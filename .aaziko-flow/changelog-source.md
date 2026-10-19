---
title: "Change Documentation — aaziko-live"
---

# Change Documentation — aaziko-live

> Auto-generated on every push, to any branch. Newest entry first. Old entries are never removed.

<!-- AAZIKO-CHANGELOG:INSERT-AFTER -->

## 2026-10-19 16:13 — branch `main`

### Overview

This push to branch `main` changed **2 file(s)**: 2 new, 0 modified, 0 removed (+457 / −0 lines).

Main areas touched: `.aaziko-flow` (1), `.github/workflows` (1).

### New files

#### `.aaziko-flow/changelog.mjs`

*New file — 347 lines*

- Defines: `sh`, `shSafe`, `git`, `esc`, `code`, `list`, `repo`, `declName`, `collect`, `minusSet` and 9 more.
- Uses: `node:child_process`, `node:fs`, `node:path`.
- Reads environment variables: `BEFORE_SHA`, `AFTER_SHA`, `BASE_BRANCH`, `BRANCH`.

**Other new files**

- `.github/workflows/aaziko-changelog.yml` — 110 lines

### Impact

- Code now reads `BEFORE_SHA` — make sure it is set in the `.env` / deployment.
- Code now reads `AFTER_SHA` — make sure it is set in the `.env` / deployment.
- Code now reads `BASE_BRANCH` — make sure it is set in the `.env` / deployment.
- Code now reads `BRANCH` — make sure it is set in the `.env` / deployment.
- Build/deploy configuration changed: `.github/workflows/aaziko-changelog.yml` — re-check the build and deployment.

---

<!-- AAZIKO-CHANGELOG:HISTORY-START -->

> **History before automatic documentation was switched on** — one entry per day of the `main` branch, newest first.

## 2026-09-26 — branch `main` (history)

### Overview

On this day, branch `main` received changes to **1 file(s)**: 1 new, 0 modified, 0 removed (+94 / −0 lines).

Main areas touched: `.github/workflows` (1).

### New files

**Other new files**

- `.github/workflows/backup-to-gitlab.yml` — 94 lines

### Impact

- Build/deploy configuration changed: `.github/workflows/backup-to-gitlab.yml` — re-check the build and deployment.

---

## 2026-08-29 — branch `main` (history)

### Overview

On this day, branch `main` received changes to **86 file(s)**: 86 new, 0 modified, 0 removed (+24715 / −0 lines).

Main areas touched: `app/content` (31), `app` (12), `(project root)` (11), `analytics-server` (9), `app/components` (4), `app/components/logistic-cost` (3).

### New files

#### `app/components/logistic-cost/CargoDetailsContent.tsx`

*New file — 4296 lines*

- Defines: `ProductInput`, `Visualization3D`, `Alert`, `CircularProgress`, `CustomTextField`, `useFetchMutation`, `promise`, `useCalculateMultipleContainersMutation`, `useGetEnhanced3DVisualizationMutation`, `_Donut`, `VoyageCard`, `fmtUsd`, `onWheel`, `Box`, `recompute`, `adjustColor`, `f`, `gridBg`, `rowFaceStyle`, `endFace`, `CargoDetailsContentProps`, `CargoDetailsContent`, `PortOpt`, `PortHint`, `portOptions`, `CargoTypeOption`, `isCylinder`, `nameMatchesSize`, `lengthMatchesSize`, `sizeMatches`, `clampedContainerIdx`, `toM`, `render`.
- Uses: `react`, `next/dynamic`, `@/app/content/_api`.

#### `app/content/product-analysis.script.js`

*New file — 1730 lines*

- Defines: `init`, `ftaFor`, `esc`, `fmtPct`, `pctClass`, `pctVal`, `pctStr`, `numOrNull`, `curatedMatches`, `liveMatches`, `showSuggestions`, `resolveHs`, `productKeyForHs`, `metric`, `buyersCell`, `statStrip`, `profilePanel`, `whereToWin`, `playbookPanel`, `liveTag`, `mapModRow`, `recToPbSteps`, `renderRecommendations`, `renderRecBodies`, `miniLoader`, `pbCertHTML`, `marginHTML`, `competitorsHTML`, `ftaHTML`, `renderCompetitors`, `pbBodyHTML`, `renderPbBody`, `wtwBodyHTML`, `renderWtwBody`, `aiBar`, `normText`, `itemDetail`, `uniqueDetail`, `normItems`, `normBlocks`, `sleep`, `laneReqs`, `macmapHasStage`, `macmapHasAny`, `macmapReqToLiveItem`, `field`, `laneToggleHTML`, `pill`, `macmapStageHTML`, `pollMacmap`, `cmpTabsInner`, `cmpChevron`, `cmpNoteRow`, `itemsGridHTML`, `cmpBodyHTML`, `laneToggleActive`, `renderCmpBody`, `certBody`, `certBodyHTML`, `renderCertBody`, `certPanel`, `marketAnalysisPanel`, `marketBodyHTML`, `renderMarketBody`, `ctaPanel`, `toTitle`, `fmtAmount`, `fmtQty`, `fmtPrice`, `buyersPanelShell`, `buyerCard`, `buyerDetail`, `renderBuyersBody`, `renderBuyers`, `collectMacmapMeasures`, `fetchMacmap`, `measuresHTML`, `complianceBaselineHTML`, `items`, `blocks`, `card`, `compliancePanelShell`, `renderCompliance`, `renderFallback`, `render`, `selectCountry`, `setActiveTab`.
- Uses: `./_api.js`, `./_demotour.js`.

