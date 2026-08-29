'use client';

import { useEffect, useRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import React from 'react';
import { CargoDetailsContent } from './CargoDetailsContent';
import { enhanceNav } from '@/app/components/enhanceNav';

/**
 * Renders the logistics keynote body verbatim (ported from aaziko_logistics.html) and
 * mounts the REAL buyer-side "Logistic Cost" popup (CargoDetailsContent) twice — the
 * tool is split across the keynote's two acts:
 *   • Part 1 "Load Calculator" shell (#load-output) — with hideShippingSection, so only
 *     the load-calculator part shows (cargo table + 3D load plan, no pricing);
 *   • Part 2 "Landed-Cost Calculator" shell (#log-output) — with hideLoadSection, so
 *     only the pricing part shows (address/ports + live freight quote cards).
 * The keynote's own interactivity (staged hero, scroll reveals) lives in
 * content/logistics.script.js, loaded here the same way StaticHtmlPage loads the other
 * pages' scripts.
 */
export default function LogisticsLive({ html }: { html: string }) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const reactRootRef = useRef<Root | null>(null);
  const loadRootRef = useRef<Root | null>(null);
  const didInit = useRef(false);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    // Make the shared top nav mobile-usable (hamburger + slide-down panel).
    enhanceNav();

    // Keynote interactivity: staged hero lines, scroll reveals, Load Calculator.
    if (!didInit.current) {
      didInit.current = true;
      import('@/app/content/logistics.script.js')
        .then((mod) => {
          if (typeof mod.init === 'function') mod.init();
        })
        .catch((err) => {
          // Non-fatal: the static markup still renders; only interactivity is affected.
          console.error('[aaziko] failed to init script for "logistics"', err);
        });
    }

    // Part 1 — load calculator only (no address/ports/freight pricing).
    const loadOut = root.querySelector<HTMLElement>('#load-output');
    if (loadOut) {
      loadOut.innerHTML = '';
      if (!loadRootRef.current) {
        loadRootRef.current = createRoot(loadOut);
      }
      loadRootRef.current.render(
        // Same wrapper the buyer product page uses around the popup (slate bg + white card).
        <div className="rounded-lg bg-slate-50 px-1 py-2 sm:px-2 sm:py-3">
          <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
            <CargoDetailsContent hideShippingSection />
          </div>
        </div>,
      );
    }

    // Part 2 — pricing only (address/ports + live freight quote cards); the
    // cargo/load half already lives in the Part-1 box above.
    const out = root.querySelector<HTMLElement>('#log-output');
    if (out) {
      out.innerHTML = '';
      if (!reactRootRef.current) {
        reactRootRef.current = createRoot(out);
      }
      reactRootRef.current.render(
        <div className="rounded-lg bg-slate-50 px-1 py-2 sm:px-2 sm:py-3">
          <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
            <CargoDetailsContent hideLoadSection />
          </div>
        </div>,
      );
    }

    return () => {
      // Defer unmounts to avoid React "synchronous unmount during render" warning.
      const r = reactRootRef.current;
      const lr = loadRootRef.current;
      reactRootRef.current = null;
      loadRootRef.current = null;
      if (r || lr) setTimeout(() => { r?.unmount(); lr?.unmount(); }, 0);
    };
  }, []);

  return <div ref={rootRef} dangerouslySetInnerHTML={{ __html: html }} />;
}
