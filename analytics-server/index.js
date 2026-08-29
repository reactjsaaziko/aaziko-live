'use strict';

/**
 * Aaziko Live — self-hosted analytics collector + dashboard.
 *
 *   POST /api/track   ← the browser tracker (app/components/AnalyticsTracker.js) posts
 *                       pageview / card_view / card_click events here. Public, no auth.
 *   GET  /live-stats  → password-protected HTML dashboard (visitors, per-page views,
 *                       per-live-card views & clicks, daily trend, top referrers).
 *   GET  /live-stats/api/stats?range=7d  → JSON aggregates behind the same auth.
 *   GET  /healthz     → liveness probe.
 *
 * Storage: a single local SQLite file (data/analytics.db). No external DB, no cookies,
 * no PII stored — the client IP is only kept as a daily-salted hash for bot/dedup sanity.
 *
 * Runs under PM2 on 72.61.233.113 (the same box that serves aaziko.com/live), fronted by
 * nginx: /api/track and /live-stats are proxied to this service on 127.0.0.1:3056.
 */

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const https = require('https');
const express = require('express');
const Database = require('better-sqlite3');
const nodemailer = require('nodemailer');
// Offline IP→city geolocation (bundles MaxMind GeoLite2 in the package — no external
// API call per visitor, no rate limits, no third party sees the IP). Loaded lazily
// so the collector still boots if the package is somehow absent.
let geoip = null;
try { geoip = require('geoip-lite'); } catch (_) { console.warn('[geo] geoip-lite not installed — location will be blank'); }
// Pre-rendered world-map land path (equirectangular) for the visitor map. Optional.
let WORLD_LAND = '';
try { WORLD_LAND = require('./world-path.js') || ''; } catch (_) {}

// Minimal .env loader (no dependency) — keeps dashboard credentials off git, same
// pattern as the contact-mailer. A local .env (KEY=value lines) overrides nothing
// already set in the real environment (PM2 / shell win).
(function loadEnv() {
  try {
    const file = path.join(__dirname, '.env');
    if (!fs.existsSync(file)) return;
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (!m) continue;
      const key = m[1];
      let val = m[2].trim().replace(/^["']|["']$/g, '');
      if (process.env[key] === undefined) process.env[key] = val;
    }
  } catch (_) {}
})();

const PORT = parseInt(process.env.ANALYTICS_PORT || '3056', 10);
// Dashboard credentials (override in production via env / PM2 ecosystem or .env).
const DASH_USER = process.env.ANALYTICS_USER || 'aaziko';
const DASH_PASS = process.env.ANALYTICS_PASS || 'aaziko-live-stats';
// Per-process secret salt for hashing IPs (rotated daily with the date → not reversible,
// not stable across days). Set ANALYTICS_SALT in prod so restarts stay consistent.
const SALT = process.env.ANALYTICS_SALT || 'aaziko-live-analytics-v1';

// ── Storage ─────────────────────────────────────────────────────────────────
const DATA_DIR = path.join(__dirname, 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });
const db = new Database(path.join(DATA_DIR, 'analytics.db'));
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS events (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    ts      INTEGER NOT NULL,       -- server receive time (ms epoch)
    day     TEXT    NOT NULL,       -- YYYY-MM-DD (UTC) for fast grouping
    type    TEXT    NOT NULL,       -- pageview | card_view | card_click | search | search_result
    page    TEXT    NOT NULL,       -- normalized page key e.g. "customs", "home"
    path    TEXT    NOT NULL,       -- raw pathname
    card    TEXT,                   -- live-card name (card_* / search / search_result)
    action  TEXT,                   -- action id that was clicked (card_click / search)
    q       TEXT,                   -- the actual search text the visitor entered (search / search_result)
    rc      INTEGER,                -- result count the visitor saw (search_result)
    rtext   TEXT,                   -- text summary of the results shown (search_result)
    rhtml   TEXT,                   -- styled HTML snapshot of the results (search_result)
    rimg    TEXT,                   -- pixel-perfect image (data URL) of the results (search_result)
    city    TEXT,                   -- approx city from IP (offline GeoLite2)
    region  TEXT,                   -- approx region/state code from IP
    country TEXT,                   -- ISO-3166 alpha-2 country code from IP
    lat     REAL,                   -- approx latitude (for the map/heat view)
    lon     REAL,                   -- approx longitude
    vid     TEXT,                   -- cookieless visitor id (localStorage)
    sid     TEXT,                   -- session id (sessionStorage)
    ref     TEXT,                   -- document.referrer host
    ua      TEXT,                   -- user agent (short)
    iph     TEXT                    -- daily-salted ip hash (spam/dedup only) — raw IP is never stored
  );
  CREATE INDEX IF NOT EXISTS ix_events_ts   ON events(ts);
  CREATE INDEX IF NOT EXISTS ix_events_day  ON events(day);
  CREATE INDEX IF NOT EXISTS ix_events_type ON events(type);
  CREATE INDEX IF NOT EXISTS ix_events_page ON events(page);
  CREATE INDEX IF NOT EXISTS ix_events_vid  ON events(vid);
`);
// Add newer columns to an already-existing database (no-op on a fresh table, which
// already declares them — the duplicate-column error is swallowed per column).
for (const col of [
  'q TEXT', 'rc INTEGER', 'rtext TEXT', 'rhtml TEXT', 'rimg TEXT',
  'city TEXT', 'region TEXT', 'country TEXT', 'lat REAL', 'lon REAL',
]) { try { db.exec('ALTER TABLE events ADD COLUMN ' + col); } catch (_) {} }

const insert = db.prepare(`
  INSERT INTO events (ts, day, type, page, path, card, action, q, rc, rtext, rhtml, rimg, city, region, country, lat, lon, vid, sid, ref, ua, iph)
  VALUES (@ts, @day, @type, @page, @path, @card, @action, @q, @rc, @rtext, @rhtml, @rimg, @city, @region, @country, @lat, @lon, @vid, @sid, @ref, @ua, @iph)