#### `analytics-server/index.js`

*New file — 1190 lines*

- Defines: `TEXT`, `pageKey`, `pageLabel`, `utcDay`, `refHost`, `ipHash`, `clip`, `geoLookup`, `isPublicIp`, `fetchGeoExternal`, `finish`, `countryName`, `auth`, `cutoff`, `aggregate`, `touchVisitor`, `buildStats`, `windowSummary`, `buildVisitor`, `csvCell`, `istTime`, `esc`, `num`, `when`, `cc`, `loc`, `locText`, `respChip`, `result`, `loadResp`, `renderResp`, `closeResp`, `renderGeo`, `renderVisitors`, `loadVisitor`, `load`, `render`, `syncDl`, `startOfLocalDay`, `localDateLabel`, `pct`, `buildDigest`, `kpi`, `mailTransport`, `sendDigest`, `msUntilNextDigest`, `scheduleDigest`, `runRetention`, `scheduleRetention`.
- Adds API endpoints: `GET /healthz`, `POST /api/track`, `GET /live-stats/api/stats`, `GET /api/stats`.
- Uses: `path`, `fs`, `crypto`, `https`, `express`, `better-sqlite3`, `nodemailer`, `geoip-lite`, `./world-path.js`.
- Reads environment variables: `ANALYTICS_PORT`, `ANALYTICS_USER`, `ANALYTICS_PASS`, `ANALYTICS_SALT`, `GEO_CITY_FALLBACK`, `DIGEST_ENABLED`, `DIGEST_TO`, `DIGEST_HOUR`, `DIGEST_TZ_OFFSET_MIN`, `SITE_URL`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `DIGEST_FROM`, `RETENTION_DAYS`.

#### `app/content/customs.script.js`

*New file — 625 lines*

- Defines: `init`, `initPage`, `setChrome`, `initLiveBox`, `esc`, `debounce`, `flag`, `countryDropdown`, `close`, `open`, `digits`, `classify`, `critToImp`, `chip`, `reqAccordion`, `plainRow`, `guideBlock`, `plainBlock`, `warningsHTML`, `guideHasItems`, `any`, `guideListFor`, `collectMacmap`, `updateRegCount`, `macmapHTML`, `startLoading`, `defaultTitle`, `renderTab`, `renderActive`, `consumerContent`, `fetchCountryHs`, `fetchMacmap`, `analyze`, `flash`.
- Uses: `./_api.js`, `./_demotour.js`.

#### `app/content/port-brain.script.js`

*New file — 611 lines*

- Defines: `init`, `esc`, `safeDecode`, `titleCase`, `flagFor`, `scoreFor`, `tierBadge`, `ringHTML`, `cardHTML`, `note`, `fmt`, `countryMatches`, `closeCountryMenu`, `chooseCountry`, `renderCountryMenu`, `searchUrl`, `itemsOf`, `dedupeByName`, `productSearch`, `say`, `settle`, `vocab`, `editDistLe`, `correctProductTerm`, `runTextSearch`, `search`, `progress`, `updateHeadline`, `fmtIndianScale`, `setAll`.
- Uses: `./_api.js`, `./_demotour.js`, `./_hswords.js`.

#### `app/components/logistic-cost/AirLandModel3D.tsx`

*New file — 563 lines*

- Defines: `Model3DProduct`, `AirLandModel3DProps`, `Placement`, `uldChamfer`, `packBoxes`, `insideContour`, `useUldGeometry`, `Cargo`.
- Uses: `react`, `@react-three/fiber`, `@react-three/drei`, `three`.

#### `app/content/marketplace.script.js`

*New file — 455 lines*

