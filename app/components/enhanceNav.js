'use client';

/**
 * Progressive enhancement for the shared marketing-site top nav.
 *
 * Every page injects an identical <nav class="nav"> via dangerouslySetInnerHTML, and on
 * small screens the .nav__links row is collapsed by CSS. This helper adds the hamburger
 * toggle button and wires it to a `nav--open` class so the links become a slide-down
 * panel — making every route's navigation usable on mobile from a single code path.
 *
 * It is idempotent (guards against a second injection) and a no-op when no nav exists,
 * so it is safe to call on every page mount.
 */
export function enhanceNav() {
  if (typeof document === 'undefined') return;

  const nav = document.querySelector('.nav');
  if (!nav) return;

  const inner = nav.querySelector('.nav__inner');
  const links = nav.querySelector('.nav__links');
  if (!inner || !links) return;

  // Highlight the tab for the page currently being viewed. Matching on the resolved
  // pathname keeps this correct under the /live sub-path (both the link and the URL
  // carry the same prefix). Skip the CTA button and in-page anchors (Indian Clusters).
  const norm = (p) => (p || '/').replace(/\/+$/, '') || '/';
  const here = norm(window.location.pathname);
  links.querySelectorAll('a').forEach((a) => {
    if (a.classList.contains('nav__cta')) return;
    if ((a.getAttribute('href') || '').includes('#')) return;
    if (norm(a.pathname) === here) a.setAttribute('aria-current', 'page');
  });

  // ── Floating "Live demonstration" button ────────────────────────────────────
  // Every module page ships an interactive live-demo section; float a button on the
  // page's right edge (not in the menu line) that jumps straight to it, so users know
  // each page has a working demo. The anchor differs per route, so map the current
  // route's slug — the last path segment, which stays correct under the optional
  // /live basePath — to its in-page demo id. Routes absent from the map (home,
  // finance, order-assurance, vision, partnership) simply don't get the button.
  const DEMO_ANCHORS = {
    marketplace: '#lmkt',
    'product-analysis': '#demo',
    'port-brain': '#demo',
    logistics: '#cost',
    customs: '#demo',
    'trade-agreements': '#demo',
    inspection: '#demo',
  };
  const segs = window.location.pathname.split('/').filter(Boolean);
  const demoAnchor = DEMO_ANCHORS[segs[segs.length - 1] || ''];
  if (demoAnchor && !document.querySelector('.demo-fab')) {
    const fab = document.createElement('a');
    fab.href = demoAnchor;
    fab.className = 'demo-fab';
    fab.setAttribute('aria-label', 'Jump to the live demonstration on this page');
    // The label carries a hidden extrabold twin (via data-text + CSS grid-stack) that
    // locks the button's width, so the blinking font-weight never resizes the pill.
    fab.innerHTML =
      '<span class="demo-fab__dot" aria-hidden="true"></span>' +
      '<span class="demo-fab__label" data-text="Live demonstration"><span>Live demonstration</span></span>';
    document.body.appendChild(fab);
  }

  if (inner.querySelector('.nav__toggle')) return; // already enhanced

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'nav__toggle';
  btn.setAttribute('aria-label', 'Toggle navigation menu');
  btn.setAttribute('aria-expanded', 'false');
  btn.setAttribute('aria-controls', 'nav-links');
  btn.innerHTML = '<span></span><span></span><span></span>';

  if (!links.id) links.id = 'nav-links';

  const setOpen = (open) => {
    nav.classList.toggle('nav--open', open);
    btn.classList.toggle('is-open', open);
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  };

  btn.addEventListener('click', () => {
    setOpen(!nav.classList.contains('nav--open'));
  });

  // Tapping any link (in-page anchor or route) should close the panel.
  links.addEventListener('click', (e) => {
    if (e.target.closest('a')) setOpen(false);
  });

  // Always reset to the closed/desktop state when the viewport grows past the breakpoint.
  const mq = window.matchMedia('(min-width: 961px)');
  const onChange = () => { if (mq.matches) setOpen(false); };
  if (mq.addEventListener) mq.addEventListener('change', onChange);
  else if (mq.addListener) mq.addListener(onChange);

  inner.appendChild(btn);
}
