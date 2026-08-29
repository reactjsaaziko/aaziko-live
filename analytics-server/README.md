# Aaziko Live — first-party analytics

Self-hosted, cookieless visitor analytics for **aaziko.com/live**. No Google, no cookies,
no third party — every event stays on your own server (72.61.233.113) in a local SQLite file.

## What it answers

- **How many people visit** — unique visitors, sessions, page views (Today / 7d / 30d / 90d / All).
- **Which page they see** — page-view + unique-visitor count per page (Home, Customs, Port Brain, …).
- **Which live card they see & use** — for every live-demo box: how many *saw* it (scrolled into
  view) and how many *used* it (clicked its search / analyze / calculate control), plus a use-rate.
- **Where visitors come from** — top referrers.

## How it works

```
browser (app/components/AnalyticsTracker.js)
   │  sendBeacon  {pageview | card_view | card_click}
   ▼
nginx  location /api/track  ─┐
                             ├─►  this service  :3056  ──►  data/analytics.db (SQLite)
nginx  location /live-stats ─┘        │
                                      └► dashboard HTML (Basic-Auth)
```

The browser tracker is injected once from `app/layout.js`, so it runs on every route. Live
cards are matched by page-unique element ids listed in `AnalyticsTracker.js` (`CARDS`) — no
per-page HTML edits. Add a card by adding one line to that list.

## Endpoints

| Route | Auth | Purpose |
|-------|------|---------|
| `POST /api/track` | none | receives events from the browser (bots dropped) |
| `GET /live-stats` | Basic | dashboard |
| `GET /live-stats/api/stats?range=7d` | Basic | JSON aggregates |
| `GET /live-stats/preview-digest` | Basic | preview the daily email in the browser (no send) |
| `GET /live-stats/send-digest` | Basic | send the daily email right now (test) |
| `GET /healthz` | none | liveness |

## Daily email digest

Every day at `DIGEST_HOUR` (default 08:00 IST) the service emails an **"Aaziko Live — Daily
Review"** to `DIGEST_TO` (default `ceoaaziko@gmail.com`): yesterday's visitors / page views /
live-cards seen & used (with day-over-day %), plus the last-7-days top pages, top live cards, and
referrers, and a link to the full dashboard. It sends through the same `contact@aaziko.com` Gmail
app-password the contact form already uses (the deploy script copies those SMTP settings from
`/var/www/aaziko-contact-mailer/.env` on first run). Toggle with `DIGEST_ENABLED`; change time with
`DIGEST_HOUR` / `DIGEST_TZ_OFFSET_MIN`. Test any time: open `…/live-stats/send-digest`.

## Deploy

```bash
bash analytics-server/deploy.sh          # build + PM2 (re)start on 72.61.233.113
```

First run creates `/var/www/aaziko-live-analytics/.env` from `.env.example` — **edit it and set a
strong `ANALYTICS_PASS`**, then `pm2 restart aaziko-live-analytics --update-env`. The deploy
excludes `data/` and `.env`, so redeploys never wipe stats or credentials.

Then wire nginx once (the deploy script prints the exact snippet): add `location = /api/track`
and `location /live-stats` to the live `aaziko` vhost and reload. Finally, redeploy the site
itself (`scripts/deploy-live.sh`) so the pages carry the tracker.

## Privacy

Cookieless (a random id in `localStorage` for unique counts). No names, emails, or precise
location. The client IP is stored only as a **daily-salted hash** for bot/dedup sanity, never raw.
Because there are no cookies and no PII, no consent banner is required.
