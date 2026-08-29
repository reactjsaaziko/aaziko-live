#!/usr/bin/env node
/**
 * Live response-capture test — drives a REAL browser through every searchable live
 * section on aaziko.com/live, performs a real search, and verifies (via the collector
 * DATABASE, the source of truth) that the analytics tracker captured the response:
 * a `search` event with the query AND a `search_result` event with the response text/HTML.
 *
 *   node tests/live-response-capture.test.js
 *
 * Why DB-verified and not request-sniffing: small responses are sent with sendBeacon,
 * which Puppeteer's request interception does NOT reliably see — only the DB is truth.
 * Each section tags its rows vid=`sectiontest-<key>` (purged at the end of the run).
 *
 * Requires: puppeteer-core + google-chrome, and SSH to the collector host to read the DB.
 */
const puppeteer = require('/home/aaziko/aaziko/node_modules/puppeteer-core');
const { execSync } = require('child_process');
const CHROME = '/usr/bin/google-chrome';
const BASE = 'https://aaziko.com/live';
const DB_SSH = 'root@72.61.233.113';
const DB_PATH = '/var/www/aaziko-live-analytics/data/analytics.db';
const DB_NM = '/var/www/aaziko-live-analytics/node_modules/better-sqlite3';
const REAL_UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// clear an input then type into it (avoids concatenating a card's default value)
async function fill(page, sel, text) {
  const el = await page.$(sel); if (!el) return false;
  await el.click({ clickCount: 3 }).catch(() => {});
  await page.keyboard.press('Backspace').catch(() => {});
  await el.type(text, { delay: 35 }); return true;
}
const click = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); if (e) { e.click(); return true; } return false; }, sel);
const submit = (page, sel) => page.evaluate((s) => { const f = document.querySelector(s); if (f) { f.requestSubmit ? f.requestSubmit() : f.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); return true; } return false; }, sel);
const pick = (page, sel) => page.evaluate((s) => { const dd = document.querySelector(s); if (dd && dd.offsetParent !== null) { const it = dd.querySelector('li,button,a,[role=option],div'); if (it && it !== dd) { it.click(); return true; } } return false; }, sel);
const selOpt = (page, sel, m) => page.evaluate((s, mm) => {
  const el = document.querySelector(s); if (!el || el.tagName !== 'SELECT') return false;
  if (mm) { for (let i = 0; i < el.options.length; i++) if (new RegExp(mm, 'i').test(el.options[i].text)) { el.selectedIndex = i; el.dispatchEvent(new Event('change', { bubbles: true })); return true; } }
  if (el.options.length > 1) { el.selectedIndex = 1; el.dispatchEvent(new Event('change', { bubbles: true })); return true; }
  return false;
}, sel, m);

const SECTIONS = [
  { key: 'marketplace', url: BASE + '/marketplace/', wait: 16000,
    run: async (p) => { await fill(p, '#lmkt-input', 'cotton t-shirts'); await p.focus('#lmkt-input'); await p.keyboard.press('Enter'); } },
  { key: 'customs', url: BASE + '/customs/', wait: 34000,
    run: async (p) => { await fill(p, '#cu-hs', '690721'); await sleep(1300); await pick(p, '#cu-hs-dd'); await fill(p, '#cu-dest', 'Germany'); await sleep(1100); await pick(p, '#cu-dest-dd'); await click(p, '#cu-analyze'); } },
  { key: 'port-brain', url: BASE + '/port-brain/', wait: 20000,
    run: async (p) => { await fill(p, '#pb-q', 'cotton'); await sleep(500); if (!(await submit(p, '#pb-search'))) { await p.focus('#pb-q'); await p.keyboard.press('Enter'); } } },
  { key: 'product-analysis', url: BASE + '/product-analysis/', wait: 40000,
    run: async (p) => { await fill(p, '#pa-product', 'ceramic tiles'); await sleep(1900); await pick(p, '#pa-suggest'); await sleep(500); await selOpt(p, '#pa-country', 'united states|usa'); await click(p, '#pa-go'); } },
  { key: 'trade-agreements', url: BASE + '/trade-agreements/', wait: 22000,
    run: async (p) => { await selOpt(p, '#ta-partner'); await fill(p, '#ta-product', 'ceramic tiles'); await sleep(900); await pick(p, '#ta-product-menu'); await click(p, '#ta-go'); } },
  { key: 'inspection', url: BASE + '/inspection/', wait: 14000,
    run: async (p) => { await selOpt(p, '#insp-order'); await click(p, '#insp-advance'); } },
];

