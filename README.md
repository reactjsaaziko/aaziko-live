# Aaziko Government Pitch — Next.js (App Router)

A **Next.js** port of the original static `site/` (the Aaziko government pitch website).
The design is preserved **exactly** — same HTML structure, the same `styles.css` byte-for-byte,
the same Google Fonts, and the same interactive scripts (animated India dot-map, scroll
reveals, counters, and all the module calculators/demos).

## How the design is kept identical

Rather than re-author 12 pages of markup (and risk shifting any of the ~343 inline styles),
each page renders its **original `<body>` markup verbatim** and runs its **original script
verbatim**:

- `app/globals.css` — the original `assets/styles.css`, copied unchanged.
- `app/content/<page>.body.html` — the original page body, kept as-is. The only edit is that
  internal links (`marketplace.html` → `/marketplace/`, `index.html` → `/`) are rewritten to
  Next routes. Any page-level `<style>` (e.g. Port Brain) is carried over.
- `app/content/<page>.script.js` — the original inline `<script>`, wrapped in an exported
  `init()` and run once on the client via `useEffect`.
- `app/StaticHtmlPage.js` — shared client component: injects the body HTML and calls `init()`.
- `app/<route>/page.js` — thin server component per route: sets page `<title>`/description
  metadata and renders `StaticHtmlPage`.

## Routes

| Route | Original file |
|---|---|
| `/` | index.html |
| `/marketplace/` | marketplace.html |
| `/product-analysis/` | product-analysis.html |
| `/port-brain/` | port-brain.html |
| `/logistics/` | logistics.html |
| `/customs/` | customs.html |
| `/trade-agreements/` | trade-agreements.html |
| `/inspection/` | inspection.html |
| `/finance/` | finance.html |
| `/order-assurance/` | order-assurance.html |
| `/vision/` | vision.html |
| `/partnership/` | partnership.html |

## Develop

```bash
npm install
npm run dev      # http://localhost:3000
```

## Build & deploy (static)

```bash
npm run build    # outputs a fully static site to ./out
```

`next.config.js` uses `output: 'export'`, so `./out` is plain static HTML/CSS/JS deployable to
any host — drag onto Vercel/Netlify, push to GitHub Pages, or serve from Nginx/Apache. No
server-side logic is required (identical to the original site).

## Regenerating from the original site

The per-route files under `app/content/` and each `app/**/page.js` are generated from the
original `../site/*.html` by:

```bash
node scripts/generate.mjs
```

Edit the original HTML and re-run to regenerate, **or** edit the files under `app/` directly —
once you start hand-editing a page you can stop using the generator for it. To convert a page to
idiomatic JSX later, replace that route's `page.js` with hand-written components; no other route
is affected.
# aaziko-live
