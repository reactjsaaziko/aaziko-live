'use client';
// Original inline <script> from finance.html, kept verbatim inside init() (only .html links rewritten).
export function init() {

  var v = document.getElementById('fin-value');
  var t = document.getElementById('fin-terms');
  var s = document.getElementById('fin-size');
  var btn = document.getElementById('fin-calc');
  var out = document.getElementById('fin-output');

  function fmt(n) { return '$' + n.toLocaleString('en-US', {maximumFractionDigits: 0}); }

  function calc() {
    var value = parseInt(v.value, 10);
    var days = parseInt(t.value, 10);
    var isMsme = s.value === 'msme';

    var advancePct = 0.90;
    var advance = value * advancePct;
    var baseRate = 9.5;                      /* indicative factoring rate p.a. */
    var subvention = isMsme ? 2.75 : 0;      /* Niryat Protsahan */
    var effRate = baseRate - subvention;
    var finCost = value * (effRate / 100) * (days / 365);
    var insurance = value * 0.004;           /* indicative ECGC-backed premium */
    var net = value - finCost - insurance;

    var html = '';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:18px;">';
    html += '<div style="font-size:14px;"><strong style="color:var(--ink);">' + fmt(value) + ' order</strong> · buyer pays ' + days + ' days after delivery</div>';
    html += '<div><span class="demo-pill">ECGC insured</span><span class="demo-pill">CGSE eligible</span>' + (isMsme ? '<span class="demo-pill">Niryat Protsahan −2.75%</span>' : '') + '</div></div>';

    /* Without Aaziko */
    html += '<div style="border:1px solid #E8E1D3;border-radius:6px;padding:16px 18px;margin-bottom:10px;background:#FFF;">';
    html += '<div style="font-weight:700;font-size:13px;color:var(--mute);letter-spacing:0.06em;">WITHOUT AAZIKO</div>';
    html += '<div style="display:flex;gap:24px;flex-wrap:wrap;margin-top:10px;font-size:13.5px;">';
    html += '<div>💸 Cash received at shipment: <strong style="color:#B0432D;">$0</strong></div>';
    html += '<div>⏳ Full payment after: <strong style="color:#B0432D;">' + days + ' days + delivery time</strong></div>';
    html += '<div>🛡️ Buyer default protection: <strong style="color:#B0432D;">None</strong></div>';
    html += '</div><div style="font-size:12.5px;color:var(--mute);margin-top:8px;">Result: most MSMEs decline the order — or borrow informally at 18–24% p.a.</div></div>';

    /* With Aaziko */
    html += '<div style="border:1.5px solid var(--emerald);border-radius:6px;padding:16px 18px;background:#F2F8F4;">';
    html += '<div style="font-weight:700;font-size:13px;color:var(--emerald);letter-spacing:0.06em;">WITH AAZIKO EXPORT FINANCE</div>';
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px;margin-top:12px;">';
    html += '<div><div style="font-size:11px;color:var(--mute);letter-spacing:0.05em;">PAID AT SHIPMENT (90%)</div><div style="font-family:Georgia,serif;font-size:24px;color:var(--emerald);font-weight:700;">' + fmt(advance) + '</div></div>';
    html += '<div><div style="font-size:11px;color:var(--mute);letter-spacing:0.05em;">EFFECTIVE FINANCE RATE</div><div style="font-family:Georgia,serif;font-size:24px;color:var(--emerald);font-weight:700;">' + effRate.toFixed(2) + '% p.a.</div>' + (isMsme ? '<div style="font-size:11px;color:var(--mute);">9.50% − 2.75% subvention</div>' : '') + '</div>';
    html += '<div><div style="font-size:11px;color:var(--mute);letter-spacing:0.05em;">FINANCE COST (' + days + ' DAYS)</div><div style="font-family:Georgia,serif;font-size:24px;color:var(--ink);font-weight:700;">' + fmt(finCost) + '</div></div>';
    html += '<div><div style="font-size:11px;color:var(--mute);letter-spacing:0.05em;">CREDIT INSURANCE</div><div style="font-family:Georgia,serif;font-size:24px;color:var(--ink);font-weight:700;">' + fmt(insurance) + '</div><div style="font-size:11px;color:var(--mute);">ECGC-backed, buyer default covered</div></div>';
    html += '<div><div style="font-size:11px;color:var(--mute);letter-spacing:0.05em;">NET TO MAKER (TOTAL)</div><div style="font-family:Georgia,serif;font-size:24px;color:var(--emerald);font-weight:700;">' + fmt(net) + '</div><div style="font-size:11px;color:var(--mute);">' + ((net/value)*100).toFixed(1) + '% of order value</div></div>';
    html += '</div>';
    html += '<div style="font-size:12.5px;color:var(--ink);margin-top:12px;">✅ Collateral required: <strong>none</strong> (CGSE guarantee) · ✅ Balance 10% releases on buyer payment · ✅ If the buyer defaults, insurance pays — the maker is whole.</div>';
    html += '</div>';

    out.innerHTML = html;
  }

  btn.addEventListener('click', calc);
  calc();

}
