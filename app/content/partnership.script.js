'use client';
// Original inline <script> from partnership.html, kept verbatim inside init() (only .html links rewritten).
export function init() {

document.body.classList.add('js-ready');
window.AAZIKO_API = window.AAZIKO_API || { livePulse: null };
var liveValues = { matches: 247, orders: 56, value: 1.4, shipments: 312 };
function fmtLiveValue(el, val) {
  var d = parseInt(el.dataset.decimal || '0', 10);
  el.textContent = (el.dataset.prefix || '') + (d ? val.toFixed(d) : Math.round(val)) + (el.dataset.suffix || '');
}
function simulateLiveData() {
  liveValues.matches += Math.floor(Math.random() * 3);
  liveValues.orders += Math.random() < 0.4 ? 1 : 0;
  liveValues.value += Math.random() * 0.02;
  liveValues.shipments += Math.floor(Math.random() * 2);
  fmtLiveValue(document.getElementById('live-matches'), liveValues.matches);
  fmtLiveValue(document.getElementById('live-orders'), liveValues.orders);
  fmtLiveValue(document.getElementById('live-value'), liveValues.value);
  fmtLiveValue(document.getElementById('live-shipments'), liveValues.shipments);
  var ts = document.getElementById('live-timestamp');
  if (ts) ts.textContent = 'Updated ' + new Date().toLocaleTimeString('en-IN', {hour: '2-digit', minute: '2-digit', second: '2-digit'});
}
function pollLiveData() {
  if (window.AAZIKO_API.livePulse) {
    fetch(window.AAZIKO_API.livePulse).then(function(r){ return r.json(); }).then(function(d){
      liveValues = { matches: d.matches_today, orders: d.orders_today, value: d.trade_value_usd_today / 1e6, shipments: d.shipments_cleared_today };
      simulateLiveData();
    }).catch(simulateLiveData);
  } else simulateLiveData();
}
var monitorEl = document.querySelector('.live-monitor');
if (monitorEl) {
  var mio = new IntersectionObserver(function(es){
    es.forEach(function(e){ if (e.isIntersecting) { pollLiveData(); setInterval(pollLiveData, 4000); mio.disconnect(); } });
  }, { threshold: 0.3 });
  mio.observe(monitorEl);
}

}