- Defines: `init`, `productSpotlight`, `setMain`, `svgEl`, `div`, `setActive`, `advance`, `play`, `stop`, `restart`, `setChrome`.
- Uses: `./_livemarket.js`, `./_demotour.js`.

#### `app/components/AnalyticsTracker.js`

*New file — 413 lines*

- Defines: `endpoint`, `rid`, `stored`, `applyOptOutParam`, `optedOut`, `send`, `fieldText`, `fieldLabel`, `collectQuery`, `isTrigger`, `summarizeResult`, `absUrl`, `snapshotHtml`, `captureResult`, `fire`, `AnalyticsTracker`, `scan`, `onInteract`.
- Uses: `react`, `next/navigation`.

#### `app/content/trade-agreements.script.js`

*New file — 312 lines*

- Defines: `init`, `esc`, `countryLabel`, `relationLabel`, `closeProductMenu`, `chooseProduct`, `findProducts`, `productTokens`, `resolveProduct`, `statusBadge`, `members`, `agreementCard`, `loadPartners`, `search`.
- Uses: `./_api.js`, `./_demotour.js`.

#### `app/content/home.script.js`

*New file — 244 lines*

- Defines: `init`, `inPoly`, `outlinePath`, `setMapToday`, `setMapAaziko`, `animateCount`, `tick`, `staggerReveal`, `play`, `count`, `rup`, `usd`, `upd`.
- Uses: `./_livemarket.js`.

#### `app/content/_demotour.js`

*New file — 238 lines*

- Defines: `runDemoTour`, `guard`, `wait`, `caption`, `type`, `pick`, `press`, `result`, `ok`, `finish`, `play`.

#### `app/content/_livemarket.js`

*New file — 168 lines*

- Defines: `esc`, `absMedia`, `imgUrl`, `imgUrls`, `unitPrice`, `moq`, `money`, `initLiveMarket`, `select`, `render`, `search`.
- Uses: `./_api.js`.

#### `app/content/_api.js`

*New file — 140 lines*

- Defines: `getJSON`, `postJSON`, `loadingHTML`, `sourceTag`.

#### `app/content/inspection.script.js`

*New file — 138 lines*

- Defines: `init`, `render`.
- Uses: `./_demotour.js`.

#### `app/content/_indiamap.js`

*New file — 134 lines*

- Defines: `inPoly`, `outlinePath`, `initIndiaMap`, `setToday`, `setAaziko`.

#### `scripts/generate.mjs`

*New file — 130 lines*

- Defines: `decodeEntities`, `extractTitle`, `extractDescription`, `extractHeadStyles`, `splitBody`, `rewriteLinks`.
- Uses: `node:fs`, `node:path`, `node:url`.

#### `tests/live-response-capture.test.js`

*New file — 116 lines*

- Defines: `sleep`, `fill`, `click`, `submit`, `pick`, `selOpt`, `drive`, `runOnCollector`, `readDb`, `purge`.
- Uses: `/home/aaziko/aaziko/node_modules/puppeteer-core`, `child_process`, `${DB_NM}`.

#### `app/content/order-assurance.script.js`

*New file — 108 lines*

- Defines: `init`, `setChrome`, `renderAssure`, `stop`, `play`.

#### `app/components/enhanceNav.js`

*New file — 100 lines*

- Defines: `enhanceNav`, `norm`, `setOpen`, `onChange`.

#### `app/content/logistics.script.js`

*New file — 97 lines*

- Defines: `init`.
- Uses: `./_demotour.js`.

#### `app/components/logistic-cost/LogisticsLive.tsx`

*New file — 92 lines*

- Defines: `LogisticsLive`.
- Uses: `react`, `react-dom/client`, `./CargoDetailsContent`, `@/app/components/enhanceNav`.

#### `app/components/animateDemoResults.js`

*New file — 85 lines*

- Defines: `animateDemoResults`, `countUp`, `tick`, `reveal`.

#### `app/components/enhanceDemoFields.js`

*New file — 65 lines*

- Defines: `enhanceDemoFields`, `isField`, `hasValue`, `flash`, `onEdit`.

#### `app/content/finance.script.js`

*New file — 60 lines*

- Defines: `init`, `fmt`, `calc`.

#### `app/content/home-final.script.js`

*New file — 54 lines*

- Defines: `init`, `count`, `rup`, `usd`, `go`.
- Uses: `./_indiamap.js`, `./_livemarket.js`.

#### `analytics-server/seed-sample.js`

*New file — 48 lines*

- Defines: `utcDay`.
- Uses: `path`, `better-sqlite3`, `fs`.

#### `app/StaticHtmlPage.js`

