'use client';

import { useEffect, useRef } from 'react';
import { enhanceNav } from '@/app/components/enhanceNav';
import { enhanceDemoFields } from '@/app/components/enhanceDemoFields';
import { animateDemoResults } from '@/app/components/animateDemoResults';

/**
 * Renders an original page body verbatim (via dangerouslySetInnerHTML so every class,
 * id and inline style is preserved byte-for-byte) and runs that page's original
 * vanilla-JS script exactly once, after the markup is in the DOM.
 *
 * The script for each route lives in ./content/<slug>.script.js and exports `init()`.
 * It is loaded dynamically inside useEffect so it only ever evaluates on the client.
 */
export default function StaticHtmlPage({ html, slug }) {
  const didInit = useRef(false);

  useEffect(() => {
    if (didInit.current) return; // guard against any double-invoke
    didInit.current = true;

    // Make the shared top nav mobile-usable (hamburger + slide-down panel).
    enhanceNav();
    // Light up each live-demo form field as the visitor fills it in.
    enhanceDemoFields();
    // Stagger-reveal each live-demo result as it renders (observers set up before the
    // page script below runs, so the first render is caught too).
    animateDemoResults();

    let cancelled = false;
    import(`./content/${slug}.script.js`)
      .then((mod) => {
        if (!cancelled && typeof mod.init === 'function') mod.init();
      })
      .catch((err) => {
        // Non-fatal: the static markup still renders; only interactivity is affected.
        console.error(`[aaziko] failed to init script for "${slug}"`, err);
      });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
