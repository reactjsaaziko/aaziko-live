'use client';
import { API, getJSON, postJSON, loadingHTML, sourceTag } from './_api.js';
import { runDemoTour } from './_demotour.js';
// Live box mirrors the admin "Product Analytics" module: trade numbers (export value, importing
// markets, per-country import value & growth) are pulled live from the trademap API; the advisory
// text (modifications / certifications / FTA) stays curated and is also the offline fallback.
export function init() {

  /* HS codes + country names the trademap API expects (admin module uses the same). */
  var HS_MAP = { ceramic: '690721', textile: '520819', engineering: '870829', leather: '420212', spice: '090421' };
  var COUNTRY_NAME = { uae: 'United Arab Emirates', uk: 'United Kingdom', us: 'United States', au: 'Australia', ar: 'Argentina' };

  /* Curated advisory profiles — used for modifications/certs/FTA and as full offline fallback. */
  var PROFILES = {
    'ceramic|uae': {
      demand: '$3.8 Bn',
      growth: '+8.4%',
      cities: ['Dubai', 'Abu Dhabi', 'Sharjah'],
      price: '$4.20 – $6.80 / sqm',
      indianShare: '14%',
      cert: ['IRAM 1500', 'ISO 13006', 'Halal packaging'],
      modifications: [
        'Switch to 600×600 mm size — 78% of UAE demand',
        'Glazed finish over matte — UAE preference factor 2.4×',
        'Shrink-wrapped on pallets, 60 sqm each — local handling standard',
        'Arabic-language labels for retail-channel buyers'
      ],
      margin: '24–32%',
      competitors: ['Spain', 'Italy', 'China'],
      fta: 'India–UAE CEPA (preferential 0% duty up to quota)'
    },
    'ceramic|uk': {
      demand: '$1.6 Bn', growth: '+3.1%',
      cities: ['London', 'Manchester', 'Birmingham'],
      price: '$6.80 – $11.20 / sqm',
      indianShare: '6%',
      cert: ['UKCA mark', 'ISO 13006', 'CE-equivalent'],
      modifications: [
        '300×600 mm rectified edge — UK retail preference',
        'Matte-finish trending up 18% YoY',
        'PEFC-certified packaging from FY26 onward',
        'Per-tile QR for buyer-side digital catalogue'
      ],
      margin: '28–36%',
      competitors: ['Spain', 'Italy', 'Turkey'],
      fta: 'India–UK CETA (preferential 0% from FY25)'
    },
    'ceramic|us': {
      demand: '$5.4 Bn', growth: '+5.6%',
      cities: ['Los Angeles', 'Houston', 'New York', 'Miami'],
      price: '$5.40 – $9.80 / sqm',
      indianShare: '9%',
      cert: ['ANSI A137.1', 'LEED v4 contribution', 'TCNA'],
      modifications: [
        '12"×24" or 24"×24" (imperial sizes only)',
        'Slip-resistance R10 minimum, certified',
        'Recycled content ≥20% for LEED-eligible projects',
        'Anti-dumping duty review — confirm before pricing'
      ],
      margin: '18–26%',
      competitors: ['Mexico', 'Italy', 'Spain'],
      fta: 'No FTA — standard MFN rates apply'
    },
    'ceramic|au': {
      demand: '$0.9 Bn', growth: '+6.2%',
      cities: ['Sydney', 'Melbourne', 'Brisbane'],
      price: '$5.20 – $8.40 / sqm',
      indianShare: '11%',
      cert: ['AS 4459', 'GreenStar-rated packaging', 'ISO 13006'],
      modifications: [
        '450×450 mm or 600×600 mm dominate',
        'Slip-rated tile for outdoor use — R11 / P4',
        'Bushfire-zone compliance (AS 3959) for outer regions',
        'Wood-look porcelain trending — niche but growing'
      ],
      margin: '26–34%',
      competitors: ['Italy', 'Spain', 'China'],
      fta: 'India–Australia ECTA (preferential 0%)'
    },
    'ceramic|ar': {
      demand: '$0.42 Bn', growth: '+2.8%',
      cities: ['Buenos Aires', 'Córdoba', 'Rosario'],
      price: '$3.80 – $6.20 / sqm',
      indianShare: '4%',
      cert: ['IRAM 12586', 'ISO 13006'],
      modifications: [
        '450×450 mm and 600×600 mm — local preference',
        'Spanish-language labels and instructions',
        'Lighter colours dominant (60%+) — heat reflection',
        'Local importer mark-ups 30–45% — negotiate floor price'
      ],
      margin: '20–28%',
      competitors: ['Brazil', 'Spain', 'China'],
      fta: 'India–MERCOSUR PTA (preferential on select HS lines)'
    },

    'textile|uae': {
      demand: '$2.1 Bn', growth: '+5.4%',
      cities: ['Dubai', 'Sharjah'],
      price: '$0.80 – $4.20 / m',
      indianShare: '32%',
      cert: ['GOTS', 'OEKO-TEX', 'Halal-certified dyes for some lines'],
      modifications: [
        'Higher GSM (200+) for hospitality channel',
        'Pre-washed and pre-shrunk',
        'Bulk-pack 100m rolls preferred over piece-cut',
        'Bilingual care labels (Arabic + English)'
      ],
      margin: '22–30%',
      competitors: ['China', 'Pakistan', 'Bangladesh'],
      fta: 'India–UAE CEPA (preferential)'
    },
    'textile|uk': {
      demand: '$1.8 Bn', growth: '+4.1%',
      cities: ['London', 'Leicester', 'Birmingham'],
      price: '$1.20 – $5.60 / m',
      indianShare: '18%',
      cert: ['GOTS', 'OEKO-TEX Standard 100', 'Fair Trade'],
      modifications: [
        'Organic-cotton lines growing 14% YoY',
        'Sustainable packaging mandate from FY26',
        'Modern slavery statement compliance documents',
        'Direct-to-retailer fulfilment increasingly demanded'
      ],
      margin: '24–34%',
      competitors: ['Bangladesh', 'China', 'Turkey'],
      fta: 'India–UK CETA'
    },
    'textile|us': {
      demand: '$4.6 Bn', growth: '+3.8%',
      cities: ['New York', 'Los Angeles', 'Atlanta'],
      price: '$1.40 – $6.20 / m',
      indianShare: '21%',
      cert: ['OEKO-TEX', 'WRAP', 'Berry Amendment for govt buyers'],
      modifications: [
        'CPSIA-compliant dyes (esp. children\'s lines)',
        'Pre-shrunk, pre-washed: standard',
        'Carton-pack quantities, not piece counts',
        '180+ thread-count for premium positioning'
      ],
      margin: '20–28%',
      competitors: ['China', 'Vietnam', 'Bangladesh'],
      fta: 'No FTA — MFN applies'
    },
    'textile|au': {
      demand: '$0.7 Bn', growth: '+5.0%',
      cities: ['Sydney', 'Melbourne'],
      price: '$1.60 – $6.80 / m',
      indianShare: '15%',
      cert: ['OEKO-TEX', 'GOTS', 'Australian Made tag rights'],
      modifications: [
        'Heavier weights for southern winter',
        'Pre-shrunk; UV-stable dyes',
        'English/metric measurements only',
        'Direct-import retailer relationships preferred'
      ],
      margin: '26–32%',
      competitors: ['China', 'Bangladesh'],
      fta: 'India–Australia ECTA'
    },
    'textile|ar': {
      demand: '$0.3 Bn', growth: '+1.8%',
      cities: ['Buenos Aires'],
      price: '$1.00 – $3.80 / m',
      indianShare: '8%',
      cert: ['IRAM', 'OEKO-TEX (rising adoption)'],
      modifications: [
        'Heavier-weight cotton (220+ GSM) for winter market',
        'Spanish-language labels',
        'Roll-pack (100m) standard for importers',
        'Import-license documentation pre-arranged'
      ],
      margin: '18–26%',
      competitors: ['Brazil', 'China'],
      fta: 'India–MERCOSUR PTA (limited textile coverage)'
    },

    'engineering|uae': {
      demand: '$1.2 Bn', growth: '+9.2%',
      cities: ['Jebel Ali', 'Sharjah', 'Dubai'],
      price: 'Component-specific',
      indianShare: '12%',
      cert: ['ISO 9001', 'IATF 16949 (auto)', 'GCC standardisation'],
      modifications: [
        'Metric-system spec sheets (mandatory)',
        'Arabic + English packaging',
        '24-month warranty standard',
        'Dubai South free-zone delivery preferred'
      ],
      margin: '22–32%',
      competitors: ['China', 'Turkey', 'Germany'],
      fta: 'India–UAE CEPA'
    },
    'engineering|uk': {
      demand: '$1.9 Bn', growth: '+4.4%',
      cities: ['Birmingham', 'Coventry', 'Manchester'],
      price: 'Component-specific',
      indianShare: '6%',
      cert: ['BS EN ISO', 'CE-marking transition / UKCA', 'IATF 16949'],
      modifications: [
        'UKCA-mark from FY25 (mandatory)',
        'REACH-compliant materials',
        'Imperial measurement for legacy automotive lines',
        'PPAP Level 3 documentation expected'
      ],
      margin: '26–34%',
      competitors: ['Germany', 'China', 'Czech Republic'],
      fta: 'India–UK CETA'
    },
    'engineering|us': {
      demand: '$5.8 Bn', growth: '+3.6%',
      cities: ['Detroit', 'Houston', 'Chicago'],
      price: 'Component-specific',
      indianShare: '8%',
      cert: ['SAE / ASTM', 'IATF 16949', 'AS9100 for aerospace'],
      modifications: [
        'Imperial-system spec sheets (mandatory)',
        'PPAP Level 3 / 4 for Tier-1 OEMs',
        'NIST cybersecurity compliance for connected parts',
        'Buy American Act exemption documentation'
      ],
      margin: '22–30%',
      competitors: ['China', 'Mexico', 'Germany'],
      fta: 'No FTA — GSP withdrawn 2019'
    },
    'engineering|au': {
      demand: '$0.6 Bn', growth: '+6.4%',
      cities: ['Melbourne', 'Sydney', 'Perth'],
      price: 'Component-specific',
      indianShare: '10%',
      cert: ['AS/NZS', 'IATF 16949', 'mining-safety where applicable'],
      modifications: [
        'Mining-grade durability for WA market',
        'Metric system + RHS standards',
        'Heavier-duty packaging for outback delivery',
        'Spare-parts availability commitment (5 years)'
      ],
      margin: '28–36%',
      competitors: ['China', 'Japan', 'Germany'],
      fta: 'India–Australia ECTA'
    },
    'engineering|ar': {
      demand: '$0.42 Bn', growth: '+4.2%',
      cities: ['Buenos Aires', 'Córdoba (auto hub)', 'Rosario'],
      price: 'Component-specific',
      indianShare: '5%',
      cert: ['IRAM', 'IATF 16949', 'Argentine homologation (auto)'],
      modifications: [
        'Spanish-language docs + spec sheets',
        'Local importer registration required',
        'Argentine auto cluster (Córdoba) for OEM tier-1 supply',
        'Currency risk hedging — peso volatility'
      ],
      margin: '24–32%',
      competitors: ['Brazil', 'China', 'Germany'],
      fta: 'India–MERCOSUR PTA (selected lines)'
    },

    'leather|uae': {
      demand: '$0.45 Bn', growth: '+7.1%',
      cities: ['Dubai'],
      price: '$8 – $48 / pc',
      indianShare: '14%',
      cert: ['LWG-certified tanning', 'Halal-compliant processing'],
      modifications: [
        'Premium full-grain leather positioning',
        'Brand co-creation opportunities high',
        'Gift-pack presentation preferred for retail',
        'Customs duty: 5% standard'
      ],
      margin: '34–48%',
      competitors: ['Italy', 'Turkey', 'Pakistan'],
      fta: 'India–UAE CEPA'
    },
    'leather|uk': {
      demand: '$0.9 Bn', growth: '+3.4%',
      cities: ['London', 'Manchester'],
      price: '$12 – $80 / pc',
      indianShare: '11%',
      cert: ['LWG Gold/Silver', 'REACH-compliant', 'animal welfare audits'],
      modifications: [
        'LWG Gold tanning — premium UK positioning',
        'Sustainable-leather narrative critical',
        'Direct-to-retailer fulfilment growing 22% YoY',
        'Modern Slavery Act compliance'
      ],
      margin: '36–46%',
      competitors: ['Italy', 'Turkey'],
      fta: 'India–UK CETA'
    },
    'leather|us': {
      demand: '$2.1 Bn', growth: '+4.8%',
      cities: ['New York', 'Los Angeles', 'Chicago'],
      price: '$14 – $98 / pc',
      indianShare: '9%',
      cert: ['LWG', 'CPSIA (esp. for children\'s lines)'],
      modifications: [
        'US sizing (imperial)',
        'CITES documentation for exotic leathers',
        'Country of Origin label compliance',
        'Direct-to-Amazon-FBA capable suppliers preferred'
      ],
      margin: '32–44%',
      competitors: ['Italy', 'China', 'Mexico'],
      fta: 'No FTA — GSP withdrawn'
    },
    'leather|au': {
      demand: '$0.18 Bn', growth: '+4.2%',
      cities: ['Sydney', 'Melbourne'],
      price: '$16 – $84 / pc',
      indianShare: '13%',
      cert: ['LWG', 'biosecurity import permits'],
      modifications: [
        'Strict biosecurity: hides need quarantine clearance',
        'Heavier-grain leather preferred for outdoor use',
        'Brand-licensed lines preferred over generic',
        'Hides from FMD-free zones only'
      ],
      margin: '34–44%',
      competitors: ['Italy', 'New Zealand', 'China'],
      fta: 'India–Australia ECTA'
    },
    'leather|ar': {
      demand: '$0.08 Bn', growth: '+2.4%',
      cities: ['Buenos Aires'],
      price: '$10 – $42 / pc',
      indianShare: '6%',
      cert: ['IRAM', 'LWG (rising adoption)'],
      modifications: [
        'Argentina has its own strong leather industry — niche premium positioning',
        'Spanish-language labels',
        'Import license + sanitary inspection',
        'Argentine peso volatility — quote in USD'
      ],
      margin: '28–38%',
      competitors: ['Brazil', 'Italy', 'Local'],
      fta: 'India–MERCOSUR PTA (selected lines)'
    },

    'spice|uae': {
      demand: '$0.62 Bn', growth: '+6.8%',
      cities: ['Dubai', 'Sharjah'],
      price: '$2.20 – $5.40 / kg',
      indianShare: '46%',
      cert: ['ESMA', 'Halal certification (mandatory)', 'FDA-equivalent'],
      modifications: [
        'Halal certification mandatory — non-negotiable',
        'Retail packaging in 250g / 500g pouches',
        'Arabic + English bilingual labels',
        'Dubai re-export hub: position for South America/Africa onward flows'
      ],
      margin: '20–32%',
      competitors: ['Iran', 'Sri Lanka', 'Ethiopia'],
      fta: 'India–UAE CEPA'
    },
    'spice|uk': {
      demand: '$0.4 Bn', growth: '+3.2%',
      cities: ['London', 'Leicester', 'Birmingham'],
      price: '$3.40 – $7.80 / kg',
      indianShare: '38%',
      cert: ['BRC AA grade', 'Soil Association organic', 'pesticide MRL'],
      modifications: [
        'Strict pesticide MRL compliance (EU standard pre-2025)',
        'Steam-sterilised spices required for retail',
        'Organic-certified lines growing 18% YoY',
        'Single-origin storytelling preferred for premium retail'
      ],
      margin: '22–34%',
      competitors: ['Sri Lanka', 'Vietnam', 'Indonesia'],
      fta: 'India–UK CETA'
    },
    'spice|us': {
      demand: '$1.4 Bn', growth: '+4.6%',
      cities: ['New Jersey', 'California', 'Texas'],
      price: '$2.80 – $6.40 / kg',
      indianShare: '24%',
      cert: ['FDA registration', 'FSMA HARPC', 'USDA Organic'],
      modifications: [
        'Steam-sterilised — FDA expectation',
        'Imperial units; ounce / pound packaging',
        'Allergen statements; FSVP supplier verification',
        'Foreign Supplier Verification Program compliance'
      ],
      margin: '20–30%',
      competitors: ['Vietnam', 'Indonesia', 'Madagascar'],
      fta: 'No FTA'
    },
    'spice|au': {
      demand: '$0.18 Bn', growth: '+5.6%',
      cities: ['Sydney', 'Melbourne'],
      price: '$3.60 – $8.20 / kg',
      indianShare: '32%',
      cert: ['FSANZ', 'irradiation permits', 'biosecurity'],
      modifications: [
        'Australian biosecurity — irradiation often mandatory',
        'Country-of-origin labels required',
        'Allergen disclosure on label',
        'Volume retailers prefer 1kg+ catering packs'
      ],
      margin: '26–34%',
      competitors: ['Sri Lanka', 'Indonesia'],
      fta: 'India–Australia ECTA'
    },
    'spice|ar': {
      demand: '$0.06 Bn', growth: '+2.2%',
      cities: ['Buenos Aires'],
      price: '$2.40 – $4.80 / kg',
      indianShare: '14%',
      cert: ['SENASA', 'IRAM'],
      modifications: [
        'SENASA sanitary import certification',
        'Spanish-language labels',
        'Bulk-pack preferred (catering channel)',
        'Currency risk — quote and invoice in USD'
      ],
      margin: '18–26%',
      competitors: ['Brazil', 'Local production'],
      fta: 'India–MERCOSUR PTA (selected)'
    }
  };

  /* Country-NEUTRAL advisory per product — used for any destination that isn't one
     of the 5 curated countries (uae/uk/us/au/ar), so a market like Thailand never
     shows another country's modifications/certs/margin/competitors. The FTA line is
     resolved separately, per selected country, from FTA_MAP below. */
  var GENERIC = {
    ceramic: {
      modifications: [
        'Offer both 600×600 mm and 300×600 mm sizes — the two formats most retail channels stock',
        'Lead with glazed porcelain; keep a matte and a rectified-edge option per shade for project buyers',
        'Shrink-wrapped on standardised pallets (~60 sqm) with corner protection for safe long-haul handling',
        'Print per-batch shade and calibre on every carton so buyers can blend lots without mismatch'
      ],
      cert: ['ISO 13006', 'ISO 10545 (test methods)', 'CE marking'],
      margin: '22–32%',
      competitors: ['Spain', 'Italy', 'China']
    },
    textile: {
      modifications: [
        'Supply pre-washed, pre-shrunk fabric with documented shrinkage and colour-fastness results',
        'Offer a higher-GSM (200+) line for hospitality and a lighter weight for apparel buyers',
        'Roll-pack in 100 m bolts as standard, with piece-cut available only on request',
        'Attach bilingual care labels and a full fibre-composition declaration on every roll'
      ],
      cert: ['OEKO-TEX Standard 100', 'GOTS', 'ISO 9001'],
      margin: '22–30%',
      competitors: ['China', 'Bangladesh', 'Turkey']
    },
    engineering: {
      modifications: [
        'Issue metric-system spec sheets with full material and tolerance data per part',
        'Provide PPAP-level documentation and material test certificates for OEM tier supply',
        'Commit to a minimum 24-month warranty and a 5-year spare-parts availability guarantee',
        'Heavier-duty, moisture-resistant export packaging with per-carton part-number labelling'
      ],
      cert: ['ISO 9001', 'IATF 16949', 'ISO 14001'],
      margin: '22–32%',
      competitors: ['China', 'Germany', 'Turkey']
    },
    leather: {
      modifications: [
        'Position full-grain leather lines with documented LWG-traceable tanning',
        'Carry sanitary / origin documentation so hides clear customs and biosecurity checks smoothly',
        'Offer brand co-creation and private-label options alongside the generic catalogue',
        'Retail-ready gift-box presentation with consistent sizing across the range'
      ],
      cert: ['LWG-certified tanning', 'REACH compliance', 'ISO 9001'],
      margin: '32–46%',
      competitors: ['Italy', 'China', 'Turkey']
    },
    spice: {
      modifications: [
        'Supply steam-sterilised spices with batch-level microbiological and pesticide-MRL test reports',
        'Offer retail pouches (250 g / 500 g) and 1 kg+ catering packs from the same line',
        'Multilingual labels with allergen statements, lot code and best-before date on every pack',
        'Provide single-origin traceability documents to support premium retail positioning'
      ],
      cert: ['ISO 22000 / FSSC 22000', 'HACCP', 'Organic (where applicable)'],
      margin: '20–32%',
      competitors: ['Vietnam', 'Indonesia', 'Sri Lanka']
    }
  };

  /* India's preferential-trade-agreement status by destination (every dropdown
     market). Drives the per-country "FTA / PREFERENTIAL ACCESS" line so a selected
     market shows its OWN agreement, never UAE's. Representative for the demo. */
  var FTA_MAP = {
    'Argentina': 'India–MERCOSUR PTA (limited preferential margins, not duty-free)',
    'Australia': 'India–Australia ECTA (preferential, most lines to 0%)',
    'Austria': 'No bilateral India FTA (EU member; no India–EU FTA in force)',
    'Bahrain': 'No India FTA in force (India–GCC FTA still under negotiation)',
    'Bangladesh': 'SAFTA (South Asian Free Trade Area)',
    'Belgium': 'No bilateral India FTA (EU member; no India–EU FTA in force)',
    'Brazil': 'India–MERCOSUR PTA (limited preferential margins, not duty-free)',
    'Canada': 'No India FTA in force (India–Canada EPA/CEPA talks paused)',
    'Chile': 'India–Chile PTA (limited preferential margins, not duty-free)',
    'China': 'APTA (Asia-Pacific Trade Agreement — limited tariff concessions only)',
    'Colombia': 'No India FTA (only a bilateral investment/PTA exploratory stage)',
    'Czech Republic': 'No bilateral India FTA (EU member; no India–EU FTA in force)',
    'Denmark': 'No bilateral India FTA (EU member; no India–EU FTA in force)',
    'Egypt': 'No India FTA in force (standard MFN duty applies)',
    'Ethiopia': 'No India FTA (standard MFN duty applies)',
    'Finland': 'No bilateral India FTA (EU member; no India–EU FTA in force)',
    'France': 'No bilateral India FTA (EU member; no India–EU FTA in force)',
    'Germany': 'No bilateral India FTA (EU member; no India–EU FTA in force)',
    'Ghana': 'No India FTA (standard MFN duty applies)',
    'Greece': 'No bilateral India FTA (EU member; no India–EU FTA in force)',
    'Hong Kong': 'No India FTA (standard MFN duty applies; Hong Kong is largely a free port)',
    'Hungary': 'No bilateral India FTA (EU member; no India–EU FTA in force)',
    'Indonesia': 'ASEAN–India FTA (AIFTA)',
    'Iran': 'No India FTA (standard MFN duty applies)',
    'Iraq': 'No India FTA (standard MFN duty applies)',
    'Ireland': 'No bilateral India FTA (EU member; no India–EU FTA in force)',
    'Israel': 'No India FTA in force (India–Israel FTA still under negotiation)',
    'Italy': 'No bilateral India FTA (EU member; no India–EU FTA in force)',
    'Japan': 'India–Japan CEPA (preferential, most lines to 0%)',
    'Jordan': 'No India FTA (standard MFN duty applies)',
    'Kenya': 'No India FTA (standard MFN duty applies)',
    'Kuwait': 'No India FTA in force (India–GCC FTA still under negotiation)',
    'Malaysia': 'ASEAN–India FTA (AIFTA) + India–Malaysia CECA',
    'Mexico': 'No India FTA (standard MFN duty applies)',
    'Morocco': 'No India FTA (standard MFN duty applies)',
    'Nepal': 'SAFTA + India–Nepal Treaty of Trade (largely duty-free)',
    'Netherlands': 'No bilateral India FTA (EU member; no India–EU FTA in force)',
    'New Zealand': 'No India FTA in force (India–New Zealand FTA under negotiation)',
    'Nigeria': 'No India FTA (standard MFN duty applies)',
    'Norway': 'India–EFTA TEPA (signed 2024; preferential on most lines as it enters into force)',
    'Oman': 'No India FTA in force (India–Oman CEPA concluded but not yet in force; GCC FTA pending)',
    'Pakistan': 'SAFTA (concessions effectively suspended; MWN status withdrawn)',
    'Peru': 'No India FTA in force (India–Peru trade agreement still under negotiation)',
    'Philippines': 'ASEAN–India FTA (AIFTA)',
    'Poland': 'No bilateral India FTA (EU member; no India–EU FTA in force)',
    'Portugal': 'No bilateral India FTA (EU member; no India–EU FTA in force)',
    'Qatar': 'No India FTA in force (India–GCC FTA still under negotiation)',
    'Romania': 'No bilateral India FTA (EU member; no India–EU FTA in force)',
    'Russia': 'No India FTA in force (India–EAEU FTA still under negotiation)',
    'Saudi Arabia': 'No India FTA in force (India–GCC FTA still under negotiation)',
    'Singapore': 'India–Singapore CECA + ASEAN–India FTA (AIFTA)',
    'South Africa': 'No India FTA in force (India–SACU PTA still under negotiation)',
    'South Korea': 'India–Korea CEPA',
    'Spain': 'No bilateral India FTA (EU member; no India–EU FTA in force)',
    'Sri Lanka': 'India–Sri Lanka FTA (ISFTA)',
    'Sweden': 'No bilateral India FTA (EU member; no India–EU FTA in force)',
    'Switzerland': 'India–EFTA TEPA (signed 2024; preferential on most lines as it enters into force)',
    'Tanzania': 'No India FTA (standard MFN duty applies)',
    'Thailand': 'ASEAN–India FTA (AIFTA) + India–Thailand Early Harvest Scheme',
    'Turkey': 'No India FTA (standard MFN duty applies)',
    'Uganda': 'No India FTA (standard MFN duty applies)',
    'Ukraine': 'No India FTA (standard MFN duty applies)',
    'United Arab Emirates': 'India–UAE CEPA (preferential 0% on most lines)',
    'United Kingdom': 'India–UK CETA (signed 2025; preferential on most lines as it enters into force)',
    'United States': 'No India FTA (standard MFN duty applies)',
    'Vietnam': 'ASEAN–India FTA (AIFTA)',
    'Yemen': 'No India FTA (standard MFN duty applies)'
  };
  var DEFAULT_FTA = 'No preferential FTA — standard MFN duty applies';
  function ftaFor(country) { return (country && FTA_MAP[country]) || DEFAULT_FTA; }

  // ===== Admin "Product Analytics" module — faithful glass UI + autocomplete inputs =====
  var prod = document.getElementById('pa-product');
  var ctry = document.getElementById('pa-country');
  var out = document.getElementById('pa-output');
  var btn = document.getElementById('pa-go');
  var suggestBox = document.getElementById('pa-suggest');

  // Curated catalog: powers reliable autocomplete + resolves HS → advisory product key.
  var CATALOG = [
    { label: 'Ceramic tiles & paving (HS 690721)', hs: '690721', key: 'ceramic' },
    { label: 'Cotton woven fabric (HS 520819)', hs: '520819', key: 'textile' },
    { label: 'Auto components / parts (HS 870829)', hs: '870829', key: 'engineering' },
    { label: 'Leather trunks, bags & cases (HS 420212)', hs: '420212', key: 'leather' },
    { label: 'Spices — capsicum / chilli (HS 090421)', hs: '090421', key: 'spice' },
    { label: 'Pepper, dried (HS 090411)', hs: '090411', key: 'spice' },
    { label: 'Leather apparel (HS 420310)', hs: '420310', key: 'leather' },
    { label: 'Auto body parts & accessories (HS 870899)', hs: '870899', key: 'engineering' },
    { label: 'Brass / copper articles (HS 741999)', hs: '741999', key: 'engineering' },
    { label: 'Basmati rice (HS 100630)', hs: '100630', key: 'spice' }
  ];
  var COUNTRY_KEY = { 'united arab emirates': 'uae', 'uae': 'uae', 'united kingdom': 'uk', 'uk': 'uk', 'united states': 'us', 'usa': 'us', 'us': 'us', 'australia': 'au', 'germany': 'de', 'argentina': 'ar' };
  var FLAGS = { 'United States': '🇺🇸', 'United Arab Emirates': '🇦🇪', 'United Kingdom': '🇬🇧', 'Germany': '🇩🇪', 'Australia': '🇦🇺', 'Argentina': '🇦🇷', 'Saudi Arabia': '🇸🇦', 'China': '🇨🇳', 'Japan': '🇯🇵', 'Singapore': '🇸🇬', 'Netherlands': '🇳🇱', 'France': '🇫🇷', 'Italy': '🇮🇹', 'Spain': '🇪🇸', 'Canada': '🇨🇦', 'Brazil': '🇧🇷', 'South Africa': '🇿🇦', 'Vietnam': '🇻🇳', 'Bangladesh': '🇧🇩', 'Thailand': '🇹🇭', 'Russia': '🇷🇺', 'Russian Federation': '🇷🇺', 'Turkey': '🇹🇷', 'Philippines': '🇵🇭', 'Israel': '🇮🇱', 'Poland': '🇵🇱', 'Pakistan': '🇵🇰', 'Indonesia': '🇮🇩', 'Malaysia': '🇲🇾', 'Sri Lanka': '🇱🇰', 'Nigeria': '🇳🇬', 'Egypt': '🇪🇬' };
  var flagFor = function (c) { return FLAGS[c] || '🌐'; };

  // Full destination-market list — the dropdown shows every market by default (no typing needed).
  var COUNTRIES = [
    { n: 'Argentina', f: '🇦🇷' }, { n: 'Australia', f: '🇦🇺' }, { n: 'Austria', f: '🇦🇹' }, { n: 'Bahrain', f: '🇧🇭' },
    { n: 'Bangladesh', f: '🇧🇩' }, { n: 'Belgium', f: '🇧🇪' }, { n: 'Brazil', f: '🇧🇷' }, { n: 'Canada', f: '🇨🇦' },
    { n: 'Chile', f: '🇨🇱' }, { n: 'China', f: '🇨🇳' }, { n: 'Colombia', f: '🇨🇴' }, { n: 'Czech Republic', f: '🇨🇿' },
    { n: 'Denmark', f: '🇩🇰' }, { n: 'Egypt', f: '🇪🇬' }, { n: 'Ethiopia', f: '🇪🇹' }, { n: 'Finland', f: '🇫🇮' },
    { n: 'France', f: '🇫🇷' }, { n: 'Germany', f: '🇩🇪' }, { n: 'Ghana', f: '🇬🇭' }, { n: 'Greece', f: '🇬🇷' },
    { n: 'Hong Kong', f: '🇭🇰' }, { n: 'Hungary', f: '🇭🇺' }, { n: 'Indonesia', f: '🇮🇩' }, { n: 'Iran', f: '🇮🇷' },
    { n: 'Iraq', f: '🇮🇶' }, { n: 'Ireland', f: '🇮🇪' }, { n: 'Israel', f: '🇮🇱' }, { n: 'Italy', f: '🇮🇹' },
    { n: 'Japan', f: '🇯🇵' }, { n: 'Jordan', f: '🇯🇴' }, { n: 'Kenya', f: '🇰🇪' }, { n: 'Kuwait', f: '🇰🇼' },
    { n: 'Malaysia', f: '🇲🇾' }, { n: 'Mexico', f: '🇲🇽' }, { n: 'Morocco', f: '🇲🇦' }, { n: 'Nepal', f: '🇳🇵' },
    { n: 'Netherlands', f: '🇳🇱' }, { n: 'New Zealand', f: '🇳🇿' }, { n: 'Nigeria', f: '🇳🇬' }, { n: 'Norway', f: '🇳🇴' },
    { n: 'Oman', f: '🇴🇲' }, { n: 'Pakistan', f: '🇵🇰' }, { n: 'Peru', f: '🇵🇪' }, { n: 'Philippines', f: '🇵🇭' },
    { n: 'Poland', f: '🇵🇱' }, { n: 'Portugal', f: '🇵🇹' }, { n: 'Qatar', f: '🇶🇦' }, { n: 'Romania', f: '🇷🇴' },
    { n: 'Russia', f: '🇷🇺' }, { n: 'Saudi Arabia', f: '🇸🇦' }, { n: 'Singapore', f: '🇸🇬' }, { n: 'South Africa', f: '🇿🇦' },
    { n: 'South Korea', f: '🇰🇷' }, { n: 'Spain', f: '🇪🇸' }, { n: 'Sri Lanka', f: '🇱🇰' }, { n: 'Sweden', f: '🇸🇪' },
    { n: 'Switzerland', f: '🇨🇭' }, { n: 'Tanzania', f: '🇹🇿' }, { n: 'Thailand', f: '🇹🇭' }, { n: 'Turkey', f: '🇹🇷' },
    { n: 'Uganda', f: '🇺🇬' }, { n: 'Ukraine', f: '🇺🇦' }, { n: 'United Arab Emirates', f: '🇦🇪' }, { n: 'United Kingdom', f: '🇬🇧' },
    { n: 'United States', f: '🇺🇸' }, { n: 'Vietnam', f: '🇻🇳' }, { n: 'Yemen', f: '🇾🇪' }
  ];
  // Build the dropdown with every market (UAE preselected) and keep flag lookups in sync.
  COUNTRIES.forEach(function (c) { if (!FLAGS[c.n]) FLAGS[c.n] = c.f; });
  if (ctry && ctry.tagName === 'SELECT') {
    ctry.innerHTML = '<option value="" selected>Select destination market…</option>' +
      COUNTRIES.map(function (c) {
        return '<option value="' + esc(c.n) + '">' + c.f + '  ' + esc(c.n) + '</option>';
      }).join('');
  }

  var resolvedHs = '';      // no product preselected — user must choose
  var renderSeq = 0;        // guards against a stale slow-call patching a newer report
  prod.value = '';          // HS-code / product field starts empty (placeholder only)
  ctry.value = '';          // destination market starts on the "Select…" placeholder

  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function fmtPct(v) { if (v === null || v === undefined || isNaN(v)) return '—'; return (v > 0 ? '+' : '') + Number(v).toFixed(1) + '%'; }
  function pctClass(v) { if (v === null || v === undefined || isNaN(v)) return ''; return v >= 0 ? 'aaz-green' : 'aaz-red'; }
  // Coerce a possibly-empty / non-numeric API value to a Number or null. Empty string,
  // 'N/A', undefined and NaN all become null so percent / price cells degrade to '—'
  // instead of rendering a bare '%' or '$' (the live india-share API can return tariffPct:'').
  function pctVal(v) { if (v === null || v === undefined || v === '' || isNaN(Number(v))) return null; return Number(v); }
  function pctStr(v) { var n = pctVal(v); return n === null ? '—' : n + '%'; }
  function numOrNull(v) { if (v === null || v === undefined || v === '' || isNaN(Number(v))) return null; return Number(v); }

  // ---------- Autocomplete ----------
  var debounceTimer = null;
  function curatedMatches(q) {
    q = q.toLowerCase();
    var digits = q.replace(/\D/g, '');
    // Match on the label text, OR on the HS code only when the query has digits.
    // Guard: hs.indexOf('') returns 0, so a digitless query like "pen" would
    // otherwise match the ENTIRE catalog and bury the real (live) results.
    return CATALOG.filter(function (c) {
      return c.label.toLowerCase().indexOf(q) >= 0 || (digits && c.hs.indexOf(digits) >= 0);
    });
  }
  async function liveMatches(q) {
    try {
      var resp = await getJSON(API.trademap + '/api/hscode/hscodes/autocomplete?q=' + encodeURIComponent(q) + '&limit=15', { timeout: 6000 });
      var data = (resp && resp.data) || [];
      // Show results exactly as the admin Product Analytics page does — the API
      // already sorts exact matches first, then 6-digit before 8/10-digit. Accept
      // any code of 6+ digits: many real matches (e.g. "pen") are 8-digit ITC-HS
      // codes, which the old "=== 6" filter dropped entirely.
      return data.map(function (d) {
        var hs = String(d.hsCode || d.hs_code || d.code || '').replace(/\D/g, '');
        return { hs: hs, label: d.description || d.productName || d.label || ('HS ' + hs) };
      }).filter(function (d) { return d.hs.length >= 6 && d.label; });
    } catch (e) { return []; }
  }
  function showSuggestions(items) {
    if (!items.length) { suggestBox.style.display = 'none'; return; }
    suggestBox.innerHTML = items.slice(0, 15).map(function (it) {
      return '<div class="aaz-suggest__item" data-hs="' + esc(it.hs) + '" data-label="' + esc(it.label) + '">' +
        '<span class="aaz-suggest__hs">HS ' + esc(it.hs) + '</span><span class="aaz-suggest__label">' + esc(it.label) + '</span></div>';
    }).join('');
    suggestBox.style.display = 'block';
    Array.prototype.forEach.call(suggestBox.querySelectorAll('.aaz-suggest__item'), function (el) {
      el.addEventListener('mousedown', function (e) {
        e.preventDefault();
        // Trade-data endpoints (total-values etc.) key on the 6-digit international
        // HS level, so truncate an 8/10-digit ITC-HS pick to its 6-digit prefix.
        resolvedHs = (el.getAttribute('data-hs') || '').replace(/\D/g, '').slice(0, 6);
        prod.value = el.getAttribute('data-label');
        suggestBox.style.display = 'none';
        render();
      });
    });
  }
  prod.addEventListener('input', function () {
    var q = prod.value.trim();
    if (q.length < 2) { suggestBox.style.display = 'none'; return; }
    var digits = q.replace(/\D/g, '');
    if (digits.length >= 6) resolvedHs = digits.slice(0, 6);
    var cur = curatedMatches(q);
    showSuggestions(cur);
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async function () {
      var live = await liveMatches(q);
      var seen = {}, merged = [];
      cur.concat(live).forEach(function (it) { if (!seen[it.hs]) { seen[it.hs] = 1; merged.push(it); } });
      if (merged.length) showSuggestions(merged);
    }, 450);
  });
  prod.addEventListener('blur', function () { setTimeout(function () { suggestBox.style.display = 'none'; }, 150); });

  function resolveHs() {
    var q = prod.value.trim();
    var digits = q.replace(/\D/g, '');
    if (digits.length >= 6) { resolvedHs = digits.slice(0, 6); return resolvedHs; }
    var m = CATALOG.filter(function (c) { return c.label.toLowerCase() === q.toLowerCase(); })[0] || curatedMatches(q)[0];
    if (m) resolvedHs = m.hs;
    return resolvedHs;
  }
  function productKeyForHs(hs) { var m = CATALOG.filter(function (c) { return c.hs === hs; })[0]; return m ? m.key : 'ceramic'; }

  // ---------- Render building blocks (admin glass UI) ----------
  function metric(label, value, sub, subClass) {
    return '<div><div class="aaz-label">' + label + '</div>' +
      '<div style="font-size:22px;font-weight:800;color:#0F172A;margin-top:3px;line-height:1.05;">' + value + '</div>' +
      '<div class="' + (subClass || '') + '" style="font-size:11px;color:#5B6B82;margin-top:3px;">' + sub + '</div></div>';
  }
  // Buyers count comes from the one slow endpoint — render a placeholder, patch it in by id when it lands.
  function buyersCell(id, v) {
    if (v === 'pending') return '<span id="' + id + '" style="opacity:0.5;animation:aazpulse 1.2s infinite;">…</span>';
    return '<span id="' + id + '">' + (v != null ? Number(v).toLocaleString('en-IN') : '—') + '</span>';
  }
  function statStrip(total, cards, buyersTotal, hs, productLabel) {
    var exportVal = (total && total.formattedExportValue) || '—';
    var importing = (cards && cards.countryCount) || (total && total.importingCountries) || '—';
    var year = (cards && cards.latestYear) || (total && total.selectedYear) || '';
    var div = '<div class="aaz-divider pa-statdiv" style="height:42px;"></div>';
    var html = '<div class="aaz-panel" style="text-align:center;margin-bottom:16px;">';
    html += '<div style="font-size:19px;font-weight:800;color:#0F172A;">Market Analysis: ' + esc(productLabel) + '</div>';
    html += '<div style="font-size:12px;color:#5B6B82;margin:2px 0 16px;">Global Trade Intelligence Report · HS ' + esc(hs) + '</div>';
    html += '<div style="display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:20px;">';
    html += '<div><div class="aaz-statval">' + esc(exportVal) + '</div><div style="font-size:12px;color:#5B6B82;margin-top:6px;">Total Export Value</div></div>' + div;
    html += '<div><div class="aaz-statval">' + esc(String(importing)) + '</div><div style="font-size:12px;color:#5B6B82;margin-top:6px;">Importing Countries</div></div>' + div;
    html += '<div><div class="aaz-statval">' + buyersCell('pa-mb', buyersTotal) + '</div><div style="font-size:12px;color:#5B6B82;margin-top:6px;">Matched Buyers</div></div>' + div;
    html += '<span class="aaz-pill"><span class="aaz-blue">📊</span> Export year <strong style="color:#0F172A;">' + esc(String(year)) + '</strong></span>';
    html += '</div></div>';
    return html;
  }
  function profilePanel(sel, share, buyersTotal, country, cards) {
    var selUnit = sel ? numOrNull(sel.perUnitPriceUsd) : null;
    var shareUnit = (share && share.found) ? numOrNull(share.unitValueUsd) : null;
    var unitPrice = selUnit !== null ? ('$' + selUnit + (sel.unit ? ' /' + sel.unit : ''))
      : shareUnit !== null ? ('$' + shareUnit + (share.quantityUnit ? ' /' + share.quantityUnit : '')) : '—';
    var winYrs = cards && cards.windowYears ? cards.windowYears.length : 4;
    var html = '<div class="aaz-panel" style="margin-bottom:16px;">';
    html += '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:16px;">';
    html += '<div style="display:flex;align-items:center;gap:12px;"><span style="font-size:30px;">' + flagFor(country) + '</span>' +
      '<div><div class="aaz-label aaz-blue">MARKET PROFILE</div><div style="font-size:17px;font-weight:700;color:#0F172A;">' + esc(country) + '</div></div></div>';
    html += '<span class="aaz-pill aaz-pill--live"><span class="aaz-dot"></span>Live data</span></div>';
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%, 120px),1fr));gap:16px;">';
    html += metric('MARKET SIZE', sel ? (sel.annualImportValueFormatted || '—') : '—', 'Annual imports from India');
    html += metric('UNIT PRICE', unitPrice, 'Avg unit price, Indian exporters');
    var growN = sel ? pctVal(sel.growthPctLatest) : null;
    var totGrowN = sel ? pctVal(sel.totalGrowthPct) : null;
    html += metric('GROWTH', growN === null ? '—' : fmtPct(growN) + ' YoY',
      totGrowN === null ? '—' : fmtPct(totGrowN) + ' over ' + winYrs + ' yrs', pctClass(growN));
    html += metric("INDIA'S SHARE", (share && share.found) ? pctStr(share.indiaSharePct) : '—', 'Share in India\'s exports');
    var dutyN = (share && share.found) ? pctVal(share.tariffPct) : null;
    html += metric('DUTY FOR INDIA',
      dutyN === null ? '—' : dutyN + '%',
      dutyN === 0 ? 'Duty-free for India' : (dutyN === null ? 'Tariff data unavailable' : 'Tariff faced by India'),
      dutyN === 0 ? 'aaz-green' : '');
    html += metric('BUYERS READY', buyersCell('pa-br', buyersTotal), 'Verified importers');
    html += '</div></div>';
    return html;
  }
  // "Where do you want to win?" — Big Market / Big Margin / Emerging tabs that
  // re-sort the SAME live market-cards data client-side (no refetch).
  function whereToWin(cards, selectedCountry) {
    if (!cards || !cards.length) return '';
    wtwCards = cards; wtwSel = selectedCountry || '';
    var html = '<div class="aaz-panel" style="margin-bottom:16px;">';
    html += '<div style="text-align:center;margin-bottom:4px;"><span class="aaz-label aaz-blue" style="letter-spacing:0.2em;">MARKET INTELLIGENCE</span></div>';
    html += '<div style="text-align:center;font-size:17px;font-weight:800;color:#0F172A;margin-bottom:4px;">Where do you want to win?</div>';
    html += '<div style="text-align:center;font-size:12px;color:#5B6B82;margin:0 auto 14px;max-width:520px;">Three strategies — pick by your capacity and how fast you need results.</div>';
    html += '<div style="display:flex;justify-content:center;margin-bottom:16px;"><div style="display:inline-flex;flex-wrap:wrap;justify-content:center;max-width:100%;gap:4px;background:rgba(30,91,71,0.06);border-radius:999px;padding:4px;">';
    [['big-market', '🌐 Big Market'], ['big-margin', '🏅 Big Margin'], ['emerging', '🚀 Emerging']].forEach(function (t) {
      var on = wtwTab === t[0];
      html += '<button type="button" data-wtw-tab="' + t[0] + '" style="border:none;cursor:pointer;border-radius:999px;padding:7px 16px;font-size:13px;font-weight:700;' + (on ? 'background:linear-gradient(135deg,#1E5B47,#5A8A6E);color:#fff;' : 'background:transparent;color:#5B6B82;') + '">' + t[1] + '</button>';
    });
    html += '</div></div>';
    html += '<div id="pa-wtw-body">' + wtwBodyHTML() + '</div>';
    html += '</div>';
    return html;
  }
  // "Your Action Playbook · {country}" — built entirely from the synchronous,
  // country-aware curated/generic `advisory` (never the slow AI endpoint).
  function playbookPanel(p, country, share) {
    // No static/derived Need/Want — start in a loading state; renderRecommendations
    // fills pbSteps + recData from the real /api/recommendations/product endpoint (same as admin).
    pbSteps = { need: [], want: [] }; recData = null; recLoading = true; recCountry = country || '';
    compList = null; compLoading = true;                  // competing origins fetched by renderCompetitors
    // FTA card reads India's live applied tariff to this destination (from india-share).
    pbTariff = (share && share.found && share.tariffPct !== '' && share.tariffPct != null) ? share.tariffPct : null;
    var html = '<div class="aaz-panel" style="margin-bottom:16px;">';
    html += '<div style="text-align:center;margin-bottom:4px;"><span class="aaz-label aaz-blue" style="letter-spacing:0.2em;">YOUR ACTION PLAYBOOK' + (country ? ' · ' + esc(country) : '') + '</span></div>';
    html += '<div style="text-align:center;font-size:17px;font-weight:800;color:#0F172A;margin-bottom:4px;">Things to do, in order, to get your first ' + (country ? esc(country) + ' ' : '') + 'order</div>';
    html += '<div style="text-align:center;font-size:12px;color:#5B6B82;margin:0 auto 16px;max-width:560px;">Each step is what you — the manufacturer — complete. Aaziko handles export documents, logistics, payment escrow &amp; inspection in parallel.</div>';
    // Product modifications card with Need / Want toggle + priority table
    html += '<div class="aaz-card" style="margin-bottom:12px;">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:6px;">';
    html += '<div style="font-size:13px;font-weight:700;color:#0F172A;">Product modifications &amp; compliance requirements</div>';
    html += '<div style="display:inline-flex;gap:4px;background:rgba(30,91,71,0.06);border-radius:999px;padding:3px;">';
    [['need', 'Need'], ['want', 'Want']].forEach(function (t) { var on = pbTab === t[0]; html += '<button type="button" data-pb-tab="' + t[0] + '" style="border:none;cursor:pointer;border-radius:999px;padding:5px 16px;font-size:12px;font-weight:700;' + (on ? 'background:linear-gradient(135deg,#1E5B47,#5A8A6E);color:#fff;' : 'background:transparent;color:#5B6B82;') + '">' + t[1] + '</button>'; });
    html += '</div></div>';
    html += '<div id="pa-pb-body">' + pbBodyHTML() + '</div>';
    html += '</div>';
    // Certifications / ROI / competitors + FTA — all real data, patched in async (never static).
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%, 160px),1fr));gap:12px;">';
    html += '<div class="aaz-card"><div class="aaz-label" style="margin-bottom:8px;">CERTIFICATIONS</div><div id="pa-pbcert">' + pbCertHTML() + '</div></div>';
    html += '<div class="aaz-card"><div class="aaz-label" style="margin-bottom:8px;">PROJECTED ROI</div><div id="pa-margin">' + marginHTML() + '</div></div>';
    html += '<div class="aaz-card"><div class="aaz-label" style="margin-bottom:8px;">TOP COMPETING ORIGINS</div><div id="pa-competitors">' + competitorsHTML() + '</div></div>';
    html += '</div>';
    html += '<div class="aaz-card" style="margin-top:12px;background:rgba(22,199,132,0.08);border-color:rgba(22,199,132,0.28);"><span class="aaz-label" style="color:#0f9d66;">FTA / PREFERENTIAL ACCESS</span><div id="pa-fta" style="font-size:13px;color:#0F172A;margin-top:4px;">' + ftaHTML() + '</div></div>';
    html += '</div>';
    return html;
  }
  function liveTag(isLive) {
    return '<div style="margin-top:6px;font-size:11px;color:' + (isLive ? '#16C784' : '#5B6B82') + ';display:flex;align-items:center;gap:6px;">' +
      (isLive ? '<span class="aaz-dot" style="width:8px;height:8px;border-radius:50%;background:#16C784;display:inline-block;"></span>Live data · pulled just now from the Aaziko platform' : 'Representative data — live feed momentarily unavailable.') + '</div>';
  }

  /* ============================================================================
     Admin-parity rich sections (emerald): Where-to-Win tabs · Action Playbook
     priority table · tabbed Compliance · Certifications detail · Market Analysis
     · CTA. AI-only fields are representative/curated (page already says so).
     ========================================================================== */
  var curPkey = 'ceramic';
  // Interactive UI state (closure-scoped so the delegated click handler re-renders
  // just the affected slot without refetching).
  var wtwCards = [], wtwSel = '', wtwTab = 'big-market';
  var pbSteps = { need: [], want: [] }, pbTab = 'need';
  // Shared state for the /api/recommendations/product fetch — drives BOTH the Need/Want
  // playbook table AND the Certifications detail panel (loader → real data, never static).
  var recData = null, recLoading = false, recCountry = '';
  // Top-competing-origins (top-suppliers endpoint) + India's live applied tariff (india-share) —
  // both real data, patched into the Action Playbook side cards / FTA card.
  var compList = null, compLoading = false, pbTariff = null;
  var cmpData = null, cmpCountry = '', cmpTab = 'production', cmpExpanded = {}, cmpBaselinePending = false;
  // MACMAP lane-split analysis — the SAME /api/hscode/analyze-macmap-regulatory the
  // admin product-analytics box runs. Fills the three stage tabs with official
  // Import/Export requirements; cmpLane is the active side (default import, matches admin).
  var cmpMacmap = null, cmpMacmapLoading = false, cmpLane = 'importing';

  var TRENDS = {
    ceramic: ['Large-format & rectified-edge tiles gaining share', 'Matte and anti-slip finishes trending up', 'Low-water-absorption porcelain in demand', 'Digital catalogues & verified sourcing rising'],
    textile: ['Organic & OEKO-TEX certified lines growing', 'Sustainable packaging mandates tightening', 'Higher-GSM hospitality fabrics in demand', 'Traceable, ethical supply chains expected'],
    engineering: ['Lightweight & EV components demand rising', 'Tighter quality (IATF/PPAP) expectations', 'Supply-chain diversification to India', 'Digital part catalogues & rapid sampling'],
    leather: ['LWG-traceable, low-chrome tanning preferred', 'Premium full-grain & private-label growing', 'Small-batch / made-to-order demand rising', 'Sustainability documentation expected'],
    spice: ['Steam-sterilised, lab-tested lots required', 'Single-origin & organic premiumisation', 'Retail-ready consumer packs growing', 'Strict pesticide-residue (MRL) compliance']
  };

  // ---- Real Need / Want data — the SAME endpoint the admin Product Analytics page uses:
  //   GET /api/recommendations/product/:id?country=&ai=openai&hsCode=&productName=
  // The ai-service keys its Market-Fit cache on hsCode + country (the :id is ignored),
  // so the live page passes the HS code as the id. Response maps exactly like admin's
  // AIRecommendationsDisplay: Need = productModifications.critical, Want = recommended + optional.
  function mapModRow(m, priority) {
    if (!m) return null;
    return {
      priority: priority,
      modification: m.modification || m.name || '',
      reason: m.reason || m.marketAdvantage || m.differentiationValue || 'Advised by buyers in this market.',
      cost: m.cost || m.estimatedCost || '—',
      timeline: m.timeline || '—'
    };
  }
  function recToPbSteps(rec) {
    var mods = (rec && rec.productModifications) || {};
    var need = (mods.critical || []).map(function (m) { return mapModRow(m, 'CRITICAL'); }).filter(Boolean);
    var want = (mods.recommended || []).map(function (m) { return mapModRow(m, 'RECOMMENDED'); })
      .concat((mods.optional || []).map(function (m) { return mapModRow(m, 'OPTIONAL'); }))
      .filter(Boolean);
    return { need: need, want: want };
  }
  async function renderRecommendations(hs, productName, country, seq) {
    try {
      var url = API.trademap + '/api/recommendations/product/' + encodeURIComponent(hs) +
        '?country=' + encodeURIComponent(country || 'United States') +
        '&ai=openai&hsCode=' + encodeURIComponent(hs) +
        '&productName=' + encodeURIComponent(productName || '');
      var r = await getJSON(url, { timeout: 170000 });
      if (seq !== renderSeq) return;                       // a newer Analyse superseded this one
      recData = (r && r.data && r.data.recommendations) || null;
      pbSteps = recToPbSteps(recData);                     // real data (empty arrays → honest empty state)
      recLoading = false;
      renderRecBodies(seq);                                // Need/Want + Certifications + ROI + cert pills + Market Analysis
    } catch (e) {
      // Never fall back to static data — clear the loaders and show the real empty state.
      if (seq === renderSeq) { recLoading = false; renderRecBodies(seq); }
    }
  }
  // Refresh every slot driven by the recommendations response.
  function renderRecBodies(seq) {
    if (seq != null && seq !== renderSeq) return;
    renderPbBody(seq); renderCertBody(seq); renderMarketBody(seq);
    var e1 = document.getElementById('pa-pbcert'); if (e1) e1.innerHTML = pbCertHTML();
    var e2 = document.getElementById('pa-margin'); if (e2) e2.innerHTML = marginHTML();
  }
  // ---- Action Playbook side cards (real data) ----
  function miniLoader() { return '<span style="display:inline-flex;align-items:center;gap:8px;color:#5B6B82;font-size:12px;"><span style="width:12px;height:12px;border:2px solid rgba(30,91,71,0.25);border-top-color:#1E5B47;border-radius:50%;display:inline-block;animation:aazikospin .7s linear infinite;"></span>Analysing…</span>'; }
  function pbCertHTML() {
    if (recLoading) return miniLoader();
    var list = (recData && recData.certifications) || [];
    if (!list.length) return '<span style="font-size:12px;color:#5B6B82;">—</span>';
    return '<div style="display:flex;flex-wrap:wrap;gap:6px;">' + list.map(function (c) { return '<span class="aaz-pill">' + esc(c.name || '') + '</span>'; }).join('') + '</div>';
  }
  function marginHTML() {
    if (recLoading) return miniLoader();
    var roi = recData && recData.financialProjections && recData.financialProjections.roi;
    if (!roi) return '<span style="font-size:12px;color:#5B6B82;">—</span>';
    return '<div style="font-size:15px;font-weight:800;color:#16C784;line-height:1.35;">' + esc(roi) + '</div>';
  }
  function competitorsHTML() {
    if (compLoading) return miniLoader();
    if (!compList || !compList.length) return '<span style="font-size:12px;color:#5B6B82;">No competing-origin trade data on file for this line.</span>';
    return '<div style="font-size:13px;color:#0F172A;">' + compList.map(esc).join(' · ') + '</div>';
  }
  function ftaHTML() {
    if (pbTariff === null || pbTariff === undefined) return '<span style="color:#5B6B82;">Live tariff data unavailable for this line.</span>';
    var t = Number(pbTariff);
    if (!isFinite(t)) return '<span style="color:#5B6B82;">—</span>';
    if (t <= 0) return 'Duty-free / preferential access for India on this line — 0% applied import duty (live tariff data).';
    return 'India faces ~' + fmtPct(t) + ' applied import duty on this line — no preferential FTA rate in force (live tariff data).';
  }
  async function renderCompetitors(hs, seq) {
    compLoading = true; compList = null;
    var b0 = document.getElementById('pa-competitors'); if (b0) b0.innerHTML = competitorsHTML();
    try {
      var r = await getJSON(API.trademap + '/api/trademap/top-suppliers/' + encodeURIComponent(hs) + '?limit=6', { timeout: 25000 });
      if (seq !== renderSeq) return;
      var sup = (r && r.data && r.data.topSuppliers) || [];
      compList = sup.map(function (s) { return s.country; }).filter(Boolean);
    } catch (e) { if (seq === renderSeq) compList = []; }
    if (seq !== renderSeq) return;
    compLoading = false;
    var b1 = document.getElementById('pa-competitors'); if (b1) b1.innerHTML = competitorsHTML();
  }
  function pbBodyHTML() {
    if (recLoading) return '<div style="display:flex;align-items:center;gap:10px;color:#5B6B82;font-size:13px;padding:14px 2px;"><span style="width:14px;height:14px;border:2px solid rgba(30,91,71,0.25);border-top-color:#1E5B47;border-radius:50%;display:inline-block;animation:aazikospin .7s linear infinite;"></span>Generating live AI analysis for ' + esc(recCountry || 'this market') + ' — the first analysis of a new market can take up to a minute…</div>';
    var rows = pbSteps[pbTab] || [];
    if (!rows.length) return '<div style="font-size:13px;color:#5B6B82;padding:8px 0;">No ' + (pbTab === 'need' ? 'must-have' : 'optional') + ' modifications identified for this market.</div>';
    var html = '';
    rows.forEach(function (r) {
      var pc = r.priority === 'CRITICAL' ? '#EF4444' : (r.priority === 'IMPORTANT' ? '#C4751F' : '#1E5B47');
      html += '<div class="pa-pb-row">';
      html += '<div class="pa-pb-badge"><span class="aaz-pill" style="font-size:9px;font-weight:800;letter-spacing:0.05em;color:' + pc + ';border-color:' + pc + ';">' + esc(r.priority) + '</span></div>';
      html += '<div style="flex:1;min-width:0;">';
      html += '<div style="font-size:13px;font-weight:700;color:#0F172A;margin-bottom:4px;">' + esc(r.modification) + '</div>';
      html += '<div style="font-size:12px;color:#5B6B82;line-height:1.5;">' + esc(r.reason) + '</div>';
      html += '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:7px;"><span class="aaz-pill" style="font-size:11px;">💰 ' + esc(r.cost) + '</span><span class="aaz-pill" style="font-size:11px;">⏱ ' + esc(r.timeline) + '</span></div>';
      html += '</div></div>';
    });
    return html;
  }
  function renderPbBody(seq) { if (seq != null && seq !== renderSeq) return; var b = document.getElementById('pa-pb-body'); if (b) b.innerHTML = pbBodyHTML(); }

  // ---- Where to Win: re-sortable Big Market / Big Margin / Emerging tabs ----
  function wtwBodyHTML() {
    var arr = wtwCards.slice();
    if (wtwTab === 'big-margin') arr.sort(function (a, b) { return (numOrNull(b.perUnitPriceUsd) === null ? -1 : numOrNull(b.perUnitPriceUsd)) - (numOrNull(a.perUnitPriceUsd) === null ? -1 : numOrNull(a.perUnitPriceUsd)); });
    else if (wtwTab === 'emerging') arr.sort(function (a, b) { var ga = pctVal(a.growthPctLatest), gb = pctVal(b.growthPctLatest); return (gb === null ? -1e9 : gb) - (ga === null ? -1e9 : ga); });
    else arr.sort(function (a, b) { return (Number(b.annualImportValueUsd) || 0) - (Number(a.annualImportValueUsd) || 0); });
    arr = arr.slice(0, 6);
    var sub = wtwTab === 'big-margin' ? 'Avg unit price' : (wtwTab === 'emerging' ? 'YoY import growth' : 'Annual imports from India');
    var rankWord = wtwTab === 'big-margin' ? 'MARGIN' : (wtwTab === 'emerging' ? 'GROWTH' : 'MARKET');
    var html = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%, 150px),1fr));gap:12px;">';
    arr.forEach(function (c, i) {
      var isSel = wtwSel && c.country === wtwSel;
      var headline;
      if (wtwTab === 'big-margin') { var u = numOrNull(c.perUnitPriceUsd); headline = u !== null ? ('$' + u + (c.unit ? ' /' + c.unit : '')) : '—'; }
      else if (wtwTab === 'emerging') { var g = pctVal(c.growthPctLatest); headline = g !== null ? fmtPct(g) : '—'; }
      else headline = c.annualImportValueFormatted || '—';
      html += '<div class="aaz-card aaz-card--pick" data-country="' + esc(c.country) + '" title="Analyse ' + esc(c.country) + '"' + (isSel ? ' style="border:2px solid #1E5B47;background:rgba(30,91,71,0.06);box-shadow:0 8px 22px rgba(30,91,71,0.22);"' : '') + '>';
      html += '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">';
      html += '<span class="aaz-pill aaz-blue" style="font-size:10px;letter-spacing:0.07em;">#' + (i + 1) + ' ' + rankWord + '</span>';
      if (isSel) html += '<span class="aaz-pill" style="font-size:10px;background:#1E5B47;color:#fff;border-color:#1E5B47;">✓ SELECTED</span>';
      html += '</div>';
      html += '<div style="display:flex;align-items:center;gap:8px;margin:8px 0 2px;"><span style="font-size:22px;">' + flagFor(c.country) + '</span><span style="font-size:13px;font-weight:700;color:#0F172A;">' + esc(c.country) + '</span></div>';
      html += '<div style="font-size:24px;font-weight:800;color:#1E5B47;line-height:1;margin:6px 0;">' + esc(headline) + '</div>';
      html += '<div style="font-size:11px;color:#5B6B82;margin-bottom:8px;">' + sub + '</div>';
      html += '<div style="display:flex;flex-wrap:wrap;gap:6px;">';
      var cUnit = numOrNull(c.perUnitPriceUsd);
      if (wtwTab !== 'big-margin' && cUnit !== null) html += '<span class="aaz-pill">$' + cUnit + (c.unit ? ' /' + c.unit : '') + '</span>';
      var cGrow = pctVal(c.growthPctLatest);
      if (wtwTab !== 'emerging' && cGrow !== null) html += '<span class="aaz-pill ' + pctClass(cGrow) + '">' + fmtPct(cGrow) + ' YoY</span>';
      if (wtwTab === 'big-market') html += '<span class="aaz-pill">Global ' + esc(c.annualImportValueFormatted || '—') + '</span>';
      html += '</div></div>';
    });
    html += '</div>';
    return html;
  }
  function renderWtwBody(seq) { if (seq != null && seq !== renderSeq) return; var b = document.getElementById('pa-wtw-body'); if (b) b.innerHTML = wtwBodyHTML(); }

  // ---- Compliance tabs (Production / Packaging / Documents / Regulatory) ----
  function aiBar(txt) { return '<div style="display:flex;align-items:center;gap:8px;background:rgba(22,199,132,0.1);border:1px solid rgba(22,199,132,0.25);border-radius:10px;padding:8px 12px;margin-bottom:12px;font-size:12px;color:#0f9d66;font-weight:600;"><span>✦</span>' + esc(txt) + '</div>'; }
  function normText(it) { return typeof it === 'string' ? it : (it && (it.text || it.requirement || it.title || it.name)) || ''; }
  // The compliance API returns only item titles (no per-item detail), so derive a
  // DISTINCT, requirement-specific note for the expand — keyword-based guidance, and
  // the requirement text is woven into the fallbacks so no two cards read identically.
  function itemDetail(text, country) {
    var c = country || 'the destination';
    var t = String(text || '').toLowerCase();
    if (/conformity|certif|\bmark\b|ecm|ukca|\bce\b/.test(t)) return 'Secure this certification/mark before production sign-off — ' + c + ' customs and buyers verify it at clearance.';
    if (/record|register|retain|\byears\b|archive/.test(t)) return 'Keep these records complete and retrievable for the required period — ' + c + ' authorities can request them.';
    if (/test|laborat|\blab\b|inspection/.test(t)) return 'Use an accredited lab/inspector and keep the report on file for ' + c + ' clearance.';
    if (/traceab|batch|serial|\blot\b/.test(t)) return 'Maintain end-to-end traceability so any ' + c + ' quality query can be traced back to a batch.';
    if (/chemical|banned|reach|substance|\blead\b|azo|restricted|raw material/.test(t)) return 'Screen materials against ' + c + ' restricted-substance limits at the sourcing stage, before production.';
    if (/safety/.test(t)) return 'Back the safety claim with test evidence accepted in the ' + c + ' market.';
    if (/standard|design|spec|dimension|\bsize\b/.test(t)) return 'Align specs to the standard ' + c + ' buyers expect — mismatches stall or reject orders.';
    if (/label|language|marking|origin|arabic|instruction|symbol|warning|icon|barcode|\bqr\b|recycl/.test(t)) return 'Show “' + text + '” correctly on the label/marking — missing or wrong marks are a common ' + c + ' rejection cause.';
    if (/packag|pallet|carton|wrap|crate|weight|\bnet\b|gross|handling/.test(t)) return '“' + text + '” must meet ' + c + ' packaging & handling norms to prevent transit damage and re-work.';
    if (/document|invoice|packing list|certificate of origin|declaration/.test(t)) return 'Prepare “' + text + '” accurately — it is required for ' + c + ' customs clearance.';
    return 'Ensure “' + text + '” is in place before the shipment leaves India — it is expected for ' + c + ' market access.';
  }
  // Resolve a detail and guarantee it differs from earlier ones (the requirement
  // text is unique, so the fallback is always distinct).
  function uniqueDetail(t, country, seen) {
    var d = itemDetail(t, country);
    if (seen[d]) d = 'Ensure “' + t + '” is in place before the shipment leaves India — it is required for ' + (country || 'the destination') + ' market access.';
    seen[d] = 1;
    return d;
  }
  function normItems(arr, country) {
    var seen = {};
    return (arr || []).map(function (it) {
      var t = normText(it); if (!t) return null;
      var crit = /mandatory|must|prohibit|require|ban|critical/i.test(t);
      return { title: t.length > 90 ? t.slice(0, 88) + '…' : t, full: t, badge: crit ? 'CRITICAL' : 'REQUIRED', detail: uniqueDetail(t, country, seen) };
    }).filter(Boolean);
  }
  function normBlocks(blocks, country) {
    var out = [], seen = {};
    (blocks || []).forEach(function (b) {
      if (!b || !b.items || !b.items.length) return;
      b.items.forEach(function (it) {
        var t = normText(it); if (!t) return;
        out.push({ title: t.length > 90 ? t.slice(0, 88) + '…' : t, full: t, badge: 'REQUIRED', detail: uniqueDetail(t, country, seen) });
      });
    });
    return out;
  }
  // Concentric-circle "target" icon (matches the admin item-card icon), emerald.
  var TARGET_SVG = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#1E5B47" stroke-width="2"><circle cx="12" cy="12" r="9"></circle><circle cx="12" cy="12" r="5"></circle><circle cx="12" cy="12" r="1.5" fill="#1E5B47" stroke="none"></circle></svg>';
  // ---- MACMAP lane-split analysis (parity with admin product-analytics) ----
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  // Requirements for ONE stage + lane out of the analysis object.
  function laneReqs(stage, lane) {
    if (!cmpMacmap || !cmpMacmap[stage]) return [];
    var k = lane === 'exporting' ? 'exporting_country_requirements' : 'importing_country_requirements';
    return cmpMacmap[stage][k] || [];
  }
  // A stage is "covered" by macmap when EITHER lane carries a requirement.
  function macmapHasStage(stage) { return !!cmpMacmap && (laneReqs(stage, 'importing').length + laneReqs(stage, 'exporting').length) > 0; }
  function macmapHasAny(a) {
    return ['production', 'packaging', 'documents'].some(function (st) {
      return a && a[st] && ((a[st].importing_country_requirements || []).length + (a[st].exporting_country_requirements || []).length) > 0;
    });
  }
  // One macmap requirement -> the live card item shape, MATCHING the admin box:
  // short Authority/Legislation values + any parenthetical group in the title become
  // always-visible chips (it.tags); Action/long values become expand notes (it.notes).
  function macmapReqToLiveItem(req, country) {
    var title = String((req && (req.requirement || req.action)) || 'Requirement').trim();
    var crit = String((req && req.criticality) || '').toLowerCase();
    var badge = /prohibit/.test(crit) ? 'PROHIBITED' : (/mandatory|critical|required/.test(crit) ? 'CRITICAL' : (/recommend|important|high/.test(crit) ? 'IMPORTANT' : 'REQUIRED'));
    var tags = [], notes = [];
    // Same 30-char split as the admin parseAIItem: short -> chip, long -> note line.
    function field(key, val) { if (!val) return; if (String(val).length > 30) notes.push(key + ': ' + val); else tags.push({ key: key, value: String(val) }); }
    if (req && req.action && req.action !== req.requirement) notes.push('Action: ' + req.action);
    field('Authority', req && req.authority);
    field('Legislation', req && req.legislation_title);
    if (req && req.handled_by === 'aaziko') notes.push('Aaziko handles this end-to-end as your trade partner.');
    // Pull any parenthetical group out of the title into chips, e.g.
    // "…Water and the Environment (DAWE)." -> chip "DAWE" (admin does the same).
    (title.match(/\(([^)]+)\)/g) || []).forEach(function (g) {
      g.replace(/[()]/g, '').split(/[\/,]/).map(function (s) { return s.trim(); }).filter(Boolean).forEach(function (v) { if (v.length <= 30) tags.push({ key: '', value: v }); });
    });
    var clean = title.replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').replace(/\s+\./g, '.').trim();
    if (!notes.length) notes.push('Ensure this is satisfied for ' + (country || 'the destination') + ' market access.');
    // De-dup chips by value (a paren group that repeats the authority/legislation) — admin does the same.
    var seenTag = {}; tags = tags.filter(function (t) { var v = t.value.toLowerCase(); if (seenTag[v]) return false; seenTag[v] = 1; return true; });
    return { title: clean.length > 90 ? clean.slice(0, 88) + '…' : clean, full: title, badge: badge, tags: tags, notes: notes };
  }
  // Emerald Import/Export lane toggle (box theme, NOT the admin blue) — default Import.
  function laneToggleHTML(country) {
    function pill(lane, arrow, label) {
      var on = cmpLane === lane;
      return '<button type="button" data-cmp-lane="' + lane + '" style="display:inline-flex;align-items:center;gap:6px;cursor:pointer;border-radius:999px;padding:7px 14px;font-size:11px;font-weight:700;border:1px solid ' + (on ? 'rgba(30,91,71,0.35)' : 'rgba(30,91,71,0.15)') + ';' + (on ? 'background:#1E5B47;color:#fff;box-shadow:0 4px 12px rgba(30,91,71,0.2);' : 'background:rgba(255,255,255,0.6);color:#5B6B82;') + '"><span style="font-size:12px;">' + arrow + '</span>' + esc(label) + '</button>';
    }
    return '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px;">' +
      pill('exporting', '↗', 'Export Need To Follow · ' + EXPORTING_COUNTRY) +
      pill('importing', '↙', 'Import Need To Follow · ' + (country || 'Destination')) +
      '</div>';
  }
  // Render one stage from macmap: the SELECTED lane's requirements, else a
  // switch-lane prompt when only the other lane has data (never a blank tab).
  function macmapStageHTML(stage, country) {
    var stageHead = function (t) { return '<div style="font-size:13px;font-weight:800;letter-spacing:0.02em;color:#0F172A;margin:4px 0 12px;">' + t + '</div>'; };
    var heading = stage === 'production' ? 'PRODUCTION STAGE — What You Must Ensure (AI Filtered)' : (stage === 'packaging' ? 'PACKAGING & LABELLING — Prepare Before Shipment' : 'DOCUMENTS FOR CUSTOMS CLEARANCE');
    var reqs = laneReqs(stage, cmpLane);
    if (!reqs.length) {
      var otherLabel = cmpLane === 'importing' ? ('Export Need To Follow · ' + EXPORTING_COUNTRY) : ('Import Need To Follow · ' + (country || 'destination'));
      return stageHead(heading) + '<div style="font-size:13px;color:#5B6B82;font-style:italic;padding:10px 2px;">No official ' + (cmpLane === 'importing' ? 'import' : 'export') + ' requirements on file for this stage — switch to “' + esc(otherLabel) + '” to see the requirements that apply.</div>';
    }
    var items = reqs.map(function (r) { return macmapReqToLiveItem(r, country); });
    var laneWord = cmpLane === 'importing' ? (country || 'destination') + ' import' : EXPORTING_COUNTRY + ' export';
    return aiBar('AI analysed ' + items.length + ' official ' + laneWord + ' requirement' + (items.length === 1 ? '' : 's') + ' · ITC Market Access Map') + stageHead(heading) + itemsGridHTML(items, stage, stage + ':' + cmpLane);
  }
  // Async job: start the macmap analysis, poll for the result (parity w/ admin).
  async function pollMacmap(hs, country, records, seq) {
    try {
      var start = await postJSON(API.trademap + '/api/hscode/analyze-macmap-regulatory/start', { hsCode: hs, destinationCountry: country, exportingCountry: EXPORTING_COUNTRY, mode: 'Export', macmapData: records, productDetail: (prod && prod.value) || '' }, { timeout: 30000 });
      var jobId = start && start.jobId;
      if (!jobId) return (start && start.analysis) || null;   // backward-compat sync result
      for (var i = 0; i < 150; i++) {                          // ~10 min ceiling
        await sleep(i === 0 ? 1500 : 4000);
        if (seq !== renderSeq) return null;
        var st = await getJSON(API.trademap + '/api/hscode/analyze-macmap-regulatory/status/' + jobId, { timeout: 30000 });
        if (st && st.status === 'done') return st.analysis || null;
        if (st && st.status === 'error') return null;
      }
    } catch (e) { /* fall back to the compliance checklist */ }
    return null;
  }
  // Compliance tab bar — descriptive labels + icons, active = white pill (admin style).
  function cmpTabsInner() {
    var regCount = (cmpData && cmpData.regulatory) ? cmpData.regulatory.reduce(function (s, g) { return s + g.measures.length; }, 0) : 0;
    var tabs = [
      ['production', '⚠️', 'Things Need To Take Care While Production'],
      ['packaging', '📦', 'Packaging Type'],
      ['documents', '📄', 'Document Requirement'],
      ['regulatory', '📋', 'Regulatory Requirements' + (regCount ? ' (' + regCount + ')' : '')]
    ];
    return tabs.map(function (t) {
      var on = cmpTab === t[0];
      return '<button type="button" data-cmp-tab="' + t[0] + '" style="flex:1 1 170px;display:flex;align-items:center;gap:8px;cursor:pointer;border-radius:12px;padding:11px 14px;font-size:12px;font-weight:700;text-align:left;border:1px solid ' + (on ? 'rgba(30,91,71,0.25)' : 'rgba(30,91,71,0.12)') + ';' + (on ? 'background:#fff;color:#1E5B47;box-shadow:0 6px 16px rgba(30,91,71,0.14);' : 'background:rgba(255,255,255,0.55);color:#5B6B82;') + '"><span style="font-size:15px;flex:none;">' + t[1] + '</span><span style="line-height:1.2;">' + t[2] + '</span></button>';
    }).join('');
  }
  // Thin chevron (rotates open) — cleaner than a text ▾.
  function cmpChevron(open) { return '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex:none;transition:transform .2s;transform:rotate(' + (open ? '180' : '0') + 'deg);"><polyline points="6 9 12 15 18 9"></polyline></svg>'; }
  // One expand note. "Label: value" → emerald label + slate value; the Aaziko
  // value-prop line → a distinct branded row with a check.
  function cmpNoteRow(n) {
    var s = String(n);
    if (/^Aaziko handles/i.test(s)) return '<div style="display:flex;align-items:center;gap:7px;margin-top:10px;font-size:11px;font-weight:600;color:#1E5B47;background:rgba(30,91,71,0.06);border:1px solid rgba(30,91,71,0.16);border-radius:9px;padding:7px 11px;"><span style="font-size:12px;line-height:1;">✓</span><span>' + esc(s) + '</span></div>';
    var ci = s.indexOf(':');
    if (ci > 0 && ci <= 14) return '<div style="font-size:12px;line-height:1.55;margin-bottom:6px;color:#5B6B82;"><span style="font-weight:700;color:#1E5B47;">' + esc(s.slice(0, ci).trim()) + ':</span> ' + esc(s.slice(ci + 1).trim()) + '</div>';
    return '<div style="font-size:12px;color:#5B6B82;line-height:1.55;margin-bottom:6px;">' + esc(s) + '</div>';
  }
  function itemsGridHTML(items, tab, keyBase) {
    var ico = tab === 'packaging' ? '<span style="font-size:14px;">📦</span>' : (tab === 'documents' ? '<span style="font-size:14px;">📄</span>' : TARGET_SVG);
    // Single-column list: each requirement is a full-width row, so expanding a card
    // just pushes the ones below it down — a clean, predictable layout with no
    // column reflow or uneven gaps.
    var html = '<div style="display:flex;flex-direction:column;gap:10px;">';
    items.forEach(function (it, i) {
      var key = (keyBase || tab) + ':' + i, open = !!cmpExpanded[key];
      var crit = it.badge === 'CRITICAL' || it.badge === 'PROHIBITED';
      var bc = crit ? '#EF4444' : (it.badge === 'IMPORTANT' ? '#D97706' : '#1E5B47');
      var bcBg = crit ? 'rgba(239,68,68,0.10)' : (it.badge === 'IMPORTANT' ? 'rgba(217,119,6,0.10)' : 'rgba(30,91,71,0.10)');
      // Clean WHITE cards with a crisp emerald-tinted border (no severity tint — the badge
      // already carries criticality); critical gets a slightly stronger left accent only.
      var accent = crit ? 'box-shadow:inset 3px 0 0 rgba(239,68,68,0.55),0 4px 14px rgba(30,91,71,0.06);' : (it.badge === 'IMPORTANT' ? 'box-shadow:inset 3px 0 0 rgba(217,119,6,0.55),0 4px 14px rgba(30,91,71,0.06);' : '');
      html += '<div class="aaz-card aaz-card--pick" data-cmp-item="' + esc(key) + '" style="padding:14px 16px;background:#fff;border:1px solid rgba(30,91,71,0.12);' + accent + '">';
      // Header row: icon + title (left), badge + chevron pinned top-right (admin layout).
      html += '<div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;">';
      html += '<div style="display:flex;gap:11px;align-items:flex-start;flex:1;min-width:0;">';
      html += '<span style="flex:none;width:32px;height:32px;border-radius:9px;background:rgba(30,91,71,0.09);border:1px solid rgba(30,91,71,0.14);display:flex;align-items:center;justify-content:center;">' + ico + '</span>';
      html += '<div style="flex:1;min-width:0;">';
      html += '<div style="font-size:13px;font-weight:700;color:#0F172A;line-height:1.45;">' + esc(it.title) + '</div>';
      if (it.tags && it.tags.length) {
        html += '<div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:6px;">';
        it.tags.forEach(function (t) {
          html += '<span style="display:inline-flex;align-items:center;border-radius:999px;padding:3px 9px;font-size:10px;font-weight:700;color:#1E5B47;border:1px solid rgba(30,91,71,0.22);background:rgba(30,91,71,0.06);">' + (t.key ? '<span style="opacity:0.55;font-weight:600;margin-right:4px;">' + esc(t.key) + ':</span>' : '') + esc(t.value) + '</span>';
        });
        html += '</div>';
      }
      if (open) {
        var notes = (it.notes && it.notes.length) ? it.notes : (it.detail ? [it.detail] : []);
        if (notes.length) {
          html += '<div style="margin-top:10px;border-top:1px solid rgba(30,91,71,0.10);padding-top:10px;">';
          notes.forEach(function (n) { html += cmpNoteRow(n); });
          html += '</div>';
        }
      }
      html += '</div>';   // title / chips / notes column
      html += '</div>';   // left group (icon + column)
      html += '<div style="flex:none;display:flex;align-items:center;gap:7px;">';
      html += '<span style="border-radius:7px;padding:3px 8px;font-size:9px;font-weight:800;letter-spacing:0.05em;color:' + bc + ';background:' + bcBg + ';">' + esc(it.badge) + '</span>';
      html += cmpChevron(open);
      html += '</div>';   // badge + chevron (top-right)
      html += '</div>';   // header row
      html += '</div>';   // card
    });
    html += '</div>';
    return html;
  }
  function cmpBodyHTML() {
    var note = function (t) { return '<div style="font-size:13px;color:#5B6B82;padding:10px 2px;">' + esc(t) + '</div>'; };
    var stageHead = function (t) { return '<div style="font-size:13px;font-weight:800;letter-spacing:0.02em;color:#0F172A;margin:4px 0 12px;">' + t + '</div>'; };
    if (cmpTab === 'regulatory') {
      var groups = (cmpData && cmpData.regulatory) || [];
      if (!groups.length) return note('No official regulatory measures on file for ' + cmpCountry + ' yet.');
      var n = groups.reduce(function (s, g) { return s + g.measures.length; }, 0);
      return aiBar(n + ' official regulatory measures · ITC Market Access Map') + stageHead('Regulatory Requirements from Market Access Map') + measuresHTML(groups);
    }
    // MACMAP lane-split analysis (parity with admin) drives the three stage tabs:
    // render the Import/Export toggle + the selected lane's official requirements.
    // Falls through to the compliance checklist only when macmap has nothing for
    // any stage (or errors); shows a loader on all stage tabs while it runs so the
    // toggle is never inert against the non-lane checklist.
    if (cmpMacmap && macmapHasStage(cmpTab)) {
      return macmapStageHTML(cmpTab, cmpCountry);
    }
    if (cmpMacmapLoading && cmpData && cmpData.regulatory && cmpData.regulatory.length) {
      return '<div style="display:flex;align-items:center;gap:10px;color:#5B6B82;font-size:13px;padding:10px 2px;"><span style="width:14px;height:14px;border:2px solid rgba(30,91,71,0.25);border-top-color:#1E5B47;border-radius:50%;display:inline-block;animation:aazikospin .7s linear infinite;"></span>Fetching official ' + esc(cmpTab) + ' requirements from Market Access Map…</div>';
    }
    var items = (cmpData && cmpData[cmpTab]) || [];
    if (!items.length) {
      if (cmpBaselinePending) return '<div style="display:flex;align-items:center;gap:10px;color:#5B6B82;font-size:13px;padding:10px 2px;"><span style="width:14px;height:14px;border:2px solid rgba(30,91,71,0.25);border-top-color:#1E5B47;border-radius:50%;display:inline-block;animation:aazikospin .7s linear infinite;"></span>Compiling the ' + cmpTab + ' checklist…</div>';
      return note('No ' + cmpTab + ' requirements available for ' + cmpCountry + ' yet.');
    }
    var word = cmpTab === 'production' ? 'production' : (cmpTab === 'packaging' ? 'packaging & labelling' : 'document');
    var aiTxt = cmpTab === 'documents' ? ('AI analysed ' + items.length + ' key document requirements for customs clearance') : ('AI analysed ' + items.length + ' key ' + word + ' requirements');
    var heading = cmpTab === 'production' ? 'PRODUCTION STAGE — What You Must Ensure (AI Filtered)' : (cmpTab === 'packaging' ? 'PACKAGING & LABELLING — Prepare Before Shipment' : 'DOCUMENTS FOR CUSTOMS CLEARANCE');
    return aiBar(aiTxt) + stageHead(heading) + itemsGridHTML(items, cmpTab);
  }
  // The Export/Import lane toggle shows only on the stage tabs while macmap lane data
  // is present (or being fetched) — never on Regulatory or the plain compliance checklist.
  function laneToggleActive() {
    if (cmpTab === 'regulatory') return false;
    if (cmpMacmap && macmapHasStage(cmpTab)) return true;
    if (cmpMacmapLoading && cmpData && cmpData.regulatory && cmpData.regulatory.length) return true;
    return false;
  }
  function renderCmpBody(seq) {
    if (seq != null && seq !== renderSeq) return;
    // Lane toggle lives ABOVE the tabs (#pa-cmp-lane); refresh it alongside the body.
    var lane = document.getElementById('pa-cmp-lane');
    if (lane) lane.innerHTML = laneToggleActive() ? laneToggleHTML(cmpCountry) : '';
    var b = document.getElementById('pa-cmp-body'); if (!b) return;
    b.innerHTML = cmpData ? cmpBodyHTML() : loadingHTML('Analysing compliance requirements for ' + esc(cmpCountry) + '…');
  }

  // ---- Certifications & Compliance (detailed list) ----
  function certBody(name) {
    var n = String(name || '').toLowerCase();
    if (n.indexOf('gso') >= 0 || n.indexOf('ecm') >= 0 || n.indexOf('emirates') >= 0) return 'GCC Standardization Organization (GSO)';
    if (n.indexOf('iram') >= 0) return 'IRAM / national standards body';
    if (n.indexOf('esma') >= 0) return 'Emirates Authority for Standardization & Metrology';
    if (n.indexOf('oeko') >= 0) return 'OEKO-TEX Association';
    if (n.indexOf('gots') >= 0) return 'Global Organic Textile Standard';
    if (n.indexOf('lwg') >= 0) return 'Leather Working Group';
    if (n.indexOf('ce') === 0 || n.indexOf('ukca') >= 0 || n.indexOf('ec-') >= 0) return 'Notified body (EU/UK conformity)';
    if (n.indexOf('iso') >= 0) return 'International Organization for Standardization (ISO)';
    if (n.indexOf('fssc') >= 0 || n.indexOf('haccp') >= 0 || n.indexOf('brc') >= 0 || n.indexOf('food') >= 0) return 'Accredited food-safety certifier';
    return 'Accredited certification body';
  }
  // Certifications now come from the REAL recommendations.certifications (same as admin) —
  // {name, issuingBody, timeline, estimatedCost, priority}. Loader → real data, never static.
  function certBodyHTML() {
    if (recLoading) return '<div style="display:flex;align-items:center;gap:10px;color:#5B6B82;font-size:13px;padding:14px 2px;"><span style="width:14px;height:14px;border:2px solid rgba(30,91,71,0.25);border-top-color:#1E5B47;border-radius:50%;display:inline-block;animation:aazikospin .7s linear infinite;"></span>Analysing certification requirements for ' + esc(recCountry || 'this market') + '…</div>';
    var list = (recData && recData.certifications) || [];
    if (!list.length) return '<div style="font-size:13px;color:#5B6B82;padding:8px 0;">No certification requirements identified for this market.</div>';
    var html = '';
    list.forEach(function (c) {
      var pr = String(c.priority || '').toLowerCase();
      var pc = pr === 'high' ? '#EF4444' : (pr === 'medium' ? '#C4751F' : '#1E5B47');
      html += '<div class="aaz-card" style="margin-bottom:10px;">';
      html += '<div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;align-items:flex-start;"><div style="font-size:14px;font-weight:700;color:#0F172A;">' + esc(c.name || '') + '</div>' + (c.priority ? '<span class="aaz-pill" style="font-size:9px;font-weight:800;letter-spacing:0.05em;color:' + pc + ';border-color:' + pc + ';text-transform:uppercase;">' + esc(c.priority) + '</span>' : '') + '</div>';
      html += '<div style="font-size:12px;color:#5B6B82;margin-top:4px;">Issuing Body: ' + esc(c.issuingBody || c.body || '—') + '</div>';
      html += '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;"><span class="aaz-pill" style="font-size:11px;">⏱ Timeline: ' + esc(c.timeline || '—') + '</span><span class="aaz-pill" style="font-size:11px;">💰 Cost: ' + esc(c.estimatedCost || c.cost || '—') + '</span></div>';
      html += '</div>';
    });
    return html;
  }
  function renderCertBody(seq) { if (seq != null && seq !== renderSeq) return; var b = document.getElementById('pa-cert-body'); if (b) b.innerHTML = certBodyHTML(); }
  function certPanel(advisory, country) {
    var html = '<div class="aaz-panel" style="margin-bottom:16px;">';
    html += '<div style="text-align:center;margin-bottom:2px;"><span class="aaz-label aaz-blue" style="letter-spacing:0.2em;">CERTIFICATIONS &amp; COMPLIANCE</span></div>';
    html += '<div style="text-align:center;font-size:12px;color:#5B6B82;margin-bottom:16px;">Certifications for ' + esc(country) + ' market access</div>';
    html += '<div id="pa-cert-body">' + certBodyHTML() + '</div>';
    html += '</div>';
    return html;
  }

  // ---- Market Analysis (size/growth + curated trends & competitive edge) ----
  function marketAnalysisPanel(advisory, country, total, sel) {
    // MARKET SIZE / GROWTH RATE come from live trade data (sel/total); KEY TRENDS +
    // COMPETITIVE ADVANTAGE come from the recommendations AI (loader → real, never static).
    var size = (sel && sel.annualImportValueFormatted) || (total && total.formattedExportValue) || '—';
    var growN = sel ? pctVal(sel.totalGrowthPct) : null;
    var growth = growN !== null ? (fmtPct(growN) + ' over recent years') : '—';
    var html = '<div class="aaz-panel" style="margin-bottom:16px;">';
    html += '<div style="text-align:center;margin-bottom:2px;"><span class="aaz-label aaz-blue" style="letter-spacing:0.2em;">MARKET ANALYSIS</span></div>';
    html += '<div style="text-align:center;font-size:12px;color:#5B6B82;margin-bottom:16px;">' + esc(country) + ' market insights &amp; opportunity</div>';
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%, 160px),1fr));gap:12px;margin-bottom:12px;">';
    html += '<div class="aaz-card"><div class="aaz-label" style="margin-bottom:6px;">MARKET SIZE</div><div style="font-size:20px;font-weight:800;color:#1E5B47;">' + esc(size) + '</div><div style="font-size:11px;color:#5B6B82;margin-top:3px;">Annual import value</div></div>';
    html += '<div class="aaz-card"><div class="aaz-label" style="margin-bottom:6px;">GROWTH RATE</div><div style="font-size:20px;font-weight:800;color:#16C784;">' + esc(growth) + '</div><div style="font-size:11px;color:#5B6B82;margin-top:3px;">Demand trajectory</div></div>';
    html += '</div>';
    html += '<div id="pa-ma-body">' + marketBodyHTML() + '</div>';
    html += '</div>';
    return html;
  }
  function marketBodyHTML() {
    if (recLoading) return '<div class="aaz-card"><div style="display:flex;align-items:center;gap:10px;color:#5B6B82;font-size:13px;padding:6px 2px;"><span style="width:14px;height:14px;border:2px solid rgba(30,91,71,0.25);border-top-color:#1E5B47;border-radius:50%;display:inline-block;animation:aazikospin .7s linear infinite;"></span>Analysing market trends for ' + esc(recCountry || 'this market') + '…</div></div>';
    var ma = (recData && recData.marketAnalysis) || {};
    var trends = ma.keyTrends || [];
    var edge = ma.competitiveAdvantage || '';
    var html = '<div class="aaz-card" style="margin-bottom:12px;"><div class="aaz-label" style="margin-bottom:8px;">KEY TRENDS</div>';
    if (!trends.length) html += '<div style="font-size:13px;color:#5B6B82;">No market trends identified for this market.</div>';
    else { html += '<ul style="list-style:none;padding:0;margin:0;font-size:13px;line-height:1.6;color:#0F172A;">'; trends.forEach(function (t) { html += '<li style="padding:4px 0 4px 18px;position:relative;"><span style="position:absolute;left:0;top:10px;width:5px;height:5px;background:#1E5B47;border-radius:50%;"></span>' + esc(t) + '</li>'; }); html += '</ul>'; }
    html += '</div>';
    html += '<div class="aaz-card" style="background:rgba(22,199,132,0.08);border-color:rgba(22,199,132,0.28);"><div class="aaz-label" style="color:#0f9d66;margin-bottom:6px;">COMPETITIVE ADVANTAGE</div><div style="font-size:13px;color:#0F172A;line-height:1.55;">' + (edge ? esc(edge) : '<span style="color:#5B6B82;">—</span>') + '</div></div>';
    return html;
  }
  function renderMarketBody(seq) { if (seq != null && seq !== renderSeq) return; var b = document.getElementById('pa-ma-body'); if (b) b.innerHTML = marketBodyHTML(); }

  // ---- Final CTA ----
  function ctaPanel(country) {
    return '<div class="aaz-panel" style="margin-bottom:8px;text-align:center;background:linear-gradient(135deg,#1E5B47 0%,#2C7757 55%,#5A8A6E 100%);border-color:rgba(255,255,255,0.5);">' +
      '<div style="font-size:clamp(18px,2.4vw,22px);font-weight:800;color:#fff;margin-bottom:6px;">One decision away from your first export order.</div>' +
      '<div style="font-size:13px;color:#EAF6EF;margin:0 auto 16px;max-width:520px;">4.7 crore manufacturers in India. Only 4% export. Be different — starting' + (country ? ' with ' + esc(country) : '') + '.</div>' +
      '<a href="/partnership/" class="aaz-btn" style="display:inline-block;text-decoration:none;background:#fff;color:#1E5B47;box-shadow:0 6px 18px rgba(0,0,0,0.18);">Contact me with matched buyers →</a>' +
      '</div>';
  }

  /* ============================================================================
     Admin "Product Analytics" sections ported into the public live box:
     Potential Buyers · HS Code Compliance Analysis · Certifications & Compliance.
     All re-skinned to the emerald .aaz-* glass system, fetched non-blocking and
     guarded by the renderSeq stale-guard so a newer Analyse never gets clobbered.
     ========================================================================== */
  var EXPORTING_COUNTRY = 'India';
  // Buyers list UI state (closure-scoped so the delegated click handler can toggle
  // the inline detail / "view all" without re-fetching).
  var lastBuyers = [], lastBuyersTotal = 0, openBuyerIdx = -1, buyersExpanded = false;

  function toTitle(s) { return String(s || '').toLowerCase().replace(/\b\w/g, function (c) { return c.toUpperCase(); }); }
  function fmtAmount(n) { n = Number(n); if (!isFinite(n) || n <= 0) return '—'; if (n >= 1e9) return '$' + (n / 1e9).toFixed(1) + 'B'; if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M'; if (n >= 1e3) return '$' + (n / 1e3).toFixed(0) + 'K'; return '$' + Math.round(n); }
  function fmtQty(n, unit) { n = Number(n); if (!isFinite(n) || n <= 0) return '—'; var v = n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(0) + 'K' : String(Math.round(n)); return v + (unit ? ' ' + unit : ''); }
  function fmtPrice(amount, qty) { amount = Number(amount); qty = Number(qty); if (!isFinite(qty) || qty <= 0 || !isFinite(amount) || amount <= 0) return '—'; var p = amount / qty; return p < 1000 ? '$' + p.toFixed(2) : fmtAmount(p); }

  // ---- Potential Buyers ----
  function buyersPanelShell(country) {
    var html = '<div class="aaz-panel" style="margin-bottom:16px;">';
    html += '<div style="text-align:center;margin-bottom:2px;"><span class="aaz-label aaz-blue" style="letter-spacing:0.2em;">POTENTIAL BUYERS</span></div>';
    html += '<div id="pa-buyers-title" style="text-align:center;font-size:17px;font-weight:800;color:#0F172A;margin-bottom:14px;">Verified importers' + (country ? ' in ' + esc(country) : '') + '</div>';
    html += '<div id="pa-buyers-body">' + loadingHTML('Finding verified buyers in ' + esc(country) + '…') + '</div>';
    html += '</div>';
    return html;
  }
  function buyerCard(b, i) {
    var ctry = toTitle(b.country || '');
    var ls = (b.leadScore != null && !isNaN(Number(b.leadScore))) ? Math.round(Number(b.leadScore)) : null;
    var open = (openBuyerIdx === i);
    var html = '<div class="aaz-card aaz-card--pick" data-buyer-idx="' + i + '"' + (open ? ' style="border:2px solid #1E5B47;background:rgba(30,91,71,0.06);"' : '') + '>';
    html += '<div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start;">';
    html += '<div style="min-width:0;"><div style="font-size:14px;font-weight:700;color:#0F172A;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + esc(b.name || '—') + '</div>';
    html += '<div style="font-size:11px;color:#5B6B82;margin-top:3px;">' + flagFor(ctry) + ' ' + esc(ctry || '—') + (b.category ? ' · ' + esc(b.category) : '') + '</div></div>';
    if (ls != null) html += '<span class="aaz-pill aaz-blue" style="font-weight:800;flex:none;">' + ls + '</span>';
    html += '</div>';
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px;">';
    html += '<div><div style="font-size:14px;font-weight:800;color:#1E5B47;">' + fmtAmount(b.totalAmount) + '</div><div style="font-size:10px;color:#5B6B82;">Annual value</div></div>';
    html += '<div><div style="font-size:14px;font-weight:800;color:#1E5B47;">' + (b.transactionCount != null ? Number(b.transactionCount).toLocaleString('en-IN') : '—') + '</div><div style="font-size:10px;color:#5B6B82;">Shipments</div></div>';
    html += '<div><div style="font-size:14px;font-weight:800;color:#0F172A;">' + fmtQty(b.totalQuantity, b.quantityUnit) + '</div><div style="font-size:10px;color:#5B6B82;">Total qty</div></div>';
    html += '<div><div style="font-size:14px;font-weight:800;color:#0F172A;">' + fmtPrice(b.totalAmount, b.totalQuantity) + '</div><div style="font-size:10px;color:#5B6B82;">Avg price</div></div>';
    html += '</div>';
    html += '<div style="font-size:11px;color:#1E5B47;font-weight:600;margin-top:10px;">' + (open ? 'Hide details ↑' : 'View details →') + '</div>';
    html += '</div>';
    return html;
  }
  function buyerDetail(b) {
    var ctry = toTitle(b.country || '');
    var html = '<div class="aaz-card" style="margin-top:12px;border-color:rgba(30,91,71,0.3);">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;background:linear-gradient(135deg,#1E5B47,#5A8A6E);margin:-16px -16px 14px;padding:12px 16px;border-radius:14px 14px 0 0;">';
    html += '<div style="color:#fff;min-width:0;"><div style="font-size:10px;letter-spacing:0.12em;opacity:0.85;">BUYER PROFILE</div><div style="font-size:15px;font-weight:800;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + esc(b.name || '—') + '</div></div>';
    html += '<span id="pa-buyer-close" style="cursor:pointer;color:#fff;font-size:18px;line-height:1;opacity:0.9;flex:none;">✕</span></div>';
    html += '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px;">';
    if (ctry) html += '<span class="aaz-pill">📍 ' + esc(ctry) + '</span>';
    if (b.category) html += '<span class="aaz-pill">Category ' + esc(b.category) + '</span>';
    if (b.transactionCount) html += '<span class="aaz-pill">' + Number(b.transactionCount).toLocaleString('en-IN') + ' shipments</span>';
    if (b.totalAmount) html += '<span class="aaz-pill">' + fmtAmount(b.totalAmount) + ' annual</span>';
    html += '</div>';
    if (b.address) html += '<div style="font-size:12px;color:#5B6B82;margin-bottom:10px;line-height:1.5;">📍 ' + esc(b.address) + '</div>';
    var prods = (b.products || []).filter(Boolean);
    if (prods.length) {
      html += '<div class="aaz-label" style="margin-bottom:6px;">PRODUCTS IMPORTED</div><div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px;">';
      prods.slice(0, 6).forEach(function (p) { var t = p.length > 60 ? p.slice(0, 58) + '…' : p; html += '<span class="aaz-pill" title="' + esc(p) + '">' + esc(t) + '</span>'; });
      html += '</div>';
    }
    var c = b.contact || {}; // public payload may omit contact — guard, never throw
    if (c.hasContact) {
      html += '<div class="aaz-label" style="margin-bottom:6px;">CONTACT</div><div style="display:flex;flex-direction:column;gap:4px;font-size:12px;">';
      (c.emails || []).forEach(function (e) { html += '<a href="mailto:' + esc(e) + '" style="color:#1E5B47;">✉ ' + esc(e) + '</a>'; });
      (c.phones || []).forEach(function (p) { html += '<a href="tel:' + esc(String(p).replace(/[^0-9+]/g, '')) + '" style="color:#1E5B47;">☎ ' + esc(p) + '</a>'; });
      (c.linkedins || []).forEach(function (l) { var u = /^https?:/.test(l) ? l : 'https://' + l; html += '<a href="' + esc(u) + '" target="_blank" rel="noopener" style="color:#1E5B47;">in ' + esc(l) + '</a>'; });
      html += '</div>';
    } else {
      html += '<div class="aaz-card" style="font-size:12px;color:#5B6B82;background:rgba(30,91,71,0.04);">Verified contact (email · phone · LinkedIn) and AI-assisted outreach for this buyer are available inside the Aaziko platform.</div>';
    }
    html += '</div>';
    return html;
  }
  function renderBuyersBody(seq) {
    if (seq != null && seq !== renderSeq) return;
    var body = document.getElementById('pa-buyers-body'); if (!body) return;
    var list = buyersExpanded ? lastBuyers : lastBuyers.slice(0, 4);
    var html = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%, 240px),1fr));gap:12px;">';
    list.forEach(function (b, i) { html += buyerCard(b, i); });
    html += '</div>';
    if (openBuyerIdx >= 0 && lastBuyers[openBuyerIdx]) html += buyerDetail(lastBuyers[openBuyerIdx]);
    if (!buyersExpanded && lastBuyers.length > 4) html += '<div style="text-align:center;margin-top:14px;"><span id="pa-buyers-more" class="aaz-pill aaz-blue" style="cursor:pointer;font-weight:700;">View all ' + Number(lastBuyersTotal || lastBuyers.length).toLocaleString('en-IN') + ' buyers →</span></div>';
    body.innerHTML = html;
  }
  async function renderBuyers(hs, country, seq) {
    var d = null;
    try {
      var r = await getJSON(API.trademap + '/api/trademap/hscode-buyers/' + hs + '?page=1&limit=12' + (country ? '&country=' + encodeURIComponent(country) : ''), { timeout: 30000 });
      d = r && r.data ? r.data : null;
    } catch (e) { d = null; }
    if (seq !== renderSeq) return;
    var body = document.getElementById('pa-buyers-body'); if (!body) return;
    var title = document.getElementById('pa-buyers-title');
    if (!d || !d.buyers || !d.buyers.length) {
      if (title) title.textContent = 'Verified importers' + (country ? ' in ' + country : '');
      body.innerHTML = '<div style="text-align:center;font-size:13px;color:#5B6B82;padding:8px 0;">' + (d ? ('No verified importers on file for ' + esc(country) + ' yet.') : ('Buyer data momentarily unavailable for ' + esc(country) + '.')) + '</div>';
      return;
    }
    lastBuyers = d.buyers;
    lastBuyersTotal = d.total != null ? d.total : d.buyers.length;
    buyersExpanded = false;
    openBuyerIdx = -1;
    if (title) title.textContent = Number(lastBuyersTotal).toLocaleString('en-IN') + ' verified importers' + (country ? ' in ' + country : '');
    renderBuyersBody(seq);
  }

  // ---- HS Code Compliance Analysis + Certifications & Compliance ----
  // MACMAP regulatory measures (ported from the Customs live box) + cache-first baseline.
  function collectMacmapMeasures(records) {
    var order = [], bySection = {};
    (records || []).forEach(function (rec) {
      (rec.Data || []).forEach(function (sec) {
        var name = sec.MeasureSection || 'Other requirements';
        if (!bySection[name]) { bySection[name] = {}; order.push(name); }
        (sec.Measures || []).forEach(function (m) {
          if (!m || !m.MeasureTitle) return;
          var key = (m.MeasureCode || '') + '|' + m.MeasureTitle;
          if (!bySection[name][key]) bySection[name][key] = { code: m.MeasureCode || '', title: m.MeasureTitle, summary: m.MeasureSummary || '' };
        });
      });
    });
    return order.map(function (n) { return { section: n, measures: Object.keys(bySection[n]).map(function (k) { return bySection[n][k]; }) }; }).filter(function (g) { return g.measures.length; });
  }
  async function fetchMacmap(hs, country) {
    for (var attempt = 0; attempt < 2; attempt++) {
      try {
        var r = await getJSON(API.trademap + '/api/hscode/search/' + hs + '?country=' + encodeURIComponent(country) + '&mode=Import', { timeout: 30000 });
        var recs = r && r.macmapRegulatory && r.macmapRegulatory.data;
        if (recs && recs.length) return recs;
      } catch (e) { /* 404/timeout — retry once */ }
    }
    return [];
  }
  function measuresHTML(groups) {
    var html = '';
    groups.forEach(function (g) {
      html += '<div class="aaz-card" style="margin-bottom:10px;"><div style="font-size:12px;font-weight:700;color:#0F172A;margin-bottom:8px;">' + esc(g.section) + '</div>';
      g.measures.slice(0, 6).forEach(function (m) {
        var summary = m.summary && m.summary.length > 200 ? m.summary.slice(0, 200) + '…' : m.summary;
        html += '<div style="padding:7px 0 7px 12px;border-left:2px solid rgba(30,91,71,0.25);margin-bottom:7px;">';
        html += '<div style="font-size:13px;font-weight:600;color:#0F172A;">' + (m.code ? '<span style="font-family:monospace;font-size:11px;color:#1E5B47;background:rgba(30,91,71,0.1);padding:1px 5px;border-radius:3px;margin-right:6px;">' + esc(m.code) + '</span>' : '') + esc(m.title) + '</div>';
        if (summary) html += '<div style="font-size:12px;color:#5B6B82;line-height:1.5;margin-top:3px;">' + esc(summary) + '</div>';
        html += '</div>';
      });
      html += '</div>';
    });
    return html;
  }
  function complianceBaselineHTML(data) {
    var s = data.sections || {};
    function items(arr) { var h = '<ul style="list-style:none;padding:0;margin:0;font-size:13px;line-height:1.6;color:#0F172A;">'; (arr || []).forEach(function (it) { var t = typeof it === 'string' ? it : (it && (it.text || it.requirement || it.title || it.name)) || ''; if (!t) return; h += '<li style="padding:4px 0 4px 16px;position:relative;"><span style="position:absolute;left:0;top:10px;width:5px;height:5px;background:#1E5B47;border-radius:50%;"></span>' + esc(t) + '</li>'; }); return h + '</ul>'; }
    function blocks(arr) { var h = ''; (arr || []).forEach(function (b) { if (!b || !b.items || !b.items.length) return; if (b.heading) h += '<div style="font-size:12px;font-weight:700;color:#0F172A;margin:8px 0 4px;">' + esc(b.heading) + '</div>'; h += items(b.items); }); return h; }
    function card(title, inner) { return '<div class="aaz-card" style="margin-bottom:10px;"><div class="aaz-label" style="margin-bottom:8px;">' + esc(title) + '</div>' + inner + '</div>'; }
    var html = '';
    if (s.production && s.production.items && s.production.items.length) html += card(s.production.title || 'Manufacturing & production', items(s.production.items));
    if (s.documents && s.documents.blocks && s.documents.blocks.length) html += card('Required documents', blocks(s.documents.blocks));
    if (s.packaging && s.packaging.blocks && s.packaging.blocks.length) html += card('Labelling & packaging', blocks(s.packaging.blocks));
    return html;
  }
  function compliancePanelShell(country, hs, label) {
    cmpExpanded = {}; // fresh expand state per analysis
    var desc = label && label.length > 70 ? label.slice(0, 68) + '…' : (label || '');
    var html = '<div class="aaz-panel" style="margin-bottom:16px;padding:0;overflow:hidden;">';
    // Gradient header card (emerald) — file icon + title + HS code/desc + country badge.
    html += '<div style="background:linear-gradient(135deg,#1E5B47 0%,#2C7757 55%,#5A8A6E 100%);padding:18px 22px;color:#fff;">';
    html += '<div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap;">';
    html += '<div style="display:flex;align-items:center;gap:12px;"><span style="width:38px;height:38px;border-radius:10px;background:rgba(255,255,255,0.18);display:flex;align-items:center;justify-content:center;font-size:18px;">📄</span><div style="font-size:18px;font-weight:800;">HS Code Compliance Analysis</div></div>';
    html += '<span class="aaz-pill" style="background:rgba(255,255,255,0.2);border-color:rgba(255,255,255,0.45);color:#fff;font-weight:700;">+ ' + esc(country) + '</span>';
    html += '</div>';
    html += '<div style="margin-top:12px;font-size:13px;color:#EAF6EF;"><strong style="color:#fff;">HS Code: ' + esc(hs) + '</strong>' + (desc ? '&nbsp; | &nbsp;' + esc(desc) : '') + '</div>';
    html += '</div>';
    // Body area (light) — Export/Import lane toggle (ABOVE the tabs, like admin) +
    // stage tab bar + content + disclaimer.
    html += '<div style="padding:18px 20px;">';
    html += '<div id="pa-cmp-lane"></div>';
    html += '<div id="pa-cmp-tabs" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;">' + cmpTabsInner() + '</div>';
    html += '<div id="pa-cmp-body">' + loadingHTML('Analysing compliance requirements for ' + esc(country) + '…') + '</div>';
    html += '<div style="font-size:11px;color:#8A857B;font-style:italic;margin-top:16px;">This is automated guidance for HS code ' + esc(hs) + ' to ' + esc(country) + '. Always verify with official customs authorities.</div>';
    html += '</div></div>';
    return html;
  }
  async function renderCompliance(hs, country, seq, advisory) {
    cmpCountry = country; cmpData = null; cmpExpanded = {}; cmpBaselinePending = true;
    cmpMacmap = null; cmpMacmapLoading = false; cmpLane = 'importing';
    renderCmpBody(seq);
    var baselinePromise = postJSON(API.trademap + '/api/compliance/analyze', { hsCode: hs, destinationCountry: country, importOrExport: 'Import', exportingCountry: EXPORTING_COUNTRY, forceAI: false }, { timeout: 170000 }).catch(function () { return null; });
    var records = await fetchMacmap(hs, country);
    if (seq !== renderSeq) return;
    // Regulatory tab is ready as soon as MACMAP lands; production/packaging/documents
    // fill in once the slower cache-first baseline resolves.
    cmpData = { production: [], packaging: [], documents: [], regulatory: collectMacmapMeasures(records) };
    // Kick off the SAME rich lane-split analysis the admin box runs, on the records
    // we just fetched. Non-blocking: the Regulatory tab + compliance checklist show
    // immediately; the stage tabs upgrade to official Import/Export requirements when
    // this resolves (cache-first on the backend, so a repeat route is instant).
    if (records && records.length) {
      cmpMacmapLoading = true;
      pollMacmap(hs, country, records, seq).then(function (analysis) {
        if (seq !== renderSeq) return;
        cmpMacmapLoading = false;
        cmpMacmap = macmapHasAny(analysis) ? analysis : null;
        renderCmpBody(seq);
      }).catch(function () { if (seq === renderSeq) { cmpMacmapLoading = false; renderCmpBody(seq); } });
    }
    var tb = document.getElementById('pa-cmp-tabs'); if (tb) tb.innerHTML = cmpTabsInner(); // show "Regulatory Requirements (N)" count
    renderCmpBody(seq);
    var resp = await baselinePromise;
    if (seq !== renderSeq) return;
    cmpBaselinePending = false;
    var data = resp && (resp.openai || resp.anthropic);
    var s = (data && data.sections) || {};
    cmpData.production = normItems(s.production && s.production.items, country);
    cmpData.packaging = normBlocks(s.packaging && s.packaging.blocks, country);
    cmpData.documents = normBlocks(s.documents && s.documents.blocks, country);
    renderCmpBody(seq);
  }

  function renderFallback(p, country) {
    var html = statStrip({ formattedExportValue: p.demand, importingCountries: '50', selectedYear: 2025 }, null, null, resolvedHs, prod.value);
    if (country) {
      var fakeSel = { annualImportValueFormatted: p.demand, perUnitPriceUsd: null, growthPctLatest: parseFloat(p.growth), totalGrowthPct: null };
      html += profilePanel(fakeSel, { found: true, indiaSharePct: parseFloat(p.indianShare), tariffPct: null, unitValueUsd: null }, null, country, null);
      html += playbookPanel(p, country, null);
    }
    html += liveTag(false);
    out.innerHTML = html;
    // Even when live trade data is unavailable, the Need/Want playbook still pulls
    // real modifications from the recommendations endpoint (loader → real, never static).
    if (country) { renderRecommendations(resolvedHs, prod.value, country, renderSeq); renderCompetitors(resolvedHs, renderSeq); }
  }

  async function render() {
    var hs = resolveHs();
    var country = ctry.value.trim();           // destination market is OPTIONAL
    // Only the product / HS code is required — analyse with or without a chosen market.
    if (!hs || hs.length !== 6) {
      out.innerHTML = '<div style="display:flex;align-items:center;gap:10px;padding:26px 4px;color:#5B6B82;font-size:13px;">' +
        '<span style="font-size:16px;">🔎</span>Choose a product / HS code, then click <strong style="color:#1E5B47;">Analyse market</strong>. <span style="color:#8A857B;">(Destination market is optional.)</span></div>';
      return;
    }
    var pkey = productKeyForHs(hs);
    curPkey = pkey;
    // Resolve a CURATED profile ONLY when the destination is genuinely one of the
    // curated markets (uae/uk/us/au/ar). Any other market — Thailand, Germany, Saudi,
    // etc. — gets the product's country-neutral GENERIC advisory with its own FTA line,
    // so it never inherits another country's modifications/certs/margin/FTA.
    var ckey = country ? COUNTRY_KEY[country.toLowerCase()] : null;
    var curated = ckey ? PROFILES[pkey + '|' + ckey] : null;
    var advisory = curated || (function () {
      var g = GENERIC[pkey] || GENERIC.ceramic;
      return { modifications: g.modifications, cert: g.cert, margin: g.margin, competitors: g.competitors, fta: ftaFor(country) };
    })();

    var seq = ++renderSeq;
    var scopeLabel = country ? esc(country) : 'all markets';
    out.innerHTML = '<div style="display:flex;align-items:center;gap:12px;padding:30px 4px;color:#5B6B82;font-size:13px;"><span style="width:16px;height:16px;border:2px solid rgba(30,91,71,0.25);border-top-color:#1E5B47;border-radius:50%;display:inline-block;animation:aazikospin .7s linear infinite;"></span>Querying live trade intelligence for HS ' + esc(hs) + ' → ' + scopeLabel + '…</div><style>@keyframes aazikospin{to{transform:rotate(360deg)}}</style>';
    try {
      // Fast trio (export value, market cards, India share) decide the whole report — draw as soon as they land.
      // India-share is country-specific, so only request it when a market is chosen.
      var results = await Promise.all([
        getJSON(API.trademap + '/api/trademap/total-values/' + hs).catch(function () { return null; }),
        getJSON(API.trademap + '/api/trademap/market-cards/' + hs).catch(function () { return null; }),
        country ? getJSON(API.trademap + '/api/trademap/india-share/' + hs + '?country=' + encodeURIComponent(country)).catch(function () { return null; }) : Promise.resolve(null)
      ]);
      if (seq !== renderSeq) return; // a newer analysis superseded this one
      var total = results[0] && results[0].data ? results[0].data : null;
      var cards = results[1] && results[1].data ? results[1].data : null;
      var share = results[2] && results[2].data ? results[2].data : null;
      if (!total && !cards) { renderFallback(advisory, country); return; }

      var countries = (cards && cards.countries) || [];
      var sel = countries.filter(function (c) { return c.country === country; })[0] || null;
      var label = (total && total.productLabel) ? total.productLabel : prod.value;
      if (label.length > 90) label = label.slice(0, 88) + '…';

      // Section order mirrors the admin module: Market Analysis → Where to Win →
      // Market Profile → Potential Buyers → Action Playbook → HS Code Compliance →
      // Certifications & Compliance → Market Analysis → CTA.
      var html = statStrip(total, cards, 'pending', hs, label);
      html += whereToWin(countries, country);
      if (country) {
        html += profilePanel(sel, share, 'pending', country, cards);
        html += buyersPanelShell(country);
        html += playbookPanel(advisory, country, share);
        html += compliancePanelShell(country, hs, label);
        html += certPanel(advisory, country);
        html += marketAnalysisPanel(advisory, country, total, sel);
        html += ctaPanel(country);
      } else {
        html += '<div class="aaz-card" style="margin-bottom:16px;text-align:center;background:rgba(30,91,71,0.05);border-color:rgba(30,91,71,0.18);">' +
          '<div style="font-size:13px;color:#0F172A;">Showing the global product view. <strong>Pick a destination market</strong> above to add country-specific price, India\'s share, duty, verified buyers, compliance &amp; your action playbook.</div></div>';
      }
      html += liveTag(true);
      out.innerHTML = html;

      // Matched-buyers count is the slow endpoint (~8s) — fetch it after the report is on screen, then patch in.
      getJSON(API.trademap + '/api/trademap/hscode-buyers/' + hs + '?page=1&limit=1', { timeout: 18000 })
        .then(function (r) { return r && r.data && r.data.total != null ? r.data.total : null; })
        .catch(function () { return null; })
        .then(function (t) {
          if (seq !== renderSeq) return;
          var txt = t != null ? Number(t).toLocaleString('en-IN') : '—';
          ['pa-mb', 'pa-br'].forEach(function (id) {
            var el = document.getElementById(id);
            if (el) { el.style.animation = 'none'; el.style.opacity = '1'; el.textContent = txt; }
          });
        });

      // Country-specific admin-parity sections — fire-and-forget, non-blocking,
      // each guarded by `seq` so a newer Analyse supersedes them cleanly.
      if (country) {
        renderBuyers(hs, country, seq);
        renderCompliance(hs, country, seq, advisory);
        renderRecommendations(hs, label, country, seq);   // real Need/Want + Certifications + ROI + Market Analysis
        renderCompetitors(hs, seq);                        // real TOP COMPETING ORIGINS (top-suppliers)
      }
    } catch (e) {
      if (seq === renderSeq) renderFallback(advisory, country);
    }
  }

  // Picking a market from a "Top destination markets" card selects it in the dropdown and re-analyses.
  function selectCountry(cn) {
    if (!cn) return;
    var has = Array.prototype.some.call(ctry.options, function (o) { return o.value === cn; });
    if (!has) {
      // Live API country names (e.g. "Russian Federation") may not be in the curated list — add on the fly.
      var opt = document.createElement('option');
      opt.value = cn;
      opt.textContent = (FLAGS[cn] || '🌐') + '  ' + cn;
      ctry.appendChild(opt);
    }
    ctry.value = cn;
    render();
  }

  btn.addEventListener('click', function () { suggestBox.style.display = 'none'; render(); });
  prod.addEventListener('keydown', function (e) { if (e.key === 'Enter') { suggestBox.style.display = 'none'; render(); } });
  ctry.addEventListener('keydown', function (e) { if (e.key === 'Enter') render(); });
  ctry.addEventListener('change', render);
  // Tab bars are static HTML (built once in the shell) while only the body re-renders,
  // so on a tab switch we must also move the active highlight across the group's buttons.
  function setActiveTab(attr, val) {
    Array.prototype.forEach.call(out.querySelectorAll('[' + attr + ']'), function (b) {
      var on = b.getAttribute(attr) === val;
      b.style.background = on ? 'linear-gradient(135deg,#1E5B47,#5A8A6E)' : 'transparent';
      b.style.color = on ? '#fff' : '#5B6B82';
    });
  }

  // Delegated click on the report (survives re-renders since #pa-output is stable).
  out.addEventListener('click', function (e) {
    if (!e.target.closest) return;
    // 1) Market card → re-analyse that country. Checked FIRST; buyer cards never carry data-country.
    var mkt = e.target.closest('.aaz-card[data-country]');
    if (mkt) { selectCountry(mkt.getAttribute('data-country')); return; }
    // 1b) Section tabs / expanders — re-render only the affected slot, no refetch.
    var wt = e.target.closest('[data-wtw-tab]'); if (wt) { wtwTab = wt.getAttribute('data-wtw-tab'); setActiveTab('data-wtw-tab', wtwTab); renderWtwBody(renderSeq); return; }
    var pt = e.target.closest('[data-pb-tab]'); if (pt) { pbTab = pt.getAttribute('data-pb-tab'); setActiveTab('data-pb-tab', pbTab); renderPbBody(renderSeq); return; }
    var cmt = e.target.closest('[data-cmp-tab]'); if (cmt) { cmpTab = cmt.getAttribute('data-cmp-tab'); var ctb = document.getElementById('pa-cmp-tabs'); if (ctb) ctb.innerHTML = cmpTabsInner(); renderCmpBody(renderSeq); return; }
    var cml = e.target.closest('[data-cmp-lane]'); if (cml) { cmpLane = cml.getAttribute('data-cmp-lane'); renderCmpBody(renderSeq); return; }
    var ci = e.target.closest('[data-cmp-item]'); if (ci) { var k = ci.getAttribute('data-cmp-item'); cmpExpanded[k] = !cmpExpanded[k]; renderCmpBody(renderSeq); return; }
    // 2) Close the buyer detail panel.
    if (e.target.closest('#pa-buyer-close')) { openBuyerIdx = -1; renderBuyersBody(renderSeq); return; }
    // 3) Reveal all fetched buyers (no extra fetch).
    if (e.target.closest('#pa-buyers-more')) { buyersExpanded = true; renderBuyersBody(renderSeq); return; }
    // 4) Buyer card → toggle its inline detail panel.
    var bc = e.target.closest('.aaz-card[data-buyer-idx]');
    if (bc) { var idx = parseInt(bc.getAttribute('data-buyer-idx'), 10); openBuyerIdx = (openBuyerIdx === idx ? -1 : idx); renderBuyersBody(renderSeq); return; }
  });
  // Self-playing cinematic demo (shared engine: ./_demotour.js). When the visitor
  // reaches the demo — by scrolling to it, or via the floating "Live demonstration"
  // button — the page dims, the input bar lifts into a spotlight, and three narrated
  // steps play: the HS code types in, the market dropdown opens and picks Australia,
  // and Analyse is pressed. Everything returns to normal the moment the report
  // renders; clicking the dim (or "Skip demo") fast-forwards to the finished result.
  (function autoPlayDemo() {
    var d = CATALOG[0]; // Ceramic tiles & paving (HS 690721)
    var bar = document.querySelector('#demo .aaz-searchbar');
    if (!d || !bar) return;
    var ran = false;
    var seed = function () {
      prod.value = d.label;
      resolvedHs = d.hs;
      if (ctry && ctry.tagName === 'SELECT') ctry.value = 'Australia';
    };
    runDemoTour({
      bar: bar,
      output: out,
      resultReady: function () { return !!out.querySelector('.aaz-statval, .aaz-panel, .aaz-card'); },
      userStarted: function () { return !!prod.value.trim(); },
      skip: function () { seed(); if (!ran) { ran = true; render(); } },
      script: async function (t) {
        t.caption(1, 3, 'Watch — typing a real product / HS code…');
        await t.type(prod, d.label);
        resolvedHs = d.hs;
        t.caption(2, 3, 'Choosing the destination market…');
        await t.pick(ctry, [
          { f: '🇺🇸', n: 'United States' }, { f: '🇦🇪', n: 'United Arab Emirates' },
          { f: '🇬🇧', n: 'United Kingdom' }, { f: '🇦🇺', n: 'Australia', pick: true },
          { f: '🇩🇪', n: 'Germany' }, { f: '🇯🇵', n: 'Japan' }
        ], function () { ctry.value = 'Australia'; });
        t.caption(3, 3, 'Analysing live trade data for this market…');
        ran = true;
        t.press(btn); // real click → render() via the button's own handler
        await t.result();
      },
    });
  })();

}
