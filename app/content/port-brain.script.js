'use client';
import { API, getJSON } from './_api.js';
import { runDemoTour } from './_demotour.js';
import HS_WORDS from './_hswords.js';

// Port Brain page = the "The world's demand, read for India" keynote. The demo card is a LIVE
// buyer-intelligence dossier with a search bar: it reads real buyers from Port Brain
// (/api/v1/buyers[,/search]) and renders them as a compact list in the dossier design.
export function init() {

  /* ===== LIVE DOSSIER LIST: one search bar + a live buyer list ===== */
  (function liveList() {
    var form = document.getElementById('pb-search');
    var input = document.getElementById('pb-q');
    var list = document.getElementById('pb-list');
    if (!form || !input || !list) return;

    function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
    function safeDecode(s) { try { return decodeURIComponent(s); } catch (e) { return String(s || ''); } }
    function titleCase(s) { return String(s || '').toLowerCase().replace(/\b\w/g, function (m) { return m.toUpperCase(); }); }
    var FLAGS = { 'United States': '🇺🇸', 'USA': '🇺🇸', 'United Arab Emirates': '🇦🇪', 'UAE': '🇦🇪', 'United Kingdom': '🇬🇧', 'UK': '🇬🇧', 'Germany': '🇩🇪', 'Australia': '🇦🇺', 'Argentina': '🇦🇷', 'Saudi Arabia': '🇸🇦', 'China': '🇨🇳', 'Japan': '🇯🇵', 'Singapore': '🇸🇬', 'Netherlands': '🇳🇱', 'France': '🇫🇷', 'Italy': '🇮🇹', 'Spain': '🇪🇸', 'Canada': '🇨🇦', 'Brazil': '🇧🇷', 'South Africa': '🇿🇦', 'Vietnam': '🇻🇳', 'Bangladesh': '🇧🇩', 'Thailand': '🇹🇭', 'Turkey': '🇹🇷', 'Uzbekistan': '🇺🇿', 'Tanzania': '🇹🇿', 'Kenya': '🇰🇪', 'Pakistan': '🇵🇰', 'Egypt': '🇪🇬', 'Nigeria': '🇳🇬', 'Indonesia': '🇮🇩', 'Malaysia': '🇲🇾', 'Philippines': '🇵🇭', 'Sri Lanka': '🇱🇰' };
    function flagFor(c) { return FLAGS[c] || FLAGS[titleCase(c)] || '🌐'; }
    function scoreFor(b) {
      var base = { B1: 88, B2: 76, B3: 64, B4: 54 }[b.buyer_tier] || 60;
      if (b.buyer_status === 'HOT') base += 6; else if (b.buyer_status === 'WARM') base += 3;
      if ((b.total_shipments || 0) > 50) base += 2;
      return Math.min(96, base);
    }
    function tierBadge(b) {
      if (b.buyer_status === 'HOT') return { t: 'Hot Lead', bg: 'rgba(239,68,68,0.10)', fg: '#EF4444', bd: 'rgba(239,68,68,0.30)' };
      if (b.buyer_status === 'WARM') return { t: 'Warm', bg: 'rgba(196,117,31,0.12)', fg: '#C4751F', bd: 'rgba(196,117,31,0.30)' };
      return { t: 'Active', bg: 'rgba(30,91,71,0.10)', fg: '#1E5B47', bd: 'rgba(30,91,71,0.28)' };
    }

    // circular ring score — SVG arc filled to score/100, matching the trade-flow feed design
    function ringHTML(score) {
      var r = 19, c = 2 * Math.PI * r;
      var pct = Math.max(0, Math.min(100, Math.round(score)));
      var off = c * (1 - pct / 100);
      return '<div class="pbcard__ring">' +
        '<svg viewBox="0 0 46 46" aria-hidden="true">' +
        '<circle class="pbring__bg" cx="23" cy="23" r="' + r + '"></circle>' +
        '<circle class="pbring__fg" cx="23" cy="23" r="' + r + '" stroke-dasharray="' + c.toFixed(1) + '" stroke-dashoffset="' + off.toFixed(1) + '" transform="rotate(-90 23 23)"></circle>' +
        '</svg>' +
        '<span class="pbcard__ringnum">' + pct + '</span>' +
        '</div>';
    }

    function cardHTML(b) {
      var name = titleCase(safeDecode(b.buyer_name || b.buyer_uuid || 'Verified importer'));
      var country = titleCase(b.buyer_country || '');
      var tb = tierBadge(b);
      var icon = b.buyer_status === 'HOT' ? '🔥 ' : '';
      var ship = b.total_shipments != null ? Number(b.total_shipments).toLocaleString('en-IN') + ' shipments' : '';
      var hs = (b.hs_codes || []).slice(0, 3).map(function (h) { return '<span class="pbcard__hs">HS ' + esc(h) + '</span>'; }).join('');
      var chip = '<span class="pbchip" style="background:' + tb.bg + ';color:' + tb.fg + ';border-color:' + tb.bd + ';">' + icon + tb.t + '</span>';
      var grow = '<span class="pbchip pbchip--grow">🌱 Growing</span>';
      return '<div class="pbcard">' +
        '<div class="pbcard__avatar">' + flagFor(b.buyer_country) + '</div>' +
        '<div class="pbcard__main">' +
        '<div class="pbcard__top"><span class="pbcard__name">' + esc(name) + '</span>' + chip + grow + '</div>' +
        '<div class="pbcard__meta">📍 ' + esc(country || '—') + (ship ? ' · ⏱ ' + ship : '') + '</div>' +
        (hs ? '<div class="pbcard__codes">' + hs + '</div>' : '') +
        '</div>' +
        ringHTML(scoreFor(b)) +
        '</div>';
    }

    function note(text) { return '<p class="pb-list__note">' + esc(text) + '</p>'; }

    var countrySel = document.getElementById('pb-country');
    var countryMenu = document.getElementById('pb-country-menu');
    var countrySource = document.getElementById('pb-country-options');
    var recEl = document.getElementById('pb-rec');
    var totalEl = document.getElementById('pb-total');
    var hotWhaleEl = document.getElementById('pb-hotwhale');
    // Every "countries" figure on the page shares the one live DB count so none
    // of them is ever a static/estimated number: the feed tile plus the two
    // hero figures ("… countries" in the stat line and the big number block).
    var countryEls = ['pb-countries', 'pb-countries-hero', 'pb-countries-num']
      .map(function (id) { return document.getElementById(id); })
      .filter(Boolean);

    function fmt(n) { return Number(n).toLocaleString('en-IN'); }

    var seq = 0;

    // Searchable country combobox. A native <select> only jumps by letters,
    // while <datalist> renders an unbounded browser popup that can cover most
    // of the page. This menu stays anchored to the field and filters by the
    // complete text the user has typed.
    if (countrySel && countryMenu && countrySource) {
      var countries = Array.prototype.map.call(
        countrySource.querySelectorAll('option'),
        function (o) { return o.value; }
      );
      var activeCountry = -1;

      function countryMatches() {
        var term = countrySel.value.trim().toLowerCase();
        var matches = countries.filter(function (c) {
          return !term || c.toLowerCase().indexOf(term) >= 0;
        });
        return (term ? [] : ['']).concat(matches).slice(0, 12);
      }
      function closeCountryMenu() {
        countryMenu.hidden = true;
        countrySel.setAttribute('aria-expanded', 'false');
        countrySel.removeAttribute('aria-activedescendant');
        activeCountry = -1;
      }
      function chooseCountry(value) {
        countrySel.value = value;
        closeCountryMenu();
        search();
      }
      function renderCountryMenu() {
        var matches = countryMatches();
        activeCountry = Math.min(activeCountry, matches.length - 1);
        if (!matches.length) {
          countryMenu.innerHTML = '<div class="pbfeed__countryempty">No matching country</div>';
        } else {
          countryMenu.innerHTML = matches.map(function (c, i) {
            return '<button type="button" role="option" id="pb-country-option-' + i +
              '" class="pbfeed__countryoption' + (i === activeCountry ? ' is-active' : '') +
              '" data-country="' + esc(c) + '" aria-selected="' + (i === activeCountry) + '">' +
              esc(c || 'All countries') + '</button>';
          }).join('');
        }
        countryMenu.hidden = false;
        countrySel.setAttribute('aria-expanded', 'true');
        if (activeCountry >= 0) {
          countrySel.setAttribute('aria-activedescendant', 'pb-country-option-' + activeCountry);
          var active = countryMenu.querySelector('.is-active');
          if (active) active.scrollIntoView({ block: 'nearest' });
        } else {
          countrySel.removeAttribute('aria-activedescendant');
        }
      }
      countrySel.addEventListener('focus', renderCountryMenu);
      countrySel.addEventListener('input', function () {
        activeCountry = -1;
        renderCountryMenu();
      });
      countrySel.addEventListener('keydown', function (e) {
        var matches = countryMatches();
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault();
          if (countryMenu.hidden) renderCountryMenu();
          activeCountry = e.key === 'ArrowDown'
            ? Math.min(activeCountry + 1, matches.length - 1)
            : Math.max(activeCountry < 0 ? matches.length - 1 : activeCountry - 1, 0);
          renderCountryMenu();
        } else if (e.key === 'Enter' && !countryMenu.hidden && activeCountry >= 0) {
          e.preventDefault();
          chooseCountry(matches[activeCountry]);
        } else if (e.key === 'Escape') {
          closeCountryMenu();
        }
      });
      countryMenu.addEventListener('mousedown', function (e) {
        var option = e.target.closest('.pbfeed__countryoption');
        if (!option) return;
        e.preventDefault();
        chooseCountry(option.getAttribute('data-country') || '');
      });
      document.addEventListener('mousedown', function (e) {
        if (!countrySel.parentElement.contains(e.target)) closeCountryMenu();
      });
    }

    // The /buyers/search backend treats its params very differently:
    //   q=                   buyer NAME (regex/$text over buyer_name) — or the
    //                        HS-code path when the value is numeric
    //   product_description= the real PRODUCT search (full-text over shipment
    //                        product/HS descriptions + HS-code resolution)
    //   hs_code_6=           buyers importing that 6-digit HS code
    // The old code sent everything as q=, so typing "ceramic tiles" returned
    // companies NAMED "…CERAMIC TILES…" instead of companies BUYING ceramic
    // tiles. A text query is now product-first with a name fallback (below).
    function searchUrl(params) {
      var qs = Object.keys(params)
        .filter(function (k) { return params[k] !== '' && params[k] != null; })
        .map(function (k) { return k + '=' + encodeURIComponent(params[k]); })
        .join('&');
      return API.portbrain + '/api/v1/buyers/search?' + qs + '&limit=24';
    }
    function itemsOf(resp) {
      return ((resp && resp.items) || []).filter(function (b) { return b.buyer_name || b.buyer_uuid; });
    }
    function dedupeByName(lists) {
      var seen = {}, out = [];
      lists.forEach(function (arr) {
        (arr || []).forEach(function (b) {
          var key = String(b.buyer_name || b.buyer_uuid || '').toUpperCase();
          if (!key || seen[key]) return;
          seen[key] = true;
          out.push(b);
        });
      });
      return out;
    }

    // PRODUCT search for a text query — two routes RACED in parallel, first
    // one back with buyers wins (they answer the same question, and either
    // may be the fast one depending on which backend build is deployed):
    //  a. product_description= directly — full-text over shipment product/HS
    //     descriptions (the older prod build answers it only when a country
    //     narrows the scan; the current build answers unscoped too, slowly).
    //  b. resolve the text to HS codes (/hs-codes/search) and pull buyers of
    //     the top codes — works on every deployed build.
    // No client aborts (same "never auto-cancel" rule as the rest of this
    // feed): a dead route resolves null via the server's own timeout and the
    // race just waits for its sibling.
    // Returns {items, total, how} or null when the term isn't a known product.
    function productSearch(q, country, mine, progress) {
      // Once the race has a winner the search() caller renders — a progress
      // note from the still-running loser would WIPE the rendered results
      // (observed live: cards appeared, then the ladder's "Scanning…" note
      // replaced them). settled gates every late progress write.
      var settled = false;
      function say(text) { if (!settled && progress) progress(text); }
      // match_mode=fuzzy mirrors the admin Buyer Search's product query exactly.
      var directP = getJSON(searchUrl({ product_description: q, country: country, match_mode: 'fuzzy' }), { timeout: 0 })
        .then(function (resp) {
          var items = itemsOf(resp);
          return items.length ? { items: items, total: resp.total, how: 'product' } : null;
        })
        .catch(function () { return null; });
      var ladderP = (async function () {
        var codes = [];
        try {
          var hsResp = await getJSON(API.portbrain + '/api/v1/hs-codes/search?q=' + encodeURIComponent(q) + '&limit=10', { timeout: 0 });
          // The HS catalog is multilingual and the backend match is substring —
          // "fabric" also hits Portuguese "fabricação" (manufacturing) and lands
          // on vegetable-product codes. Keep only codes whose description
          // contains a query word as a WHOLE word (with simple plural forms).
          var qWords = q.toLowerCase().split(/\s+/).filter(function (w) { return w.length >= 3; });
          codes = ((hsResp && hsResp.items) || [])
            .filter(function (h) {
              var toks = String(h.description || '').toLowerCase().split(/[^a-z]+/);
              return qWords.some(function (w) {
                return toks.indexOf(w) >= 0 || toks.indexOf(w + 's') >= 0 || toks.indexOf(w + 'es') >= 0 ||
                  (w.charAt(w.length - 1) === 's' && toks.indexOf(w.substring(0, w.length - 1)) >= 0);
              });
            })
            .map(function (h) { return String(h.hs_code || '').substring(0, 6); })
            .filter(function (c) { return /^\d{6}$/.test(c); });
        } catch (e) { return null; }   // resolver unavailable → name fallback
        if (codes.length) say('Scanning importers of “' + q + '” (HS ' + codes[0] + ')…');
        for (var i = 0; i < Math.min(codes.length, 2); i++) {
          if (mine !== seq) return null;
          try {
            var byHs = await getJSON(searchUrl({ hs_code_6: codes[i], country: country }), { timeout: 0 });
            var hsItems = itemsOf(byHs);
            if (hsItems.length) return { items: hsItems, total: byHs.total, how: 'hs' };
          } catch (e) { /* next code */ }
        }
        return null;
      })();
      // First route to produce buyers wins; null only when BOTH come up empty.
      return new Promise(function (resolve) {
        var pending = 2;
        function settle(r) {
          if (r && r.items.length) { settled = true; resolve(r); }
          else if (--pending === 0) { settled = true; resolve(null); }
        }
        directP.then(settle);
        ladderP.then(settle);
      });
    }

    // SPELL CORRECTION — a compact vocabulary of real product words extracted
    // from the HS taxonomy (build-time, _hswords.js). A query word that isn't
    // in the vocabulary is mapped to its nearest vocabulary word (edit
    // distance ≤1 for short words, ≤2 otherwise; the list is frequency-ordered
    // so the first hit at the best distance is the most common word). This is
    // what turns "febric" into "fabric" — no backend support needed.
    var _vocab = null;
    function vocab() {
      if (!_vocab) {
        var arr = HS_WORDS.split(' ');
        var set = {};
        for (var i = 0; i < arr.length; i++) set[arr[i]] = true;
        _vocab = { arr: arr, set: set };
      }
      return _vocab;
    }
    function editDistLe(a, b, max) {
      var la = a.length, lb = b.length;
      if (Math.abs(la - lb) > max) return max + 1;
      var prev = [], cur = [], i, j, t;
      for (j = 0; j <= lb; j++) prev[j] = j;
      for (i = 1; i <= la; i++) {
        cur[0] = i;
        var rowMin = i;
        for (j = 1; j <= lb; j++) {
          var cost = a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1;
          cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
          if (cur[j] < rowMin) rowMin = cur[j];
        }
        if (rowMin > max) return max + 1;
        t = prev; prev = cur; cur = t;
      }
      return prev[lb];
    }
    function correctProductTerm(q) {
      var v = vocab();
      var words = q.toLowerCase().split(/\s+/).filter(Boolean);
      var out = [], changed = false;
      for (var wi = 0; wi < words.length; wi++) {
        var w = words[wi];
        if (w.length < 4 || v.set[w] || /\d/.test(w)) { out.push(w); continue; }
        var max = w.length <= 5 ? 1 : 2;
        var best = null, bestD = max + 1;
        for (var i = 0; i < v.arr.length; i++) {
          var d = editDistLe(w, v.arr[i], max);
          if (d < bestD) { bestD = d; best = v.arr[i]; if (bestD === 1) break; }
        }
        if (best) { out.push(best); changed = true; } else { out.push(w); }
      }
      return changed ? out.join(' ') : null;
    }

    // Text query resolution: PRODUCT first (that's what this page promises),
    // buyer NAME as fallback. A one-box query can also be a company name that
    // merely CONTAINS product words ("rak ceramics"), so even when the product
    // route wins, the top couple of name hits are woven in after the leading
    // importers — the company someone typed stays findable.
    //
    // HONESTY CHECK: the backend's product route can "succeed" with pure
    // buyer-NAME matches (its text index falls back to names when a term
    // matches no product data — e.g. a misspelling like "febric"). When the
    // product route's top rows are all present in the plain name search too,
    // the match is name-based: relabel it, and first try a spell-corrected
    // product search so the user still gets real importers.
    // Returns {items, total, matchedAs, correctedTo?}, or null when superseded.
    async function runTextSearch(q, country, mine, progress, noCorrect) {
      var namePromise = getJSON(searchUrl({ q: q, country: country }), { timeout: 0 }).catch(function () { return null; });
      var product = await productSearch(q, country, mine, progress);
      if (mine !== seq) return null;
      var nameResp = await namePromise;
      if (mine !== seq) return null;
      var nameItems = itemsOf(nameResp);
      var nameSet = {};
      nameItems.forEach(function (b) { nameSet[String(b.buyer_name || '').toUpperCase()] = true; });
      var nameOnly = !!(product && product.items.length) &&
        product.items.slice(0, 8).every(function (b) { return nameSet[String(b.buyer_name || '').toUpperCase()]; });

      // Nothing product-based (or name-matches masquerading as product) →
      // one spell-corrected retry before settling for company names.
      if ((!product || nameOnly) && !noCorrect) {
        var corrected = correctProductTerm(q);
        if (corrected && corrected !== q) {
          progress('No product match for “' + q + '” — trying “' + corrected + '”…');
          var fixed = await runTextSearch(corrected, country, mine, progress, true);
          if (mine !== seq) return null;
          if (fixed && fixed.items.length && fixed.matchedAs === 'product') {
            fixed.correctedTo = corrected;
            return fixed;
          }
        }
      }

      if (product && product.items.length && !nameOnly) {
        return {
          items: dedupeByName([product.items.slice(0, 4), nameItems.slice(0, 2), product.items]),
          total: product.total,
          matchedAs: 'product',
        };
      }
      // Name-based result (either the fallback or the unmasked "product" hits).
      var items = nameOnly ? dedupeByName([product.items, nameItems]) : nameItems;
      var total = nameOnly && nameResp && nameResp.total == null ? product.total : (nameResp && nameResp.total);
      return { items: items, total: total, matchedAs: 'name' };
    }

    var inFlightKey = null;
    async function search() {
      var q = input.value.trim();
      var country = countrySel ? countrySel.value.trim() : '';
      // The demo tour ends by re-seeding the same query it just submitted
      // (skip() → search()), which used to run the whole pipeline twice.
      // An identical search already in flight is simply left to finish.
      var key = q + '|' + country;
      if (key === inFlightKey) return;
      inFlightKey = key;
      var mine = ++seq;
      var label = q || country;
      list.innerHTML = note(label ? 'Searching Port Brain for “' + label + '”…' : 'Loading live importers from Port Brain…');
      function progress(text) { if (mine === seq) list.innerHTML = note(text); }

      try {
        var isNumeric = /^\d{4,10}$/.test(q);
        var items, total, matchedAs = 'name', worldwide = false, prodCountP = null, correctedTo = null;

        if (!q) {
          // Country-only → server-side country filter on the buyer list;
          // no filter at all → the unfiltered baseline feed (headline source).
          var listUrl = API.portbrain + '/api/v1/buyers?limit=24' + (country ? '&country=' + encodeURIComponent(country) : '');
          var resp = await getJSON(listUrl, { timeout: 0 });
          // Harvest the full-DB headline figures from the UNFILTERED baseline
          // load (the one request we fire on page-open). Done BEFORE the
          // supersede check so the self-playing demo's filtered search can't
          // starve the tiles, and WITHOUT any extra request.
          if (!country) updateHeadline(resp);
          if (mine !== seq) return;
          items = itemsOf(resp);
          total = resp && resp.total;
        } else if (isNumeric) {
          // HS-code query — the backend's numeric q path aggregates buyers of
          // that code from raw shipments.
          var hsResp2 = await getJSON(searchUrl({ q: q, country: country }), { timeout: 0 });
          if (mine !== seq) return;
          items = itemsOf(hsResp2);
          total = hsResp2 && hsResp2.total;
          matchedAs = 'hs';
          if (!items.length && country) {
            // Nothing in the selected country → retry worldwide (the admin
            // equivalent of flipping back to "All Countries").
            progress('No buyers in ' + country + ' — searching worldwide…');
            var hsWide = await getJSON(searchUrl({ q: q }), { timeout: 0 }).catch(function () { return null; });
            if (mine !== seq) return;
            items = itemsOf(hsWide);
            total = hsWide && hsWide.total;
            worldwide = items.length > 0;
          }
        } else {
          // Same companion call the admin Buyer Search fires: matching
          // products in the trade flow (shown as a footer count).
          prodCountP = getJSON(API.portbrain + '/api/v1/products?search=' + encodeURIComponent(q) + '&limit=10', { timeout: 0 })
            .catch(function () { return null; });
          var r = await runTextSearch(q, country, mine, progress);
          if (!r) return;
          if (!r.items.length && country) {
            // The demo tour leaves a country selected; a product that has no
            // buyers THERE still deserves its worldwide answer, like the
            // admin's "All Countries" view.
            progress('No buyers in ' + country + ' — searching worldwide…');
            r = await runTextSearch(q, '', mine, progress);
            if (!r) return;
            worldwide = r.items.length > 0;
          }
          items = r.items;
          total = r.total;
          matchedAs = r.matchedAs;
          if (r.correctedTo) correctedTo = r.correctedTo;
        }

        if (!items || !items.length) { list.innerHTML = note('No buyers matched — try another product, HS code or country.'); return; }
        var totalFmt = total != null ? Number(total).toLocaleString('en-IN') : String(items.length);
        var verb = matchedAs === 'product' || matchedAs === 'hs' ? 'importing' : 'matching';
        var term = correctedTo || q || country;
        var foot = !label
          ? totalFmt + ' buyers mapped'
          : totalFmt + ' buyers ' + verb + ' “' + esc(term) + '”' +
            (correctedTo ? ' (corrected from “' + esc(q) + '”)' : '') +
            (worldwide ? ' worldwide (none in ' + esc(country) + ')' : '');
        list.innerHTML = items.slice(0, 6).map(cardHTML).join('') +
          '<div class="pb-list__foot">↳ live from Port Brain · ' + foot + '<span class="pb-prodcount"></span></div>';
        // Async footer chip: how many products in the trade flow matched the
        // term (the admin's Products counter). Appended when it arrives.
        if (prodCountP) {
          prodCountP.then(function (pr) {
            if (mine !== seq || !pr) return;
            var n = Number(pr.total) || (pr.items || []).length;
            var el = list.querySelector('.pb-prodcount');
            if (n > 0 && el) el.textContent = ' · ' + Number(n).toLocaleString('en-IN') + ' matching products in the trade flow';
          });
        }
      } catch (e) {
        if (mine !== seq) return;
        list.innerHTML = note('Live Port Brain feed is momentarily unavailable. Please retry.');
      } finally {
        // Once this search is done (or superseded), the same query may be
        // re-submitted manually — that's a legitimate refresh.
        if (mine === seq) inFlightKey = null;
      }
    }

    // Fill the 5 headline figures (records analysed, total buyers, hot/whale,
    // active, countries) from a full-DB response. Pure DOM update — no fetch of
    // its own, so it never adds a request. Each tile updates only when its value
    // is present, so a partial/null stats block leaves that tile's "…" in place
    // until the backend returns it (no polling, no auto-retry).
    function updateHeadline(resp) {
      // The backend answers {items:[], total:0, timeout:true} when its own 15s
      // guard fires — that's "no data yet", NOT a real zero. Never write it to
      // the tiles; leave the "…" placeholders until a real total arrives.
      if (!resp || resp.timeout || !(Number(resp.total) > 0)) return;
      var total = fmt(resp.total);
      if (total != null) {
        if (totalEl) totalEl.textContent = total;
        // Every printed "buyers mapped" figure on the page (prologue, hero
        // stat line, ACT-3 card) mirrors the same live DB count.
        document.querySelectorAll('.js-pb-buyers').forEach(function (el) { el.textContent = total; });
      }
      var st = (resp && resp.stats) || {};
      if (hotWhaleEl && st.hot_whale != null) hotWhaleEl.textContent = fmt(st.hot_whale);
      if (st.countries != null) {
        countryEls.forEach(function (el) { el.textContent = fmt(st.countries); });
      }
    }

    // LIVE STORY FIGURES — the remaining printed numbers become dynamic too.
    // Each fetch is independent, non-blocking and best-effort: the printed
    // copy stays as the instant placeholder and is overwritten the moment the
    // real figure lands (so a dead endpoint never blanks the page).
    (function liveStoryFigures() {
      function fmtIndianScale(n) {
        n = Number(n);
        if (!(n > 0)) return null;
        if (n >= 1e7) { var cr = Math.round((n / 1e7) * 10) / 10; return (cr % 1 ? cr.toFixed(1) : String(cr)) + ' crore+'; }
        if (n >= 1e5) return Math.floor(n / 1e5) + ' lakh+';
        return fmt(n);
      }
      function setAll(sel, text) {
        if (!text) return;
        document.querySelectorAll(sel).forEach(function (el) { el.textContent = text; });
      }

      // "Live · <today>" — the date chip reflects the actual visit day.
      var dateEl = document.getElementById('pb-live-date');
      if (dateEl) {
        try {
          dateEl.textContent = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long' });
        } catch (e) { /* keep printed date */ }
      }

      // Trade records read — live count of the raw shipment collection. This
      // endpoint takes ~45s on the production backend, so it fills in whenever
      // it arrives; the "Records analysed" tile shares the same real figure.
      getJSON(API.portbrain + '/api/v1/raw-data/portbrain-raw/stats', { timeout: 0 })
        .then(function (s) {
          var n = s && Number(s.total_records);
          if (!(n > 0)) return;
          setAll('.js-pb-records', fmtIndianScale(n));
          if (recEl) recEl.textContent = fmt(n);
        })
        .catch(function () { /* keep printed copy */ });

      // Indian products to match against — live marketplace catalogue total.
      getJSON(API.marketplace + '/product-service/products?limit=1', { timeout: 0 })
        .then(function (r) {
          var n = r && r.pagination && Number(r.pagination.total);
          if (n > 0) setAll('.js-pb-products', fmtIndianScale(n));
        })
        .catch(function () { /* keep printed copy */ });
    })();

    form.addEventListener('submit', function (e) { e.preventDefault(); search(); });
    search();

    /* Self-playing cinematic demo (shared engine): the page dims, the buyer-search bar
       lifts into a spotlight, a product query types itself in, a country is picked from
       a live dropdown, and "Find buyers" is pressed — real importers answer. #pb-feed
       is revealed with a transition (stacking context), so it is raised with the bar.
       Delayed so the reveal settles first. */
    runDemoTour({
      bar: form,
      liftAlso: [document.getElementById('pb-feed')],
      delay: 1100,
      threshold: 0.5,
      output: list,
      resultReady: function () { return !!list.querySelector('.pbcard'); },
      userStarted: function () { return !!(input.value || '').trim(); },
      skip: function () {
        input.value = 'ceramic tiles';
        if (countrySel) countrySel.value = 'United Arab Emirates';
        search();
      },
      script: async function (t) {
        t.caption(1, 3, 'Watch — typing a product India exports…');
        await t.type(input, 'ceramic tiles', 60);
        t.caption(2, 3, 'Picking the buyer market to scan…');
        await t.pick(countrySel, [
          { f: '🇺🇸', n: 'United States' }, { f: '🇦🇪', n: 'United Arab Emirates', pick: true },
          { f: '🇬🇧', n: 'United Kingdom' }, { f: '🇩🇪', n: 'Germany' }, { f: '🇯🇵', n: 'Japan' }
        ], function () { if (countrySel) countrySel.value = 'United Arab Emirates'; });
        t.caption(3, 3, 'Scanning 13 lakh live trade records for buyers…');
        var goBtn = document.querySelector('#pb-search .pbfeed__go');
        if (goBtn) t.press(goBtn); else search(); // real click submits the form → search()
        await t.wait(300);
        await t.result();
      },
    });
  })();

  /* ===== KEYNOTE (ACTs 1–7): staged hero lines + scroll reveals, scoped to the
     .pb-keynote wrapper. ===== */
  (function keynote() {
    var scopes = document.querySelectorAll('.pb-keynote');
    if (!scopes.length) return;

    // Only hide-then-reveal once JS is confirmed running (no-JS shows everything).
    scopes.forEach(function (s) { s.classList.add('is-ready'); });

    var hero = document.getElementById('pb-hero');
    if (hero) requestAnimationFrame(function () { setTimeout(function () { hero.classList.add('play'); }, 140); });

    if (!('IntersectionObserver' in window)) {
      document.querySelectorAll('.pb-keynote .reveal').forEach(function (el) { el.classList.add('vis'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('vis'); io.unobserve(e.target); } });
    }, { threshold: 0.14, rootMargin: '0px 0px -8% 0px' });
    document.querySelectorAll('.pb-keynote .reveal').forEach(function (el) { io.observe(el); });
  })();

}
