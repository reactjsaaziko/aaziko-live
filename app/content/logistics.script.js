'use client';
import { runDemoTour } from './_demotour.js';

// Logistics page = the "one number" keynote ported from aaziko_logistics.html.
// This script drives the keynote's staged hero lines and scroll reveals (ported
// verbatim from the source file's inline script). Neither calculator box is
// scripted here — the REAL buyer-side "Logistic Cost" tool (CargoDetailsContent)
// is mounted by LogisticsLive.tsx into #load-output (Part 1, load-only) and
// #log-output (Part 2, full tool with freight pricing).
export function init() {
  var root = document.querySelector('.lg-keynote');
  if (!root) return;

  // Only hide-then-reveal once JS is confirmed running (no-JS shows everything).
  root.classList.add('is-ready');

  var $ = function (id) { return document.getElementById(id); };

  // staged hero lines
  requestAnimationFrame(function () {
    setTimeout(function () {
      var h = $('lg-hero');
      if (h) h.classList.add('play');
    }, 140);
  });

  // scroll reveals (.reveal → .vis)
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('vis'); io.unobserve(e.target); }
      });
    }, { threshold: 0.14, rootMargin: '0px 0px -8% 0px' });
    root.querySelectorAll('.reveal').forEach(function (el) { io.observe(el); });
  } else {
    // No IO: reveal everything so nothing stays hidden.
    root.querySelectorAll('.reveal').forEach(function (el) { el.classList.add('vis'); });
  }

  /* Self-playing cinematic demo (shared engine): the landed-cost calculator is the
     REAL React tool, so the tour drives it for real — it opens the destination-port
     dropdown, picks Rotterdam, and commits through the native value setter + a
     'change' event so React's onChange fires and the engine re-quotes the new route
     with live partner rates. Normal again once the re-quote is on screen. */
  (function autoPlayDemo() {
    var calc = document.querySelector('#cost .calc');
    var outEl = document.getElementById('log-output');
    if (!calc || !outEl) return;

    // The tool mounts async; the destination port is the 2nd <select> (origin is 1st).
    var destSel = function () { return outEl.querySelectorAll('select')[1] || null; };
    var setDest = function (port) {
      var sel = destSel();
      if (!sel) return;
      var setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
      setter.call(sel, port);
      sel.dispatchEvent(new Event('change', { bubbles: true })); // → React onChange → live re-quote
    };

    runDemoTour({
      bar: calc,
      variant: 'flat',
      delay: 900,
      threshold: 0.25,
      output: outEl,
      resultTimeout: 12000,
      resultReady: function () {
        var txt = outEl.textContent || '';
        return /ROTTERDAM/i.test(txt) && /[$₹]\s?[\d,]/.test(txt);
      },
      userStarted: function () { return false; },
      skip: function () { setDest('ROTTERDAM'); },
      script: async function (t) {
        t.caption(1, 2, 'This is the real Aaziko landed-cost engine — live, not a mock-up…');
        // Wait for the React tool (and its first live quote) to be on screen.
        for (var i = 0; i < 20 && !destSel(); i++) { await t.wait(300); }
        await t.wait(1200);
        var sel = destSel();
        if (sel) {
          t.caption(2, 2, 'Changing the destination — Jebel Ali → Rotterdam, re-quoted live…');
          await t.pick(sel, [
            { f: '🇦🇪', n: 'JEBEL ALI' }, { f: '🇩🇪', n: 'HAMBURG' },
            { f: '🇳🇱', n: 'ROTTERDAM', pick: true }, { f: '🇰🇷', n: 'BUSAN' },
            { f: '🇬🇧', n: 'FELIXSTOWE' }
          ], function () { setDest('ROTTERDAM'); });
          await t.wait(600); // let the re-quote begin
          await t.result();
          await t.wait(600);
        } else {
          t.caption(2, 2, 'Quoting Nhava Sheva → Jebel Ali with live partner rates…');
          await t.result();
          await t.wait(900);
        }
      },
    });
  })();
}
