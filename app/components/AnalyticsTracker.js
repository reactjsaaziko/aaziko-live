'use client';

/**
 * Aaziko Live — first-party, cookieless visitor analytics.
 *
 * Rendered once from app/layout.js so it runs on every route. It records three things
 * and POSTs them to the self-hosted collector (analytics-server/, PM2 on the same box):
 *
 *   pageview   — every page load AND every client-side route change (which page).
 *   card_view  — each "live card" (the interactive live-demo boxes) the first time it
 *                scrolls into view on a given page load (which live card people SEE).
 *   card_click — a click / form-submit on a live card's primary control
 *                (which live card people actually USE).
 *   search     — the actual text a visitor entered into a card's search / query fields,
 *                captured on an intentful trigger (a Search / Go / Analyze button or an
 *                Enter form-submit) — so we can see WHAT people search for, per section.
 *
 * Design rules:
 *   • Never blocks or breaks the page — every call is wrapped, failures are swallowed,
 *     sends are fire-and-forget (sendBeacon / fetch keepalive).
 *   • Cookieless — a random visitor id lives in localStorage (for unique-visitor counts),
 *     a session id in sessionStorage. No PII, no cookies → no consent banner needed.
 *   • The live cards are matched by page-unique element ids (see CARDS) so no per-page
 *     HTML edits are needed; a card simply absent on a route is skipped.
 */

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

// ── Live-card registry ──────────────────────────────────────────────────────
// Each entry: a page-unique container id (what "seeing the card" means) + the ids of
// its primary interactive controls (what "using the card" means). Absent ids are
// skipped, so one flat list safely covers every route. `result` (optional) names the
// container that holds the search output (and an optional element that holds a count),
// so we can record what the visitor actually GOT back for their query.
const CARDS = [
  { id: 'lmkt',        name: 'Marketplace — Product Search',      actions: ['lmkt-form', 'lmkt-input'], result: { box: 'lmkt-grid' } },
  { id: 'mp-demo',     name: 'Marketplace — Product Spotlight',   actions: [] },
  { id: 'cu3',         name: 'Customs 3.0 — Compliance Check',    actions: ['cu-analyze', 'cu-hs', 'cu-dest', 'cu-exp'], result: { box: 'cu-results', count: 'cu-reg-count' } },
  { id: 'pb-feed',     name: 'Port Brain — Buyer Feed',           actions: ['pb-search', 'pb-q', 'pb-country'], result: { box: 'pb-list' } },
  { id: 'pb-list',     name: 'Port Brain — Buyer Results',        actions: [] },
  { id: 'load',        name: 'Logistics — Load Calculator',       actions: [] },
  { id: 'cost',        name: 'Logistics — Cost Estimator',        actions: [] },
  { id: 'pa-output',   name: 'Product Analysis — Demand & Price', actions: ['pa-go', 'pa-product', 'pa-country'], result: { box: 'pa-output' } },
  { id: 'ta-output',   name: 'Trade Agreements — FTA Finder',     actions: ['ta-go', 'ta-product', 'ta-partner'], result: { box: 'ta-output' } },
  { id: 'fin-calc',    name: 'Finance — Trade Finance',           actions: ['fin-value', 'fin-terms', 'fin-size'] },
  { id: 'insp-output', name: 'Inspection — Live Report',          actions: ['insp-advance', 'insp-order'], result: { box: 'insp-output' } },
  { id: 'asSteps',     name: 'Order Assurance — Escrow Flow',     actions: ['asPlay'] },
];

function endpoint() {
  if (typeof window === 'undefined') return '/api/track';
  if (window.__AAZIKO_ANALYTICS__) return window.__AAZIKO_ANALYTICS__;
  // Same-origin in production (nginx proxies /api/track → the collector on :3056).
  // On localhost there's normally NO analytics collector running, so skip tracking
  // entirely (return null → send() no-ops) — avoids the repeated failed /api/track
  // requests in dev. A dev who runs the collector can opt in via window.__AAZIKO_ANALYTICS__.
  const h = window.location.hostname;
  if (/^(localhost|127\.0\.0\.1)$/.test(h)) return null;
  return '/api/track';
}

