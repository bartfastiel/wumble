#!/usr/bin/env node
// Builds a single file dist/wumble.html from dist/ (scripts, stylesheets, favicon and samples embedded) – for
// double-click use without a server. No dependencies, runs after `vite build`.
//
//   node tools/single-file.mjs [dist] [dist/wumble.html]
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, relative, resolve, extname } from 'node:path';

const dist = resolve(process.argv[2] ?? 'dist');
const out = resolve(process.argv[3] ?? join(dist, 'wumble.html'));
const index = join(dist, 'index.html');
if (!existsSync(index)) {
  console.error(`${index} missing – run \`npm run build\` first`);
  process.exit(2);
}

const asset = (href) => readFileSync(join(dist, href.replace(/^\.?\//, '')), 'utf8');
const attr = (tag, name) => tag.match(new RegExp(` ${name}="([^"]*)"`))?.[1];
const MIME = { '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.mp3': 'audio/mpeg' };
const dataUrl = (file) =>
  `data:${MIME[extname(file)] ?? 'application/octet-stream'};base64,${readFileSync(file).toString('base64')}`;

// The samples (public/samples → dist/samples) as data URLs keyed by their manifest path; the sample store reads the
// map from window.__WUMBLE_SAMPLES__ instead of fetching. Base64 contains no `<`, so the script stays intact.
const samplesDir = join(dist, 'samples');
const samples = {};
if (existsSync(samplesDir)) {
  for (const entry of readdirSync(samplesDir, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || extname(entry.name) !== '.mp3') continue;
    const file = join(entry.parentPath, entry.name);
    samples[relative(samplesDir, file).replaceAll('\\', '/')] = dataUrl(file);
  }
}
const samplesScript = `<script>window.__WUMBLE_SAMPLES__ = ${JSON.stringify(samples)};</script>\n`;

let html = readFileSync(index, 'utf8');
html = html.replace(
  /<script\b[^>]*\bsrc="([^"]+)"[^>]*><\/script>/g,
  (tag, src) => `${samplesScript}<script type="module">\n${asset(src).replace(/<\/script/g, '<\\/script')}\n</script>`,
);
html = html.replace(/<link\b[^>]*>/g, (tag) => {
  const rel = attr(tag, 'rel');
  const href = attr(tag, 'href');
  if (!href) return tag;
  if (rel === 'stylesheet') return `<style>\n${asset(href)}\n</style>`;
  if (rel === 'modulepreload') return '';
  if (rel === 'icon') return tag.replace(href, dataUrl(join(dist, href.replace(/^\.?\//, ''))));
  return tag;
});
if (/\b(src|href)="\.?\/?assets\//.test(html)) {
  console.error('References to assets/ left unembedded');
  process.exit(1);
}
if (!html.includes('__WUMBLE_SAMPLES__')) {
  console.error('No module script found to embed the samples before');
  process.exit(1);
}

writeFileSync(out, html);
console.log(
  `${out}: ${(Buffer.byteLength(html) / 1024).toFixed(1)} kB, ${Object.keys(samples).length} samples embedded`,
);
