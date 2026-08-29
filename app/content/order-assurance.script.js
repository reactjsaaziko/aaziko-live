'use client';

// Order Assurance page = the "100% Assurance" keynote ported from aaziko_assurance.html.
// Original inline <script> kept verbatim inside init(), scoped to #aza-assurance
// (js-ready goes on the wrapper instead of <body>, reveals observed within it).
export function init() {
  var page = document.getElementById('aza-assurance');
  if (!page) return;
  page.classList.add('js-ready');

  var $ = function (id) { return document.getElementById(id); };

  /* measure sticky nav + credibility bar so the first section fills the rest of
     the viewport exactly (used by .moment.screen1's calc); the shared header
     lives outside #aza-assurance, so it is looked up document-wide */
  (function () {
    var nav = document.querySelector('.nav');
    var cred = page.querySelector('.cred');
    function setChrome() {
      var h = (nav ? nav.offsetHeight : 0) + (cred ? cred.offsetHeight : 0);
      page.style.setProperty('--aza-chrome', h + 'px');
    }
    setChrome();
    window.addEventListener('resize', setChrome);
  })();

  /* staged hero lines — the hero is no longer the first screen, so the lines
     play when it scrolls into view instead of on page load */
  (function () {
    var h = $('hero');
    if (!h) return;
    var hio = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting) {
          setTimeout(function () { h.classList.add('play'); }, 140);
          hio.unobserve(h);
        }
      });
    }, { threshold: 0.25 });
    hio.observe(h);
  })();

  /* reveal-on-scroll */
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (e.isIntersecting) {
        e.target.classList.add('vis');
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.14, rootMargin: '0px 0px -8% 0px' });
  page.querySelectorAll('.reveal').forEach(function (el) { io.observe(el); });

  /* ===== Assurance demo ===== */
  var STEPS = [
    { s: 'Contract', t: 'Written order contract', w: 'The exact specification, quantity and packing are agreed and locked — buyer, maker and Aaziko, on paper.', r: 'No "close enough". The spec is the spec.' },
    { s: 'Sample', t: 'Sample approved', w: 'The buyer approves a physical sample before a single unit is mass-produced.', r: 'You see it before you commit.' },
    { s: 'Evidence', t: 'Daily production evidence', w: 'Photos and video from the factory floor, every day — the buyer watches the order being made.', r: 'No black box. You watch it happen.' },
    { s: 'Inspection', t: 'Inspection & seal', w: 'Aaziko, a third-party firm, or the buyer inspects the goods against the contract and seals them at the warehouse. The report goes to the buyer.', r: 'Verified — before anything ships.' },
    { s: 'Payment', t: 'Payment on approval', w: 'Only after the buyer approves the inspected goods is the maker paid — in full. Until then, the money is held safely by Aaziko.', r: 'Your money moves only when you say so.' },
    { s: 'Insurance', t: 'Insured in transit', w: 'The shipment is covered, end to end, on the way to the buyer.', r: 'Protected across the ocean too.' },
    { s: 'Grievance', t: 'Grievance cover', w: 'If anything is still wrong, the Aaziko Assurance team steps in — resolution, replacement or refund.', r: 'A real team to call. Guaranteed.' }
  ];
  var N = STEPS.length, prog = 0, timer = null;

  function renderAssure() {
    var pct = Math.round(prog / N * 100), risk = 100 - pct;
    $('asPct').textContent = pct + '%';
    $('shFill').style.transform = 'scaleY(' + (prog / N) + ')';
    $('asRisk').style.width = risk + '%';
    $('asRiskV').textContent = risk + '%';
    var pay = $('asPay');
    if (prog === 0) { pay.className = 'pay exposed'; pay.innerHTML = 'Buyer’s money: <b>exposed</b>'; }
    else if (prog < 5) { pay.className = 'pay'; pay.innerHTML = 'Buyer’s money: <b>held safely by Aaziko</b>'; }
    else { pay.className = 'pay released'; pay.innerHTML = 'Buyer’s money: <b>released — only after your approval</b>'; }
    // chips
    var sc = $('asSteps'); sc.innerHTML = '';
    STEPS.forEach(function (st, i) {
      var b = document.createElement('div');
      b.className = 'as-chip' + (i < prog ? ' done' : '') + (i === prog - 1 ? ' active' : '');
      b.textContent = (i + 1) + ' · ' + st.s;
      b.onclick = function () { stop(); prog = i + 1; renderAssure(); };
      sc.appendChild(b);
    });
    // detail
    var d = $('asDetail');
    if (prog === 0) {
      d.innerHTML = '<div class="dstep">Before Aaziko</div><div class="dt">The buyer is fully exposed.</div><div class="dw">An unknown factory, a paid invoice, and nothing but hope. This is the deal that never happens. Press play to watch the risk disappear.</div>';
    } else if (prog >= N) {
      d.innerHTML = '<div class="dstep">Delivered</div><div class="dt" style="color:var(--emerald)">100% Assured.</div><div class="dw">Every safeguard applied. The goods matched the contract, the money moved only on approval, and Aaziko stood behind all of it. The buyer took <b>zero</b> risk.</div><div class="dr">✓ Risk: 0% · order guaranteed end to end</div>';
    } else {
      var st = STEPS[prog - 1];
      d.innerHTML = '<div class="dstep">Step ' + prog + ' of ' + N + '</div><div class="dt">' + st.t + '</div><div class="dw">' + st.w + '</div><div class="dr">→ ' + st.r + '</div>';
    }
  }
  function stop() { if (timer) { clearInterval(timer); timer = null; } $('asPlay').textContent = '▶ Play the order'; }
  function play() {
    if (timer) { stop(); return; }
    if (prog >= N) { prog = 0; renderAssure(); }
    $('asPlay').textContent = '∥ Pause';
    timer = setInterval(function () {
      prog++; renderAssure();
      if (prog >= N) { stop(); }
    }, 1050);
  }
  $('asPlay').onclick = play;
  renderAssure();
}
