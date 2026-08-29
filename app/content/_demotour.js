'use client';

/**
 * Shared cinematic auto-demo tour for the module pages' "Live demonstration" boxes.
 *
 * When the visitor reaches a demo — by scrolling to it, or via the floating
 * "Live demonstration" button that jumps to it — the whole page dims under a fixed
 * overlay, the demo's input bar lifts into a spotlight, and the page's own `script`
 * drives a narrated sequence with the helpers below (type into fields, open a
 * simulated dropdown and pick an option, press the real button). The moment the
 * page's `script` resolves, everything returns to normal. A click anywhere on the
 * dim (or the "Skip demo" chip) fast-forwards via the page's `skip()`.
 *
 * Guarantees: plays once per load; never hijacks a visitor who already started
 * typing (`userStarted`); reduced-motion visitors skip the theatrics and get the
 * seeded result directly (`skip()`); a stuck network can't leave the page dark
 * (`result()` has a hard timeout).
 *
 * Usage (from a page script's init):
 *   runDemoTour({
 *     bar,                       // element lifted into the spotlight (position: relative)
 *     watch,                     // scroll trigger target (default: bar)
 *     liftAlso: [el, …],         // ancestors that create stacking contexts (e.g. a tilted
 *                                //   hero card) — raised above the dim alongside the bar
 *     variant: 'flat',           // lift without the zoom (for large surfaces)
 *     delay: 800,                // ms after scroll-trigger before the tour starts
 *     threshold: 0.6,            // IntersectionObserver visibility threshold
 *     output, resultReady(),     // container + predicate awaited by t.result()
 *     resultTimeout: 15000,
 *     userStarted(),             // true → visitor already interacting, don't play
 *     skip(),                    // seed the example instantly + run the real analysis
 *     script: async (t) => { … } // the narrated sequence
 *   });
 */

var TOUR_SKIP = { tour: 'skipped' }; // sentinel thrown by helpers once the tour stops

