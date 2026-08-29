'use client';
// Original inline <script> from vision.html, kept verbatim inside init() (only .html links rewritten).
export function init() {

document.body.classList.add('js-ready');
var io = new IntersectionObserver(function(es){
  es.forEach(function(e){
    if (!e.isIntersecting) return;
    var items = document.querySelectorAll('#vision-chain > *');
    items.forEach(function(el, i){ setTimeout(function(){ el.classList.add('on'); }, i * 420); });
    io.disconnect();
  });
}, { threshold: 0.2 });
io.observe(document.getElementById('vision-chain'));

}