`);

// ── Helpers ─────────────────────────────────────────────────────────────────
const BOT_RE = /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|headless|lighthouse|pingdom|uptime|monitor|curl|wget|python-requests|axios|go-http/i;

// /live/customs/ -> "customs"; / or /live/ -> "home"; /live/trade-agreements/ -> "trade-agreements"
function pageKey(pathname) {
  let p = String(pathname || '/').split('?')[0].split('#')[0];
  p = p.replace(/^\/live(\/|$)/, '/').replace(/\/+$/, '');
  if (p === '' || p === '/') return 'home';
  const seg = p.replace(/^\/+/, '').split('/')[0];
  return seg || 'home';
}

const PAGE_LABELS = {
  home: 'Home',
  marketplace: 'Marketplace',
  'product-analysis': 'Product Analysis',
  'port-brain': 'Port Brain',
  logistics: 'Logistics',
  customs: 'Customs',
  'trade-agreements': 'Trade Agreements (FTAs)',
  inspection: 'Inspection',
  finance: 'Finance',
  'order-assurance': 'Order Assurance',
  partnership: 'Partnership',
  vision: 'Vision',
  'home-classic': 'Home (classic)',
};
const pageLabel = (k) => PAGE_LABELS[k] || k;

function utcDay(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}
function refHost(ref) {
  if (!ref) return '';
  try { return new URL(ref).hostname.replace(/^www\./, ''); } catch (_) { return ''; }
}
function ipHash(ip, day) {
  return crypto.createHash('sha256').update(SALT + '|' + day + '|' + (ip || '')).digest('hex').slice(0, 16);
}
function clip(s, n) {
  return s == null ? null : String(s).slice(0, n);
}

// Resolve an IP to a coarse { city, region, country, lat, lon } using the offline
// GeoLite2 data. Never stores the raw IP — only this derived, city-level location.
function geoLookup(ip) {
  if (!geoip || !ip) return {};
  try {
    // Strip an IPv6-mapped IPv4 prefix ("::ffff:1.2.3.4") that proxies sometimes add.
    const clean = String(ip).replace(/^::ffff:/i, '');
    const g = geoip.lookup(clean);
    if (!g) return {};
    return {
      city: g.city || null,
      region: g.region || null,
      country: g.country || null,
      lat: Array.isArray(g.ll) ? g.ll[0] : null,
      lon: Array.isArray(g.ll) ? g.ll[1] : null,
    };
  } catch (_) { return {}; }
}

// External city lookup — a fallback for when the offline GeoLite2 DB has a country but
// NO city (common for ISP/mobile IPs, e.g. Indian broadband). Server-side only, IP-only,
// cached per IP, short timeout, never blocks. Disable with GEO_CITY_FALLBACK=false.
// Privacy note: this sends the visitor's IP to ipwho.is when the offline DB lacks a city.
const GEO_CITY_FALLBACK = String(process.env.GEO_CITY_FALLBACK || 'true') === 'true';
const geoCache = new Map(); // ip -> { city, region, country, lat, lon, ts }
function isPublicIp(ip) {
  if (!ip) return false;
  const s = String(ip).replace(/^::ffff:/i, '');
  if (/^(10\.|127\.|0\.|169\.254\.|192\.168\.|::1$|fe80:|fc00:|fd)/i.test(s)) return false;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(s)) return false;
  return /\d+\.\d+\.\d+\.\d+/.test(s) || s.includes(':');
}
function fetchGeoExternal(ip) {
  return new Promise((resolve) => {
    if (!GEO_CITY_FALLBACK || !ip) return resolve(null);
    const clean = String(ip).replace(/^::ffff:/i, '');
    const cached = geoCache.get(clean);
    if (cached && Date.now() - cached.ts < 86400000) return resolve(cached.city ? cached : null);
    let done = false;
    const finish = (v) => {
      if (done) return; done = true;
      geoCache.set(clean, Object.assign({ city: null, ts: Date.now() }, v || {}, { ts: Date.now() }));
      if (geoCache.size > 8000) geoCache.clear();
      resolve(v && v.city ? v : null);
    };
    try {
      const req = https.get('https://ipwho.is/' + encodeURIComponent(clean) + '?fields=success,city,region,country_code,latitude,longitude', { timeout: 2500 }, (res) => {
        let data = '';
        res.on('data', (c) => { data += c; if (data.length > 20000) req.destroy(); });
        res.on('end', () => {
          try {
            const j = JSON.parse(data);
            if (j && j.success && j.city) finish({ city: j.city, region: j.region || null, country: j.country_code || null, lat: j.latitude != null ? Number(j.latitude) : null, lon: j.longitude != null ? Number(j.longitude) : null });
            else finish(null);
          } catch (_) { finish(null); }
        });
      });
      req.on('error', () => finish(null));
      req.on('timeout', () => { try { req.destroy(); } catch (_) {} finish(null); });
    } catch (_) { finish(null); }
  });
}

// ISO-3166 alpha-2 → English country name (e.g. "IN" → "India"), for display only.
let _countryNames = null;
function countryName(code) {
  if (!code) return '';
  try {
    if (!_countryNames) _countryNames = new Intl.DisplayNames(['en'], { type: 'region' });
    return _countryNames.of(code) || code;
  } catch (_) { return code; }
}

// ── App ─────────────────────────────────────────────────────────────────────
const app = express();
app.set('trust proxy', true);
app.use(express.json({ limit: '1mb', type: ['application/json', 'text/plain'] }));

// CORS for the collector only (prod is same-origin; localhost dev needs it).
app.use('/api/track', (req, res, next) => {
  res.set('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  res.set('Access-Control-Max-Age', '86400');
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
});

app.get('/healthz', (_req, res) => res.json({ ok: true, ts: Date.now() }));

// ── Collector ─────────────────────────────────────────────────────────────
app.post('/api/track', async (req, res) => {
  // sendBeacon Blobs may arrive as text/plain → parse defensively.
  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch (_) { b = null; } }
  if (!b || typeof b !== 'object') return res.status(204).end();

  const type = String(b.type || '');
  if (!['pageview', 'card_view', 'card_click', 'search', 'search_result'].includes(type)) return res.status(204).end();

  const ua = String(req.headers['user-agent'] || '');
  if (BOT_RE.test(ua)) return res.status(204).end(); // drop bots silently

  const now = Date.now();
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.ip || '';
  const day = utcDay(now);
  let geo = geoLookup(ip); // offline first — derived city/country only, raw IP not stored
  // If the offline DB found a country but no city, ask an external service for the city.
  if (GEO_CITY_FALLBACK && !geo.city && isPublicIp(ip)) {
    try { const ext = await fetchGeoExternal(ip); if (ext && ext.city) geo = { city: ext.city, region: ext.region || geo.region, country: ext.country || geo.country, lat: ext.lat != null ? ext.lat : geo.lat, lon: ext.lon != null ? ext.lon : geo.lon }; } catch (_) {}
  }
  let rc = null;
  if (b.rc != null && b.rc !== '') { const n = parseInt(b.rc, 10); if (Number.isFinite(n)) rc = n; }
  try {
    insert.run({
      ts: now,
      day,
      type,
      page: pageKey(b.path),
      path: clip(b.path || '/', 300),
      card: clip(b.card, 120),
      action: clip(b.action, 60),
      q: clip(b.q, 300),
      rc,
      rtext: clip(b.rtext, 20000),
      rhtml: clip(b.rhtml, 400000),
      rimg: clip(b.rimg, 400000), // no longer captured (text/HTML only); kept for the column
      city: clip(geo.city, 80),
      region: clip(geo.region, 40),
      country: clip(geo.country, 4),
      lat: geo.lat == null ? null : Number(geo.lat),
      lon: geo.lon == null ? null : Number(geo.lon),
      vid: clip(b.vid, 64),
      sid: clip(b.sid, 64),
      ref: clip(refHost(b.ref), 120),
      ua: clip(ua, 200),
      iph: ipHash(ip, day),
    });
  } catch (_) {
    /* never fail the beacon */
  }
  res.status(204).end();
});

// ── Auth (dashboard + stats API) ──────────────────────────────────────────
function auth(req, res, next) {
  const hdr = req.headers.authorization || '';
  const [scheme, val] = hdr.split(' ');
  if (scheme === 'Basic' && val) {
    const [u, p] = Buffer.from(val, 'base64').toString().split(':');
    if (u === DASH_USER && p === DASH_PASS) return next();
  }
  res.set('WWW-Authenticate', 'Basic realm="Aaziko Live Stats"');
  return res.status(401).send('Authentication required');
}

// Range → cutoff ms. "all" = 0.
function cutoff(range) {
  const now = Date.now();
  const DAY = 86400000;
  switch (range) {
    case 'today': return now - DAY;
    case '30d':   return now - 30 * DAY;
    case '90d':   return now - 90 * DAY;
    case 'all':   return 0;
    case '7d':
    default:      return now - 7 * DAY;
  }
}

// Reduce a set of event rows into the full aggregate object. Shared by the live
// dashboard (buildStats) and the daily email digest (windowSummary).
function aggregate(rows) {
  const uniqVisitors = new Set();
  const uniqSessions = new Set();
  let pageviews = 0, cardViews = 0, cardClicks = 0, searchCount = 0;
  const byPage = new Map();     // page -> { views, visitors:Set }
  const byCard = new Map();     // card -> { views, clicks, page }
  const byDay = new Map();      // day  -> { pv, vis:Set }
  const byRef = new Map();      // refHost -> count
  const searchList = [];        // one entry per captured search (for the recent-searches feed)
  const searchAgg = new Map();  // normalized query -> { q, count, sections:Set, rc, rtext }
  const byVisitor = new Map();  // vid -> { city, country, lat, lon, pageviews, searches, firstTs, lastTs, ref }
  const resultByKey = new Map();   // vid|card|lowerq -> { rc, rtext, ts } (exact match for a search row)
  const resultByQuery = new Map(); // lowerq -> { rc, rtext, ts } (fallback / for top-search rows)

  // Track a visitor's coarse location + activity across all their events.
  function touchVisitor(e) {
    if (!e.vid) return null;
    let v = byVisitor.get(e.vid);
    if (!v) { v = { vid: e.vid, city: null, region: null, country: null, lat: null, lon: null, pageviews: 0, searches: 0, firstTs: e.ts, lastTs: e.ts, ref: e.ref || '' }; byVisitor.set(e.vid, v); }
    if (e.ts < v.firstTs) v.firstTs = e.ts;
    if (e.ts > v.lastTs) v.lastTs = e.ts;
    if (e.city && !v.city) v.city = e.city;
    if (e.region && !v.region) v.region = e.region;
    if (e.country && !v.country) v.country = e.country;
    if (e.lat != null && v.lat == null) { v.lat = e.lat; v.lon = e.lon; }
    if (!v.ref && e.ref) v.ref = e.ref;
    return v;
  }

  for (const e of rows) {
    if (e.vid) uniqVisitors.add(e.vid);
    if (e.sid) uniqSessions.add(e.sid);
    const v = touchVisitor(e);

    if (e.type === 'search_result') {
      const q = String(e.q || '').trim();
      if (q) {
        const rec = { rc: e.rc == null ? null : e.rc, rtext: e.rtext || '', rhtml: e.rhtml || '', rimg: e.rimg || '', ts: e.ts };
        const nk = q.toLowerCase();
        resultByKey.set((e.vid || '') + '|' + (e.card || '') + '|' + nk, rec);
        const prev = resultByQuery.get(nk);
        if (!prev || e.ts >= prev.ts) resultByQuery.set(nk, rec);
      }
      continue;
    }

    if (e.type === 'search') {
      const q = String(e.q || '').trim();
      if (q) {
        searchCount++;
        if (v) v.searches++;
        searchList.push({
          ts: e.ts,
          q,
          card: e.card || '',
          section: e.card || pageLabel(e.page),
          page: pageLabel(e.page),
          vid: e.vid || '',
          city: e.city || '',
          country: e.country || '',
          ref: e.ref || '',
        });
        const nk = q.toLowerCase();
        const g = searchAgg.get(nk) || { q, count: 0, sections: new Set() };
        g.count++;
        if (e.card) g.sections.add(e.card);
        searchAgg.set(nk, g);
      }
      continue;
    }

    if (e.type === 'pageview') {
      if (v) v.pageviews++;
      pageviews++;
      const pg = byPage.get(e.page) || { views: 0, visitors: new Set() };
      pg.views++; if (e.vid) pg.visitors.add(e.vid);
      byPage.set(e.page, pg);

      const d = byDay.get(e.day) || { pv: 0, vis: new Set() };
      d.pv++; if (e.vid) d.vis.add(e.vid);
      byDay.set(e.day, d);

      if (e.ref) byRef.set(e.ref, (byRef.get(e.ref) || 0) + 1);
    } else if (e.type === 'card_view' || e.type === 'card_click') {
      const key = e.card || '(unknown)';
      const c = byCard.get(key) || { views: 0, clicks: 0, page: e.page };
      if (e.type === 'card_view') { c.views++; cardViews++; }
      else { c.clicks++; cardClicks++; }
      byCard.set(key, c);
    }
  }

  const pages = [...byPage.entries()]
    .map(([k, v]) => ({ key: k, label: pageLabel(k), views: v.views, visitors: v.visitors.size }))
    .sort((a, b) => b.views - a.views);

  const cards = [...byCard.entries()]
    .map(([name, v]) => ({
      name,
      page: pageLabel(v.page),
      views: v.views,
      clicks: v.clicks,
      ctr: v.views ? Math.round((v.clicks / v.views) * 100) : 0,
    }))
    .sort((a, b) => (b.views + b.clicks) - (a.views + a.clicks));

  const days = [...byDay.entries()]
    .map(([day, v]) => ({ day, pageviews: v.pv, visitors: v.vis.size }))
    .sort((a, b) => a.day.localeCompare(b.day));

  const referrers = [...byRef.entries()]
    .map(([host, count]) => ({ host, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);

  // Recent searches — the "who searched what, where, when, and what they got" feed.
  const recentSearches = searchList
    .sort((a, b) => b.ts - a.ts)
    .slice(0, 200)
    .map((s) => {
      const nk = s.q.toLowerCase();
      const r = resultByKey.get((s.vid || '') + '|' + (s.card || '') + '|' + nk) || resultByQuery.get(nk) || null;
      return {
        ts: s.ts,
        q: s.q,
        section: s.section,
        page: s.page,
        city: s.city || '',
        country: s.country || '',
        countryName: countryName(s.country),
        vid: s.vid || '',
        card: s.card || '',
        visitor: (s.vid || '').slice(0, 8),
        source: s.ref || '',
        resultCount: r && r.rc != null ? r.rc : null,
        hasResponse: !!(r && (r.rimg || r.rhtml || r.rtext)),
      };
    });

  // Top search terms — the same queries grouped and counted, with the sections used
  // and the most recently observed result count for that query.
  const topSearches = [...searchAgg.values()]
    .map((g) => {
      const r = resultByQuery.get(g.q.toLowerCase());
      return { q: g.q, count: g.count, sections: [...g.sections], resultCount: r && r.rc != null ? r.rc : null };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 50);

  // Where visitors are — one row per distinct visitor, folded into cities & countries.
  const visitorRows = [...byVisitor.values()];
  const cityMap = new Map();     // "city|country" -> { city, country, lat, lon, visitors:Set }
  const countryMap = new Map();  // country -> { country, visitors:Set }
  for (const v of visitorRows) {
    if (v.country) {
      const c = countryMap.get(v.country) || { country: v.country, visitors: new Set() };
      c.visitors.add(v.vid); countryMap.set(v.country, c);
    }
    if (v.city) {
      const k = v.city + '|' + (v.country || '');
      const c = cityMap.get(k) || { city: v.city, country: v.country || '', lat: v.lat, lon: v.lon, visitors: new Set() };
      if (c.lat == null && v.lat != null) { c.lat = v.lat; c.lon = v.lon; }
      c.visitors.add(v.vid); cityMap.set(k, c);
    }
  }
  const cities = [...cityMap.values()]
    .map((c) => ({ city: c.city, country: c.country, countryName: countryName(c.country), visitors: c.visitors.size, lat: c.lat, lon: c.lon }))
    .sort((a, b) => b.visitors - a.visitors)
    .slice(0, 60);
  const countries = [...countryMap.values()]
    .map((c) => ({ country: c.country, countryName: countryName(c.country), visitors: c.visitors.size }))
    .sort((a, b) => b.visitors - a.visitors)
    .slice(0, 40);
  const locatedVisitors = visitorRows.filter((v) => v.city || v.country).length;

  // Visitor list — feeds the per-visitor "journey" drill-down (newest activity first).
  const visitors = visitorRows
    .sort((a, b) => b.lastTs - a.lastTs)
    .slice(0, 120)
    .map((v) => ({
      vid: v.vid,
      short: (v.vid || '').slice(0, 8),
      city: v.city || '',
      country: v.country || '',
      countryName: countryName(v.country),
      pageviews: v.pageviews,
      searches: v.searches,
      firstTs: v.firstTs,
      lastTs: v.lastTs,
      source: v.ref || '',
    }));

  return {
    totals: {
      visitors: uniqVisitors.size,
      sessions: uniqSessions.size,
      located: locatedVisitors,
      countries: countryMap.size,
      pageviews,
      cardViews,
      cardClicks,
      searches: searchCount,
    },
    pages,
    cards,
    days,
    referrers,
    recentSearches,
    topSearches,
    cities,
    countries,
    visitors,
  };
}

function buildStats(range) {
  const since = cutoff(range);
  const rows = db.prepare('SELECT * FROM events WHERE ts >= ?').all(since);
  return Object.assign({ range, generatedAt: Date.now() }, aggregate(rows));
}

// Aggregate a bounded time window [from, to) — used by the daily email digest.
function windowSummary(from, to) {
  const rows = db.prepare('SELECT * FROM events WHERE ts >= ? AND ts < ?').all(from, to);
  return aggregate(rows);
}

app.get('/live-stats/api/stats', auth, (req, res) => {
  res.json(buildStats(String(req.query.range || '7d')));
});
// Also expose without the /live-stats prefix in case nginx strips it.
app.get('/api/stats', auth, (req, res) => {
  res.json(buildStats(String(req.query.range || '7d')));
});

// One visitor's full journey — their location + every page they viewed and every
// query they searched (with the result they saw), in order. Powers the drill-down.
function buildVisitor(vid, range) {
  const since = cutoff(range);
  const rows = db.prepare('SELECT * FROM events WHERE vid = ? AND ts >= ? ORDER BY ts ASC').all(vid, since);
  let city = '', region = '', country = '', source = '', firstTs = null, lastTs = null;
  const results = new Map(); // card|lowerq -> { rc, rtext }
  for (const e of rows) {
    if (e.city && !city) city = e.city;
    if (e.region && !region) region = e.region;
    if (e.country && !country) country = e.country;
    if (e.ref && !source) source = e.ref;
    if (firstTs == null) firstTs = e.ts;
    lastTs = e.ts;
    if (e.type === 'search_result' && e.q) {
      results.set((e.card || '') + '|' + String(e.q).toLowerCase(), { rc: e.rc, rtext: e.rtext || '', rhtml: e.rhtml || '', rimg: e.rimg || '' });
    }
  }
  const timeline = [];
  for (const e of rows) {
    if (e.type === 'pageview') {
      timeline.push({ ts: e.ts, type: 'pageview', page: pageLabel(e.page), path: e.path });
    } else if (e.type === 'search' && e.q) {
      const r = results.get((e.card || '') + '|' + String(e.q).toLowerCase());
      timeline.push({
        ts: e.ts, type: 'search', page: pageLabel(e.page), section: e.card || pageLabel(e.page), q: e.q,
        resultCount: r && r.rc != null ? r.rc : null, hasResponse: !!(r && (r.rimg || r.rhtml || r.rtext)),
      });
    }
  }
  return {
    vid, short: (vid || '').slice(0, 8),
    city, region, country, countryName: countryName(country),
    source, firstTs, lastTs,
    pageviews: timeline.filter((t) => t.type === 'pageview').length,
    searches: timeline.filter((t) => t.type === 'search').length,
    timeline,
  };
}
app.get(['/live-stats/api/visitor', '/api/visitor'], auth, (req, res) => {
  const vid = String(req.query.vid || '').slice(0, 64);
  if (!vid) return res.status(400).json({ error: 'vid required' });
  res.json(buildVisitor(vid, String(req.query.range || 'all')));
});

// The full response (styled HTML + text) a visitor saw for one search — fetched
// on demand when the popup opens, so the big HTML never rides in the list payloads.
app.get(['/live-stats/api/response', '/api/response'], auth, (req, res) => {
  const vid = String(req.query.vid || '').slice(0, 64);
  const card = String(req.query.card || '').slice(0, 120);
  const q = String(req.query.q || '').slice(0, 300);
  const since = cutoff(String(req.query.range || 'all'));
  let row = null;
  // Return the fullest capture for this search (longest HTML, newest first) so the popup
  // can show it with the live-card design; resultText is the fallback.
  if (vid && card) row = db.prepare("SELECT rc,rtext,rhtml,card,q FROM events WHERE type='search_result' AND vid=? AND card=? AND q=? AND ts>=? ORDER BY length(rhtml) DESC, ts DESC LIMIT 1").get(vid, card, q, since);
  if (!row && card) row = db.prepare("SELECT rc,rtext,rhtml,card,q FROM events WHERE type='search_result' AND card=? AND q=? AND ts>=? ORDER BY length(rhtml) DESC, ts DESC LIMIT 1").get(card, q, since);
  if (!row) return res.status(404).json({ error: 'not found' });
  res.json({ section: row.card, q: row.q, resultCount: row.rc, resultText: row.rtext || '', resultHtml: row.rhtml || '' });
});

// Full data export — every recorded action (one row per event), so you can see all
// visitor detail (who, where, which page, which search, what result) in Excel.
function csvCell(v) {
  if (v == null) return '';
  const s = String(v).replace(/"/g, '""').replace(/[\r\n]+/g, ' ');
  return /[",]/.test(s) ? '"' + s + '"' : s;
}
function istTime(ms) {
  return new Date(ms + 330 * 60000).toISOString().replace('T', ' ').slice(0, 19); // IST, no ms
}
app.get(['/live-stats/export.csv', '/export.csv'], auth, (req, res) => {
  const since = cutoff(String(req.query.range || 'all'));
  const rows = db.prepare('SELECT * FROM events WHERE ts >= ? ORDER BY ts DESC').all(since);
  const cols = [
    ['time_ist', (e) => istTime(e.ts)],
    ['visitor', (e) => (e.vid || '').slice(0, 12)],
    ['session', (e) => (e.sid || '').slice(0, 12)],
    ['type', (e) => e.type],
    ['page', (e) => pageLabel(e.page)],
    ['path', (e) => e.path],
    ['section', (e) => e.card || ''],
    ['query', (e) => e.q || ''],
    ['result_count', (e) => (e.rc == null ? '' : e.rc)],
    ['result_summary', (e) => e.rtext || ''],
    ['city', (e) => e.city || ''],
    ['region', (e) => e.region || ''],
    ['country', (e) => e.country || ''],
    ['country_name', (e) => countryName(e.country)],
    ['source', (e) => e.ref || ''],
    ['browser', (e) => e.ua || ''],
  ];
  let csv = '﻿' + cols.map((c) => c[0]).join(',') + '\r\n'; // BOM so Excel reads UTF-8
  for (const e of rows) csv += cols.map((c) => csvCell(c[1](e))).join(',') + '\r\n';
  const stamp = istTime(Date.now()).slice(0, 10);
  res.set('Content-Type', 'text/csv; charset=utf-8');
  res.set('Content-Disposition', `attachment; filename="aaziko-live-visitors-${stamp}.csv"`);
  res.send(csv);
});

// ── Dashboard ─────────────────────────────────────────────────────────────
app.get(['/live-stats', '/live-stats/', '/'], auth, (_req, res) => {
  res.set('Content-Type', 'text/html; charset=utf-8').send(DASHBOARD_HTML);
});

const DASHBOARD_HTML = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Aaziko Live · Analytics</title>
<style>
  :root{--ink:#132a22;--emerald:#1E5B47;--saffron:#C4751F;--cream:#F5EFE2;--card:#fff;--line:#e6e0d2;--mute:#6b7a72}
  *{box-sizing:border-box}
  body{margin:0;font:15px/1.5 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:var(--ink);background:#faf7ef}
  header{background:var(--emerald);color:#fff;padding:18px 22px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px}
  header h1{font-size:18px;margin:0;font-weight:700;letter-spacing:.2px}
  header .sub{font-size:12px;opacity:.8}
  .wrap{max-width:1100px;margin:0 auto;padding:22px}
  .ranges{display:flex;gap:6px;flex-wrap:wrap}
  .ranges button{border:1px solid rgba(255,255,255,.35);background:transparent;color:#fff;padding:6px 12px;border-radius:999px;cursor:pointer;font-size:13px}
  .ranges button.on{background:#fff;color:var(--emerald);font-weight:700}
  .ranges a.dl{border:1px solid rgba(255,255,255,.55);background:var(--saffron);color:#fff;padding:6px 12px;border-radius:999px;font-size:13px;text-decoration:none;font-weight:700;white-space:nowrap}
  .ranges a.dl:hover{filter:brightness(1.06)}
  .cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:14px;margin:0 0 22px}
  .kpi{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px 18px}
  .kpi .n{font-size:30px;font-weight:800;color:var(--emerald);line-height:1}
  .kpi .l{font-size:12px;color:var(--mute);margin-top:6px;text-transform:uppercase;letter-spacing:.4px}
  section{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:18px;margin-bottom:20px}
  section h2{font-size:14px;margin:0 0 14px;text-transform:uppercase;letter-spacing:.5px;color:var(--mute)}
  table{width:100%;border-collapse:collapse;font-size:14px}
  th,td{text-align:left;padding:9px 8px;border-bottom:1px solid #f0ebdd}
  th{font-size:11px;text-transform:uppercase;letter-spacing:.4px;color:var(--mute);font-weight:600}
  td.num,th.num{text-align:right;font-variant-numeric:tabular-nums}
  .bar{height:8px;background:#eee6d4;border-radius:6px;overflow:hidden}
  .bar > i{display:block;height:100%;background:var(--emerald)}
  .bar.s > i{background:var(--saffron)}
  .chart{display:flex;align-items:flex-end;gap:4px;height:120px;padding-top:8px}
  .chart .col{flex:1;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:4px;min-width:0}
  .chart .col .b{width:70%;background:var(--emerald);border-radius:4px 4px 0 0;min-height:2px}
  .chart .col small{font-size:9px;color:var(--mute);white-space:nowrap;transform:rotate(-45deg);transform-origin:top left;margin-top:6px}
  .muted{color:var(--mute);font-size:13px}
  .mono{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px;color:var(--mute)}
  .q{font-weight:600;color:var(--ink)}
  .scroll{max-height:460px;overflow:auto}
  .pill{display:inline-block;font-size:11px;background:#eef4f0;color:var(--emerald);padding:2px 8px;border-radius:999px}
  .chip{display:inline-block;font-size:11px;background:#fbf1e2;color:var(--saffron);padding:2px 8px;border-radius:999px;font-weight:600}
  .rc{display:inline-block;font-size:11px;background:#eef4f0;color:var(--emerald);padding:1px 7px;border-radius:999px;font-variant-numeric:tabular-nums}
  .grid2{display:grid;grid-template-columns:1fr 1fr;gap:18px}
  @media(max-width:720px){.grid2{grid-template-columns:1fr}}
  .map{width:100%;background:#f3efe4;border:1px solid var(--line);border-radius:12px;display:block}
  tr.click{cursor:pointer}
  tr.click:hover{background:#f7fbf9}
  .tl{border-left:2px solid #e6e0d2;margin:6px 0 6px 6px;padding:0 0 0 14px}
  .tl .ev{position:relative;padding:7px 0}
  .tl .ev:before{content:"";position:absolute;left:-19px;top:12px;width:8px;height:8px;border-radius:50%;background:var(--emerald)}
  .tl .ev.s:before{background:var(--saffron)}
  .tl .ev .tt{font-size:11px;color:var(--mute)}
  .journeycard{background:#fbfaf5;border:1px solid var(--line);border-radius:12px;padding:14px 16px;margin-top:12px}
  /* polish */
  body{background:#f2f5f2}
  header{box-shadow:0 2px 14px rgba(19,42,34,.12)}
  section{box-shadow:0 2px 12px rgba(19,42,34,.05);border-radius:16px;padding:20px 22px}
  section h2{display:flex;align-items:center;gap:9px;padding-bottom:12px;border-bottom:1px solid #f1ecdf}
  section h2:before{content:"";width:3px;height:14px;background:var(--saffron);border-radius:2px;display:inline-block;flex:none}
  .kpi{box-shadow:0 2px 12px rgba(19,42,34,.05);transition:transform .12s ease,box-shadow .12s ease;border-radius:16px}
  .kpi:hover{transform:translateY(-2px);box-shadow:0 6px 18px rgba(19,42,34,.09)}
  thead th{background:#faf7ee;border-bottom:1px solid #ece4d3}
  tbody tr:nth-child(even){background:#fcfaf4}
  tbody tr:hover{background:#f1f8f4}
  td,th{padding:10px 10px}
  .rshow{cursor:pointer}
  .rshow:hover{filter:brightness(.96);text-decoration:underline}
  /* full-response modal */
  .modal{display:none;position:fixed;inset:0;background:rgba(19,42,34,.55);z-index:50;align-items:center;justify-content:center;padding:20px}
  .modal.show{display:flex}
  .mcard{background:#fff;border-radius:16px;max-width:900px;width:100%;max-height:85vh;display:flex;flex-direction:column;box-shadow:0 24px 70px rgba(0,0,0,.3);overflow:hidden}
  .respframe{width:100%;height:200px;border:0;background:#fff;display:block}
  .mhead{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;padding:16px 18px;border-bottom:1px solid var(--line)}
  .mtitle{font-size:15px;line-height:1.5}
  .mx{border:0;background:transparent;font-size:26px;line-height:1;cursor:pointer;color:var(--mute);padding:0 2px}
  .mbody{margin:0;padding:16px 18px;overflow:auto;flex:1 1 auto;min-height:0;white-space:pre-wrap;word-break:break-word;font:13px/1.6 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:var(--ink)}
  .mfoot{padding:10px 18px;border-top:1px solid var(--line)}
  @media(max-width:560px){.chart .col small{display:none}}
</style></head><body>
<header>
  <div><h1>Aaziko Live · Visitor Analytics</h1><div class="sub" id="meta">loading…</div></div>
  <div class="ranges" id="ranges">
    <button data-r="today">Today</button>
    <button data-r="7d" class="on">7 days</button>
    <button data-r="30d">30 days</button>
    <button data-r="90d">90 days</button>
    <button data-r="all">All</button>
    <a id="dl" class="dl" href="live-stats/export.csv?range=7d" title="Download every visitor's full detail (pages + searches) as CSV">&#8681; Download all data</a>
  </div>
</header>
<div class="wrap">
  <div class="cards" id="kpis"></div>
  <section><h2>Visitors over time</h2><div class="chart" id="chart"></div></section>
  <section><h2>Which page people visit</h2><div id="pages"></div></section>
  <section><h2>Which live card people see &amp; use</h2><div id="cards"></div></section>
  <section><h2>Recent searches &middot; who searched what, where &amp; what they got</h2><div id="recent" class="scroll"></div></section>
  <section><h2>Top search terms</h2><div id="searches"></div></section>
  <section><h2>Where visitors are &middot; approx. city &amp; country from IP</h2>
    <div id="map"></div>
    <div class="grid2"><div id="cities"></div><div id="countries"></div></div>
  </section>
  <section><h2>Visitors &middot; click one to see their journey</h2>
    <div id="journey"></div>
    <div id="visitors" class="scroll"></div>
  </section>
  <section><h2>Where visitors come from</h2><div id="refs"></div></section>
</div>
<div id="modal" class="modal"><div class="mcard">
  <div class="mhead"><div class="mtitle"></div><button class="mx" id="mclose" aria-label="Close">&times;</button></div>
  <pre class="mbody"></pre>
  <div class="mfoot muted" style="font-size:11px">The full response the visitor saw for this search, captured as visible text.</div>
</div></div>
<script>
var WORLD_LAND=${JSON.stringify(WORLD_LAND)};
var range='7d';
function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
function num(n){return (n||0).toLocaleString()}
function when(ts){var d=new Date(ts);return d.toLocaleDateString(undefined,{day:'numeric',month:'short'})+' '+d.toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit'})}
function cc(code){return code?String(code).toUpperCase():''}
function loc(s){
  if(s.city&&s.country) return '<span class="chip">'+esc(s.city)+'</span> <span class="muted">'+esc(cc(s.country))+'</span>';
  if(s.city) return '<span class="chip">'+esc(s.city)+'</span>';
  if(s.countryName||s.country) return '<span class="muted">'+esc(s.countryName||cc(s.country))+'</span>';
  return '<span class="muted">—</span>';
}
function locText(o){ if(o.city&&(o.countryName||o.country)) return o.city+', '+(o.countryName||cc(o.country)); return o.city||o.countryName||cc(o.country)||'Unknown'; }
// A result chip; clicking it fetches and shows the full response the visitor saw.
function respChip(o){
  if(o.count==null && !o.has) return '<span class="muted">—</span>';
  var lbl=o.count!=null?(num(o.count)+' results'):'view';
  if(!o.has) return '<span class="rc">'+lbl+'</span>';
  var p=encodeURIComponent(JSON.stringify({vid:o.vid||'',card:o.card||'',q:o.q||''}));
  return '<span class="rc rshow" data-p="'+p+'" title="Click to see the full response">'+lbl+' &#9432;</span>';
}
function result(s){return respChip({vid:s.vid,card:s.card,q:s.q,count:s.resultCount,has:s.hasResponse});}
function loadResp(k){
  var m=document.getElementById('modal');
  m.querySelector('.mtitle').innerHTML='<span class="pill">'+esc(k.card||'')+'</span> <span class="q">'+esc(k.q||'')+'</span>';
  m.querySelector('.mbody').textContent='Loading response…';
  m.classList.add('show');
  fetch('live-stats/api/response?vid='+encodeURIComponent(k.vid||'')+'&card='+encodeURIComponent(k.card||'')+'&q='+encodeURIComponent(k.q||'')+'&range='+range,{credentials:'same-origin'})
    .then(function(r){if(!r.ok)throw new Error(r.status);return r.json()})
    .then(renderResp)
    .catch(function(e){m.querySelector('.mbody').textContent='Could not load response ('+e.message+')';});
}
function renderResp(o){
  var m=document.getElementById('modal');
  m.querySelector('.mtitle').innerHTML='<span class="pill">'+esc(o.section||'')+'</span> <span class="q">'+esc(o.q||'')+'</span>'+(o.resultCount!=null?' <span class="rc">'+num(o.resultCount)+' results</span>':'');
  var body=m.querySelector('.mbody');
  if(o.resultHtml){
    // Render the captured HTML so the response shows with the SAME design as the live
    // card. Sandboxed frame = no scripts run. Manrope loaded to match; opacity forced to
    // 1 (live card fades sections in). Scaled with CSS zoom to fit the popup, crisply.
    var head='<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap">'+
      '<style>#__s *{opacity:1!important}</style>';
    var inner='<div id="__s" style="display:inline-block;padding:14px;box-sizing:border-box;vertical-align:top;font-family:Manrope,-apple-system,Segoe UI,Roboto,Arial,sans-serif">'+o.resultHtml+'</div>';
    var doc=head+'<body style="margin:0;background:#fff;overflow:hidden">'+inner+'</body>';
    body.innerHTML='<iframe sandbox="allow-same-origin" class="respframe" srcdoc="'+doc.replace(/&/g,'&amp;').replace(/"/g,'&quot;')+'"></iframe>';
    var f=body.querySelector('iframe');
    f.onload=function(){
      try{
        var d=f.contentDocument, s=d.getElementById('__s');
        var natW=Math.max(s.offsetWidth, s.scrollWidth);
        var frameW=f.clientWidth||820;
        var scale=(natW>frameW && natW>0)?(frameW/natW):1;
        var natH=Math.max(s.offsetHeight, s.scrollHeight);
        if(scale<1){ if('zoom' in s.style){ s.style.zoom=scale; } else { s.style.transformOrigin='top left'; s.style.transform='scale('+scale+')'; } }
        // Size the iframe to the FULL scaled content height (no cap) so the whole response
        // is reachable — the modal body (.mbody overflow:auto, capped by .mcard max-height)
        // scrolls it. Capping the iframe here would clip the lower sections (was the bug).
        f.style.height=(Math.ceil(natH*scale)+8)+'px';
      }catch(_){ f.style.height='60vh'; }
    };
  } else {
    body.textContent=o.resultText||'(no response text captured)';
  }
}
function closeResp(){document.getElementById('modal').classList.remove('show');}
document.addEventListener('click',function(e){
  var el=e.target.closest&&e.target.closest('.rshow');
  if(el){try{loadResp(JSON.parse(decodeURIComponent(el.getAttribute('data-p'))))}catch(_){ } return;}
  if(e.target.id==='modal'||e.target.id==='mclose') closeResp();
});
document.addEventListener('keydown',function(e){if(e.key==='Escape')closeResp();});
function renderGeo(d){
  var cities=d.cities||[], countries=d.countries||[];
  // Real equirectangular world map (inline SVG land path, no external tiles) with a
  // dot per city, positioned by lat/lon and sized by visitor count.
  var pts=cities.filter(function(c){return c.lat!=null&&c.lon!=null;});
  var mx=Math.max.apply(null,pts.map(function(p){return p.visitors}).concat([1]));
  var land=WORLD_LAND?'<path d="'+WORLD_LAND+'" fill="#d6e2db" stroke="#bfcec5" stroke-width="0.4"/>':'';
  // A proper location PIN per city (tip points at the exact lat/lon), sized gently by visitors.
  var dots=pts.map(function(p){
    var x=(p.lon+180)*2, y=(90-p.lat)*2;
    var sc=0.55+Math.sqrt(p.visitors/mx)*0.45; // ~0.55–1.0
    var tx=(x-12*sc).toFixed(2), ty=(y-23*sc).toFixed(2);
    return '<g transform="translate('+tx+','+ty+') scale('+sc.toFixed(3)+')">'+
      '<path d="M12 23C12 23 5 14.5 5 9a7 7 0 0 1 14 0c0 5.5-7 14-7 14z" fill="#C4751F" stroke="#fff" stroke-width="1.3"/>'+
      '<circle cx="12" cy="9" r="2.6" fill="#fff"/>'+
      '<title>'+esc(locText(p))+' · '+p.visitors+' visitor(s)</title></g>';
  }).join('');
  document.getElementById('map').innerHTML=
    '<svg class="map" viewBox="0 0 720 360" preserveAspectRatio="xMidYMid meet"><rect x="0" y="0" width="720" height="360" fill="#eef3f1"/>'+land+dots+'</svg>'+
    '<div class="muted" style="font-size:11px;margin:8px 2px 2px">'+(pts.length?('Showing '+pts.length+' location'+(pts.length>1?'s':'')+' · '):'No located visitors yet · ')+'approximate city-level IP geolocation (offline GeoLite2). Dot size = visitors.</div>';
  var cmx=Math.max.apply(null,cities.map(function(c){return c.visitors}).concat([1]));
  document.getElementById('cities').innerHTML='<h3 style="font-size:12px;color:var(--mute);margin:4px 0 8px;text-transform:uppercase;letter-spacing:.4px">Top cities</h3>'+
    (cities.length? '<table><thead><tr><th>City</th><th>Country</th><th class="num">Visitors</th><th style="width:28%">&nbsp;</th></tr></thead><tbody>'+
    cities.map(function(c){return '<tr><td>'+esc(c.city||'—')+'</td><td class="muted">'+esc(c.countryName||cc(c.country))+'</td><td class="num">'+num(c.visitors)+'</td><td><div class="bar s"><i style="width:'+Math.round(c.visitors/cmx*100)+'%"></i></div></td></tr>'}).join('')+
    '</tbody></table>' : '<span class="muted">No city data yet.</span>');
  var ntmx=Math.max.apply(null,countries.map(function(c){return c.visitors}).concat([1]));
  document.getElementById('countries').innerHTML='<h3 style="font-size:12px;color:var(--mute);margin:4px 0 8px;text-transform:uppercase;letter-spacing:.4px">Top countries</h3>'+
    (countries.length? '<table><thead><tr><th>Country</th><th class="num">Visitors</th><th style="width:35%">&nbsp;</th></tr></thead><tbody>'+
    countries.map(function(c){return '<tr><td>'+esc(c.countryName||cc(c.country))+' <span class="muted mono">'+esc(cc(c.country))+'</span></td><td class="num">'+num(c.visitors)+'</td><td><div class="bar"><i style="width:'+Math.round(c.visitors/ntmx*100)+'%"></i></div></td></tr>'}).join('')+
    '</tbody></table>' : '<span class="muted">No country data yet.</span>');
}
function renderVisitors(d){
  var vs=d.visitors||[];
  document.getElementById('visitors').innerHTML = vs.length? '<table><thead><tr><th>Visitor</th><th>City</th><th class="num">Pages</th><th class="num">Searches</th><th>Last seen</th><th>Source</th></tr></thead><tbody>'+
    vs.map(function(v){return '<tr class="click" data-vid="'+esc(v.vid)+'"><td class="mono">'+esc(v.short)+'</td><td>'+loc(v)+'</td><td class="num">'+num(v.pageviews)+'</td><td class="num">'+num(v.searches)+'</td><td class="muted" style="white-space:nowrap">'+esc(when(v.lastTs))+'</td><td>'+esc(v.source||'direct')+'</td></tr>'}).join('')+
    '</tbody></table><div class="muted" style="font-size:11px;margin-top:6px">Click any visitor to see their full journey.</div>' : '<span class="muted">No visitors yet.</span>';
  var tb=document.getElementById('visitors');
  tb.querySelectorAll('tr.click').forEach(function(tr){tr.addEventListener('click',function(){loadVisitor(tr.getAttribute('data-vid'))})});
}
function loadVisitor(vid){
  var box=document.getElementById('journey');
  box.innerHTML='<div class="journeycard muted">Loading journey…</div>';
  fetch('live-stats/api/visitor?vid='+encodeURIComponent(vid)+'&range='+range,{credentials:'same-origin'})
    .then(function(r){return r.json()}).then(function(v){
      var head='<div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;align-items:baseline"><div><b class="mono">'+esc(v.short)+'</b> &middot; <span class="chip">'+esc(locText(v))+'</span></div>'+
        '<div class="muted" style="font-size:12px">'+num(v.pageviews)+' pages &middot; '+num(v.searches)+' searches &middot; '+esc(v.source||'direct')+'</div></div>';
      var tl=(v.timeline||[]).map(function(e){
        if(e.type==='pageview') return '<div class="ev"><div>Viewed <b>'+esc(e.page)+'</b></div><div class="tt">'+esc(when(e.ts))+'</div></div>';
        var r=' '+respChip({vid:v.vid,card:e.section,q:e.q,count:e.resultCount,has:e.hasResponse});
        return '<div class="ev s"><div>Searched <span class="pill">'+esc(e.section)+'</span> <span class="q">'+esc(e.q)+'</span>'+r+'</div><div class="tt">'+esc(when(e.ts))+'</div></div>';
      }).join('') || '<div class="muted">No page/search events in this range.</div>';
      box.innerHTML='<div class="journeycard">'+head+'<div class="tl">'+tl+'</div><div style="margin-top:8px"><a href="#" id="jclose" class="muted" style="font-size:12px">Close</a></div></div>';
      var c=document.getElementById('jclose'); if(c) c.addEventListener('click',function(ev){ev.preventDefault();box.innerHTML=''});
    }).catch(function(e){box.innerHTML='<div class="journeycard muted">Could not load journey ('+e.message+')</div>'});
}
function load(){
  fetch('live-stats/api/stats?range='+range,{credentials:'same-origin'})
    .then(function(r){if(!r.ok)throw new Error(r.status);return r.json()})
    .then(render).catch(function(e){document.getElementById('meta').textContent='Error loading stats ('+e.message+')'});
}
function render(d){
  var t=d.totals;
  document.getElementById('meta').textContent='Updated '+new Date(d.generatedAt).toLocaleString()+' · range: '+d.range;
  document.getElementById('kpis').innerHTML=[
    ['Unique visitors',t.visitors],['Countries',t.countries],['Page views',t.pageviews],
    ['Live-card views',t.cardViews],['Searches',t.searches]
  ].map(function(k){return '<div class="kpi"><div class="n">'+num(k[1])+'</div><div class="l">'+k[0]+'</div></div>'}).join('');

  // trend chart
  var days=d.days, max=Math.max(1,Math.max.apply(null,days.map(function(x){return x.pageviews})));
  document.getElementById('chart').innerHTML = days.length? days.map(function(x){
    var h=Math.round(x.pageviews/max*100);
    return '<div class="col" title="'+x.day+': '+x.pageviews+' views, '+x.visitors+' visitors"><div class="b" style="height:'+h+'%"></div><small>'+x.day.slice(5)+'</small></div>';
  }).join('') : '<span class="muted">No data yet.</span>';

  // pages
  var pmax=Math.max(1,Math.max.apply(null,d.pages.map(function(x){return x.views}).concat([1])));
  document.getElementById('pages').innerHTML = d.pages.length? '<table><thead><tr><th>Page</th><th class="num">Views</th><th class="num">Visitors</th><th style="width:35%">Share</th></tr></thead><tbody>'+
    d.pages.map(function(p){return '<tr><td>'+esc(p.label)+'</td><td class="num">'+num(p.views)+'</td><td class="num">'+num(p.visitors)+'</td><td><div class="bar"><i style="width:'+Math.round(p.views/pmax*100)+'%"></i></div></td></tr>'}).join('')+
    '</tbody></table>' : '<span class="muted">No page views yet.</span>';

  // cards
  var cmax=Math.max(1,Math.max.apply(null,d.cards.map(function(x){return x.views}).concat([1])));
  document.getElementById('cards').innerHTML = d.cards.length? '<table><thead><tr><th>Live card</th><th>Page</th><th class="num">Seen</th><th class="num">Used</th><th class="num">Use&nbsp;rate</th><th style="width:25%">Seen</th></tr></thead><tbody>'+
    d.cards.map(function(c){return '<tr><td>'+esc(c.name)+'</td><td><span class="pill">'+esc(c.page)+'</span></td><td class="num">'+num(c.views)+'</td><td class="num">'+num(c.clicks)+'</td><td class="num">'+c.ctr+'%</td><td><div class="bar s"><i style="width:'+Math.round(c.views/cmax*100)+'%"></i></div></td></tr>'}).join('')+
    '</tbody></table>' : '<span class="muted">No live-card activity yet.</span>';

  // recent searches — who searched what, in which section, from which city, + result
  var rs=d.recentSearches||[];
  document.getElementById('recent').innerHTML = rs.length? '<table><thead><tr><th>When</th><th>City</th><th>Section</th><th>Search query</th><th>Result</th><th>Visitor</th><th>Source</th></tr></thead><tbody>'+
    rs.map(function(s){return '<tr><td class="muted" style="white-space:nowrap">'+esc(when(s.ts))+'</td><td>'+loc(s)+'</td><td><span class="pill">'+esc(s.section||s.page)+'</span></td><td class="q">'+esc(s.q)+'</td><td>'+result(s)+'</td><td class="mono">'+esc(s.visitor||'anon')+'</td><td>'+esc(s.source||'direct')+'</td></tr>'}).join('')+
    '</tbody></table>' : '<span class="muted">No searches captured yet. As soon as visitors search a live card, their queries appear here.</span>';

  // top search terms
  var ts2=d.topSearches||[];
  document.getElementById('searches').innerHTML = ts2.length? '<table><thead><tr><th>Search query</th><th>Section(s)</th><th class="num">Result</th><th class="num">Times</th></tr></thead><tbody>'+
    ts2.map(function(s){return '<tr><td class="q">'+esc(s.q)+'</td><td class="muted">'+esc((s.sections||[]).join(', '))+'</td><td class="num">'+(s.resultCount!=null?'<span class="rc">'+num(s.resultCount)+'</span>':'<span class="muted">—</span>')+'</td><td class="num">'+num(s.count)+'</td></tr>'}).join('')+
    '</tbody></table>' : '<span class="muted">No searches captured yet.</span>';

  // where visitors are — scatter map + cities + countries
  renderGeo(d);
  // visitor list (journey drill-down)
  renderVisitors(d);

  // referrers
  document.getElementById('refs').innerHTML = d.referrers.length? '<table><thead><tr><th>Source</th><th class="num">Visits</th></tr></thead><tbody>'+
    d.referrers.map(function(r){return '<tr><td>'+esc(r.host)+'</td><td class="num">'+num(r.count)+'</td></tr>'}).join('')+'</tbody></table>' : '<span class="muted">Mostly direct traffic (no referrer).</span>';
}
function syncDl(){var a=document.getElementById('dl');if(a)a.href='live-stats/export.csv?range='+range;}
document.getElementById('ranges').addEventListener('click',function(e){
  var b=e.target.closest('button'); if(!b)return;
  range=b.getAttribute('data-r');
  [].forEach.call(this.querySelectorAll('button'),function(x){x.classList.toggle('on',x===b)});
  syncDl();
  load();
});
syncDl();
load();
setInterval(load, 60000);
</script>
</body></html>`;