function rid() {
  try {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  } catch (_) {}
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

function stored(store, key) {
  try {
    let v = window[store].getItem(key);
    if (!v) { v = rid(); window[store].setItem(key, v); }
    return v;
  } catch (_) {
    return 'anon';
  }
}

// ── "Do not track me" opt-out ────────────────────────────────────────────────
// Keeps our OWN testing out of the analytics without ever touching real visitors.
// Open any Live page once with ?aaz_notrack=1 and this browser stops being tracked
// (the flag is persisted in localStorage); ?aaz_notrack=0 turns tracking back on.
// Cookieless + per-browser by design — an incognito window is a fresh browser, so
// mark each browser you test from. When set, send() below transmits nothing.
let _optOutParamApplied = false;
function applyOptOutParam() {
  if (_optOutParamApplied) return;
  _optOutParamApplied = true;
  try {
    const p = new URLSearchParams(window.location.search).get('aaz_notrack');
    if (p == null) return;
    const on = /^(1|on|true|yes)$/i.test(p);
    try {
      if (on) window.localStorage.setItem('aaz_notrack', '1');
      else window.localStorage.removeItem('aaz_notrack');
    } catch (_) {}
    try {
      console.info('[aaziko] analytics ' + (on
        ? 'disabled for this browser (?aaz_notrack=1) — your visits will not be recorded'
        : 're-enabled for this browser (?aaz_notrack=0)'));
    } catch (_) {}
  } catch (_) {}
}
function optedOut() {
  try {
    applyOptOutParam();
    return window.localStorage.getItem('aaz_notrack') === '1';
  } catch (_) {
    return false;
  }
}

function send(payload) {
  try {
    if (optedOut()) return; // this browser opted out of analytics — record nothing
    payload.vid = stored('localStorage', 'aaz_vid');
    payload.sid = stored('sessionStorage', 'aaz_sid');
    payload.t = Date.now();
    const url = endpoint();
    if (!url) return; // no collector configured (e.g. localhost dev) — skip silently, no failed request
    const body = JSON.stringify(payload);
    // sendBeacon and keepalive-fetch both cap the body at ~64KB and silently drop
    // anything larger — which is exactly what happened to big result-HTML snapshots.
    // Small events use the beacon (survives page unload); large ones (a full response
    // snapshot) go via a normal fetch, which has no such size cap.
    if (body.length < 60000) {
      if (navigator.sendBeacon) {
        const ok = navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }));
        if (ok) return;
      }
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
        credentials: 'omit',
      }).catch(() => {});
    } else {
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        credentials: 'omit',
      }).catch(() => {});
    }
  } catch (_) {
    /* analytics must never break the page */
  }
}

// ── Search-value capture ────────────────────────────────────────────────────
// Read what a visitor actually typed / selected in a card's fields. We only ever
// look at click/submit interactions (never keystrokes), so this stays bounded.

// The human-readable value of one field (selected option text for a <select>).
function fieldText(el) {
  if (!el) return '';
  const tag = el.tagName;
  if (tag === 'SELECT') {
    const opt = el.selectedOptions && el.selectedOptions[0];
    return String((opt && opt.textContent) || el.value || '').trim();
  }
  if (tag === 'INPUT' || tag === 'TEXTAREA') return String(el.value || '').trim();
  return '';
}

// A short label for a field, used only when a card has more than one query field
// (e.g. Customs: "HS Code" + "Destination Country"). Single-field cards show the
// bare value with no label.
function fieldLabel(el) {
  const raw = el.getAttribute('placeholder') || el.getAttribute('aria-label') || el.getAttribute('name') || el.id || '';
  return String(raw).replace(/[.…]+$/, '').replace(/^Search\s+/i, '').trim().slice(0, 40);
}

// Join a card's non-empty query fields into one readable string. "" when nothing typed.
function collectQuery(card) {
  const parts = [];
  for (const a of card.actions) {
    const el = document.getElementById(a);
    if (!el) continue;
    const tag = el.tagName;
    if (tag !== 'INPUT' && tag !== 'SELECT' && tag !== 'TEXTAREA') continue;
    if (el.type === 'submit' || el.type === 'button') continue;
    const v = fieldText(el);
    if (v) parts.push({ label: fieldLabel(el), value: v });
  }
  if (!parts.length) return '';
  if (parts.length === 1) return parts[0].value.slice(0, 160);
  return parts.map((p) => (p.label ? p.label + ': ' : '') + p.value).join(' · ').slice(0, 240);
}

// True only for a deliberate "run the search" gesture — a button / link / role=button,
// or a form submit (Enter in a search box) — not clicking into an input or opening a select.
function isTrigger(ev) {
  if (ev.type === 'submit') return true;
  const t = ev.target;
  if (!t || !t.closest) return false;
  return !!t.closest('button, a[href], [role="button"], input[type="submit"], input[type="button"]');
}