*New file — 47 lines*

- Defines: `StaticHtmlPage`.
- Uses: `react`, `@/app/components/enhanceNav`, `@/app/components/enhanceDemoFields`, `@/app/components/animateDemoResults`.

#### `app/content/partnership.script.js`

*New file — 40 lines*

- Defines: `init`, `fmtLiveValue`, `simulateLiveData`, `pollLiveData`.

#### `app/layout.js`

*New file — 37 lines*

- Defines: `RootLayout`.
- Uses: `./globals.css`, `./tailwind.css`, `@/app/components/AnalyticsTracker`.

#### `package.json`

*New file — 30 lines*

- Added package `@react-three/drei` ^9.122.0
- Added package `@react-three/fiber` ^8.18.0
- Added package `html2canvas` ^1.4.1
- Added package `next` 14.2.35
- Added package `react` 18.3.1
- Added package `react-dom` 18.3.1
- Added package `three` ^0.169.0
- Added package `@types/node` ^25.9.3
- Added package `@types/react` ^19.2.17
- Added package `@types/react-dom` ^19.2.3
- Added package `autoprefixer` ^10.5.0
- Added package `postcss` ^8.5.15
- Added package `tailwindcss` ^3.4.19
- Added package `typescript` ^6.0.3
- Added npm script `dev`
- Added npm script `build`
- Added npm script `start`
- Added npm script `lint`

#### `next.config.js`

*New file — 25 lines*

- Data / content file (no functions or components).
- Reads environment variables: `AAZIKO_BASE_PATH`.

#### `app/page.js`

*New file — 19 lines*

- Defines: `Page`.
- Uses: `@/app/StaticHtmlPage`, `@/app/content/home-final.body.html`, `@/app/home-final.css`.

#### `app/home-classic/page.js`

*New file — 18 lines*

- Defines: `Page`.
- Uses: `@/app/StaticHtmlPage`, `@/app/content/home.body.html`, `@/app/home.css`.

#### `analytics-server/package.json`

*New file — 16 lines*

- Added package `better-sqlite3` ^11.8.1
- Added package `express` ^4.21.2
- Added package `geoip-lite` ^1.4.10
- Added package `nodemailer` ^6.9.16
- Added npm script `start`

#### `app/content/vision.script.js`

*New file — 16 lines*

- Defines: `init`.

#### `app/customs/page.js`

*New file — 13 lines*

- Defines: `Page`.
- Uses: `@/app/StaticHtmlPage`, `@/app/content/customs.body.html`, `@/app/customs.css`.

#### `app/logistics/page.js`

*New file — 13 lines*

- Defines: `Page`.
- Uses: `@/app/components/logistic-cost/LogisticsLive`, `@/app/content/logistics.body.html`, `@/app/logistics.css`.

#### `app/marketplace/page.js`

*New file — 13 lines*

- Defines: `Page`.
- Uses: `@/app/StaticHtmlPage`, `@/app/content/marketplace.body.html`, `@/app/marketplace.css`.

#### `app/order-assurance/page.js`

*New file — 13 lines*

- Defines: `Page`.
- Uses: `@/app/StaticHtmlPage`, `@/app/content/order-assurance.body.html`, `@/app/order-assurance.css`.

#### `app/port-brain/page.js`

*New file — 13 lines*

- Defines: `Page`.
- Uses: `@/app/StaticHtmlPage`, `@/app/content/port-brain.body.html`, `@/app/port-brain.css`.

#### `tailwind.config.js`

*New file — 13 lines*

- Data / content file (no functions or components).

#### `app/finance/page.js`

*New file — 11 lines*

- Defines: `Page`.
- Uses: `@/app/StaticHtmlPage`, `@/app/content/finance.body.html`.

#### `app/inspection/page.js`

*New file — 11 lines*

- Defines: `Page`.
- Uses: `@/app/StaticHtmlPage`, `@/app/content/inspection.body.html`.

#### `app/partnership/page.js`

*New file — 11 lines*

- Defines: `Page`.
- Uses: `@/app/StaticHtmlPage`, `@/app/content/partnership.body.html`.

#### `app/product-analysis/page.js`

*New file — 11 lines*

- Defines: `Page`.
- Uses: `@/app/StaticHtmlPage`, `@/app/content/product-analysis.body.html`.

#### `app/trade-agreements/page.js`

*New file — 11 lines*

- Defines: `Page`.
- Uses: `@/app/StaticHtmlPage`, `@/app/content/trade-agreements.body.html`.

#### `app/vision/page.js`

*New file — 11 lines*

- Defines: `Page`.
- Uses: `@/app/StaticHtmlPage`, `@/app/content/vision.body.html`.

