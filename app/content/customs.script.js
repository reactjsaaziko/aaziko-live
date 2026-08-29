'use client';
import { API, getJSON, postJSON } from './_api.js';
import { runDemoTour } from './_demotour.js';

/* Customs page ("aaziko_customs" redesign) — narrative sections + the live Custom 3.0 box.

   Page behaviour (scoped to #azc-customs): staged hero lines, reveal-on-scroll, mobile burger nav.

   Live box: faithful replica of the admin "ModernHSCodeSearch" (Custom 3.0) screen,
   rebuilt in vanilla JS for the marketing static site. Wired to the same ai-service endpoints:
     GET  /api/hscode/available-countries                  → country dropdowns
     GET  /api/hscode/hscodes/autocomplete?q=&limit=       → HS typeahead + country-specific variants
     GET  /api/hscode/search/:hs?country=&mode=            → MACMAP official regulatory measures
     POST /api/compliance/analyze                          → production / packaging / documents (Claude-powered, cache-first)
*/
export function init() {
  initPage();
  initLiveBox();
}

/* ================= page shell: nav + staged hero + reveal-on-scroll ================= */
function initPage() {
  var page = document.getElementById('azc-customs');
  if (!page) return;
  page.classList.add('js-ready');

  /* measure sticky nav + credibility bar so the first section fills the rest of
     the viewport exactly (used by .moment.screen1's calc); the shared header
     lives outside #azc-customs, so it is looked up document-wide */
  (function () {
    var nav = document.querySelector('.nav');
    var cred = page.querySelector('.cred');
    function setChrome() {
      var h = (nav ? nav.offsetHeight : 0) + (cred ? cred.offsetHeight : 0);
      page.style.setProperty('--azc-chrome', h + 'px');
    }
    setChrome();
    window.addEventListener('resize', setChrome);
  })();

  /* staged hero lines */
  requestAnimationFrame(function () {
    setTimeout(function () {
      var h = document.getElementById('azc-hero');
      if (h) h.classList.add('play');
    }, 140);
  });

  /* reveal-on-scroll */
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (e.isIntersecting) { e.target.classList.add('vis'); io.unobserve(e.target); }
    });
  }, { threshold: 0.14, rootMargin: '0px 0px -8% 0px' });
  page.querySelectorAll('.reveal').forEach(function (el) { io.observe(el); });
}

