/** @type {import('next').NextConfig} */
// Optional sub-path the site is hosted under (e.g. "/live" for aaziko.com/live/).
// Empty by default so local dev and root-hosting are unchanged; set at build time:
//   AAZIKO_BASE_PATH=/live npm run build
const basePath = (process.env.AAZIKO_BASE_PATH || '').replace(/\/$/, '');

const nextConfig = {
  // Static export -> ./out, deployable to any static host (same as the original site).
  output: 'export',
  // When set, Next prefixes its router links and /_next assets with this path.
  ...(basePath ? { basePath } : {}),
  // Each route becomes /route/index.html so plain <a href="/route/"> links resolve on static hosts.
  trailingSlash: true,
  images: { unoptimized: true },
  // The ported pages run the original imperative DOM scripts once via useEffect; a guard
  // already prevents double-init, and disabling StrictMode keeps dev behaviour identical to prod.
  reactStrictMode: false,
  webpack: (config) => {
    // Import the original page bodies (*.body.html) as raw strings, kept byte-for-byte.
    config.module.rules.push({ test: /\.body\.html$/, type: 'asset/source' });
    return config;
  },
};

module.exports = nextConfig;
