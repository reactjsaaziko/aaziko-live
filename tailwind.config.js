/** @type {import('tailwindcss').Config} */
// Scoped Tailwind for the ported buyer "Logistic Cost" popup only.
// preflight + container are disabled so Tailwind does NOT reset or override the
// existing marketing-site CSS (which defines its own `.container` and base styles).
module.exports = {
  content: ['./app/components/**/*.{js,jsx,ts,tsx}', './app/**/*.{js,jsx,ts,tsx}'],
  corePlugins: {
    preflight: false,
    container: false,
  },
  theme: { extend: {} },
  plugins: [],
};
