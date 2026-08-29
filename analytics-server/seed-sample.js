// Seed the local DB with realistic back-dated sample events so a test digest email
// looks like a real day. Safe to delete — for local testing only.
const path = require('path');
const Database = require('better-sqlite3');
const fs = require('fs');
fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });
const db = new Database(path.join(__dirname, 'data', 'analytics.db'));
db.pragma('journal_mode = WAL');
db.exec(`CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER, day TEXT, type TEXT, page TEXT,
  path TEXT, card TEXT, action TEXT, vid TEXT, sid TEXT, ref TEXT, ua TEXT, iph TEXT);`);
const ins = db.prepare(`INSERT INTO events (ts,day,type,page,path,card,action,vid,sid,ref,ua,iph)
  VALUES (@ts,@day,@type,@page,@path,@card,@action,@vid,@sid,@ref,@ua,@iph)`);
const DAY = 86400000, now = Date.now();
const utcDay = (ms) => new Date(ms).toISOString().slice(0, 10);
const PAGES = ['home','customs','port-brain','logistics','marketplace','product-analysis','trade-agreements','finance'];
const CARDS = {
  customs: 'Customs 3.0 — Compliance Check', 'port-brain': 'Port Brain — Buyer Feed',
  logistics: 'Logistics — Load Calculator', marketplace: 'Marketplace — Product Search',
  'product-analysis': 'Product Analysis — Demand & Price', 'trade-agreements': 'Trade Agreements — FTA Finder',
  finance: 'Finance — Trade Finance',
};
const REFS = ['google.com','linkedin.com','','','bing.com',''];
let n = 0;
for (let d = 6; d >= 0; d--) {                       // last 7 days
  const base = now - d * DAY;
  const visitors = 6 + Math.floor((7 - d) * 2.5);    // gentle upward trend
  for (let v = 0; v < visitors; v++) {
    const vid = 'v' + d + '_' + v, sid = 's' + d + '_' + v;
    const ref = REFS[(v + d) % REFS.length];
    const npages = 1 + ((v + d) % 3);
    for (let p = 0; p < npages; p++) {
      const page = PAGES[(v + p) % PAGES.length];
      const ts = base - (p * 120000);
      ins.run({ ts, day: utcDay(ts), type: 'pageview', page, path: '/live/' + (page === 'home' ? '' : page + '/'),
        card: null, action: null, vid, sid, ref: p === 0 ? ref : '', ua: 'seed', iph: 'seed' }); n++;
      const card = CARDS[page];
      if (card && (v + p) % 2 === 0) {
        ins.run({ ts: ts + 3000, day: utcDay(ts), type: 'card_view', page, path: '/live/' + page + '/',
          card, action: null, vid, sid, ref: '', ua: 'seed', iph: 'seed' }); n++;
        if ((v + p) % 3 === 0)
          ins.run({ ts: ts + 6000, day: utcDay(ts), type: 'card_click', page, path: '/live/' + page + '/',
            card, action: 'go', vid, sid, ref: '', ua: 'seed', iph: 'seed' }), n++;
      }
    }
  }
}
console.log('seeded', n, 'sample events across 7 days');
