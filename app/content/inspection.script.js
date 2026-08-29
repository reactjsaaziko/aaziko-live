'use client';
import { runDemoTour } from './_demotour.js';
// Original inline <script> from inspection.html, kept verbatim inside init() (only .html links rewritten).
export function init() {

  /* Order monitoring timelines by order type */
  var ORDERS = {
    tiles: {
      title: '12,000 sqm vitrified tiles', maker: 'Spectrum Vitrified Pvt Ltd · Morbi, Gujarat', dest: 'Dubai, UAE',
      stages: [
        { icon: '📦', name: 'Raw material verified', media: '4 photos · 1 video', note: 'Clay & feldspar batch logged; shade reference approved against contract sample.' },
        { icon: '🏭', name: 'Production started', media: '6 photos · 2 videos', note: 'Pressing & glazing line running. Kiln temperature log shared daily.' },
        { icon: '🔍', name: 'Mid-production check', media: '8 photos · 1 video', note: 'Dimensional check on 120-piece sample: 600×600±0.5mm. Shade batch consistent.' },
        { icon: '✨', name: 'Finishing & sorting', media: '5 photos · 1 video', note: 'Premium grade sorted; 1.8% factory rejects removed before packing.' },
        { icon: '📋', name: 'Third-party inspection (AQL 2.5)', media: 'Full report + 22 photos', note: 'PASSED — 315 pcs sampled across 12 pallets; 0 critical, 2 minor defects. Report sent to buyer.' },
        { icon: '🚢', name: 'Packed & sealed for shipment', media: '6 photos · container video', note: 'Container ABCU-203117-4 sealed on camera. Evidence pack archived to order record.' }
      ]
    },
    garments: {
      title: '8,000 pc knitted T-shirts', maker: 'Velan Knits · Tirupur, Tamil Nadu', dest: 'London, UK',
      stages: [
        { icon: '🧶', name: 'Yarn & fabric verified', media: '5 photos · lab dip', note: '100% combed cotton 180 GSM confirmed; lab-dip shade approved by buyer in-app.' },
        { icon: '✂️', name: 'Cutting started', media: '4 photos · 1 video', note: 'Pattern efficiency 87%; size ratio per contract (S–XXL).' },
        { icon: '🪡', name: 'Stitching in progress', media: '7 photos · 2 videos', note: 'Inline QC: stitch density 12 SPI verified on 200-pc sample.' },
        { icon: '🧺', name: 'Washing & finishing', media: '4 photos', note: 'Shrinkage test: 3.1% (within 5% tolerance). GSM re-verified after wash.' },
        { icon: '📋', name: 'Third-party inspection (AQL 2.5)', media: 'Full report + 18 photos', note: 'PASSED — measurement spec, print durability and packing audit complete. Report with buyer.' },
        { icon: '✈️', name: 'Cartons sealed for dispatch', media: '5 photos', note: '334 cartons, barcode-labelled per buyer warehouse spec. Evidence archived.' }
      ]
    },
    brass: {
      title: '2,400 pc brass cabinet hardware', maker: 'Shree Hari Brass · Moradabad, UP', dest: 'Sydney, Australia',
      stages: [
        { icon: '🔥', name: 'Casting batch verified', media: '4 photos · 1 video', note: 'Brass alloy composition certificate logged (61% Cu).' },
        { icon: '⚙️', name: 'Machining & threading', media: '5 photos', note: 'Thread gauge check on 80-pc sample: 100% pass.' },
        { icon: '✨', name: 'Polishing & lacquer', media: '6 photos · 1 video', note: 'Salt-spray test 48h on finish sample: no tarnish.' },
        { icon: '🧪', name: 'Mid-production check', media: '4 photos', note: 'Weight tolerance ±2% verified; finish matched to approved sample.' },
        { icon: '📋', name: 'Third-party inspection (AQL 2.5)', media: 'Full report + 15 photos', note: 'PASSED — 200 pcs sampled; 0 critical defects. Report sent to buyer.' },
        { icon: '📦', name: 'Export packing complete', media: '4 photos', note: 'Individually boxed, 50/master carton, moisture absorbers added for sea freight.' }
      ]
    },
    pumps: {
      title: '160 units 5HP submersible pumps', maker: 'Jaldhara Pumps · Rajkot, Gujarat', dest: 'Lagos, Nigeria',
      stages: [
        { icon: '🔩', name: 'Components verified', media: '6 photos', note: 'SS-304 impellers and copper winding wire batch-certified.' },
        { icon: '🏭', name: 'Assembly line running', media: '5 photos · 2 videos', note: 'Stator winding resistance logged per unit.' },
        { icon: '⚡', name: 'Performance testing', media: '3 videos', note: 'Every unit run-tested: head, discharge and current draw recorded on camera.' },
        { icon: '🔍', name: 'Mid-production check', media: '4 photos', note: '20-unit sample re-tested by Aaziko field engineer; all within rated curve.' },
        { icon: '📋', name: 'Third-party inspection', media: 'Full report + 20 photos', note: 'PASSED — witnessed performance test of 13-unit sample; nameplate & IEC marking verified.' },
        { icon: '🚢', name: 'Crated for shipment', media: '5 photos', note: 'Palletised wooden crates, ISPM-15 stamped. Evidence pack archived.' }
      ]
    }
  };

  var sel = document.getElementById('insp-order');
  var btn = document.getElementById('insp-advance');
  var out = document.getElementById('insp-output');
  var progress = 1; /* stages revealed */

  function render() {
    var o = ORDERS[sel.value];
    var html = '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:18px;">';
    html += '<div style="font-size:14px;"><strong style="color:var(--ink);">' + o.title + '</strong> · ' + o.maker + ' → ' + o.dest + '</div>';
    html += '<div><span class="demo-pill">Evidence-backed</span><span class="demo-pill">ZED aligned</span><span class="demo-pill">AQL inspected</span></div></div>';

    o.stages.forEach(function(s, i) {
      var done = i < progress;
      var current = i === progress - 1;
      html += '<div style="display:flex;gap:14px;align-items:flex-start;padding:13px 14px;border:1px solid ' + (done ? 'var(--emerald)' : '#E8E1D3') + ';border-radius:6px;margin-bottom:8px;background:' + (done ? '#F2F8F4' : '#FFFFFF') + ';opacity:' + (done ? '1' : '0.55') + ';">';
      html += '<div style="font-size:22px;line-height:1;">' + (done ? s.icon : '🔒') + '</div>';
      html += '<div style="flex:1;">';
      html += '<div style="font-weight:700;font-size:13.5px;color:var(--ink);">' + (i + 1) + '. ' + s.name + (current ? ' <span class="demo-pill" style="margin-left:8px;">JUST UPDATED</span>' : '') + '</div>';
      if (done) {
        html += '<div style="font-size:12px;color:var(--emerald);font-weight:600;margin-top:3px;">📷 ' + s.media + ' uploaded to your dashboard</div>';
        html += '<div style="font-size:12.5px;color:var(--mute);margin-top:3px;">' + s.note + '</div>';
      } else {
        html += '<div style="font-size:12px;color:var(--mute);margin-top:3px;">Pending — unlocks as production advances</div>';
      }
      html += '</div></div>';
    });

    if (progress >= o.stages.length) {
      html += '<div style="margin-top:14px;padding:16px 18px;background:var(--emerald);color:#FFFFFF;border-radius:6px;font-size:14px;"><strong>Inspection passed · evidence complete.</strong> The full photo/video record and AQL report are archived to this order. Payment now releases through <a href="/order-assurance/" style="color:#C8E6D5;text-decoration:underline;">Order Assurance →</a></div>';
      btn.textContent = 'Restart demo ↺';
    } else {
      btn.textContent = 'Advance production →';
    }
    out.innerHTML = html;
  }

  btn.addEventListener('click', function() {
    var o = ORDERS[sel.value];
    progress = progress >= o.stages.length ? 1 : progress + 1;
    render();
  });
  sel.addEventListener('change', function() { progress = 1; render(); });
  render();

  /* Self-playing cinematic demo (shared engine): the page dims, the order row lifts
     into a spotlight, an order is picked from a live dropdown, and "Advance
     production" is pressed three times — the buyer-dashboard timeline unlocks stage
     by stage, then the page returns to normal. */
  (function autoPlayDemo() {
    var bar = document.querySelector('#demo .demo-input');
    if (!bar) return;
    runDemoTour({
      bar: bar,
      delay: 600,
      threshold: 0.5,
      output: out,
      userStarted: function () { return false; },
      skip: function () {
        sel.value = 'garments';
        progress = 3;
        render();
      },
      script: async function (t) {
        t.caption(1, 2, 'Watch — picking a live order to follow…');
        await t.pick(sel, [
          { f: '🧱', n: 'Vitrified tiles · Morbi → Dubai' },
          { f: '👕', n: 'Knitted T-shirts · Tirupur → London', pick: true },
          { f: '🔩', n: 'Brass hardware · Moradabad → Sydney' },
          { f: '⚙️', n: 'Submersible pumps · Rajkot → Lagos' }
        ], function () {
          sel.value = 'garments';
          sel.dispatchEvent(new Event('change', { bubbles: true })); // progress=1 + render
        });
        t.caption(2, 2, 'Advancing production — the buyer sees every stage…');
        await t.wait(700);
        t.press(btn);          // real clicks: stage 2…
        await t.wait(1100);
        t.press(btn);          // …stage 3…
        await t.wait(1100);
        t.press(btn);          // …stage 4
        await t.wait(1000);
      },
    });
  })();
}