// ── Daily email digest ─────────────────────────────────────────────────────
// A once-a-day "Aaziko Live — Daily Review" email (yesterday's numbers + 7-day
// context) to ceoaaziko@gmail.com, sent via the same SMTP account the contact
// form uses. All config is env-driven (.env on the server).
const DIGEST_ENABLED = String(process.env.DIGEST_ENABLED || 'true') === 'true';
const DIGEST_TO = process.env.DIGEST_TO || 'ceoaaziko@gmail.com';
const DIGEST_HOUR = parseInt(process.env.DIGEST_HOUR || '8', 10);   // local hour (see offset)
const TZ_OFFSET_MIN = parseInt(process.env.DIGEST_TZ_OFFSET_MIN || '330', 10); // 330 = IST
const SITE_URL = process.env.SITE_URL || 'https://aaziko.com';

function startOfLocalDay(ms) {
  const d = new Date(ms + TZ_OFFSET_MIN * 60000);
  const utcMidnight = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return utcMidnight - TZ_OFFSET_MIN * 60000; // epoch ms of local midnight
}
function localDateLabel(ms) {
  const d = new Date(ms + TZ_OFFSET_MIN * 60000);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}
function pct(cur, prev) {
  if (!prev) return cur ? '+100%' : '—';
  const p = Math.round(((cur - prev) / prev) * 100);
  return (p >= 0 ? '+' : '') + p + '%';
}

