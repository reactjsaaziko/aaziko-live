'use client';
import { API, getJSON } from './_api.js';

/* Live marketplace search box (.lmkt) — the Port Brain dossier-styled card that shows a
   real search bar + 9 live products from GET {marketplace}/product-service/products.
   Used on the home page (#demo journey) and the marketplace hero. Markup contract:
   #lmkt-form, #lmkt-input, #lmkt-grid, #lmkt-foot (styles live in globals.css). */

var MEDIA_BASE = 'https://api.aaziko.com';
export var FALLBACK_IMG = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 30">' +
  '<rect width="40" height="30" fill="#F5EFE2"/>' +
  '<path d="M14 11l6-3 6 3v8l-6 3-6-3zM14 11l6 3 6-3M20 14v8" fill="none" stroke="#C9C2B4" stroke-width="1.2"/>' +
  '</svg>');

export function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
function absMedia(u) {
  if (!u || typeof u !== 'string' || !u.trim()) return '';
  if (/^https?:\/\//i.test(u)) return u;
  return MEDIA_BASE + (u.charAt(0) === '/' ? u : '/' + u);
}
export function imgUrl(p) {
  var d = p.productDescription || {};
  return absMedia(d.mainPhotoUrl || (d.productPhotosVideos && d.productPhotosVideos[0]) || '') || FALLBACK_IMG;
}
/* Every usable photo of a product (main photo first, videos filtered out, de-duped). */
export function imgUrls(p) {
  var d = p.productDescription || {};
  var raw = [d.mainPhotoUrl].concat(d.productPhotosVideos || []);
  var out = [], seen = {};
  raw.forEach(function (u) {
    var a = absMedia(u);
    if (!a || seen[a] || /\.(mp4|webm|mov|avi|mkv)(\?|$)/i.test(a)) return;
    seen[a] = 1; out.push(a);
  });
  return out;
}
/* Headline price = lowest tier price strictly > 0; priceRanges can contain a junk
   0-price tier that must never win. MOQ = smallest valid tier start, else minQuantity. */
export function unitPrice(p) {
  var valid = (p.priceRanges || [])
    .map(function (r) { return Number(r && r.price); })
    .filter(function (n) { return isFinite(n) && n > 0; })
    .sort(function (a, b) { return a - b; });
  return valid.length ? valid[0] : 0;
}
export function moq(p) {
  var starts = (p.priceRanges || [])
    .filter(function (r) { return !(r && r.isInfinite && Number(r.price) <= 0); })
    .map(function (r) { return Number(r && r.quantityFrom); })
    .filter(function (n) { return isFinite(n) && n > 0 && n < 1e12; });
  if (starts.length) return Math.min.apply(null, starts);
  var m = Number(p.minQuantity);
  return isFinite(m) && m > 0 ? m : 1;
}
export function money(n) { return '₹' + Number(n).toLocaleString('en-IN'); }

// Shown only if the live feed is unreachable (representative, clearly labelled).
var STATIC_PRODUCTS = [
  { productName: 'Glazed Porcelain Floor Tiles 600×600', categoryId: { categoryName: 'Ceramic & Porcelain Tiles' }, priceRanges: [{ quantityFrom: 500, price: 285 }] },
  { productName: 'Vitrified Wall Tiles, Gloss Finish', categoryId: { categoryName: 'Ceramic & Porcelain Tiles' }, priceRanges: [{ quantityFrom: 1000, price: 210 }] },
  { productName: 'Digital Printed Bathroom Tiles', categoryId: { categoryName: 'Wall Tiles' }, priceRanges: [{ quantityFrom: 800, price: 165 }] },
  { productName: 'Full-Body Porcelain Slab 800×1600', categoryId: { categoryName: 'Porcelain Slabs' }, priceRanges: [{ quantityFrom: 200, price: 720 }] },
  { productName: 'Matt Finish Parking Tiles 300×300', categoryId: { categoryName: 'Floor Tiles' }, priceRanges: [{ quantityFrom: 1200, price: 95 }] },
  { productName: 'Wooden Strip Porcelain Planks 200×1200', categoryId: { categoryName: 'Porcelain Tiles' }, priceRanges: [{ quantityFrom: 600, price: 340 }] },
  { productName: 'Anti-Skid Ceramic Floor Tiles 400×400', categoryId: { categoryName: 'Ceramic Tiles' }, priceRanges: [{ quantityFrom: 900, price: 130 }] },
  { productName: 'Marble-Look Glazed Vitrified Tiles 600×1200', categoryId: { categoryName: 'Vitrified Tiles' }, priceRanges: [{ quantityFrom: 400, price: 460 }] },
  { productName: 'Subway Ceramic Wall Tiles 100×300', categoryId: { categoryName: 'Wall Tiles' }, priceRanges: [{ quantityFrom: 1500, price: 78 }] }
];

/* opts.onSelect(product, { byUser }) — when given, the 9 result cards become selectable
   (click / Enter / Space) and the FIRST product of the very first result set is
   auto-selected (byUser:false) so a caller's detail panel is never empty. */
export function initLiveMarket(opts) {
  opts = opts || {};
  var box = document.getElementById('lmkt');
  var form = document.getElementById('lmkt-form');
  var input = document.getElementById('lmkt-input');
  var grid = document.getElementById('lmkt-grid');
  var foot = document.getElementById('lmkt-foot');
  if (!form || !input || !grid || !foot) return;

  var pickable = typeof opts.onSelect === 'function';
  if (pickable && box) box.classList.add('lmkt--pick');
  var autoSelected = false;

  function select(list, i, byUser) {
    grid.querySelectorAll('.lmkt-card.is-sel').forEach(function (c) { c.classList.remove('is-sel'); });
    var card = grid.querySelector('.lmkt-card[data-idx="' + i + '"]');
    if (card) card.classList.add('is-sel');
    opts.onSelect(list[i], { byUser: !!byUser });
  }

  function render(list, isLive, total) {
    if (!list.length) {
      grid.innerHTML = '<div class="lmkt-note">No products matched — try another word (e.g. "tiles", "pump", "cartridge").</div>';
    } else {
      grid.innerHTML = list.slice(0, 9).map(function (p, i) {
        var cat = (p.categoryId && p.categoryId.categoryName) || '';
        var price = unitPrice(p);
        return '<div class="lmkt-card" data-idx="' + i + '"' +
          (pickable ? ' role="button" tabindex="0" aria-label="View details: ' + esc(p.productName) + '"' : '') + '>' +
          '<div class="lmkt-img"><img src="' + esc(imgUrl(p)) + '" alt="' + esc(p.productName) + '" loading="lazy"></div>' +
          '<div class="lmkt-body">' +
            '<div class="lmkt-name">' + esc(p.productName) + '</div>' +
            (cat ? '<div class="lmkt-cat">' + esc(cat) + '</div>' : '') +
            '<div class="lmkt-meta">' +
              '<span class="lmkt-price">' + (price > 0 ? money(price) + ' <small>/ unit</small>' : 'On request') + '</span>' +
              '<span class="lmkt-moq">MOQ ' + moq(p).toLocaleString('en-IN') + '</span>' +
            '</div>' +
          '</div>' +
        '</div>';
      }).join('');
      grid.querySelectorAll('img').forEach(function (im) {
        im.addEventListener('error', function () { im.src = FALLBACK_IMG; }, { once: true });
      });
      if (pickable) {
        grid.querySelectorAll('.lmkt-card').forEach(function (card) {
          var i = Number(card.getAttribute('data-idx'));
          card.addEventListener('click', function () { select(list, i, true); });
          card.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(list, i, true); }
          });
        });
        // Default: the detail panel starts on the first product of the opening
        // search ("Porcelain tiles" → a real tile) until the user picks one.
        if (!autoSelected) { autoSelected = true; select(list, 0, false); }
      }
    }
    foot.className = 'lmkt-foot ' + (isLive ? 'is-live' : 'is-static');
    foot.textContent = isLive
      ? '↳ live from Aaziko Marketplace' + (total ? ' · ' + Number(total).toLocaleString('en-IN') + ' matching products' : '')
      : 'Representative products shown — live feed momentarily unavailable.';
  }

  var seq = 0;
  function search(q) {
    var mine = ++seq;
    grid.innerHTML = '<div class="lmkt-note"><span class="lmkt-spin"></span>Searching the live Aaziko marketplace…</div>';
    foot.textContent = '';
    getJSON(API.marketplace + '/product-service/products?page=1&limit=9&search=' + encodeURIComponent(q), { timeout: 15000 })
      .then(function (r) {
        if (mine !== seq) return;
        render((r && r.data) || [], true, r && r.pagination && r.pagination.total);
      })
      .catch(function () {
        if (mine !== seq) return;
        render(STATIC_PRODUCTS, false, null);
      });
  }

  var deb;
  input.addEventListener('input', function () {
    clearTimeout(deb);
    deb = setTimeout(function () { search(input.value.trim()); }, 500);
  });
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    clearTimeout(deb);
    search(input.value.trim());
  });

  search(input.value.trim() || 'Porcelain tiles');
}
