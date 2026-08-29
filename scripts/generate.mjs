// Generates the Next.js routes from the original static HTML pages.
// Each page's <body> markup is kept verbatim (only internal .html links are rewritten
// to Next routes); each page's <script> is wrapped into an exported init() and run
// client-side via useEffect. Re-runnable: regenerates app/content + per-route page.js.

import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT = join(__dirname, '..');
const SRC = join(PROJECT, '..', 'site'); // original static site
const APP = join(PROJECT, 'app');
const CONTENT = join(APP, 'content');

// src file -> { route (URL path segment; '' = home), slug (content filename) }
const PAGES = [
  { src: 'index.html', route: '', slug: 'home' },
  { src: 'marketplace.html', route: 'marketplace', slug: 'marketplace' },
  { src: 'product-analysis.html', route: 'product-analysis', slug: 'product-analysis' },
  { src: 'port-brain.html', route: 'port-brain', slug: 'port-brain' },
  { src: 'logistics.html', route: 'logistics', slug: 'logistics' },
  { src: 'customs.html', route: 'customs', slug: 'customs' },
  { src: 'trade-agreements.html', route: 'trade-agreements', slug: 'trade-agreements' },
  { src: 'inspection.html', route: 'inspection', slug: 'inspection' },
  { src: 'finance.html', route: 'finance', slug: 'finance' },
  { src: 'order-assurance.html', route: 'order-assurance', slug: 'order-assurance' },
  { src: 'vision.html', route: 'vision', slug: 'vision' },
  { src: 'partnership.html', route: 'partnership', slug: 'partnership' },
];

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function extractTitle(html) {
  const m = html.match(/<title>([\s\S]*?)<\/title>/i);
  return m ? decodeEntities(m[1].trim()) : 'Aaziko';
}

function extractDescription(html) {
  const m = html.match(/<meta\s+name=["']description["']\s+content=["']([\s\S]*?)["']\s*\/?>/i);
  return m ? decodeEntities(m[1].trim()) : '';
}

// Any <style> blocks that lived in <head> (e.g. port-brain.html) — re-injected with the body.
function extractHeadStyles(html) {
  const head = html.match(/<head[\s\S]*?<\/head>/i);
  const scope = head ? head[0] : '';
  const blocks = scope.match(/<style[\s\S]*?<\/style>/gi) || [];
  return blocks.join('\n');
}

// Returns { bodyInner, scriptInner } — bodyInner has the trailing <script> removed.
function splitBody(html) {
  const bodyOpen = html.search(/<body[^>]*>/i);
  const bodyStart = html.indexOf('>', bodyOpen) + 1;
  const bodyEnd = html.lastIndexOf('</body>');
  let body = html.slice(bodyStart, bodyEnd);

  let scriptInner = '';
  const scriptStart = body.search(/<script[\s>]/i);
  if (scriptStart !== -1) {
    const openEnd = body.indexOf('>', scriptStart) + 1;
    const closeStart = body.lastIndexOf('</script>');
    scriptInner = body.slice(openEnd, closeStart);
    const closeEnd = closeStart + '</script>'.length;
    body = body.slice(0, scriptStart) + body.slice(closeEnd);
  }
  return { bodyInner: body.trim(), scriptInner };
}

// index.html -> "/", name.html -> "/name/", preserving #hash.
function rewriteLinks(html) {
  return html.replace(/href="([a-z0-9-]+)\.html(#[^"]*)?"/gi, (_m, page, hash) => {
    const h = hash || '';
    if (page === 'index') return `href="/${h}"`;
    return `href="/${page}/${h}"`;
  });
}

// --- generate -------------------------------------------------------------
rmSync(CONTENT, { recursive: true, force: true });
mkdirSync(CONTENT, { recursive: true });

const summary = [];

for (const page of PAGES) {
  const raw = readFileSync(join(SRC, page.src), 'utf8');
  const title = extractTitle(raw);
  const description = extractDescription(raw);
  const headStyles = extractHeadStyles(raw);
  const { bodyInner, scriptInner } = splitBody(raw);

  let body = rewriteLinks(bodyInner);
  if (headStyles) body = `${headStyles}\n${body}`;

  // 1) body fragment (verbatim, raw asset)
  writeFileSync(join(CONTENT, `${page.slug}.body.html`), body, 'utf8');

  // 2) script module exporting init() — rewrite any links the script builds at runtime too
  const script = rewriteLinks(scriptInner);
  const scriptModule = `'use client';\n// Original inline <script> from ${page.src}, kept verbatim inside init() (only .html links rewritten).\nexport function init() {\n${script}\n}\n`;
  writeFileSync(join(CONTENT, `${page.slug}.script.js`), scriptModule, 'utf8');

  // 3) route page.js (server component: metadata + render)
  const routeDir = page.route ? join(APP, page.route) : APP;
  if (page.route) mkdirSync(routeDir, { recursive: true });
  const pageModule =
    `import StaticHtmlPage from '@/app/StaticHtmlPage';\n` +
    `import html from '@/app/content/${page.slug}.body.html';\n\n` +
    `export const metadata = {\n` +
    `  title: ${JSON.stringify(title)},\n` +
    `  description: ${JSON.stringify(description)},\n` +
    `};\n\n` +
    `export default function Page() {\n` +
    `  return <StaticHtmlPage html={html} slug="${page.slug}" />;\n` +
    `}\n`;
  writeFileSync(join(routeDir, 'page.js'), pageModule, 'utf8');

  summary.push(`  /${page.route || ''}  <-  ${page.src}  (${body.length} B body, ${scriptInner.length} B script)`);
}

console.log('Generated routes:\n' + summary.join('\n'));
console.log(`\n${PAGES.length} pages generated.`);
