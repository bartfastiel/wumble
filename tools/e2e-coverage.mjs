#!/usr/bin/env node
// Turns the raw V8 coverage of the Playwright tests (coverage/e2e-raw/*.json, written by e2e/fixtures.ts) into one
// lcov report: every bundle entry (dist/assets/*.js) is mapped back to src/ with the source map of the e2e build,
// converted per test and merged – V8 ranges nest and must not be merged before the conversion. Only src/ files count.
//
//   node tools/e2e-coverage.mjs [coverage/e2e-raw] [coverage/e2e]
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import libCoverage from 'istanbul-lib-coverage';
import libReport from 'istanbul-lib-report';
import reports from 'istanbul-reports';
import v8ToIstanbul from 'v8-to-istanbul';

const rawDir = resolve(process.argv[2] ?? 'coverage/e2e-raw');
const outDir = resolve(process.argv[3] ?? 'coverage/e2e');
const dist = resolve('dist');
const src = resolve('src');

if (!existsSync(rawDir)) {
  console.error(`${rawDir} missing – run \`npm run e2e\` first`);
  process.exit(2);
}

// http://127.0.0.1:4173/assets/index-abc123.js → dist/assets/index-abc123.js, or null for everything else
const bundleFile = (url) => {
  const match = /\/assets\/([^/?#]+\.js)$/.exec(url);
  return match === null ? null : join(dist, 'assets', match[1]);
};

const bundles = new Map();
const originalLines = new Map(); // absolute source path → its lines, from the source map
const bundleOf = (file) => {
  if (!bundles.has(file)) {
    const map = `${file}.map`;
    if (!existsSync(map)) {
      console.error(`${map} missing – the e2e build (vite build --mode e2e) writes source maps`);
      process.exit(2);
    }
    const sourcemap = JSON.parse(readFileSync(map, 'utf8'));
    sourcemap.sources.forEach((source, i) => {
      const candidate = join(sourcemap.sourceRoot ?? '', source); // resolved like v8-to-istanbul does
      const path = isAbsolute(candidate) ? candidate : resolve(dirname(file), candidate);
      originalLines.set(path, (sourcemap.sourcesContent?.[i] ?? '').split(/\r?\n/));
    });
    bundles.set(file, { source: readFileSync(file, 'utf8'), sourcemap });
  }
  return bundles.get(file);
};

// After a reload V8 may report only the functions that ran since: without the range of the whole script there is no
// telling which functions did not run, and the conversion would count every line as hit
const isComplete = (entry, source) =>
  entry.functions.some((fn) => fn.ranges.some((range) => range.startOffset === 0 && range.endOffset === source.length));

const inSrc = (path) => {
  const rel = relative(src, path);
  return rel !== '' && !rel.startsWith('..') && !rel.startsWith(sep) && !path.includes('node_modules');
};

const map = libCoverage.createCoverageMap({});
let tests = 0;
let entries = 0;
let partial = 0;
for (const name of readdirSync(rawDir)
  .filter((file) => file.endsWith('.json'))
  .sort()) {
  tests++;
  for (const entry of JSON.parse(readFileSync(join(rawDir, name), 'utf8'))) {
    const file = bundleFile(entry.url);
    if (file === null || !existsSync(file)) continue;
    const { source, sourcemap } = bundleOf(file);
    if (!isComplete(entry, source)) {
      partial++;
      continue;
    }
    entries++;
    const converter = v8ToIstanbul(file, 0, { source, sourceMap: { sourcemap } });
    await converter.load();
    converter.applyCoverage(entry.functions);
    const data = converter.toIstanbul();
    for (const path of Object.keys(data)) if (inSrc(path)) map.addFileCoverage(data[path]);
    converter.destroy();
  }
}

// v8-to-istanbul reports every line of a file as a statement; blank and comment lines would count as covered
const isCode = (text) => {
  const trimmed = text.trim();
  return trimmed !== '' && !trimmed.startsWith('//') && !trimmed.startsWith('/*') && !trimmed.startsWith('*');
};
const codeOnly = libCoverage.createCoverageMap({});
for (const path of map.files()) {
  const data = map.fileCoverageFor(path).toJSON();
  const lines = originalLines.get(path) ?? [];
  const ids = Object.keys(data.statementMap).filter((id) => isCode(lines[data.statementMap[id].start.line - 1] ?? ''));
  codeOnly.addFileCoverage({
    ...data,
    statementMap: Object.fromEntries(ids.map((id) => [id, data.statementMap[id]])),
    s: Object.fromEntries(ids.map((id) => [id, data.s[id]])),
  });
}

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
// Paths relative to the project, like the unit report – Sonar joins both per file
const context = libReport.createContext({ dir: outDir, coverageMap: codeOnly });
reports.create('lcovonly', { file: 'lcov.info', projectRoot: process.cwd() }).execute(context);
reports.create('text-summary').execute(context);
console.log(
  `\n${tests} tests, ${entries} bundle entries (${partial} partial ones skipped) → ${codeOnly.files().length} files in ${join(outDir, 'lcov.info')}`,
);