function buildDigest() {
  const now = Date.now();
  const todayStart = startOfLocalDay(now);
  const yStart = todayStart - 86400000;                 // yesterday 00:00 local
  const dbStart = yStart - 86400000;                    // day-before 00:00 local
  const wk = windowSummary(now - 7 * 86400000, now);    // 7-day context
  const y = windowSummary(yStart, todayStart);          // yesterday
  const d0 = windowSummary(dbStart, yStart);            // day before (for trend)

  const label = localDateLabel(yStart);
  const kpi = (n, l, change) =>
    `<td style="padding:12px 10px;text-align:center;border:1px solid #e6e0d2;border-radius:10px">
       <div style="font-size:26px;font-weight:800;color:#1E5B47;line-height:1">${(n || 0).toLocaleString()}</div>
       <div style="font-size:11px;color:#6b7a72;text-transform:uppercase;letter-spacing:.4px;margin-top:4px">${l}</div>
       ${change ? `<div style="font-size:11px;color:#6b7a72;margin-top:2px">${change} vs prev day</div>` : ''}
     </td>`;

  const pageRows = wk.pages.slice(0, 8).map(p =>
    `<tr><td style="padding:7px 8px;border-bottom:1px solid #f0ebdd">${p.label}</td>
     <td style="padding:7px 8px;border-bottom:1px solid #f0ebdd;text-align:right">${p.views.toLocaleString()}</td>
     <td style="padding:7px 8px;border-bottom:1px solid #f0ebdd;text-align:right">${p.visitors.toLocaleString()}</td></tr>`).join('') ||
    '<tr><td colspan="3" style="padding:10px;color:#6b7a72">No page views yet.</td></tr>';

  const cardRows = wk.cards.slice(0, 10).map(c =>
    `<tr><td style="padding:7px 8px;border-bottom:1px solid #f0ebdd">${c.name}</td>
     <td style="padding:7px 8px;border-bottom:1px solid #f0ebdd;text-align:right">${c.views.toLocaleString()}</td>
     <td style="padding:7px 8px;border-bottom:1px solid #f0ebdd;text-align:right">${c.clicks.toLocaleString()}</td>
     <td style="padding:7px 8px;border-bottom:1px solid #f0ebdd;text-align:right">${c.ctr}%</td></tr>`).join('') ||
    '<tr><td colspan="4" style="padding:10px;color:#6b7a72">No live-card activity yet.</td></tr>';

  const searchRows = (wk.topSearches || []).slice(0, 12).map(s =>
    `<tr><td style="padding:7px 8px;border-bottom:1px solid #f0ebdd">${s.q}</td>
     <td style="padding:7px 8px;border-bottom:1px solid #f0ebdd;color:#6b7a72">${(s.sections || []).join(', ')}</td>
     <td style="padding:7px 8px;border-bottom:1px solid #f0ebdd;text-align:right">${s.count.toLocaleString()}</td></tr>`).join('') ||
    '<tr><td colspan="3" style="padding:10px;color:#6b7a72">No searches captured yet.</td></tr>';

  const cityRows = (wk.cities || []).slice(0, 8).map(c =>
    `<tr><td style="padding:7px 8px;border-bottom:1px solid #f0ebdd">${c.city || '—'}</td>
     <td style="padding:7px 8px;border-bottom:1px solid #f0ebdd;color:#6b7a72">${c.countryName || c.country || ''}</td>
     <td style="padding:7px 8px;border-bottom:1px solid #f0ebdd;text-align:right">${c.visitors.toLocaleString()}</td></tr>`).join('') ||
    '<tr><td colspan="3" style="padding:10px;color:#6b7a72">No located visitors yet.</td></tr>';

  const refRows = wk.referrers.slice(0, 6).map(r =>
    `<tr><td style="padding:6px 8px;border-bottom:1px solid #f0ebdd">${r.host}</td>
     <td style="padding:6px 8px;border-bottom:1px solid #f0ebdd;text-align:right">${r.count.toLocaleString()}</td></tr>`).join('') ||
    '<tr><td colspan="2" style="padding:10px;color:#6b7a72">Mostly direct traffic.</td></tr>';

  const html = `<!doctype html><html><body style="margin:0;background:#faf7ef;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#132a22">
  <div style="max-width:640px;margin:0 auto;padding:22px">
    <div style="background:#1E5B47;color:#fff;padding:18px 22px;border-radius:14px 14px 0 0">
      <div style="font-size:18px;font-weight:800">Aaziko Live — Daily Review</div>
      <div style="font-size:13px;opacity:.85">${label} · aaziko.com/live</div>
    </div>
    <div style="background:#fff;border:1px solid #e6e0d2;border-top:0;padding:20px;border-radius:0 0 14px 14px">
      <table width="100%" cellspacing="8" cellpadding="0" style="border-collapse:separate"><tr>
        ${kpi(y.totals.visitors, 'Visitors', pct(y.totals.visitors, d0.totals.visitors))}
        ${kpi(y.totals.pageviews, 'Page views', pct(y.totals.pageviews, d0.totals.pageviews))}
        ${kpi(y.totals.cardViews, 'Cards seen', pct(y.totals.cardViews, d0.totals.cardViews))}
        ${kpi(y.totals.cardClicks, 'Cards used', pct(y.totals.cardClicks, d0.totals.cardClicks))}
      </tr></table>

      <h3 style="font-size:13px;text-transform:uppercase;letter-spacing:.5px;color:#6b7a72;margin:24px 0 8px">Which pages people visit · last 7 days</h3>
      <table width="100%" style="border-collapse:collapse;font-size:14px">
        <tr><th align="left" style="padding:6px 8px;font-size:11px;color:#6b7a72">Page</th><th align="right" style="padding:6px 8px;font-size:11px;color:#6b7a72">Views</th><th align="right" style="padding:6px 8px;font-size:11px;color:#6b7a72">Visitors</th></tr>
        ${pageRows}
      </table>

      <h3 style="font-size:13px;text-transform:uppercase;letter-spacing:.5px;color:#6b7a72;margin:24px 0 8px">Which live card people see &amp; use · last 7 days</h3>
      <table width="100%" style="border-collapse:collapse;font-size:14px">
        <tr><th align="left" style="padding:6px 8px;font-size:11px;color:#6b7a72">Live card</th><th align="right" style="padding:6px 8px;font-size:11px;color:#6b7a72">Seen</th><th align="right" style="padding:6px 8px;font-size:11px;color:#6b7a72">Used</th><th align="right" style="padding:6px 8px;font-size:11px;color:#6b7a72">Use rate</th></tr>
        ${cardRows}
      </table>

      <h3 style="font-size:13px;text-transform:uppercase;letter-spacing:.5px;color:#6b7a72;margin:24px 0 8px">What people search for · last 7 days</h3>
      <table width="100%" style="border-collapse:collapse;font-size:14px">
        <tr><th align="left" style="padding:6px 8px;font-size:11px;color:#6b7a72">Search query</th><th align="left" style="padding:6px 8px;font-size:11px;color:#6b7a72">Section(s)</th><th align="right" style="padding:6px 8px;font-size:11px;color:#6b7a72">Times</th></tr>
        ${searchRows}
      </table>

      <h3 style="font-size:13px;text-transform:uppercase;letter-spacing:.5px;color:#6b7a72;margin:24px 0 8px">Where visitors are · last 7 days (approx, by IP)</h3>
      <table width="100%" style="border-collapse:collapse;font-size:14px">
        <tr><th align="left" style="padding:6px 8px;font-size:11px;color:#6b7a72">City</th><th align="left" style="padding:6px 8px;font-size:11px;color:#6b7a72">Country</th><th align="right" style="padding:6px 8px;font-size:11px;color:#6b7a72">Visitors</th></tr>
        ${cityRows}
      </table>

      <h3 style="font-size:13px;text-transform:uppercase;letter-spacing:.5px;color:#6b7a72;margin:24px 0 8px">Where visitors come from · last 7 days</h3>
      <table width="100%" style="border-collapse:collapse;font-size:14px">
        <tr><th align="left" style="padding:6px 8px;font-size:11px;color:#6b7a72">Source</th><th align="right" style="padding:6px 8px;font-size:11px;color:#6b7a72">Visits</th></tr>
        ${refRows}
      </table>

      <div style="margin-top:22px;padding-top:16px;border-top:1px solid #eee6d4;font-size:12px;color:#6b7a72">
        7-day totals: <b>${wk.totals.visitors.toLocaleString()}</b> visitors ·
        <b>${wk.totals.pageviews.toLocaleString()}</b> page views ·
        <b>${wk.totals.cardClicks.toLocaleString()}</b> live-card uses.<br>
        <a href="${SITE_URL}/live-stats" style="color:#1E5B47;font-weight:600">Open the full dashboard →</a>
      </div>
    </div>
    <div style="text-align:center;font-size:11px;color:#9aa69f;padding:14px">Automated daily review · Aaziko Live analytics</div>
  </div></body></html>`;

  return { subject: `Aaziko Live — Daily Review · ${label}`, html };
}

function mailTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: String(process.env.SMTP_SECURE || 'false') === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

async function sendDigest(toOverride) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('[digest] SMTP not configured (SMTP_USER/SMTP_PASS) — skipping email');
    return { ok: false, reason: 'smtp-not-configured' };
  }
  const to = (toOverride && String(toOverride).trim()) || DIGEST_TO;
  const { subject, html } = buildDigest();
  await mailTransport().sendMail({
    from: process.env.DIGEST_FROM || `"Aaziko Live" <${process.env.SMTP_USER}>`,
    to,
    subject,
    html,
  });
  console.log('[digest] sent to', to);
  return { ok: true, to };
}

function msUntilNextDigest() {
  const now = Date.now();
  const d = new Date(now + TZ_OFFSET_MIN * 60000);
  let target = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), DIGEST_HOUR, 0, 0) - TZ_OFFSET_MIN * 60000;
  if (target <= now) target += 86400000;
  return target - now;
}
function scheduleDigest() {
  if (!DIGEST_ENABLED) { console.log('[digest] disabled (DIGEST_ENABLED=false)'); return; }
  const wait = msUntilNextDigest();
  console.log('[digest] next daily email to ' + DIGEST_TO + ' in ~' + Math.round(wait / 3600000) + 'h (at ' + DIGEST_HOUR + ':00, TZ+' + TZ_OFFSET_MIN + 'm)');
  setTimeout(function run() {
    sendDigest().catch((e) => console.error('[digest] send failed:', e && e.message));
    setTimeout(run, 86400000);
  }, wait);
}

