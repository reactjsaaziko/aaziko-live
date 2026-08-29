'use client';
// Aaziko Trade Execution System home — behaviour ported verbatim from the
// reference page's <script>. Runs once (StaticHtmlPage), all DOM lookups are
// by unique id/class inside #ates-home.
import { initIndiaMap } from './_indiamap.js';
import { initLiveMarket } from './_livemarket.js';

export function init() {
(function(){
  "use strict";

  /* hero dots — 2 in 1000 feeling, small sample */
  var ud=document.querySelector('.updots');
  if(ud){var h='';for(var i=0;i<40;i++){h+='<i'+(i===7?' class="on"':'')+'></i>';}ud.innerHTML=h;}

  /* ② the gap — India dot-map (must run before the $2T early-return below) */
  initIndiaMap();

  /* ⑥ how a buyer buys — live marketplace search (never animation-gated) */
  initLiveMarket();

  /* $2T model */
  var BASE=78300000, BASELINE=863.1, TARGET=2000, FX=88;
  var rate=document.getElementById('rate'), val=document.getElementById('val');
  if(!rate||!val) return;
  var rateOut=document.getElementById('rateOut'), valOut=document.getElementById('valOut'),
      oExp=document.getElementById('oExp'), oAdd=document.getElementById('oAdd'),
      oTot=document.getElementById('oTot'), oGap=document.getElementById('oGap'), fill=document.getElementById('fill');
  function count(n){
    if(n>=10000000) return (n/10000000).toFixed(2).replace(/\.?0+$/,'')+' crore';
    if(n>=100000)  return (n/100000).toFixed(2).replace(/\.?0+$/,'')+' lakh';
    return Math.round(n).toLocaleString('en-IN');
  }
  function rup(l){ return l>=100 ? '₹'+(l/100).toFixed(2).replace(/\.?0+$/,'')+' crore' : '₹'+l+' lakh'; }
  function usd(b){ return b>=1000 ? '$'+(b/1000).toFixed(2)+' T' : '$'+Math.round(b)+' B'; }
  function go(){
    var pct=+rate.value, per=+val.value;
    var makers=BASE*(pct/100);
    var added=(makers*per*100000)/FX/1e9;
    var gap=(added/(TARGET-BASELINE))*100;
    rateOut.textContent=pct+'%'; valOut.textContent=rup(per);
    oExp.textContent=count(makers); oAdd.textContent=usd(added);
    oTot.textContent=usd(BASELINE+added); oGap.textContent=(gap>=100?'100':Math.round(gap))+'%';
    fill.style.width=Math.min(100,gap)+'%';
  }
  rate.addEventListener('input',go); val.addEventListener('input',go); go();

  var reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var items=document.querySelectorAll('.rv');
  if(reduce||!('IntersectionObserver' in window)){ for(var k=0;k<items.length;k++) items[k].classList.add('in'); }
  else{ var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target);}});},{rootMargin:'0px 0px -8% 0px',threshold:.06});
    for(var j=0;j<items.length;j++) io.observe(items[j]); }
})();
}