// Read what the card showed back for a search: a rough result count + a short text
// summary of the output container. Returns null while the output still looks empty
// or mid-load, so the caller can retry.
const LOADING_RE = /^(loading|searching|analy[sz]ing|please wait|…|\.\.\.)/i;
function summarizeResult(card) {
  const cfg = card.result;
  if (!cfg) return null;
  const box = document.getElementById(cfg.box);
  if (!box) return null;
  // Keep the line structure (each section on its own line) so it reads well as text —
  // collapse only runs of spaces/tabs, and cap blank-line runs.
  const text = String(box.innerText || '')
    .replace(/[ \t ]+/g, ' ')
    .replace(/[ \t]*\n[ \t]*/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  let count = null;
  if (cfg.count) {
    const cEl = document.getElementById(cfg.count);
    if (cEl) {
      const m = String(cEl.textContent || '').replace(/[,\s]/g, '').match(/\d+/);
      if (m) count = parseInt(m[0], 10);
    }
  }
  if (count == null && box.childElementCount > 0) count = box.childElementCount;
  if (!text && count == null) return null;              // nothing rendered yet
  if (count == null && LOADING_RE.test(text)) return null; // still loading → retry later
  return { count, text: text.slice(0, 20000) };         // keep the full visible response (long ones included)

}

// Snapshot the result's rendered HTML with styles inlined, so the dashboard can show it
// with the SAME design as the live card (fonts, colours, layout) — WITHOUT a screenshot
// image, and without needing the site's CSS. Each node's computed styles are copied onto
// it; scripts are stripped so nothing runs when it's displayed. ('opacity' is skipped so
// a mid-fade element isn't frozen washed-out; the popup forces full opacity anyway.)
const SNAP_PROPS = [
  'display', 'box-sizing', 'position', 'flex', 'flex-direction', 'flex-wrap', 'justify-content',
  'align-items', 'gap', 'grid-template-columns', 'width', 'max-width', 'height', 'margin', 'padding',
  'border', 'border-radius', 'background-color', 'background-image', 'background-size', 'background-position',
  'color', 'font-family', 'font-size', 'font-weight', 'font-style', 'line-height', 'text-align',
  'text-transform', 'text-decoration', 'letter-spacing', 'white-space', 'vertical-align', 'box-shadow',
  'object-fit', 'overflow', 'list-style',
];
const SNAP_SKIP = { SCRIPT: 1, STYLE: 1, LINK: 1, NOSCRIPT: 1, IFRAME: 1, CANVAS: 1 };
function absUrl(u) { try { return new URL(u, window.location.href).href; } catch (_) { return u; } }
function snapshotHtml(box) {
  try {
    if (!box) return '';
    const clone = box.cloneNode(true);
    const src = [box].concat(Array.prototype.slice.call(box.querySelectorAll('*')));
    const dst = [clone].concat(Array.prototype.slice.call(clone.querySelectorAll('*')));
    const n = Math.min(src.length, dst.length);
    for (let i = 0; i < n; i++) {
      const so = src[i], d = dst[i];
      if (SNAP_SKIP[d.tagName]) { if (d.parentNode) d.parentNode.removeChild(d); continue; }
      if (d.attributes) {
        for (let a = d.attributes.length - 1; a >= 0; a--) {
          const an = d.attributes[a].name;
          if (an.indexOf('on') === 0 || an === 'class' || an === 'id' || an === 'srcset') d.removeAttribute(an);
        }
      }
      try {
        const cs = getComputedStyle(so);
        let st = '';
        for (const p of SNAP_PROPS) {
          const v = cs.getPropertyValue(p);
          if (v && v !== 'none' && v !== 'normal' && v !== 'auto' && v !== '0px' && v !== 'rgba(0, 0, 0, 0)') st += p + ':' + v + ';';
        }
        if (st) d.setAttribute('style', st);
      } catch (_) {}
      if (d.tagName === 'IMG') { try { d.setAttribute('src', absUrl(so.currentSrc || so.src)); } catch (_) {} }
    }
    const html = clone.outerHTML || '';
    return html.length > 400000 ? '' : html;
  } catch (_) { return ''; }
}

const RESULT_LOADING_RE = /Analysing compliance requirements|Fetching official|Querying live trade|Analysing compliance/i;

// After a search fires, capture the response as styled HTML (same design as the live
// card) + a text version. Some cards load extra sections (HS-code compliance / Market
// Access Map measures) seconds — sometimes ~a minute — later, so capture over a long
// window and send progressively richer snapshots; the dashboard keeps the latest
// (fullest). De-duped per (card, query). No screenshot image is taken.
function captureResult(card, q, sentSet) {
  if (!card.result || typeof document === 'undefined') return;
  const key = card.id + '|' + q.toLowerCase();
  if (sentSet.has(key)) return; // one capture cycle per (card, query)
  sentSet.add(key);
  let firstSent = false, bestLen = 0, sends = 0;
  const fire = () => {
    if (sends >= 3) return;
    const r = summarizeResult(card);
    if (!r) return;
    const rhtml = snapshotHtml(document.getElementById(card.result.box));
    const len = (rhtml || '').length + (r.text || '').length;
    const loading = RESULT_LOADING_RE.test(r.text || '') || RESULT_LOADING_RE.test(rhtml || '');
    const payload = { type: 'search_result', path: window.location.pathname, card: card.name, q, rc: r.count, rtext: r.text, rhtml };
    if (!firstSent) { firstSent = true; sends++; bestLen = len; send(payload); }        // early snapshot
    else if (!loading && len > bestLen + 400) { sends++; bestLen = len; send(payload); } // richer, once more loaded
  };
  for (const delay of [900, 2200, 4500, 8000, 13000, 20000, 30000, 45000, 60000]) setTimeout(fire, delay);
}

export default function AnalyticsTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    // Honour the "do not track me" opt-out: apply any ?aaz_notrack flag from the URL,
    // then attach nothing (no pageview, no observers, no listeners) for this browser.
    if (optedOut()) return;

    // 1) Page view — fires once per distinct path (initial load + each SPA navigation).
    send({
      type: 'pageview',
      path: window.location.pathname,
      ref: document.referrer || '',
      title: document.title || '',
      sw: window.screen ? window.screen.width : 0,
      lang: navigator.language || '',
    });

    // Cards seen already on THIS page render (reset per navigation).
    const seen = new Set();
    let io = null;
    try {
      io = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (!e.isIntersecting) continue;
            const card = e.target.__aazCard;
            if (card && !seen.has(card.id)) {
              seen.add(card.id);
              send({ type: 'card_view', path: window.location.pathname, card: card.name });
            }
            io.unobserve(e.target);
          }
        },
        { threshold: 0.35 }
      );
    } catch (_) {
      io = null;
    }

    // 2) Card views — the body HTML is injected by StaticHtmlPage in a separate effect,
    // so re-scan a few times to catch cards as they appear. Idempotent (flagged nodes).
    const scan = () => {
      if (!io) return;
      for (const card of CARDS) {
        const el = document.getElementById(card.id);
        if (el && !el.__aazObserved) {
          el.__aazObserved = true;
          el.__aazCard = card;
          io.observe(el);
        }
      }
    };
    const timers = [0, 300, 800, 1600, 3000].map((d) => setTimeout(scan, d));

    // 3) Card clicks + search values — one delegated listener maps an action id
    //    back to its card, records the "used" click (once per card per render), and
    //    on an intentful trigger also records the actual query text the visitor
    //    entered (de-duped per distinct card+query so repeats aren't spammed).
    const actionToCard = new Map();
    for (const card of CARDS) for (const a of card.actions) actionToCard.set(a, card);
    const clicked = new Set(); // once per card per page render keeps click counts meaningful
    const searched = new Set(); // per (card|query) so each distinct search is captured once
    const resultSent = new Set(); // per (card|query) so each search's result is captured once
    const onInteract = (ev) => {
      try {
        let node = ev.target;
        for (let i = 0; node && i < 8; i++, node = node.parentElement) {
          if (!node.id) continue;
          const card = actionToCard.get(node.id);
          if (!card) continue;

          if (!clicked.has(card.id)) {
            clicked.add(card.id);
            send({ type: 'card_click', path: window.location.pathname, card: card.name, action: node.id });
          }

          if (isTrigger(ev)) {
            const q = collectQuery(card);
            if (q) {
              const key = card.id + '|' + q.toLowerCase();
              if (!searched.has(key)) {
                searched.add(key);
                send({ type: 'search', path: window.location.pathname, card: card.name, action: node.id, q });
              }
              // Record what the card returned for this query (async — polled).
              captureResult(card, q, resultSent);
            }
          }
          return;
        }
      } catch (_) {}
    };
    document.addEventListener('click', onInteract, true);
    document.addEventListener('submit', onInteract, true);

    return () => {
      timers.forEach(clearTimeout);
      if (io) io.disconnect();
      document.removeEventListener('click', onInteract, true);
      document.removeEventListener('submit', onInteract, true);
    };
  }, [pathname]);

  return null;
}
