'use client';

/**
 * Progressive enhancement for the interactive "Live demonstration" form fields that
 * every module page ships — the section the floating demo button jumps to. It gives
 * each field a consistent cue as the visitor fills it in:
 *
 *   • focus  → animated emerald glow ring   — handled purely in CSS (:focus /
 *              :focus-within), so it is robust even for the logistics calculator's
 *              React-mounted inputs, which re-render and would drop a JS-added class.
 *   • edit   → a one-shot saffron flash (.demo-field--flash) + a persistent "filled"
 *              emerald cue (.demo-field--filled) — added here on input/change.
 *
 * One code path for every route: fields are located inside the known demo-section
 * roots (#demo / #lmkt / #cost) and tagged with .demo-field so the CSS has a stable
 * hook and smooth transitions. Interaction is handled through delegated listeners on
 * each root, so any field a page adds later is covered too. Idempotent, and a no-op
 * where no demo exists.
 */
export function enhanceDemoFields() {
  if (typeof document === 'undefined') return;

  const roots = ['#demo', '#lmkt', '#cost']
    .map((sel) => document.querySelector(sel))
    .filter(Boolean);
  if (!roots.length) return;

  const FIELD_SEL = 'input, select, textarea';
  const isField = (el) => el && el.matches && el.matches(FIELD_SEL);

  const hasValue = (el) => {
    if (!el) return false;
    if (el.tagName === 'SELECT') return el.value !== '' && el.selectedIndex > 0;
    if (el.type === 'checkbox' || el.type === 'radio') return el.checked;
    return String(el.value || '').trim() !== '';
  };

  // Saffron flash on every edit; the transition (see .demo-field in CSS) makes it a
  // smooth pulse. While typing, each keystroke resets the timer so the field stays
  // lit, then settles ~0.45s after the last change.
  const flash = (el) => {
    el.classList.add('demo-field--flash');
    window.clearTimeout(el._demoFlashTimer);
    el._demoFlashTimer = window.setTimeout(() => el.classList.remove('demo-field--flash'), 450);
  };

  roots.forEach((root) => {
    if (root.dataset.demoFieldsEnhanced) return; // idempotent
    root.dataset.demoFieldsEnhanced = '1';

    // Give every field the shared base hook up front (invisible on its own; just sets
    // up the transition used by the flash/filled cues).
    root.querySelectorAll(FIELD_SEL).forEach((el) => el.classList.add('demo-field'));

    const onEdit = (e) => {
      const el = e.target;
      if (!isField(el)) return;
      el.classList.add('demo-field');
      el.classList.toggle('demo-field--filled', hasValue(el));
      flash(el);
    };
    root.addEventListener('input', onEdit);
    root.addEventListener('change', onEdit);
  });
}
