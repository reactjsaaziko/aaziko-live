'use client';
import { initLiveMarket } from './_livemarket.js';
// Home page ("aaziko_home finel" redesign). All behaviour scoped to #azf-home.
// The reference page's rotating globe is replaced by the India dot-map, kept from
// the previous home hero. Reveal-on-scroll, count-ups and the impact simulator are
// ported verbatim from the reference <script>.
export function init() {

  document.body.classList.add('js-ready');
  var root = document.getElementById('azf-home');
  if (!root) return;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var SVGNS = 'http://www.w3.org/2000/svg';

  /* The shared header (outside #azf-home) handles its own mobile menu via enhanceNav. */

  /* ---------- hero: reveal the headline lines ---------- */
  requestAnimationFrame(function () {
    setTimeout(function () {
      var hero = root.querySelector('.hero');
      if (hero) hero.classList.add('lit');
    }, 120);
  });

  /* ================= HERO: India dot-map ================= */
  /* India outline — real national boundary (datameet composite GeoJSON), simplified
     and projected (aspect-corrected equirectangular) into the 400x440 viewBox */
  var INDIA = [
    [156,76.6],[160,76.8],[170.2,71.4],[174.6,71.1],[182.3,77.2],[183.1,75.8],[185.1,76.1],[183.5,83.1],
    [178.5,87.8],[176.7,87.8],[175.4,93],[171.4,92.9],[170.6,94.6],[170.5,100],[172.6,102.1],[175.2,102],
    [174.6,104.3],[176.7,107.9],[170.9,111.5],[168.5,107.6],[164.9,109.4],[168.8,115.5],[168.9,122.9],[172.3,121.5],
    [175.5,126.1],[180.2,126.9],[183.8,129.1],[183.6,131.1],[192.1,135.2],[185.2,140.5],[184.5,146.4],[183.1,147.4],
    [183.8,151.4],[200.6,161.2],[209.2,163],[209.5,165.3],[215.8,167.2],[216.2,165.6],[221.1,167],[223.6,165.1],
    [228.6,167.1],[229.1,170.4],[235.8,173.7],[238.7,172.5],[241.5,175.7],[243.3,174.6],[250.5,177.3],[253.5,176],
    [256.1,177.9],[262.1,176.8],[263.9,178],[265.5,173.6],[263.4,169.7],[264.9,160.3],[270.1,158.5],[272.6,161.2],
    [271.4,164.6],[273,167.3],[271.3,169.3],[275.7,173],[281.7,174.2],[287.7,172],[299.6,173.2],[305.8,172.1],
    [305.9,167.7],[304.8,165.6],[301,165.5],[300.9,162.5],[310.1,161.4],[311.9,160.2],[311.5,158.3],[316.8,154.3],
    [327.5,149.5],[328.5,147],[331.3,145.6],[337.8,147.7],[345.3,144.5],[348.6,146.3],[347.8,148],[349,147.4],
    [351.1,149.4],[352.3,152.2],[349.9,154.1],[350.9,154.9],[353,153],[355.2,155.9],[359.5,157.4],[359.7,159.3],
    [359.4,161.1],[354.8,164.1],[357.2,169.9],[352,166.8],[346.6,168.4],[342.8,172.3],[337.1,175],[337.3,181.2],
    [331.6,188.9],[331.1,190.7],[332.8,192.7],[326.7,206],[318.2,203.4],[318.8,213.9],[317.9,215.3],[316.3,214.8],
    [316.9,223.4],[313.9,227.1],[312.1,224.9],[310.8,226.8],[307.5,207.4],[304.1,207.3],[304.3,210.1],[302.1,212.2],
    [302.9,214.4],[300.7,216],[298.6,212.2],[297.9,214.1],[296,208.5],[298.2,203.1],[300.4,203.4],[301.1,201.7],
    [303.6,202.7],[303.8,200.5],[306.3,199.6],[307,194.3],[309.7,194.5],[309,192.8],[305.1,191.1],[288.7,191.5],
    [282.5,189.9],[282.7,182.2],[280.8,179.4],[279.7,182.4],[277.5,182],[274.7,177.6],[272.9,177.5],[274.2,179.3],
    [270.4,179.1],[271.2,178.2],[267.4,175.4],[267.1,177],[268.9,178],[265.4,180.4],[264.6,183.9],[269.1,187.5],
    [271.8,187.3],[273.9,190.2],[273,191.3],[268.1,190.8],[267.7,193.7],[265,193.9],[264,196.4],[265.5,199],
    [271.1,201.8],[269.3,208.2],[271.7,209.8],[271,212.6],[273.7,213],[272.2,215.3],[274.8,230.3],[270.8,229.6],
    [270.6,225.8],[266.7,231.3],[265.8,225.3],[263.9,224.2],[265.3,225],[261.5,229.9],[255.2,231.5],[251.9,234.7],
    [253,239.7],[251.9,240.1],[253.6,240.9],[250.6,243],[250.3,245.5],[251.2,244.9],[246.9,249.2],[238.2,252.2],
    [231.8,257],[223.4,267.8],[205,281.9],[205,287],[199.1,289.8],[195.1,289.7],[191.1,296.4],[188.7,294.6],
    [184.2,296.9],[182,304.2],[185,323.4],[179,341.3],[180.2,356.4],[174,357.3],[170.2,366],[173,367.9],
    [164.7,370],[161.5,377.9],[156.4,381.2],[152.9,380],[145.9,371.9],[147.2,371.5],[145.8,371.3],[143.9,366.7],
    [139,347.5],[131.8,336.8],[123.7,309.5],[119.1,303.4],[113,287.9],[114,287.6],[111.6,275.6],[108.9,268],
    [110.3,269.3],[110.4,267.4],[109.1,267.4],[108.2,263],[110.1,259.6],[109.1,258.3],[107.7,260.8],[107.3,257.4],
    [108.6,256.7],[107.1,255.4],[108.4,254],[106.7,253.7],[106.4,251.8],[108.5,242.1],[107.7,236.6],[106,236.6],
    [105.6,234.1],[108.5,230.3],[104.9,229.5],[106.9,226.7],[104.5,227.1],[105.2,224.3],[108.5,223.8],[102.7,223.2],
    [101,227],[102.4,230.5],[100.3,235.2],[86.7,240.8],[81,237.6],[68.2,223.9],[68.8,221.5],[70.8,223.7],
    [80.8,220.1],[83.2,215.8],[81,215.1],[75.8,218.3],[71.4,217.4],[64.9,213.6],[62.8,209.5],[66.4,205.6],
    [62.7,206.7],[61.5,209],[60.3,208.3],[61.8,204.6],[65.1,204.6],[66.1,201.1],[78.6,202.4],[83.6,200],
    [86.5,201.8],[90.2,199.5],[85.3,185.2],[82.3,185.5],[80.3,183.5],[80.6,177.4],[79.4,175.4],[73.5,172.7],
    [74.1,170],[84.1,159.4],[88,163],[98,160.3],[102.5,152.2],[108.6,148.5],[114.3,137.9],[119.5,135.4],
    [119.1,132.2],[127,125.5],[125.1,124.8],[126.5,121.6],[124.8,118.4],[126,116.8],[133.9,112.8],[131.2,110],
    [126.9,109.9],[126.9,106],[123.4,106.6],[116.2,103.3],[114.2,86.9],[116.4,86.6],[120.7,82],[116.7,78.3],
    [116.8,76.1],[113.7,76],[109.5,72.4],[105.1,72.4],[104.7,70.2],[113.8,62.4],[128.2,59],[132,59.8],
    [141.9,66.1]
  ];
  function inPoly(x, y, poly) {
    var inside = false;
    for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      var xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
    }
    return inside;
  }
  function outlinePath(poly) {
    return 'M' + poly.map(function (p) { return p[0] + ' ' + p[1]; }).join(' L ') + ' Z';
  }

  var mapSvg = document.getElementById('india-map');
  var caption = document.getElementById('map-caption');
  var dots = [];
  if (mapSvg) {
    (function buildMap() {
      var path = document.createElementNS(SVGNS, 'path');
      path.setAttribute('d', outlinePath(INDIA));
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', '#1E5B47');
      path.setAttribute('stroke-width', '1');
      path.setAttribute('opacity', '0.35');
      mapSvg.appendChild(path);
      var step = 13;
      for (var y = 20; y < 430; y += step) {
        for (var x = 60; x < 360; x += step) {
          if (inPoly(x, y, INDIA)) {
            var c = document.createElementNS(SVGNS, 'circle');
            c.setAttribute('cx', x); c.setAttribute('cy', y); c.setAttribute('r', 3.4);
            c.setAttribute('class', 'india-dot');
            mapSvg.appendChild(c);
            dots.push(c);
          }
        }
      }
    })();

    var mapPhase = 'today';
    function setMapToday() {
      mapPhase = 'today';
      dots.forEach(function (d) { d.classList.remove('lit', 'lit--saffron'); });
      [Math.floor(dots.length * 0.32), Math.floor(dots.length * 0.55)].forEach(function (i) {
        if (dots[i]) dots[i].classList.add('lit');
      });
      if (caption) caption.textContent = 'EACH DOT ≈ 10 LAKH MSMEs · LIT DOTS = EXPORTING TODAY (0.2%)';
    }
    function setMapAaziko() {
      mapPhase = 'aaziko';
      if (caption) caption.textContent = 'WITH AAZIKO — EVERY DISTRICT CONNECTED TO GLOBAL BUYERS';
      dots.forEach(function (d, i) {
        setTimeout(function () { if (mapPhase === 'aaziko') d.classList.add('lit', 'lit--saffron'); }, i * 6 + Math.random() * 120);
      });
    }
    // opening sequence: "today" first, auto-reveal the "with Aaziko" state once.
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        io.disconnect();
        if (reduce) { dots.forEach(function (d) { d.classList.add('lit', 'lit--saffron'); }); return; }
        setMapToday();
        setTimeout(function () { setMapAaziko(); }, 2600);
      });
    }, { threshold: 0.2 });
    io.observe(mapSvg);
  }

  /* ================= reveal-on-scroll + count-ups ================= */
  function animateCount(el) {
    if (reduce) return;
    var target = parseFloat(el.dataset.target), dec = parseInt(el.dataset.decimals || '0', 10), dur = 1250, start = null;
    function tick(ts) {
      if (start === null) start = ts;
      var p = Math.min((ts - start) / dur, 1), e = 1 - Math.pow(1 - p, 3);
      el.textContent = (target * e).toFixed(dec);
      if (p < 1) requestAnimationFrame(tick); else el.textContent = target.toFixed(dec);
    }
    el.textContent = (0).toFixed(dec);
    requestAnimationFrame(tick);
  }
  var io2 = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (!en.isIntersecting) return;
      en.target.classList.add('vis');
      en.target.querySelectorAll('.count').forEach(function (c) {
        if (!c.dataset.done) { c.dataset.done = '1'; animateCount(c); }
      });
      io2.unobserve(en.target);
    });
  }, { threshold: 0.16, rootMargin: '0px 0px -8% 0px' });
  root.querySelectorAll('.reveal').forEach(function (el) { io2.observe(el); });

  /* ================= staggered build-in on scroll (reliable) ================= */
  /* Reveals a section's children one-by-one when it scrolls into view. Every
     element ends fully visible; a 4s safety-timeout guarantees content can never
     stay hidden even if the observer never fires. */
  function staggerReveal(sectionId, selector, step) {
    var sec = document.getElementById(sectionId);
    if (!sec) return;
    var seq = sec.querySelectorAll(selector);
    if (!seq.length) return;
    var played = false;
    function play() {
      if (played) return;
      played = true;
      seq.forEach(function (el, i) { setTimeout(function () { el.classList.add('show'); }, i * step); });
    }
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { play(); io.disconnect(); } });
    }, { threshold: 0.15 });
    io.observe(sec);
    setTimeout(play, 4000);
  }
  staggerReveal('why', '.cbox > *, .stats3 .stat-card', 65);
  staggerReveal('policy', '.gov-item, .activation, .missing', 90);
  staggerReveal('vision', '.vbox, .varrow, .vision-cta', 90);
  staggerReveal('demo', '.step-row', 90);

  /* ================= live marketplace search (#demo) ================= */
  /* Shared Port Brain-styled live box (see _livemarket.js): search bar + 4 real
     products from {marketplace}/product-service/products. */
  initLiveMarket();

  /* ================= impact simulator · the $2T math ================= */
  (function () {
    var rate = document.getElementById('mRate'), val = document.getElementById('mVal');
    if (!rate || !val) return;
    var BASE = 78300000, BASELINE = 863.1, TARGET = 2000, FX = 88;
    var rateOut = document.getElementById('mRateOut'), valOut = document.getElementById('mValOut'),
        oExp = document.getElementById('mExp'), oAdd = document.getElementById('mAdd'),
        oTot = document.getElementById('mTot'), oGap = document.getElementById('mGap'),
        fill = document.getElementById('mFill');
    function count(n) {
      if (n >= 1e7) return (n / 1e7).toFixed(2).replace(/\.?0+$/, '') + ' crore';
      if (n >= 1e5) return (n / 1e5).toFixed(2).replace(/\.?0+$/, '') + ' lakh';
      return Math.round(n).toLocaleString('en-IN');
    }
    function rup(l) { return l >= 100 ? '₹' + (l / 100).toFixed(2).replace(/\.?0+$/, '') + ' crore' : '₹' + l + ' lakh'; }
    function usd(b) { return b >= 1000 ? '$' + (b / 1000).toFixed(2) + ' T' : '$' + Math.round(b) + ' B'; }
    function upd() {
      var pct = +rate.value, per = +val.value;
      var makers = BASE * (pct / 100);
      var added = (makers * per * 100000) / FX / 1e9;   // ₹ lakh → USD billions
      var gap = (added / (TARGET - BASELINE)) * 100;
      rateOut.textContent = pct + '%';
      valOut.textContent = rup(per);
      oExp.textContent = count(makers);
      oAdd.textContent = usd(added);
      oTot.textContent = usd(BASELINE + added);
      oGap.textContent = (gap >= 100 ? '100' : Math.round(gap)) + '%';
      fill.style.width = Math.min(100, gap) + '%';
    }
    rate.addEventListener('input', upd);
    val.addEventListener('input', upd);
    upd();
  })();

  /* ===== $2T section: entrance reveal (ported from the reference .rv fade-up) ===== */
  (function () {
    var sec = document.getElementById('impact');
    if (!sec) return;
    var rvs = sec.querySelectorAll('.rv');
    if (!rvs.length) return;
    var show = function (el) { el.classList.add('in'); };
    if (reduce || !('IntersectionObserver' in window)) {
      rvs.forEach(show);
      return;
    }
    var rio = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { show(e.target); rio.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.06 });
    rvs.forEach(function (el, i) { el.style.transitionDelay = (i * 90) + 'ms'; rio.observe(el); });
    // safety: never leave content hidden if the observer never fires
    setTimeout(function () { rvs.forEach(show); }, 4000);
  })();

}