/* ================= Custom 3.0 live box ================= */
function initLiveBox() {
  var root = document.getElementById('cu3');
  if (!root) return;

  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function debounce(fn, ms) { var t; return function () { var a = arguments, c = this; clearTimeout(t); t = setTimeout(function () { fn.apply(c, a); }, ms); }; }

  // ---- country → flag emoji ----
  var ISO = {
    'india': 'IN', 'united kingdom': 'GB', 'uk': 'GB', 'great britain': 'GB', 'united states': 'US', 'usa': 'US', 'us': 'US',
    'united arab emirates': 'AE', 'uae': 'AE', 'australia': 'AU', 'germany': 'DE', 'argentina': 'AR', 'china': 'CN',
    'afghanistan': 'AF', 'albania': 'AL', 'anguilla': 'AI', 'antigua and barbuda': 'AG', 'armenia': 'AM', 'austria': 'AT',
    'bangladesh': 'BD', 'belgium': 'BE', 'bhutan': 'BT', 'brazil': 'BR', 'cambodia': 'KH', 'canada': 'CA', 'chile': 'CL',
    'cuba': 'CU', 'cyprus': 'CY', 'djibouti': 'DJ', 'dominican republic': 'DO', 'ecuador': 'EC', 'ethiopia': 'ET',
    'france': 'FR', 'ghana': 'GH', 'honduras': 'HN', 'hong kong': 'HK', 'hong kong, china': 'HK', 'indonesia': 'ID',
    'iraq': 'IQ', 'ireland': 'IE', 'israel': 'IL', 'italy': 'IT', 'japan': 'JP', 'jordan': 'JO', 'kenya': 'KE',
    'kiribati': 'KI', 'kuwait': 'KW', 'lesotho': 'LS', 'liberia': 'LR', 'malaysia': 'MY', 'maldives': 'MV', 'mexico': 'MX',
    'moldova, republic of': 'MD', 'moldova': 'MD', 'nepal': 'NP', 'netherlands': 'NL', 'new zealand': 'NZ',
    'nigeria': 'NG', 'oman': 'OM', 'pakistan': 'PK', 'philippines': 'PH', 'poland': 'PL', 'portugal': 'PT', 'qatar': 'QA',
    'russia': 'RU', 'russian federation': 'RU', 'saudi arabia': 'SA', 'singapore': 'SG', 'south africa': 'ZA',
    'south korea': 'KR', 'korea, republic of': 'KR', 'spain': 'ES', 'sri lanka': 'LK', 'sweden': 'SE', 'switzerland': 'CH',
    'thailand': 'TH', 'turkey': 'TR', 'turkiye': 'TR', 'vietnam': 'VN', 'viet nam': 'VN', 'egypt': 'EG', 'bahrain': 'BH',
    'denmark': 'DK', 'norway': 'NO', 'finland': 'FI', 'greece': 'GR', "cote d'ivoire": 'CI', 'ivory coast': 'CI', 'curacao': 'CW'
  };
  function flag(name) {
    var key = String(name || '').toLowerCase().trim();
    var c = ISO[key];
    if (!c) return '🌐';
    return c.toUpperCase().replace(/./g, function (ch) { return String.fromCodePoint(127397 + ch.charCodeAt(0)); });
  }

  // ---- state ----
  var state = {
    hs: '', hsDesc: '', exporting: 'India', destination: '', mode: 'Import',
    ruleCtx: 'importing', activeTab: 'production', sectionsState: 'idle', advOpen: false, consumerOpen: false
  };
  var data = { sections: null, disclaimer: '', macmap: [], guide: null, macmapAI: null };
  var token = 0;
  var loadIv = null;

  // ---- elements ----
  var elHs = $('cu-hs'), elHsDesc = $('cu-hs-desc'), elHsDd = $('cu-hs-dd');
  var elExp = $('cu-exp'), elExpFlag = $('cu-exp-flag'), elExpDd = $('cu-exp-dd');
  var elDest = $('cu-dest'), elDestFlag = $('cu-dest-flag'), elDestDd = $('cu-dest-dd');
  var elTabContent = $('cu-tab-content'), elResults = $('cu-results'), elEmpty = $('cu-empty');
  var elChs = $('cu-chs'), elChsSel = $('cu-chs-select'), elChsCount = $('cu-chs-count');
  var elRulesNav = $('cu-rules-nav');

  // ---- countries ----
  var COUNTRIES = ['India', 'United Kingdom', 'United States', 'United Arab Emirates', 'Australia', 'Germany', 'Argentina',
    'China', 'France', 'Italy', 'Spain', 'Netherlands', 'Canada', 'Japan', 'Singapore', 'Saudi Arabia', 'Qatar', 'Oman',
    'Kuwait', 'Bahrain', 'Bangladesh', 'Nepal', 'Sri Lanka', 'Malaysia', 'Indonesia', 'Vietnam', 'Thailand', 'South Africa', 'Kenya', 'Brazil', 'Mexico'];
  (async function loadCountries() {
    try {
      var r = await getJSON(API.trademap + '/api/hscode/available-countries');
      var merged = [].concat(r.importingCountries || [], r.exportingCountries || []);
      var seen = {}, out = [];
      merged.forEach(function (c) { var k = String(c || '').trim(); if (k && !seen[k.toLowerCase()]) { seen[k.toLowerCase()] = 1; out.push(k); } });
      if (out.length) COUNTRIES = out.sort();
    } catch (e) { /* keep fallback list */ }
  })();

  // ---- generic typeahead dropdown for country fields ----
  function countryDropdown(inputEl, ddEl, flagEl, which) {
    function close() { ddEl.hidden = true; ddEl.innerHTML = ''; }
    function open() {
      var q = inputEl.value.toLowerCase().trim();
      var list = COUNTRIES.filter(function (c) { return c.toLowerCase().indexOf(q) >= 0; }).slice(0, 60);
      if (!list.length) { ddEl.innerHTML = '<div class="hs-empty">No countries found</div>'; ddEl.hidden = false; return; }
      ddEl.innerHTML = list.map(function (c) {
        return '<div class="hs-item" data-c="' + esc(c) + '"><span class="hs-cflag">' + flag(c) + '</span><span class="hs-desc-txt">' + esc(c) + '</span></div>';
      }).join('');
      ddEl.hidden = false;
      Array.prototype.forEach.call(ddEl.querySelectorAll('.hs-item'), function (it) {
        it.addEventListener('mousedown', function (e) {
          e.preventDefault();
          var c = it.getAttribute('data-c');
          inputEl.value = c;
          if (flagEl) { flagEl.textContent = flag(c); flagEl.classList.remove('tss-flag--empty'); }
          if (which === 'exp') state.exporting = c; else state.destination = c;
          close();
        });
      });
    }
    inputEl.addEventListener('input', open);
    inputEl.addEventListener('focus', open);
    inputEl.addEventListener('blur', function () { setTimeout(close, 150); });
  }
  countryDropdown(elExp, elExpDd, elExpFlag, 'exp');
  countryDropdown(elDest, elDestDd, elDestFlag, 'dest');

  // ---- HS code typeahead ----
  function digits(s) { return String(s || '').replace(/\D/g, ''); }
  var hsSearch = debounce(async function () {
    var q = elHs.value.trim();
    if (!q) { elHsDd.hidden = true; return; }
    elHsDd.innerHTML = '<div class="hs-empty">Searching…</div>'; elHsDd.hidden = false;
    var url = API.trademap + '/api/hscode/hscodes/autocomplete?q=' + encodeURIComponent(q) + '&limit=20' +
      (state.destination ? '&destinationCountry=' + encodeURIComponent(state.destination) : '') +
      (state.exporting ? '&exportingCountry=' + encodeURIComponent(state.exporting) : '');
    try {
      var r = await getJSON(url);
      var rows = (r && r.data) || [];
      if (!rows.length) { elHsDd.innerHTML = '<div class="hs-empty">No matches</div>'; return; }
      elHsDd.innerHTML = rows.map(function (row, i) {
        var hc = String(row.hsCode == null ? '' : row.hsCode);
        var cflag = row.country ? '<span class="hs-cflag">' + flag(row.country) + '</span>' : '';
        var cname = row.country ? '<span class="hs-cname">' + esc(row.country) + '</span>' : '';
        return '<div class="hs-item" data-i="' + i + '"><span class="hs-badge">' + esc(hc) + '</span>' + cflag + cname +
          '<span class="hs-desc-txt">' + esc(row.description || '') + '</span></div>';
      }).join('');
      Array.prototype.forEach.call(elHsDd.querySelectorAll('.hs-item'), function (it) {
        it.addEventListener('mousedown', function (e) {
          e.preventDefault();
          var row = rows[+it.getAttribute('data-i')];
          state.hs = digits(row.hsCode); state.hsDesc = row.description || '';
          elHs.value = String(row.hsCode == null ? '' : row.hsCode);
          elHsDesc.textContent = state.hsDesc;
          elHsDd.hidden = true;
        });
      });
    } catch (e) { elHsDd.innerHTML = '<div class="hs-empty">Search unavailable</div>'; }
  }, 280);
  elHs.addEventListener('input', function () { state.hs = digits(elHs.value); state.hsDesc = ''; elHsDesc.textContent = ''; hsSearch(); });
  elHs.addEventListener('focus', function () { if (elHs.value.trim()) hsSearch(); });
  elHs.addEventListener('blur', function () { setTimeout(function () { elHsDd.hidden = true; }, 150); });

  // ---- mode (Export / Import) toggle ----
  Array.prototype.forEach.call(root.querySelectorAll('.trade-search-toggle-btn'), function (btn) {
    btn.addEventListener('click', function () {
      state.mode = btn.getAttribute('data-mode');
      Array.prototype.forEach.call(root.querySelectorAll('.trade-search-toggle-btn'), function (b) { b.classList.toggle('active', b === btn); });
    });
  });

  // ---- rules nav (exporting / importing) ----
  Array.prototype.forEach.call(root.querySelectorAll('.rules-nav-btn'), function (btn) {
    btn.addEventListener('click', function () {
      state.ruleCtx = btn.getAttribute('data-ctx');
      Array.prototype.forEach.call(root.querySelectorAll('.rules-nav-btn'), function (b) { b.classList.toggle('rules-nav-btn-active', b === btn); });
      renderActive();
    });
  });

  // ---- tabs ----
  Array.prototype.forEach.call(root.querySelectorAll('.tab-button'), function (btn) {
    btn.addEventListener('click', function () {
      state.activeTab = btn.getAttribute('data-tab');
      Array.prototype.forEach.call(root.querySelectorAll('.tab-button'), function (b) { b.classList.toggle('tab-button-active', b === btn); });
      renderActive();
    });
  });

  // ---- expand / collapse accordion items (event delegation; survives re-render) ----
  elTabContent.addEventListener('click', function (e) {
    var h = e.target.closest ? e.target.closest('.ai-accordion-header') : null;
    if (!h || !elTabContent.contains(h)) return;
    var item = h.parentNode;
    if (item.classList.contains('no-expand')) return;
    item.classList.toggle('open');
  });

  // ---- consumer requirement ----
  $('cu-consumer').addEventListener('click', function () {
    state.consumerOpen = !state.consumerOpen;
    var c = $('cu-consumer-content');
    c.hidden = !state.consumerOpen;
    $('cu-consumer').classList.toggle('collapsed', !state.consumerOpen);
    $('cu-consumer-chev').classList.toggle('rotated', state.consumerOpen);
    if (state.consumerOpen) c.innerHTML = consumerContent();
  });

  // ---- importance classification ----
  function classify(t) {
    var s = String(t).toLowerCase();
    if (/prohibit|banned|forbidden|not permitted|illegal|restricted/.test(s)) return { cls: 'critical', tag: 'CRITICAL', ico: '⛔' };
    if (/mandatory|must|shall|required|require|ensure|certif|complian|comply|test report|licen|registration|declaration/.test(s)) return { cls: 'high', tag: 'MANDATORY', ico: '⚠' };
    return { cls: 'medium', tag: 'RECOMMENDED', ico: '•' };
  }
  function critToImp(crit, text) {
    var c = String(crit || '').toLowerCase();
    if (c.indexOf('prohibit') >= 0 || c.indexOf('banned') >= 0) return { cls: 'critical', tag: 'PROHIBITED', ico: '⛔' };
    if (c.indexOf('critical') >= 0) return { cls: 'critical', tag: 'CRITICAL', ico: '⛔' };
    if (c.indexOf('mandat') >= 0 || c === 'required') return { cls: 'high', tag: 'MANDATORY', ico: '⚠' };
    if (c.indexOf('recommend') >= 0 || c.indexOf('optional') >= 0 || c.indexOf('advis') >= 0) return { cls: 'medium', tag: 'RECOMMENDED', ico: '•' };
    return classify(text || '');
  }
  function chip(label, val, kind) {
    return '<span class="ai-field' + (kind ? ' field-' + kind : '') + '"><strong>' + esc(label) + ':</strong> ' + esc(val) + '</span>';
  }

  // Real guide requirement → expandable accordion with its actual AI/regulatory detail.
  function reqAccordion(obj) {
    if (typeof obj === 'string') return plainRow(obj);
    var title = obj.requirement || obj.document_name || obj.text || obj.title || obj.name || '';
    if (!title) return '';
    var imp = critToImp(obj.criticality, title);
    var chips = [];
    if (obj.measure_code) chips.push(chip('Measure', obj.measure_code, 'law'));
    if (obj.regulation_ref) chips.push(chip('Regulation', obj.regulation_ref, 'law'));
    if (obj.start_date) chips.push(chip('In force', obj.start_date, ''));
    if (obj.applies_to) chips.push(chip('Applies to', obj.applies_to, ''));
    var authority = obj.authority || obj.implementation_authority || obj.issuing_authority;
    if (authority) chips.push(chip('Authority', authority, ''));
    var chipsHtml = chips.length ? '<div class="ai-card-fields">' + chips.join('') + '</div>' : '';
    var lines = '';
    if (obj.legislation_title) lines += '<div class="ai-body-guide"><strong>Legislation:</strong> ' + esc(obj.legislation_title) + '</div>';
    if (obj.action) lines += '<div class="ai-body-guide">' + esc(obj.action) + '</div>';
    if (obj.requirement && (obj.document_name)) lines += '<div class="ai-body-guide">' + esc(obj.requirement) + '</div>';
    var body = chipsHtml + lines;
    var hasBody = !!body;
    return '<div class="ai-accordion-item importance-' + imp.cls + (hasBody ? '' : ' no-expand') + '">' +
      '<div class="ai-accordion-header"><span class="aih-ico">' + imp.ico + '</span>' +
      '<span class="ai-card-title">' + esc(title) + '</span>' +
      '<span class="importance-tag tag-' + imp.cls + '">' + imp.tag + '</span>' +
      (hasBody ? '<span class="accordion-arrow">▾</span>' : '') + '</div>' +
      (hasBody ? '<div class="ai-accordion-body">' + body + '</div>' : '') + '</div>';
  }

  // Plain AI line (compliance/analyze has no per-item detail) → non-expandable row.
  function plainRow(text) {
    var t = typeof text === 'string' ? text : (text && (text.text || text.requirement || text.title || text.name)) || '';
    if (!t) return '';
    var imp = classify(t);
    return '<div class="ai-accordion-item importance-' + imp.cls + ' no-expand">' +
      '<div class="ai-accordion-header"><span class="aih-ico">' + imp.ico + '</span>' +
      '<span class="ai-card-title">' + esc(t) + '</span>' +
      '<span class="importance-tag tag-' + imp.cls + '">' + imp.tag + '</span></div></div>';
  }

  function guideBlock(title, items) {
    var html = (items || []).map(reqAccordion).filter(Boolean).join('');
    if (!html) return '';
    return '<div class="ai-analysis-block">' + (title ? '<div class="block-heading">' + esc(title) + '</div>' : '') +
      '<div class="ai-accordion-list">' + html + '</div></div>';
  }
  function plainBlock(heading, items) {
    var html = (items || []).map(plainRow).filter(Boolean).join('');
    if (!html) return '';
    return '<div class="ai-analysis-block">' + (heading ? '<div class="block-heading">' + esc(heading) + '</div>' : '') +
      '<div class="ai-accordion-list">' + html + '</div></div>';
  }
  function warningsHTML(warns) {
    var items = (warns || []).map(function (w) {
      var t = w.warning || w.requirement || w.text || '';
      var sub = [w.measure_code, w.legislation_title].filter(Boolean).join(' · ');
      return t ? '<li><strong>' + esc(t) + '</strong>' + (sub ? '<div class="cu3-warn__sub">' + esc(sub) + '</div>' : '') + '</li>' : '';
    }).join('');
    if (!items) return '';
    return '<div class="cu3-warn"><div class="cu3-warn__head">⚠ Prohibition warnings (' + warns.length + ')</div><ul>' + items + '</ul></div>';
  }

  // Does the structured guide actually carry any items (it's empty for many combos)?
  function guideHasItems(g) {
    if (!g) return false;
    function any(o, keys) { return o && keys.some(function (k) { return o[k] && o[k].length; }); }
    return any(g.production, ['importing_country_requirements', 'exporting_country_requirements']) ||
      any(g.packaging, ['importing_country_requirements', 'exporting_country_requirements', 'packaging_requirements']) ||
      any(g.documents, ['importing_country_documents', 'exporting_country_documents', 'traceability_records']) ||
      (g.prohibition_warnings && g.prohibition_warnings.length) || false;
  }
  // Tolerant of both shapes: the cached guide (uses *_documents for documents) and
  // the live MACMAP AI pass (uses *_requirements for all three tabs).
  function guideListFor(g, tab, ctx) {
    var sec = g[tab] || {};
    var imp = sec.importing_country_requirements || sec.importing_country_documents || [];
    var exp = sec.exporting_country_requirements || sec.exporting_country_documents || [];
    var extra = sec.packaging_requirements || sec.traceability_records || [];
    return [].concat(ctx === 'exporting' ? exp : imp, extra);
  }

  // ---- MACMAP official measures ----
  function collectMacmap(records) {
    var order = [], by = {};
    (records || []).forEach(function (rec) {
      (rec.Data || []).forEach(function (sec) {
        var name = sec.MeasureSection || 'Other requirements';
        if (!by[name]) { by[name] = {}; order.push(name); }
        (sec.Measures || []).forEach(function (m) {
          if (!m || !m.MeasureTitle) return;
          var k = (m.MeasureCode || '') + '|' + m.MeasureTitle;
          if (!by[name][k]) by[name][k] = { code: m.MeasureCode || '', title: m.MeasureTitle, summary: m.MeasureSummary || '' };
        });
      });
    });
    return order.map(function (n) { return { section: n, measures: Object.keys(by[n]).map(function (k) { return by[n][k]; }) }; })
      .filter(function (g) { return g.measures.length; });
  }
  // Total measure count → the "Official Regulatory Measures (N)" tab badge.
  function updateRegCount() {
    var el = document.getElementById('cu-reg-count'); if (!el) return;
    var n = collectMacmap(data.macmap || []).reduce(function (s, g) { return s + g.measures.length; }, 0);
    el.textContent = n ? ' (' + n + ')' : '';
  }
  function macmapHTML(records) {
    var groups = collectMacmap(records);
    if (!groups.length) return '';
    var html = '<div class="block-heading" style="background:linear-gradient(135deg,#ecfdf5,#f8fafc);border-left-color:#059669;color:#047857;">' +
      'Official regulatory measures · ' + esc(state.destination) + ' (ITC Market Access Map)</div>';
    groups.forEach(function (g) {
      html += '<div class="ai-analysis-block"><div class="block-heading">' + esc(g.section) + '</div>';
      g.measures.forEach(function (m) {
        var sum = m.summary && m.summary.length > 240 ? m.summary.slice(0, 240) + '…' : m.summary;
        html += '<div class="measure-row"><div class="measure-title">' +
          (m.code ? '<span class="measure-code">' + esc(m.code) + '</span>' : '') + esc(m.title) + '</div>' +
          (sum ? '<div class="measure-sum">' + esc(sum) + '</div>' : '') + '</div>';
      });
      html += '</div>';
    });
    return html;
  }

  // ---- loading (rotating messages) ----
  var LOAD_MSGS = {
    production: ['Reviewing manufacturing controls for the HS code…', 'Identifying mandatory testing & certification steps…', 'Looking up destination country quality standards…', 'Compiling production checklist…'],
    packaging: ['Reading destination market labelling rules…', 'Looking up mandatory language requirements…', 'Identifying outer-packaging standards…', 'Compiling packaging & labelling checklist…'],
    documents: ['Identifying required commercial documents…', 'Listing compliance & certification papers…', 'Adding origin and import documents…', 'Compiling your customs document checklist…'],
    regulatory: ['Fetching official regulatory measures…', 'Reading the ITC Market Access Map…', 'Compiling the measures for this route…']
  };
  function startLoading(container, messages) {
    if (loadIv) { clearInterval(loadIv); loadIv = null; }
    container.innerHTML = '<div class="loading-message"><div class="cu-spinner"></div><div class="loading-text">' + esc(messages[0]) + '</div></div>';
    var i = 0, tEl = container.querySelector('.loading-text');
    loadIv = setInterval(function () {
      i = (i + 1) % messages.length;
      if (!tEl) return;
      tEl.style.opacity = '0';
      setTimeout(function () { if (tEl) { tEl.textContent = messages[i]; tEl.style.opacity = '1'; } }, 250);
    }, 2200);
  }

  // ---- render the active tab ----
  function defaultTitle(tab) {
    return tab === 'production' ? 'Production stage — what you must ensure'
      : tab === 'packaging' ? 'Packaging & labelling requirements' : 'Required documents';
  }

  function renderTab(tab, ctx) {
    // Official Regulatory Measures live in their OWN tab (the raw MACMAP measures,
    // not lane-split) — independent of the Export/Import rule toggle.
    if (tab === 'regulatory') {
      var rhtml = '<div class="cu3-note" style="margin:0 0 16px;font-style:normal;color:#475569;">' +
        'Official regulatory measures on file for <strong>' + esc(state.destination) + '</strong>, from the ITC Market Access Map.</div>';
      var mac = (data.macmap && data.macmap.length) ? macmapHTML(data.macmap) : '';
      rhtml += mac || '<div class="cu3-tab-empty">No official regulatory measures on file for this combination yet.</div>';
      if (data.disclaimer) rhtml += '<div class="cu3-note">' + esc(data.disclaimer) + '</div>';
      return rhtml;
    }
    var s = data.sections || {};
    var rich = data.macmapAI || data.guide;   // real per-item detail (live AI pass, or cached guide)
    var html = '';
    var ctxNote = ctx === 'exporting'
      ? 'Prerequisites to satisfy in <strong>' + esc(state.exporting) + '</strong> before this shipment leaves for ' + esc(state.destination) + '.'
      : 'Rules that apply at <strong>' + esc(state.destination) + '</strong> customs for goods arriving from ' + esc(state.exporting) + '.';
    html += '<div class="cu3-note" style="margin:0 0 16px;font-style:normal;color:#475569;">' + ctxNote + '</div>';

    var warns = (data.guide && data.guide.prohibition_warnings) || (data.macmapAI && data.macmapAI.prohibition_warnings);
    if (tab === 'documents' && warns && warns.length) html += warningsHTML(warns);

    var richItems = rich ? guideListFor(rich, tab, ctx) : [];
    if (richItems.length) {
      html += guideBlock((rich[tab] && rich[tab].title) || defaultTitle(tab), richItems);
    } else {
      if (tab === 'production' && s.production) html += plainBlock(s.production.title || defaultTitle(tab), s.production.items);
      else if (tab === 'packaging') ((s.packaging && s.packaging.blocks) || []).forEach(function (b) { html += plainBlock(b.heading, b.items); });
      else if (tab === 'documents') ((s.documents && s.documents.blocks) || []).forEach(function (b) { html += plainBlock(b.heading, b.items); });
    }

    // (Official regulatory measures now live in their own "Official Regulatory
    //  Measures" tab, no longer appended to the production stage.)

    if (!/ai-accordion-item|measure-row/.test(html)) html += '<div class="cu3-tab-empty">No ' + tab + ' requirements found for this combination yet.</div>';
    if (data.disclaimer) html += '<div class="cu3-note">' + esc(data.disclaimer) + '</div>';
    return html;
  }

  function renderActive() {
    // The Official Regulatory Measures tab only needs the quick MACMAP fetch, not
    // the slower AI brief — render it as soon as those measures are in.
    if (state.activeTab === 'regulatory' && data.macmap && data.macmap.length) {
      if (loadIv) { clearInterval(loadIv); loadIv = null; }
      elTabContent.innerHTML = renderTab('regulatory', state.ruleCtx);
      return;
    }
    var ready = data.macmapAI || data.guide || data.sections;
    if (!ready) {
      if (state.sectionsState === 'error') { elTabContent.innerHTML = '<div class="cu3-tab-empty">Compliance brief is momentarily unavailable — please try again in a moment.</div>'; return; }
      startLoading(elTabContent, LOAD_MSGS[state.activeTab] || LOAD_MSGS.production);
      return;
    }
    if (loadIv) { clearInterval(loadIv); loadIv = null; }
    elTabContent.innerHTML = renderTab(state.activeTab, state.ruleCtx);
  }

  function consumerContent() {
    var s = data.sections || {}; var lines = [];
    ((s.packaging && s.packaging.blocks) || []).forEach(function (b) {
      if (/label|consumer|languag|market|retail|warning|marking/i.test(b.heading || '')) (b.items || []).forEach(function (it) { lines.push(it); });
    });
    var html = '';
    if (lines.length) html += '<ul style="margin:0 0 10px;padding-left:18px;">' + lines.slice(0, 8).map(function (l) { return '<li style="margin:3px 0;">' + esc(l) + '</li>'; }).join('') + '</ul>';
    html += '<p style="margin:0;color:#64748b;">Retail-facing requirements for <strong>' + esc(state.destination || 'the destination') +
      '</strong>: product labelling in the local language, mandatory safety markings, and consumer-protection / warranty disclosures per destination law.</p>';
    return html;
  }

  // ---- country-specific HS codes (>6-digit national variants) ----
  async function fetchCountryHs(hs6) {
    try {
      var r = await getJSON(API.trademap + '/api/hscode/hscodes/autocomplete?q=' + encodeURIComponent(hs6) + '&limit=50');
      var rows = (r && r.data) || [];
      var variants = rows.filter(function (row) { return digits(row.hsCode).length > 6 && row.country; });
      if (!variants.length) { elChs.hidden = true; return; }
      elChsCount.textContent = String(variants.length);
      elChsSel.innerHTML = '<option value="">Select a country-specific HS code…</option>' + variants.map(function (row) {
        var d = (row.description || '').slice(0, 90);
        return '<option value="' + esc(digits(row.hsCode)) + '">' + esc(row.hsCode) + '  ' + esc(row.country) + (d ? ' — ' + esc(d) : '') + '</option>';
      }).join('');
      elChs.hidden = false;
    } catch (e) { elChs.hidden = true; }
  }
  elChsSel.addEventListener('change', function () {
    var v = elChsSel.value; if (!v) return;
    state.hs = v; elHs.value = v; elHsDesc.textContent = '';
  });

  // ---- MACMAP fetch ----
  async function fetchMacmap(hs, country) {
    for (var attempt = 0; attempt < 2; attempt++) {
      try {
        var r = await getJSON(API.trademap + '/api/hscode/search/' + hs + '?country=' + encodeURIComponent(country) + '&mode=' + encodeURIComponent(state.mode));
        var recs = r && r.macmapRegulatory && r.macmapRegulatory.data;
        if (recs && recs.length) return recs;
      } catch (e) { /* retry once */ }
    }
    return [];
  }

  // ---- analyze ----
  async function analyze() {
    var hs = state.hs || digits(elHs.value);
    var dest = (elDest.value || '').trim() || state.destination;
    var exp = (elExp.value || '').trim() || state.exporting || 'India';
    state.destination = dest; state.exporting = exp; state.hs = hs;

    if (!hs) { elHs.focus(); flash(elHs); return; }
    if (!dest) { elDest.focus(); flash(elDest); return; }

    var myToken = ++token;
    if (elEmpty) elEmpty.hidden = true;
    elResults.hidden = false;
    elRulesNav.hidden = false;
    $('cu-rules-exp').textContent = '(' + exp + ')';
    $('cu-rules-imp').textContent = '(' + dest + ')';
    state.consumerOpen = false; $('cu-consumer-content').hidden = true;
    $('cu-consumer').classList.add('collapsed'); $('cu-consumer-chev').classList.remove('rotated');

    data = { sections: null, disclaimer: '', macmap: [], guide: null, macmapAI: null };
    updateRegCount();                     // clear any stale "(N)" from the previous search
    state.sectionsState = 'loading';
    renderActive();                       // single loading state until the one analysis lands
    elResults.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    // country-specific HS variants (non-blocking, cosmetic)
    fetchCountryHs(hs.slice(0, 6));

    // ===== ONE analysis only =====
    // Every accordion body is built from this single response. Opening an item later
    // just reveals its already-loaded detail — it NEVER calls the AI again.

    // Official measures (quick data fetch, not an AI analysis).
    var recs = [];
    try { recs = await fetchMacmap(hs, dest); } catch (e) { recs = []; }
    if (myToken !== token) return;
    data.macmap = recs || [];
    updateRegCount();                     // fill the "Official Regulatory Measures (N)" tab badge
    if (state.activeTab === 'regulatory') renderActive();   // show measures immediately if that tab is open

    // (a) Pre-built structured guide for this combo → use it directly (instant, no AI call).
    var g = null;
    try {
      var gr = await getJSON(API.trademap + '/api/hscode/import-export-guide/' + hs +
        '?country=' + encodeURIComponent(dest) + '&mode=' + encodeURIComponent(state.mode) + '&exportingCountry=' + encodeURIComponent(exp));
      g = gr && gr.data; g = (Array.isArray(g) ? g[0] : g) || null;
    } catch (e) { g = null; }
    if (myToken !== token) return;
    if (guideHasItems(g)) { data.guide = g; state.sectionsState = 'ready'; renderActive(); return; }

    // (b) Otherwise run the SINGLE AI pass over the measures → real per-item detail,
    //     embedded into each accordion now so opening it is instant (no re-analysis).
    if (data.macmap.length) {
      try {
        var ar = await postJSON(API.trademap + '/api/hscode/analyze-macmap-regulatory', {
          hsCode: hs, destinationCountry: dest, exportingCountry: exp, mode: state.mode,
          macmapData: data.macmap, productDetail: state.hsDesc || ''
        }, { timeout: 170000 });
        if (myToken !== token) return;
        data.macmapAI = (ar && ar.analysis) || null;
      } catch (e) { if (myToken !== token) return; }
    }

    // (c) Last-resort fallback only if the AI pass produced nothing (e.g. no measures on file).
    if (!data.macmapAI) {
      try {
        var cr = await postJSON(API.trademap + '/api/compliance/analyze', {
          hsCode: hs, destinationCountry: dest, importOrExport: state.mode, exportingCountry: exp, forceAI: false
        }, { timeout: 170000 });
        if (myToken !== token) return;
        var d = cr && (cr.openai || cr.anthropic);
        if (d && d.sections) { data.sections = d.sections; data.disclaimer = d.disclaimer || ''; }
      } catch (e) { if (myToken !== token) return; }
    }

    state.sectionsState = (data.macmapAI || data.sections) ? 'ready' : 'error';
    renderActive();
  }

  function flash(el) {
    el.style.transition = 'box-shadow .2s'; el.style.boxShadow = '0 0 0 3px rgba(239,68,68,0.3)';
    setTimeout(function () { el.style.boxShadow = ''; }, 700);
  }

  $('cu-analyze').addEventListener('click', analyze);
  elHs.addEventListener('keydown', function (e) { if (e.key === 'Enter') { elHsDd.hidden = true; analyze(); } });
  elDest.addEventListener('keydown', function (e) { if (e.key === 'Enter') { elDestDd.hidden = true; analyze(); } });

  /* Self-playing cinematic demo (shared engine): the page dims, the Trade Search bar
     lifts into a spotlight, an HS code types itself in, the destination market is
     picked from a live dropdown, and Analyze is pressed. Values are set without
     input events so the real autocomplete never opens mid-tour; analyze() reads the
     field values directly. The compliance report section appears immediately (its
     accordion loads live), which is when the spotlight lifts. */
  (function autoPlayDemo() {
    var bar = document.querySelector('#demo .trade-search-bar');
    if (!bar) return;
    var seed = function () {
      elHs.value = '690721';
      elDest.value = 'United States';
      if (elDestFlag) { elDestFlag.textContent = '🇺🇸'; elDestFlag.classList.remove('tss-flag--empty'); }
    };
    var ran = false;
    runDemoTour({
      bar: bar,
      delay: 700,
      threshold: 0.5,
      output: document.getElementById('cu-results'),
      resultReady: function () { return !$('cu-results').hidden; },
      userStarted: function () { return !!(elHs.value || '').trim(); },
      skip: function () { seed(); if (!ran) { ran = true; analyze(); } },
      script: async function (t) {
        t.caption(1, 3, 'Watch — typing the product’s HS code…');
        await t.type(elHs, '690721', 90);
        t.caption(2, 3, 'Choosing the destination market…');
        await t.pick(elDest, [
          { f: '🇺🇸', n: 'United States', pick: true }, { f: '🇦🇪', n: 'United Arab Emirates' },
          { f: '🇬🇧', n: 'United Kingdom' }, { f: '🇩🇪', n: 'Germany' }, { f: '🇦🇺', n: 'Australia' }
        ], seed);
        t.caption(3, 3, 'Pulling every rule, duty and document — live…');
        ran = true;
        t.press($('cu-analyze')); // real click → analyze()
        await t.wait(250);
        await t.result();
      },
    });
  })();
}