export function runDemoTour(opts) {
  if (typeof document === 'undefined') return;
  var bar = opts.bar;
  if (!bar || typeof opts.script !== 'function') return;

  var played = false, finished = false, stopped = false;
  var dim = null;
  var liftAlso = opts.liftAlso || [];

  function guard() { if (stopped) throw TOUR_SKIP; }

  /* ── helpers handed to the page's script ─────────────────────────────── */

  function wait(ms) {
    return new Promise(function (res) { setTimeout(res, ms); }).then(guard);
  }

  // Narration chip pinned above the spotlit bar: "Step x/n · text".
  function caption(step, total, text) {
    var cap = bar.querySelector('.pa-tour-cap');
    if (!cap) {
      cap = document.createElement('div');
      cap.className = 'pa-tour-cap';
      cap.innerHTML = '<span class="pa-tour-cap__step"></span><span class="pa-tour-cap__text"></span>';
      bar.appendChild(cap);
    }
    cap.querySelector('.pa-tour-cap__step').textContent = 'Step ' + step + '/' + total;
    cap.querySelector('.pa-tour-cap__text').textContent = text;
    cap.classList.remove('pa-tour-cap--in');
    void cap.offsetWidth; // restart the slide-in per step
    cap.classList.add('pa-tour-cap--in');
  }

  // Types text into an input character by character under the dark highlight.
  // Sets .value directly (no input events), so pages' own debounced listeners
  // never fire mid-type.
  function type(input, text, ms) {
    input.classList.add('demo-autotype');
    input.value = '';
    var i = 0;
    return new Promise(function (res, rej) {
      (function tick() {
        if (stopped) { rej(TOUR_SKIP); return; }
        input.value = text.slice(0, i);
        if (i++ < text.length) { setTimeout(tick, ms || 42); return; }
        input.classList.remove('demo-autotype');
        res();
      })();
    });
  }

  // A native <select> can't be opened by script, so simulate it: a small option
  // list opens under the field, the highlight scans down to the target option,
  // marks it chosen, closes, and `commit()` sets the real control's value.
  // items: [{ f: '🇦🇺', n: 'Australia', pick: true }, …]
  function pick(anchor, items, commit) {
    var wrap = anchor.parentElement || bar;
    if (getComputedStyle(wrap).position === 'static') wrap.style.position = 'relative';
    anchor.classList.add('demo-autotype');
    var target = 0;
    items.forEach(function (o, ix) { if (o.pick) target = ix; });
    var dd = document.createElement('div');
    dd.className = 'pa-fakedd';
    dd.innerHTML = items.map(function (o) {
      return '<div class="pa-fakedd__item' + (o.pick ? ' pa-fakedd__item--pick' : '') + '">' +
        '<span>' + (o.f || '') + '</span><span>' + o.n + '</span>' +
        (o.pick ? '<span class="pa-fakedd__check">✓</span>' : '') + '</div>';
    }).join('');
    wrap.appendChild(dd);
    var rows = dd.querySelectorAll('.pa-fakedd__item');
    var k = 0;
    return new Promise(function (res, rej) {
      (function scan() {
        if (stopped) { rej(TOUR_SKIP); return; }
        for (var j = 0; j < rows.length; j++) rows[j].classList.remove('pa-fakedd__item--hot');
        rows[k].classList.add('pa-fakedd__item--hot');
        if (k < target) { k++; setTimeout(scan, 150); return; }
        setTimeout(function () {
          if (stopped) { rej(TOUR_SKIP); return; }
          rows[target].classList.remove('pa-fakedd__item--hot');
          rows[target].classList.add('pa-fakedd__item--done');
          setTimeout(function () {
            if (stopped) { rej(TOUR_SKIP); return; }
            dd.style.transition = 'opacity .2s ease, transform .2s ease';
            dd.style.opacity = '0';
            dd.style.transform = 'translateY(-8px)';
            setTimeout(function () {
              if (dd.parentNode) dd.parentNode.removeChild(dd);
              anchor.classList.remove('demo-autotype');
              if (stopped) { rej(TOUR_SKIP); return; }
              if (commit) commit();
              res();
            }, 210);
          }, 520);
        }, 260);
      })();
    });
  }

  // Visibly presses a real button (and actually clicks it unless noClick).
  function press(btn, noClick) {
    if (!btn) return;
    btn.classList.add('pa-pressable');
    btn.classList.add('pa-press');
    setTimeout(function () { btn.classList.remove('pa-press'); }, 380);
    if (!noClick) btn.click();
  }

  // Resolves when the page's result has rendered (predicate true on a mutation of
  // `output`), or after the hard timeout — the page can never stay dark.
  function result() {
    return new Promise(function (res) {
      var done = false, mo = null, tm = null;
      function ok() {
        if (done) return;
        done = true;
        if (mo) mo.disconnect();
        clearTimeout(tm);
        res();
      }
      if (opts.output && opts.resultReady && 'MutationObserver' in window) {
        mo = new MutationObserver(function () { if (opts.resultReady()) ok(); });
        mo.observe(opts.output, { childList: true, subtree: true });
        if (opts.resultReady()) { ok(); return; }
      }
      tm = setTimeout(ok, opts.resultTimeout || 15000);
    });
  }

  /* ── lifecycle ────────────────────────────────────────────────────────── */

  function finish(skipped) {
    if (finished) return;
    finished = true;
    stopped = true;
    Array.prototype.forEach.call(document.querySelectorAll('.pa-fakedd'), function (n) {
      if (n.parentNode) n.parentNode.removeChild(n);
    });
    Array.prototype.forEach.call(document.querySelectorAll('.demo-autotype'), function (n) {
      n.classList.remove('demo-autotype');
    });
    var cap = bar.querySelector('.pa-tour-cap');
    if (cap && cap.parentNode) cap.parentNode.removeChild(cap);
    bar.classList.remove('pa-tour-lift');
    if (opts.variant) bar.classList.remove('pa-tour-lift--' + opts.variant);
    liftAlso.forEach(function (n) { if (n) n.classList.remove('pa-tour-root'); });
    if (dim) {
      var d = dim;
      dim = null;
      d.classList.add('pa-tour-dim--out');
      setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, 340);
    }
    if (skipped && opts.skip) opts.skip();
  }

  function play() {
    if (played || finished) return;
    if (opts.userStarted && opts.userStarted()) { played = true; return; }
    played = true;

    // Reduced motion: no theatrics — seed the example and run it straight away.
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      finished = true;
      stopped = true;
      if (opts.skip) opts.skip();
      return;
    }

    dim = document.createElement('div');
    dim.className = 'pa-tour-dim';
    dim.innerHTML = '<span class="pa-tour-dim__skip">Skip demo ✕</span>';
    dim.addEventListener('click', function () { finish(true); });
    document.body.appendChild(dim);

    bar.classList.add('pa-tour-bar', 'pa-tour-lift');
    if (opts.variant) bar.classList.add('pa-tour-lift--' + opts.variant);
    liftAlso.forEach(function (n) { if (n) n.classList.add('pa-tour-root'); });

    var ctx = { caption: caption, type: type, pick: pick, press: press, wait: wait, result: result };
    wait(opts.settle == null ? 420 : opts.settle)
      .then(function () { return opts.script(ctx); })
      .then(function () { finish(false); })
      .catch(function (e) {
        if (e !== TOUR_SKIP) {
          try { console.error('[aaziko] demo tour failed', e); } catch (_) { /* noop */ }
          finish(false);
        }
      });
  }

  var watch = opts.watch || bar;
  var arm = function () { setTimeout(play, opts.delay || 0); };
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { io.disconnect(); arm(); } });
    }, { threshold: opts.threshold == null ? 0.6 : opts.threshold });
    io.observe(watch);
  } else {
    arm();
  }
}