async function drive(s) {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--window-size=1400,1200'] });
  try {
    const page = await browser.newPage();
    await page.setUserAgent(REAL_UA);
    await page.setViewport({ width: 1400, height: 1200 });
    await page.evaluateOnNewDocument((v) => { try { localStorage.setItem('aaz_vid', v); } catch (e) {} }, 'sectiontest-' + s.key);
    await page.goto(s.url, { waitUntil: 'networkidle2', timeout: 60000 });
    await sleep(2500);
    await s.run(page).catch(() => {});
    await sleep(s.wait);
  } catch (_) {} finally { await browser.close().catch(() => {}); }
}

// Run a node script on the collector by PIPING it to `node -` over SSH stdin — this
// avoids all the shell-quoting hell of embedding the script in the ssh command string.
function runOnCollector(js) {
  return execSync(`ssh -o ConnectTimeout=8 ${DB_SSH} node -`, { input: js, encoding: 'utf8', timeout: 30000 });
}
// Read the collector DB and return per-key {searches, results, q, rtext, rhtml, sample}
function readDb() {
  const js = `const D=require('${DB_NM}');const db=new D('${DB_PATH}');const out={};` +
    `for(const k of ${JSON.stringify(SECTIONS.map(s => s.key))}){const v='sectiontest-'+k;` +
    `const s=db.prepare("SELECT COUNT(*) n FROM events WHERE vid=? AND type='search'").get(v).n;` +
    `const q=db.prepare("SELECT q FROM events WHERE vid=? AND type='search' AND q IS NOT NULL AND q<>'' ORDER BY ts DESC LIMIT 1").get(v);` +
    `const r=db.prepare("SELECT COUNT(*) n FROM events WHERE vid=? AND type='search_result'").get(v).n;` +
    `const b=db.prepare("SELECT length(rtext) tl,length(rhtml) hl,rtext FROM events WHERE vid=? AND type='search_result' ORDER BY length(rhtml) DESC LIMIT 1").get(v);` +
    `out[k]={searches:s,results:r,q:q&&q.q||'',rtext:b&&b.tl||0,rhtml:b&&b.hl||0,sample:(b&&b.rtext||'').slice(0,90)};}` +
    `process.stdout.write(JSON.stringify(out));`;
  return JSON.parse(runOnCollector(js));
}
function purge() {
  const js = `const D=require('${DB_NM}');const db=new D('${DB_PATH}');process.stdout.write(String(db.prepare("DELETE FROM events WHERE vid LIKE 'sectiontest-%'").run().changes));`;
  try { return runOnCollector(js); } catch (_) { return '?'; }
}

(async () => {
  console.log('LIVE RESPONSE-CAPTURE TEST · aaziko.com/live · ' + SECTIONS.length + ' sections');
  console.log('(clearing any prior test rows: ' + purge() + ' deleted)\n');
  for (const s of SECTIONS) { process.stdout.write('  driving ' + s.key.padEnd(18) + ' … '); await drive(s); console.log('done'); }
  await sleep(2000);
  const db = readDb();

  console.log('\n== RESULTS (verified from the collector database) ==');
  console.log('SECTION'.padEnd(18) + 'CAPTURE  SEARCH RESULT  RESPONSE       DATA');
  let pass = 0;
  for (const s of SECTIONS) {
    const d = db[s.key] || {};
    const captured = d.searches > 0 && d.results > 0 && (d.rtext > 0 || d.rhtml > 0);
    if (captured) pass++;
    const kb = Math.round((d.rhtml || 0) / 1024);
    const dataNote = /momentarily unavailable|not available/i.test(d.sample) ? 'feed DOWN' : /no buyers matched|no .* found|no matching/i.test(d.sample) ? 'no results (valid)' : (kb >= 5 ? 'rich' : 'thin');
    console.log(s.key.padEnd(18) + (captured ? '  PASS ' : '  FAIL ') + '   ' + String(d.searches || 0) + '      ' + String(d.results || 0) + '    ' + (kb + 'KB / ' + (d.rtext || 0) + 'ch').padEnd(14) + ' ' + dataNote);
  }
  console.log('\n' + pass + '/' + SECTIONS.length + ' sections CAPTURE the response (search + result stored).');
  console.log('DATA notes: "rich"=full card captured · "no results (valid)"=card showed an empty state · "feed DOWN"=that card\'s backend API is unavailable (capture still worked).');
  console.log('\nPurging test rows: ' + purge() + ' deleted.');
})().catch((e) => { console.error('TEST ERROR:', e.message); process.exit(1); });