#### `postcss.config.js`

*New file — 6 lines*

- Data / content file (no functions or components).

#### `next-env.d.ts`

*New file — 5 lines*

- Data / content file (no functions or components).

#### `analytics-server/world-path.js`

*New file — 3 lines*

- Data / content file (no functions or components).

#### `app/content/_hswords.js`

*New file — 2 lines*

- Data / content file (no functions or components).

**Other new files**

- `app/globals.css` — 2967 lines
- `package-lock.json` — 2527 lines
- `analytics-server/package-lock.json` — 1529 lines
- `app/content/home-final.body.html` — 535 lines
- `app/content/customs.body.html` — 405 lines
- `app/home-final.css` — 402 lines
- `app/content/trade-agreements.body.html` — 340 lines
- `app/home.css` — 317 lines
- `app/content/home.body.html` — 316 lines
- `app/content/marketplace.body.html` — 226 lines
- `app/port-brain.css` — 216 lines
- `app/content/port-brain.body.html` — 202 lines
- `app/marketplace.css` — 197 lines
- `app/content/partnership.body.html` — 180 lines
- `app/content/finance.body.html` — 173 lines
- `app/content/order-assurance.body.html` — 172 lines
- `app/content/product-analysis.body.html` — 165 lines
- `app/content/logistics.body.html` — 161 lines
- `app/content/inspection.body.html` — 158 lines
- `app/logistics.css` — 150 lines
- `app/order-assurance.css` — 147 lines
- `app/customs.css` — 125 lines
- `analytics-server/deploy.sh` — 101 lines
- `app/content/vision.body.html` — 94 lines
- `README.md` — 71 lines
- `analytics-server/README.md` — 69 lines
- `scripts/deploy-live.sh` — 50 lines
- `tsconfig.json` — 39 lines
- `analytics-server/.env.example` — 28 lines
- `.gitignore` — 18 lines
- `jsconfig.json` — 7 lines
- `analytics-server/.gitignore` — 4 lines
- `app/tailwind.css` — 3 lines
- `tsconfig.tsbuildinfo` — 1 lines
- `public/aaziko-logo.png` — binary file

### Impact

- New API endpoint `GET /healthz` is available.
- New API endpoint `POST /api/track` is available.
- New API endpoint `GET /live-stats/api/stats` is available.
- New API endpoint `GET /api/stats` is available.
- Code now reads `ANALYTICS_PORT` — make sure it is set in the `.env` / deployment.
- Code now reads `ANALYTICS_USER` — make sure it is set in the `.env` / deployment.
- Code now reads `ANALYTICS_PASS` — make sure it is set in the `.env` / deployment.
- Code now reads `ANALYTICS_SALT` — make sure it is set in the `.env` / deployment.
- Code now reads `GEO_CITY_FALLBACK` — make sure it is set in the `.env` / deployment.
- Code now reads `DIGEST_ENABLED` — make sure it is set in the `.env` / deployment.
- Code now reads `DIGEST_TO` — make sure it is set in the `.env` / deployment.
- Code now reads `DIGEST_HOUR` — make sure it is set in the `.env` / deployment.
- Code now reads `DIGEST_TZ_OFFSET_MIN` — make sure it is set in the `.env` / deployment.
- Code now reads `SITE_URL` — make sure it is set in the `.env` / deployment.
- Code now reads `SMTP_HOST` — make sure it is set in the `.env` / deployment.
- Code now reads `SMTP_PORT` — make sure it is set in the `.env` / deployment.
- Code now reads `SMTP_SECURE` — make sure it is set in the `.env` / deployment.
- Code now reads `SMTP_USER` — make sure it is set in the `.env` / deployment.
- Code now reads `SMTP_PASS` — make sure it is set in the `.env` / deployment.
- Code now reads `DIGEST_FROM` — make sure it is set in the `.env` / deployment.
- Code now reads `RETENTION_DAYS` — make sure it is set in the `.env` / deployment.
- Dependencies changed in `package.json` — run `npm install` and rebuild the Docker image before deploying.
- Code now reads `AAZIKO_BASE_PATH` — make sure it is set in the `.env` / deployment.
- Dependencies changed in `analytics-server/package.json` — run `npm install` and rebuild the Docker image before deploying.
- Build/deploy configuration changed: `analytics-server/.env.example` — re-check the build and deployment.
- Build/deploy configuration changed: `next.config.js` — re-check the build and deployment.
- Build/deploy configuration changed: `tsconfig.json` — re-check the build and deployment.
- 1 test file(s) were added or changed — run the tests.

---
