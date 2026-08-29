'use client';
import { API, getJSON, loadingHTML, sourceTag } from './_api.js';
import { runDemoTour } from './_demotour.js';
// Live box mirrors the macmap.org / ITC Market Access Map "Trade Agreements" search,
// backed by the same data the admin Port Brain "Macmap Trade Agreements" view uses:
//   GET /api/v1/raw-data/macmap-trade-agreements?country=<ISO3>&relation=&partner=&in_force=
// (Port Brain service). Filter axes mirror the macmap form: Country/Territory,
// Relation (exporter|importer), Partner, and an "In force" toggle.
export function init() {

  // ----- keynote page animations (hero line-in + scroll reveals), scoped to #azt-fta -----
  var root = document.getElementById('azt-fta');
  if (root) {
    root.classList.add('js-ready');
    var hero = document.getElementById('hero');
    if (hero) requestAnimationFrame(function () { setTimeout(function () { hero.classList.add('play'); }, 140); });
    var reveals = root.querySelectorAll('.reveal');
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('vis'); io.unobserve(e.target); } });
      }, { threshold: 0.14, rootMargin: '0px 0px -8% 0px' });
      reveals.forEach(function (el) { io.observe(el); });
    } else {
      reveals.forEach(function (el) { el.classList.add('vis'); });
    }
  }

  var BASE = API.portbrain + '/api/v1/raw-data/macmap-trade-agreements';

  var countrySel  = document.getElementById('ta-country');
  var relationSel = document.getElementById('ta-relation');
  var partnerSel  = document.getElementById('ta-partner');
  var productInput = document.getElementById('ta-product');
  var productMenu = document.getElementById('ta-product-menu');
  var inforceChk  = document.getElementById('ta-inforce');
  var goBtn       = document.getElementById('ta-go');
  var out         = document.getElementById('ta-output');
  if (!countrySel || !relationSel || !partnerSel || !out) return;

  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function countryLabel() { return countrySel.options[countrySel.selectedIndex].text; }
  function relationLabel() { return relationSel.options[relationSel.selectedIndex].text.toLowerCase(); }

  var selectedProduct = null;
  var productTimer = null;
  var productSeq = 0;

  function closeProductMenu() {
    if (!productMenu || !productInput) return;
    productMenu.hidden = true;
    productInput.setAttribute('aria-expanded', 'false');
  }

  function chooseProduct(item) {
    selectedProduct = item;
    // Keep the words the user/demo typed visible. The resolved HS code is
    // stored in selectedProduct and shown in the result context below; replacing
    // "ceramic tiles" with a long code/description made the demo look as if the
    // user's search had been discarded.
    closeProductMenu();
  }

  async function findProducts(query, showMenu) {
    var q = String(query || '').trim().replace(/\s+—.*$/, '');
    if (q.length < 2) return [];
    var mine = ++productSeq;
    try {
      // A bare "tiles" query is overwhelmed by corrupt multilingual catalogue
      // rows containing "DÃ¡tiles". Narrow it to the actual HS product phrase
      // used by the catalogue; the user's visible input remains unchanged.
      var apiQuery = /^tiles?$/i.test(q) ? 'ceramic ' + q : q;
      var resp = await getJSON(
        API.portbrain + '/api/v1/hs-codes/search?q=' + encodeURIComponent(apiQuery) + '&limit=60',
        { timeout: 12000 }
      );
      if (mine !== productSeq) return [];
      var items = (resp && resp.items) || [];
      // The backend search is substring-based ("rice" also matches "prices").
      // Keep genuine whole-word product matches so the HS suggestions remain
      // relevant. Numeric input is matched by code prefix instead.
      if (/^\d+$/.test(q)) {
        items = items.filter(function (item) {
          return String(item.hs_code || '').indexOf(q) === 0;
        });
      } else {
        // Normalize accents before tokenizing. Without this, Spanish "dátiles"
        // was split at "á" into ["d", "tiles"], causing a search for "tiles"
        // to incorrectly resolve to HS 080410 (dates).
        function productTokens(value) {
          var text = String(value || '');
          // Some catalogue rows contain UTF-8 decoded as Latin-1 ("DÃ¡tiles").
          // Repair that common mojibake form before stripping accents.
          if (/Ã.|Â./.test(text)) {
            try { text = decodeURIComponent(escape(text)); } catch (e) { /* retain original */ }
          }
          return text
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .split(/[^a-z0-9]+/)
            .filter(Boolean);
        }
        var words = productTokens(q).filter(function (w) { return w.length >= 2; });
        items = items.filter(function (item) {
          var tokens = productTokens(item.description);
          return words.every(function (word) {
            return tokens.indexOf(word) >= 0 || tokens.indexOf(word + 's') >= 0 ||
              (word.charAt(word.length - 1) === 's' && tokens.indexOf(word.slice(0, -1)) >= 0);
          });
        });
      }
      items = items.slice(0, 8);
      if (showMenu && productMenu) {
        productMenu.innerHTML = items.length
          ? items.map(function (item, i) {
              return '<button type="button" class="ta-product-option" role="option" data-index="' + i + '">' +
                '<b>HS ' + esc(item.hs_code) + '</b><span>' + esc(item.description) + '</span></button>';
            }).join('')
          : '<div style="padding:10px;color:var(--mute);font-size:12px;">No matching HS product</div>';
        productMenu._items = items;
        productMenu.hidden = false;
        productInput.setAttribute('aria-expanded', 'true');
      }
      return items;
    } catch (e) {
      if (showMenu) closeProductMenu();
      return [];
    }
  }

  async function resolveProduct() {
    if (!productInput || !productInput.value.trim()) return null;
    if (selectedProduct) return selectedProduct;
    var items = await findProducts(productInput.value, false);
    if (items.length) {
      chooseProduct(items[0]);
      return items[0];
    }
    return null;
  }

  if (productInput && productMenu) {
    productInput.addEventListener('input', function () {
      selectedProduct = null;
      clearTimeout(productTimer);
      if (productInput.value.trim().length < 2) {
        closeProductMenu();
        return;
      }
      productTimer = setTimeout(function () { findProducts(productInput.value, true); }, 220);
    });
    productInput.addEventListener('focus', function () {
      if (productInput.value.trim().length >= 2 && !selectedProduct) findProducts(productInput.value, true);
    });
    productInput.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeProductMenu();
    });
    productMenu.addEventListener('mousedown', function (e) {
      var option = e.target.closest('.ta-product-option');
      if (!option) return;
      e.preventDefault();
      var item = (productMenu._items || [])[Number(option.getAttribute('data-index'))];
      if (item) chooseProduct(item);
    });
    document.addEventListener('mousedown', function (e) {
      if (!productInput.parentElement.contains(e.target)) closeProductMenu();
    });
  }

  function statusBadge(status) {
    var s = String(status || '').toLowerCase();
    var bg = '#eef2f7', col = '#5B6B82';
    if (s.indexOf('in force') >= 0) { bg = 'var(--mint-soft)'; col = 'var(--emerald)'; }
    else if (s.indexOf('sign') >= 0) { bg = '#FFF4E5'; col = 'var(--saffron)'; }
    else if (s.indexOf('negoti') >= 0) { bg = '#EEF2FF'; col = '#4F6BED'; }
    return '<span style="font-size:11px;font-weight:600;padding:2px 9px;border-radius:20px;background:' + bg + ';color:' + col + ';white-space:nowrap;">' + esc(status || '—') + '</span>';
  }

  function members(m) {
    var list = String(m || '').split(',').map(function (x) { return x.trim(); }).filter(Boolean);
    if (!list.length) return '';
    var shown = list.slice(0, 12).map(esc).join(' · ');
    var more = list.length > 12 ? ' <span style="color:var(--mute);">+' + (list.length - 12) + ' more</span>' : '';
    return shown + more;
  }

  function agreementCard(a) {
    var html = '<div style="background:var(--white);border:1px solid var(--border);border-radius:6px;padding:14px 16px;margin-bottom:10px;">';
    html += '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:6px;">';
    html += '<div style="font-size:15px;font-weight:700;color:var(--ink);line-height:1.3;">' + esc(a.FtaName || 'Trade agreement') + '</div>';
    html += statusBadge(a.Status);
    html += '</div>';
    var meta = [];
    if (a.Type) meta.push(esc(a.Type));
    if (a.Scope) meta.push(esc(String(a.Scope).replace(/,/g, ', ')));
    if (a.InForceDate) meta.push('In force since ' + esc(a.InForceDate));
    else if (a.SignedDate) meta.push('Signed ' + esc(a.SignedDate));
    if (meta.length) html += '<div style="font-size:12px;color:var(--mute);margin-bottom:8px;">' + meta.join(' · ') + '</div>';
    var mem = members(a.MemberStates);
    if (mem) html += '<div style="font-size:12px;color:var(--body);line-height:1.6;"><span style="color:var(--mute);">Members:</span> ' + mem + '</div>';
    html += '</div>';
    return html;
  }

  // Partner options depend on the chosen country + relation, exactly like the real tool.
  async function loadPartners() {
    var url = BASE + '/filter-options/MemberStatesList?country=' + encodeURIComponent(countrySel.value) +
      '&relation=' + encodeURIComponent(relationSel.value) + '&limit=300';
    var prev = partnerSel.value;
    try {
      var resp = await getJSON(url);
      var vals = (resp && resp.values) || [];
      var html = '<option value="">All</option>';
      vals.forEach(function (v) { html += '<option value="' + esc(v) + '">' + esc(v) + '</option>'; });
      partnerSel.innerHTML = html;
      if (prev && vals.indexOf(prev) >= 0) partnerSel.value = prev;
    } catch (e) {
      partnerSel.innerHTML = '<option value="">All</option>';
    }
  }

  async function search() {
    // Clear the previous cards immediately. The auto-demo waits for fresh
    // results; leaving old cards visible while HS resolution runs can make the
    // tour finish before the product has actually been resolved.
    if (productInput && productInput.value.trim()) {
      out.innerHTML = loadingHTML('Resolving the product HS code…');
    }
    var product = await resolveProduct();
    var params = 'country=' + encodeURIComponent(countrySel.value) +
      '&relation=' + encodeURIComponent(relationSel.value) + '&limit=50';
    if (partnerSel.value) params += '&partner=' + encodeURIComponent(partnerSel.value);
    if (inforceChk.checked) params += '&in_force=true';

    var cName = countryLabel(), rLabel = relationLabel();
    out.innerHTML = loadingHTML('Consulting trade agreements for ' + esc(cName) + ' ' + esc(rLabel) + '…');
    try {
      var resp = await getJSON(BASE + '?' + params, { timeout: 25000 });
      var items = (resp && resp.items) || [];
      if (!items.length) {
        out.innerHTML = '<p style="font-size:13px;color:#5B6B82;">No trade agreements found for ' + esc(cName) + ' (' + esc(rLabel) + ')' +
          (partnerSel.value ? ' with ' + esc(partnerSel.value) : '') + (inforceChk.checked ? ' that are in force' : '') + '.</p>';
        return;
      }
      var header = '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:14px;">' +
        '<div style="font-size:14px;color:var(--ink);"><strong>' + items.length + (items.length >= 50 ? '+' : '') + '</strong> trade agreements · ' +
        esc(cName) + ' <span style="color:var(--mute);">' + esc(rLabel) + '</span></div>' +
        (inforceChk.checked ? '<span style="font-size:11px;font-weight:600;padding:2px 10px;border-radius:20px;background:var(--mint-soft);color:var(--emerald);">In force only</span>' : '') +
        '</div>';
      out.innerHTML = header + items.map(agreementCard).join('') + sourceTag(true);
    } catch (e) {
      out.innerHTML = '<p style="font-size:13px;color:#5B6B82;">Trade-agreements feed momentarily unavailable. Please try again in a moment.</p>';
    }
  }

  goBtn.addEventListener('click', search);
  countrySel.addEventListener('change', loadPartners);
  relationSel.addEventListener('change', loadPartners);

  // Load with the same defaults shown in the macmap form: India · as exporter · in force.
  loadPartners();
  search();

  /* Self-playing cinematic demo (shared engine): the page dims, the search row lifts
     into a spotlight, a country is picked from a live dropdown (UAE) and Search is
     pressed — every agreement it is party to lists out. The commit sets the select
     without firing 'change', so partners aren't re-fetched mid-tour; the real Search
     click does the work. */
  (function autoPlayDemo() {
    var bar = document.querySelector('#demo .demo-input');
    if (!bar || !countrySel || !goBtn) return;
    var ran = false;
    runDemoTour({
      bar: bar,
      delay: 600,
      threshold: 0.5,
      output: out,
      resultReady: function () {
        var t = out.textContent || '';
        return t.length > 300 && !/Consulting|unavailable/i.test(t);
      },
      userStarted: function () { return false; },
      skip: function () {
        countrySel.value = 'ARE';
        if (productInput) {
          selectedProduct = null;
          productInput.value = 'ceramic tiles';
        }
        if (!ran) { ran = true; search(); }
      },
      script: async function (t) {
        t.caption(1, 3, 'Watch — choosing a country to inspect…');
        await t.pick(countrySel, [
          { f: '🇮🇳', n: 'India' }, { f: '🇺🇸', n: 'United States' },
          { f: '🇦🇪', n: 'United Arab Emirates', pick: true },
          { f: '🇬🇧', n: 'United Kingdom' }, { f: '🇦🇺', n: 'Australia' }
        ], function () { countrySel.value = 'ARE'; });
        t.caption(2, 3, 'Adding a product to resolve its HS code…');
        if (productInput) {
          selectedProduct = null;
          await t.type(productInput, 'ceramic tiles', 55);
        }
        t.caption(3, 3, 'Listing every applicable country agreement…');
        ran = true;
        t.press(goBtn); // real click → search()
        await t.wait(300);
        await t.result();
      },
    });
  })();

}