// Preview the digest email in the browser (no send) — behind the dashboard login.
app.get(['/live-stats/preview-digest', '/preview-digest'], auth, (_req, res) => {
  res.set('Content-Type', 'text/html; charset=utf-8').send(buildDigest().html);
});

// Manual trigger: send a digest right now (behind the dashboard login) to test it.
// Optional ?to=someone@example.com sends this one email to that address instead of
// the configured DIGEST_TO (does not change the daily-schedule recipient).
app.get(['/live-stats/send-digest', '/send-digest'], auth, async (req, res) => {
  try {
    const r = await sendDigest(req.query.to);
    res.json(r);
  } catch (e) {
    res.status(500).json({ ok: false, error: e && e.message });
  }
});

// ── Data retention ──────────────────────────────────────────────────────────
// Rolling window: every day, delete every event older than RETENTION_DAYS so the
// database always holds only the most recent N days (default 45). This removes the
// old visit detail AND its stored response data. Set RETENTION_DAYS=0 to keep forever.
const RETENTION_DAYS = parseInt(process.env.RETENTION_DAYS || '45', 10);
const deleteOlderThan = db.prepare('DELETE FROM events WHERE ts < ?');
function runRetention() {
  if (!RETENTION_DAYS || RETENTION_DAYS < 1) return;
  try {
    const cutoffTs = Date.now() - RETENTION_DAYS * 86400000;
    const r = deleteOlderThan.run(cutoffTs);
    if (r.changes > 0) {
      db.pragma('wal_checkpoint(TRUNCATE)'); // reclaim the journal so freed space is reused
      console.log('[retention] deleted ' + r.changes + ' events older than ' + RETENTION_DAYS + ' days');
    }
  } catch (e) {
    console.error('[retention] cleanup failed:', e && e.message);
  }
}
function scheduleRetention() {
  if (!RETENTION_DAYS || RETENTION_DAYS < 1) { console.log('[retention] disabled — data kept forever'); return; }
  runRetention();                       // sweep once on boot
  setInterval(runRetention, 86400000);  // then once every 24h
  console.log('[retention] rolling window of ' + RETENTION_DAYS + ' days armed (daily cleanup)');
}

app.listen(PORT, () => {
  console.log('[aaziko-live-analytics] listening on :' + PORT + '  (db: ' + path.join(DATA_DIR, 'analytics.db') + ')');
  scheduleDigest();
  scheduleRetention();
});
