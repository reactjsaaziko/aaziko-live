'use client';

/**
 * Shared API config + fetch helpers for the aaziko-next "Live demonstration" boxes.
 *
 * Each marketing-site live box mirrors a real Aaziko admin module and pulls live data
 * from the same backend the admin product uses. Base URLs are centralised here so the
 * whole site can be pointed at production with a single edit (or via window.__AAZIKO_API__).
 *
 * Local dev gateways/services (what these resolve to on the dev box):
 *   trademap        ai-service          :3004  → Product Analysis + Customs HS-code/compliance
 *   marketplace     product gateway     :3030  → Marketplace product search
 *   transport       transport-service   :3037  → Logistics / Load Calculator (container packing)
 *   serviceprovider service-provider    :3036  → Real freight + CHA rate cards (landed-cost quote)
 *   portbrain       port-brain          :8000  → Port Brain buyer trade feed
 */
// Local dev gateways/services (used only when the site is opened on localhost).
const LOCAL = {
  trademap: 'http://localhost:3004',
  marketplace: 'http://localhost:3030',
  transport: 'http://localhost:3037',
  serviceprovider: 'http://localhost:3036',
  portbrain: 'http://localhost:8000',
};

// Live production endpoints (used when the site is served from any real domain).
//   marketplace     → common API gateway (paths already include /product-service/…)
//   transport       → gateway proxies /transport-service → transport-service
//   serviceprovider → gateway proxies /service-provider  → service-provider (landed-cost)
//   trademap        → ai-service (hscode / trademap / compliance)
//   portbrain       → port-brain API
const LIVE = {
  trademap: 'https://api.aaziko.com/ai-service',
  marketplace: 'https://api.aaziko.com/common-api',
  transport: 'https://api.aaziko.com/common-api/transport-service',
  serviceprovider: 'https://api.aaziko.com/common-api/service-provider',
  // Direct to the production port-brain API (no proxy). NOTE: this only renders in the
  // browser once the api.aaziko.com proxy stops hard-coding Access-Control-Allow-Origin
  // to admin.aaziko.com — it must reflect the request origin (https://aaziko.com).
  portbrain: 'https://api.aaziko.com/port-brain',
};

// Default EVERY environment — including localhost — to the LIVE api.aaziko.com backend,
// so the live-demo boxes pull real data without the local dev microservices running.
// (The production proxy reflects the request origin, so localhost is CORS-allowed.)
// Developers who DO run the local stack can opt back in, without a rebuild, via either
//   ?api=local   in the URL   — or —   window.__AAZIKO_LOCAL__ = true
const useLocal =
  typeof window !== 'undefined' &&
  (window.__AAZIKO_LOCAL__ === true || /[?&]api=local(\b|=)/.test(window.location.search));
let BASE = useLocal ? LOCAL : LIVE;

// TESTING (temporary): while the Port Brain headline-stats work is being
// verified, a site opened on localhost talks to the LOCAL port-brain container
// (:8000) so backend changes can be tested before touching api.aaziko.com.
// All other services stay LIVE. Append ?api=live to the URL to force the
// production API, or delete this block when testing is done.
const onLocalhost =
  typeof window !== 'undefined' &&
  /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname);
const forceLive =
  typeof window !== 'undefined' && /[?&]api=live(\b|=)/.test(window.location.search);
// service-provider joins the same localhost exception: the PROD gateway has no
// /landed-cost/* routes deployed yet (every one 504s while the service's other
// paths answer 401 in ~0.5s), so on the live API the Landed-Cost box has NO
// ports in its dropdowns and no freight cards. Locally :3036 serves them, so a
// dev box gets the real port catalogue and real rates. Remove this once
// landedCostController/Routes are deployed to the prod service-provider.
if (onLocalhost && !useLocal && !forceLive) {
  BASE = {
    ...BASE,
    portbrain: LOCAL.portbrain,
    serviceprovider: LOCAL.serviceprovider,
  };
}

// A deployed site can still hard-override any base without a rebuild:
//   window.__AAZIKO_API__ = { trademap: 'https://api.aaziko.com/ai-service', ... }
export const API =
  (typeof window !== 'undefined' && window.__AAZIKO_API__)
    ? { ...BASE, ...window.__AAZIKO_API__ }
    : BASE;

export async function getJSON(url, { timeout = 22000 } = {}) {
  const ctrl = new AbortController();
  // timeout <= 0  → no client-side abort at all: wait as long as the request
  // takes and never auto-cancel (used by the Port Brain feed, whose full-DB
  // queries can legitimately run long).
  const timer = timeout > 0 ? setTimeout(() => ctrl.abort(), timeout) : null;
  try {
    const res = await fetch(url, { signal: ctrl.signal, credentials: 'omit' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function postJSON(url, body, { timeout = 35000 } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
      credentials: 'omit',
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/** Small helper: a spinner/skeleton block used while a live request is in flight. */
export function loadingHTML(label) {
  return (
    '<div style="display:flex;align-items:center;gap:12px;padding:28px 4px;color:var(--mute);font-size:13px;">' +
    '<span class="aaziko-spin" style="width:16px;height:16px;border:2px solid var(--border);border-top-color:var(--emerald);border-radius:50%;display:inline-block;animation:aazikospin .7s linear infinite;"></span>' +
    (label || 'Querying live Aaziko data…') +
    '</div>' +
    '<style>@keyframes aazikospin{to{transform:rotate(360deg)}}</style>'
  );
}

/** Tag appended to a rendered box telling the viewer whether numbers are live or representative. */
export function sourceTag(isLive) {
  if (isLive) {
    return (
      '<div style="margin-top:14px;font-size:11px;color:var(--emerald);display:flex;align-items:center;gap:6px;">' +
      '<span class="live-dot"></span>Live data · pulled just now from the Aaziko platform</div>'
    );
  }
  return (
    '<div style="margin-top:14px;font-size:11px;color:var(--mute);font-style:italic;">' +
    'Representative data shown — live feed momentarily unavailable.</div>'
  );
}
