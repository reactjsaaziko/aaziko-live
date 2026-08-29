'use client';
import { initLiveMarket, esc, imgUrls, unitPrice, moq, money, FALLBACK_IMG } from './_livemarket.js';
import { runDemoTour } from './_demotour.js';

// Marketplace page = the "Global trade, the Gen Z way" keynote (ACTs 1–6) wrapped around
// the live, animated Aaziko-engine order-flow diagram (engineFlow → #order-process), which
// is deliberately preserved as-is. This script drives both: the engine diagram and the
// keynote's staged reveals.
export function init() {

  /* ===== PRODUCT SPOTLIGHT: the ACT-3 "one page" mock card (#mock-card) is filled with
     whichever product is selected in the hero's live #lmkt search grid. On load it
     defaults to the first result of the opening "Porcelain tiles" search; when the
     visitor clicks a result card, the page scrolls to the demo and the card re-assembles
     with that product's real name, maker, photos and price tiers. ===== */
  function productSpotlight(p, info) {
    var elTitle = document.getElementById('mock-title');
    var elSup = document.getElementById('mock-sup');
    var elTiers = document.getElementById('mock-tiers');
    var elImg = document.getElementById('mock-img');
    var elThumbs = document.getElementById('mock-thumbs');
    var elBadges = document.getElementById('mock-badges');
    var elLogi = document.getElementById('mock-logi');
    if (!elTitle || !elTiers || !elImg || !p) return;

    elTitle.textContent = p.productName || 'Product';

    // supplier line: real maker name, origin, marketplace rating
    if (elSup) {
      var country = (p.featuredCountry && p.featuredCountry[0]) || 'India';
      var rating = Number(p.rating);
      elSup.innerHTML = '<span class="gold">VERIFIED MAKER</span> ' +
        (p.companyName ? esc(p.companyName) + ' · ' : '') + esc(country) +
        (isFinite(rating) && rating > 0 ? ' · ' + rating.toFixed(1) + '★' : '') +
        ' · <span class="vf">Verified ✓</span>';
    }

    // badges: category + real signals from the record
    if (elBadges) {
      var cat = (p.categoryId && p.categoryId.categoryName) || '';
      var badges = [];
      if (cat) badges.push(cat);
      badges.push((p.customizationType && p.customizationType.length) ? 'Customize' : 'OEM ready');
      badges.push('In stock', 'Fast dispatch');
      elBadges.innerHTML = badges.slice(0, 4).map(function (b) { return '<span>' + esc(b) + '</span>'; }).join('');
    }

    // price tiers from priceRanges (junk 0-price tiers dropped); best = cheapest
    var tiers = (p.priceRanges || [])
      .filter(function (r) { return r && isFinite(Number(r.price)) && Number(r.price) > 0 && isFinite(Number(r.quantityFrom)); })
      .sort(function (a, b) { return Number(a.quantityFrom) - Number(b.quantityFrom); })
      .slice(0, 3);
    var best = -1;
    tiers.forEach(function (r, i) { if (best < 0 || Number(r.price) < Number(tiers[best].price)) best = i; });
    var html = tiers.map(function (r, i) {
      var from = Number(r.quantityFrom), to = Number(r.quantityTo);
      var q = (r.isInfinite || !isFinite(to) || to >= 999999)
        ? from.toLocaleString('en-IN') + '+ units'
        : from.toLocaleString('en-IN') + '–' + to.toLocaleString('en-IN');
      return '<div class="tier' + (i === best ? ' best' : '') + '"><div class="q">' + esc(q) + '</div><div class="pr">' + money(r.price) + '</div></div>';
    }).join('');
    if (!html) {
      var up = unitPrice(p);
      html = '<div class="tier best"><div class="q">Unit price</div><div class="pr">' + (up > 0 ? money(up) : 'On request') + '</div></div>';
    }
    html += '<div class="tier"><div class="q">MOQ</div><div class="pr">' + moq(p).toLocaleString('en-IN') + '</div></div>';
    elTiers.innerHTML = html;

    // photos: real main image + up to 4 thumbnails that swap the main image
    var photos = imgUrls(p);
    function setMain(u) {
      elImg.innerHTML = '<img src="' + esc(u) + '" alt="' + esc(p.productName || 'Product') + '">';
      var im = elImg.querySelector('img');
      im.addEventListener('error', function () { im.src = FALLBACK_IMG; }, { once: true });
    }
    if (photos.length) setMain(photos[0]);
    else elImg.innerHTML = 'PRODUCT<br>IMAGE';
    if (elThumbs) {
      elThumbs.innerHTML = '';
      for (var t = 0; t < 4; t++) {
        var th = document.createElement('i');
        if (photos[t]) {
          th.className = 'has' + (t === 0 ? ' is-on' : '');
          th.style.backgroundImage = 'url("' + photos[t].replace(/"/g, '%22') + '")';
          (function (u, node) {
            node.addEventListener('click', function () {
              setMain(u);
              elThumbs.querySelectorAll('i.is-on').forEach(function (x) { x.classList.remove('is-on'); });
              node.classList.add('is-on');
            });
          })(photos[t], th);
        }
        elThumbs.appendChild(th);
      }
    }

    // logistics row: real origin country of THIS product
    if (elLogi) {
      var org = (p.featuredCountry && p.featuredCountry[0]) || 'India';
      elLogi.innerHTML = esc(org) + ' → your port · <b>one landed-cost quote</b>';
    }

    // on a real click: bring the demo into view and replay its assembly animation
    if (info && info.byUser) {
      var demo = document.getElementById('mp-demo');
      if (demo) {
        demo.scrollIntoView({ behavior: 'smooth', block: 'center' });
        demo.classList.remove('play');
        void demo.offsetWidth;
        demo.classList.add('play');
      }
    }
  }

  /* Live marketplace search box in the hero (shared with the home page #demo section);
     on this page its result cards are selectable and drive the spotlight above. */
  initLiveMarket({ onSelect: productSpotlight });

  /* Self-playing cinematic demo (shared engine): the page dims, the hero search bar
     lifts into a spotlight, a buyer's query types itself in and Search is pressed —
     the live marketplace answers. #lmkt is tilted (transform → stacking context), so
     it must be raised above the dim alongside the bar. Delayed so the hero's staged
     reveal fully settles first. */
  (function autoPlayDemo() {
    var box = document.getElementById('lmkt');
    var bar = document.querySelector('#lmkt .lmkt-search');
    var input = document.getElementById('lmkt-input');
    var grid = document.getElementById('lmkt-grid');
    var go = document.querySelector('#lmkt .lmkt-search__go');
    if (!box || !bar || !input || !grid) return;
    var ran = false;
    var initial = input.value; // the page ships value="Porcelain tiles" — not user input
    var doSearch = function () {
      ran = true;
      var form = document.getElementById('lmkt-form');
      if (form) form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    };
    runDemoTour({
      bar: bar,
      liftAlso: [box],
      delay: 1700,
      output: grid,
      resultReady: function () { return !!grid.querySelector('.lmkt-card'); },
      userStarted: function () { return input.value.trim() !== initial.trim(); },
      skip: function () { input.value = 'pump'; if (!ran) doSearch(); },
      script: async function (t) {
        t.caption(1, 2, 'Watch — typing what a buyer wants to source…');
        await t.type(input, 'pump', 70);
        t.caption(2, 2, 'Searching the live Aaziko marketplace…');
        await t.wait(350);
        if (go) t.press(go, true); // press visual; submit the form ourselves
        doSearch();
        await t.wait(300);         // let the loading note replace the default grid
        await t.result();
      },
    });
  })();

  /* ===== ORDER-FLOW ENGINE: a central "Aaziko engine" diagram that shows Aaziko as the
     executor, not a middleman. Buyer (left) and Maker (right) each touch the engine once;
     Aaziko (the big centre disc) does everything in between. A glowing token travels the
     active leg of the loop, the engine sub-label names the current job, and a big spotlight
     card reads out each step in plain language. Autoplays in a loop while in view. Mobile /
     reduced-motion fall back to the readable .azflow-fallback list. ===== */
  (function engineFlow() {
    var root = document.getElementById('order-process');
    if (!root) return;
    var canvas = root.querySelector('.azflow-canvas');
    if (!canvas) return;
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var SVGNS = 'http://www.w3.org/2000/svg';

    function svgEl(name, attrs) { var e = document.createElementNS(SVGNS, name); for (var k in attrs) { if (attrs[k] != null) e.setAttribute(k, attrs[k]); } return e; }
    function div(cls) { var d = document.createElement('div'); if (cls) d.className = cls; return d; }

    var NODES = {
      buyer:  { x: 120, y: 235, r: 60, label: 'BUYER', sub: 'one order',    cls: 'buyer' },
      vendor: { x: 800, y: 235, r: 60, label: 'MAKER', sub: 'manufactures', cls: 'vendor' }
    };
    var ENG = { x: 460, y: 235, r: 94 };
    // the four legs of the loop (start → end = direction of travel)
    var CONNS = {
      order:   { d: 'M169,201 C250,150 300,150 372,203', cls: 'buyer',  lx: 270, ly: 134, label: 'ORDER' },
      mfg:     { d: 'M548,203 C620,150 670,150 751,201', cls: 'aaz',    lx: 650, ly: 134, label: 'MAKE ORDER' },
      goods:   { d: 'M751,269 C670,320 620,320 548,267', cls: 'vendor', lx: 650, ly: 342, label: 'GOODS + PHOTOS' },
      deliver: { d: 'M372,267 C300,320 250,320 169,269', cls: 'aaz',    lx: 270, ly: 342, label: 'DELIVERED' }
    };
    // who lights up, which leg travels, what the engine is "doing", and the spotlight copy
    var STEPS = [
      { lit: ['buyer', 'aaziko'],  conn: 'order',   eng: 'Order in',           tone: 'buyer',
        tag: 'Buyer', title: 'Buyer places one simple order',
        text: 'The buyer compares verified Indian makers — price, certification, lead time — and places one order. That is the buyer’s only job.',
        chips: ['One search bar', 'Compare & order'] },
      { lit: ['aaziko', 'vendor'], conn: 'mfg',     eng: 'Contracts',          tone: 'aaz',
        tag: 'Aaziko', title: 'Contracts signed, maker briefed',
        text: 'Aaziko signs two contracts — one with the buyer, one with the maker — and sends the manufacturing order. From here, Aaziko carries the risk.',
        chips: ['Contract · Buyer', 'Contract · Maker'] },
      { lit: ['vendor', 'aaziko'], conn: 'goods',   eng: 'In production',      tone: 'vendor',
        tag: 'Maker', title: 'Maker manufactures & sends live photos',
        text: 'The maker only manufactures — and shares live photos. Aaziko relays every update to the buyer, so the order is watched as it is made.',
        chips: ['Live photos', 'Relayed to buyer'] },
      { lit: ['aaziko'],           conn: null,      eng: 'Inspect · Pay',   tone: 'aaz',
        tag: 'Aaziko', title: 'Aaziko inspects, pays the maker 100% & takes the goods',
        text: 'Aaziko inspects on-site, pays the maker 100% upfront, and takes the goods. For the maker the deal is done — no waiting on an overseas buyer.',
        chips: ['On-site inspection', 'Maker paid 100%', 'Goods collected'] },
      { lit: ['aaziko'],           conn: null,      eng: 'Customs · Insure', tone: 'aaz',
        tag: 'Aaziko', title: 'Aaziko clears customs, insures, ships & moves it',
        text: 'Holding the goods, Aaziko runs the whole cross-border layer — customs, insurance, freight and logistics. The buyer touches none of the paperwork.',
        chips: ['Customs cleared', 'Insured', 'Freight & logistics'] },
      { lit: ['aaziko', 'buyer'],  conn: 'deliver', eng: 'Delivering',         tone: 'aaz',
        tag: 'Delivered', title: 'Delivered to the buyer’s door',
        text: 'Inspected, insured, customs-cleared and on time. One simple order in — finished goods out. Aaziko executed everything in between.',
        chips: ['Door delivery', 'End to end'] }
    ];

    // Aaziko's compulsory work — capability chips that orbit the engine and STAY lit once done,
    // so by the final step the engine is ringed by everything Aaziko handled. `step` = the STEP
    // index at which each one lights up (and remains "done" afterwards, accumulating).
    var CAPS = [
      { label: 'Contracts',  step: 1 },
      { label: 'Inspection', step: 3 },
      { label: 'Maker paid',  step: 3 },
      { label: 'Customs',    step: 4 },
      { label: 'Insurance',  step: 4 },
      { label: 'Logistics',  step: 4 }
    ];
    // the two contracts Aaziko signs (shown only on the contract step): dashed links from the
    // engine to the buyer and to the maker, each carrying a CONTRACT pill.
    var CONTRACTS = [
      { x1: ENG.x - (ENG.r + 2), x2: NODES.buyer.x + (NODES.buyer.r + 2),  px: 273 },
      { x1: ENG.x + (ENG.r + 2), x2: NODES.vendor.x - (NODES.vendor.r + 2), px: 647 }
    ];

    // ---- build the SVG loop ----
    var VB_W = 920, VB_H = 470;
    // SVG is decorative: the process is conveyed to assistive tech by the pip buttons' aria-labels,
    // the caption text, and the static .azflow-fallback list — so hide the SVG to avoid duplication.
    var svg = svgEl('svg', { viewBox: '0 0 ' + VB_W + ' ' + VB_H, 'class': 'azf-map', preserveAspectRatio: 'xMidYMid meet', 'aria-hidden': 'true' });

    var defs = svgEl('defs', {});
    var eg = svgEl('linearGradient', { id: 'azfEngGrad', x1: '0', y1: '0', x2: '0', y2: '1' });
    eg.appendChild(svgEl('stop', { offset: '0%', 'stop-color': '#2A6E56' }));
    eg.appendChild(svgEl('stop', { offset: '100%', 'stop-color': '#144234' }));
    defs.appendChild(eg);
    svg.appendChild(defs);

    // connectors: faint track + colour line that draws on the active leg, plus a leg label
    var connEls = {};
    for (var key in CONNS) {
      var C = CONNS[key];
      var g = svgEl('g', { 'class': 'azf-conn azf-conn--' + C.cls });
      g.appendChild(svgEl('path', { d: C.d, 'class': 'azf-conn__track' }));
      g.appendChild(svgEl('path', { d: C.d, pathLength: '1', 'class': 'azf-conn__line' }));
      var lt = svgEl('text', { x: C.lx, y: C.ly, 'text-anchor': 'middle', 'class': 'azf-conn__lbl' }); lt.textContent = C.label;
      g.appendChild(lt);
      svg.appendChild(g); connEls[key] = g;
    }

    // one glowing token reused on whichever leg is active
    var canOffset = !!(window.CSS && CSS.supports && CSS.supports('offset-path', "path('M0 0 L1 1')"));
    var token = svgEl('circle', { cx: 0, cy: 0, r: 7, 'class': 'azf-token' });
    svg.appendChild(token);

    // buyer + maker nodes
    var nodeEls = {};
    ['buyer', 'vendor'].forEach(function (k) {
      var N = NODES[k];
      var g = svgEl('g', { 'class': 'azf-node azf-node--' + N.cls, role: 'img', 'aria-label': N.label });
      g.appendChild(svgEl('circle', { cx: N.x, cy: N.y, r: N.r, 'class': 'azf-node__ring' }));
      g.appendChild(svgEl('circle', { cx: N.x, cy: N.y, r: N.r, 'class': 'azf-node__c' }));
      var t1 = svgEl('text', { x: N.x, y: N.y - 3, 'text-anchor': 'middle', 'class': 'azf-node__lbl' }); t1.textContent = N.label;
      var t2 = svgEl('text', { x: N.x, y: N.y + 16, 'text-anchor': 'middle', 'class': 'azf-node__sub' }); t2.textContent = N.sub;
      g.appendChild(t1); g.appendChild(t2);
      svg.appendChild(g); nodeEls[k] = g;
    });

    // central Aaziko engine
    var engG = svgEl('g', { 'class': 'azf-eng', role: 'img', 'aria-label': 'Aaziko engine' });
    engG.appendChild(svgEl('circle', { cx: ENG.x, cy: ENG.y, r: ENG.r + 16, 'class': 'azf-eng__halo' }));
    engG.appendChild(svgEl('circle', { cx: ENG.x, cy: ENG.y, r: ENG.r + 9, 'class': 'azf-eng__ring' }));
    engG.appendChild(svgEl('circle', { cx: ENG.x, cy: ENG.y, r: ENG.r, 'class': 'azf-eng__disc' }));
    var etag = svgEl('text', { x: ENG.x, y: ENG.y - 30, 'text-anchor': 'middle', 'class': 'azf-eng__tag' }); etag.textContent = 'EXECUTES EVERYTHING';
    var ename = svgEl('text', { x: ENG.x, y: ENG.y + 6, 'text-anchor': 'middle', 'class': 'azf-eng__name' }); ename.textContent = 'Aaziko';
    var esub = svgEl('text', { x: ENG.x, y: ENG.y + 34, 'text-anchor': 'middle', 'class': 'azf-eng__sub' });
    engG.appendChild(etag); engG.appendChild(ename); engG.appendChild(esub);
    svg.appendChild(engG);

    // the two CONTRACT links (engine ↔ buyer, engine ↔ maker) — shown on the contract step,
    // proving Aaziko is contracted with BOTH sides
    var contractG = svgEl('g', { 'class': 'azf-contract' });
    CONTRACTS.forEach(function (ct) {
      var g = svgEl('g', {});
      g.appendChild(svgEl('line', { x1: ct.x1, y1: ENG.y, x2: ct.x2, y2: ENG.y, 'class': 'azf-contract__line' }));
      var pill = svgEl('g', { 'class': 'azf-contract__pill' });
      pill.appendChild(svgEl('rect', { x: ct.px - 38, y: ENG.y - 11, width: 76, height: 22, rx: 11, 'class': 'azf-contract__pillbg' }));
      var pt = svgEl('text', { x: ct.px, y: ENG.y + 3.5, 'text-anchor': 'middle', 'class': 'azf-contract__pilltxt' }); pt.textContent = 'CONTRACT';
      pill.appendChild(pt); g.appendChild(pill); contractG.appendChild(g);
    });
    svg.appendChild(contractG);

    canvas.appendChild(svg);

    // ---- "What Aaziko handles" rail: Aaziko's compulsory jobs as a clean row BELOW the loop
    // (not crowded around the engine). Each lights up on its step and stays lit, so the full
    // scope accumulates as the animation plays. ----
    var rail = div('azflow-rail');
    var railLbl = div('azflow-rail__lbl'); railLbl.textContent = 'What Aaziko handles';
    rail.appendChild(railLbl);
    var capEls = [];
    CAPS.forEach(function (cp) {
      var chip = div('azflow-rail__chip'); chip.textContent = cp.label;
      rail.appendChild(chip); capEls.push({ g: chip, step: cp.step });
    });
    canvas.appendChild(rail);

    // ---- spotlight caption ----
    var cap = div('azflow-cap');
    var capTag = div('azflow-cap__tag');
    var capTitle = document.createElement('h3'); capTitle.className = 'azflow-cap__title';
    var capText = document.createElement('p'); capText.className = 'azflow-cap__text';
    var capChips = div('azflow-cap__chips');
    cap.appendChild(capTag); cap.appendChild(capTitle); cap.appendChild(capText); cap.appendChild(capChips);
    canvas.appendChild(cap);

    // ---- progress pips (click to jump) ----
    var pipRow = div('azflow-pips');
    var pipEls = [];
    STEPS.forEach(function (st, i) {
      var b = document.createElement('button');
      b.className = 'azflow-pip azflow-pip--' + st.tone;
      b.type = 'button';
      b.setAttribute('aria-label', 'Step ' + (i + 1) + ': ' + st.title);
      b.textContent = ('0' + (i + 1)).slice(-2);
      b.addEventListener('click', function () { setActive(i); restart(); });
      pipRow.appendChild(b); pipEls.push(b);
    });
    canvas.appendChild(pipRow);

    function setActive(i) {
      current = i;
      var st = STEPS[i];
      for (var k in nodeEls) nodeEls[k].classList.toggle('is-active', st.lit.indexOf(k) >= 0);
      engG.classList.toggle('is-active', st.lit.indexOf('aaziko') >= 0);
      engG.classList.toggle('is-working', !st.conn);   // steps with no leg = Aaziko working inside
      for (var c in connEls) connEls[c].classList.toggle('is-active', c === st.conn);
      // capability chips: light up on their step, then stay "done" — so Aaziko's work accumulates
      capEls.forEach(function (cc) { cc.g.classList.toggle('is-done', cc.step < i); cc.g.classList.toggle('is-active', cc.step === i); });
      // the two contracts appear on the contract step (Step 02)
      contractG.classList.toggle('is-on', i === 1);
      // token rides the active leg
      token.classList.remove('is-on');
      if (st.conn && canOffset) {
        token.setAttribute('style', "offset-path: path('" + CONNS[st.conn].d + "');");
        void token.getBoundingClientRect();   // force reflow so the animation restarts
        token.classList.add('is-on');
      }
      esub.textContent = st.eng;
      capTag.textContent = 'Step ' + ('0' + (i + 1)).slice(-2) + ' · ' + st.tag;
      capTitle.textContent = st.title;
      capText.textContent = st.text;
      capChips.innerHTML = '';
      st.chips.forEach(function (cn) { var ch = div('azflow-cap__chip'); ch.textContent = cn; capChips.appendChild(ch); });
      cap.className = 'azflow-cap azflow-cap--' + st.tone;
      cap.classList.remove('is-swap'); void cap.offsetWidth; cap.classList.add('is-swap');
      pipEls.forEach(function (p, j) { p.classList.toggle('is-done', j < i); p.classList.toggle('is-active', j === i); });
    }

    // ---- autoplay loop ----
    var STEP_MS = 3000, END_PAUSE = 3800, current = -1, timer = null, playing = false;
    function advance() {
      if (!playing) return;
      if (document.hidden) { timer = setTimeout(advance, STEP_MS); return; }
      var next = (current + 1) % STEPS.length;
      setActive(next);
      timer = setTimeout(advance, next === STEPS.length - 1 ? END_PAUSE : STEP_MS);
    }
    function play() { if (playing) return; playing = true; clearTimeout(timer); timer = setTimeout(advance, STEP_MS); }
    function stop() { playing = false; clearTimeout(timer); }
    function restart() { clearTimeout(timer); if (playing) timer = setTimeout(advance, STEP_MS + 1200); }

    setActive(0);
    root.classList.add('azflow--ready');

    if (reduce || !('IntersectionObserver' in window)) { root.classList.add('is-static'); return; }
    var inView = false;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { inView = e.isIntersecting; if (e.isIntersecting) play(); else stop(); });
    }, { threshold: 0.25 });
    io.observe(canvas);
    // pause autoplay while a keyboard user is focused inside, so step changes don't fight them
    canvas.addEventListener('focusin', stop);
    canvas.addEventListener('focusout', function () { if (inView) play(); });
    setTimeout(function () {
      if (playing) return;
      var r = canvas.getBoundingClientRect(), vh = window.innerHeight || 800;
      if (r.top < vh * 1.3 && r.bottom > 0) play();
    }, 800);
  })();

  /* ===== KEYNOTE (ACTs 1–6): staged hero lines, scroll reveals, and the
     assembling product-page demo. Mirrors the original standalone page's
     script, but scoped to the .mp-keynote wrappers so it never fights the
     engine diagram above. ===== */
  (function keynote() {
    var scopes = document.querySelectorAll('.mp-keynote');
    if (!scopes.length) return;

    // Only hide-then-reveal once JS is confirmed running (no-JS shows everything).
    scopes.forEach(function (s) { s.classList.add('is-ready'); });

    /* measure sticky nav + credibility bar so the first section (#close) fills
       the rest of the viewport exactly (used by #close.moment's calc); the
       shared header lives outside .mp-keynote, so it is looked up document-wide */
    (function () {
      var nav = document.querySelector('.nav');
      var cred = document.querySelector('.mp-keynote .cred');
      function setChrome() {
        var h = (nav ? nav.offsetHeight : 0) + (cred ? cred.offsetHeight : 0);
        scopes.forEach(function (s) { s.style.setProperty('--mp-chrome', h + 'px'); });
      }
      setChrome();
      window.addEventListener('resize', setChrome);
    })();

    // hero staged lines
    var hero = document.getElementById('mp-hero');
    if (hero) {
      requestAnimationFrame(function () { setTimeout(function () { hero.classList.add('play'); }, 140); });
    }

    if (!('IntersectionObserver' in window)) {
      // No IO: reveal everything so nothing stays hidden.
      document.querySelectorAll('.mp-keynote .reveal').forEach(function (el) { el.classList.add('vis'); });
      document.querySelectorAll('.mp-keynote .wseq').forEach(function (el) { el.classList.add('vis'); });
      var d0 = document.getElementById('mp-demo'); if (d0) d0.classList.add('play');
      return;
    }

    // scroll reveals (.reveal / .wseq → .vis)
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('vis'); io.unobserve(e.target); } });
    }, { threshold: 0.14, rootMargin: '0px 0px -8% 0px' });
    document.querySelectorAll('.mp-keynote .reveal, .mp-keynote .wseq').forEach(function (el) { io.observe(el); });

    // demo assembly: play when the demo enters the viewport
    var demo = document.getElementById('mp-demo');
    if (demo) {
      var io2 = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { if (e.isIntersecting) { demo.classList.add('play'); io2.disconnect(); } });
      }, { threshold: 0.25 });
      io2.observe(demo);
    }
  })();

}
