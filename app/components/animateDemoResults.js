'use client';

/**
 * Makes every page's "Live demonstration" result feel alive. Whenever a demo renders
 * (or re-renders) into one of its result containers, the freshly-injected blocks fade
 * and rise in with a stagger — so the answer assembles itself instead of snapping in —
 * and any stat headline numbers count up from zero.
 *
 * One MutationObserver-based path covers every route regardless of the bespoke markup
 * each demo produces. It respects prefers-reduced-motion, is idempotent, and is a no-op
 * on pages without a demo.
 */
export function animateDemoResults() {
  if (typeof document === 'undefined') return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  // The result containers each page renders into (a superset; absent ones are skipped).
  const OUTPUT_SEL = [
    '.demo-output', // finance, inspection, trade-agreements
    '#pa-output',   // product-analysis
    '#lmkt-grid',   // marketplace, home
    '#pb-list',     // port-brain
    '#cu-results',  // customs
    '#log-output',  // logistics
  ];

  const STEP = 70;       // ms between successive blocks
  const MAX_DELAY = 640; // cap so long lists don't crawl in

  // Count a plain numeric stat up from zero, preserving its prefix/suffix ("$0.9 Bn",
  // "50", "+6.2% YoY", "11%"). Skips anything with child elements (e.g. a live-updating
  // cell) or no parseable number, and restores the exact original text at the end.
  const countUp = (el) => {
    if (el.dataset.counted || el.children.length) return;
    const raw = el.textContent.trim();
    const m = raw.match(/^([^\d-]*)(-?\d[\d,]*\.?\d*)(.*)$/);
    if (!m) return;
    const target = parseFloat(m[2].replace(/,/g, ''));
    if (!isFinite(target)) return;
    el.dataset.counted = '1';
    const prefix = m[1], suffix = m[3];
    const decimals = (m[2].split('.')[1] || '').length;
    const dur = 780, t0 = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - t0) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      if (t < 1) {
        el.textContent = prefix + (target * eased).toFixed(decimals) + suffix;
        requestAnimationFrame(tick);
      } else {
        el.textContent = raw; // exact original formatting
      }
    };
    requestAnimationFrame(tick);
  };

  const reveal = (container) => {
    const kids = Array.from(container.children).filter((n) => n.nodeType === 1);
    kids.forEach((el, i) => {
      el.classList.remove('demo-rise');
      void el.offsetWidth; // restart the animation on re-render
      el.style.animationDelay = Math.min(i * STEP, MAX_DELAY) + 'ms';
      el.classList.add('demo-rise');
    });
    container.querySelectorAll('.aaz-statval').forEach(countUp);
  };

  const containers = new Set();
  OUTPUT_SEL.forEach((sel) => document.querySelectorAll(sel).forEach((c) => containers.add(c)));

  containers.forEach((container) => {
    if (container.dataset.demoAnimated) return; // idempotent
    container.dataset.demoAnimated = '1';

    if (container.children.length) reveal(container); // animate the default result already present

    let raf = 0;
    const mo = new MutationObserver((muts) => {
      if (!muts.some((m) => m.addedNodes && m.addedNodes.length)) return;
      if (raf) cancelAnimationFrame(raf); // coalesce bursty innerHTML writes into one pass
      raf = requestAnimationFrame(() => { raf = 0; reveal(container); });
    });
    mo.observe(container, { childList: true });
  });
}
