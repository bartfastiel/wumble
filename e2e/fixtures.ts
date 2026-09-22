// The shared `test` of the end-to-end tests: in Chromium every page of a test records V8 coverage of the bundle, written
// per test to coverage/e2e-raw/*.json; tools/e2e-coverage.mjs maps it back to src/ and merges it into one lcov report.
import { type Page, test as base } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

export { expect } from '@playwright/test';

type CoverageEntry = Awaited<ReturnType<Page['coverage']['stopJSCoverage']>>[number];

const RAW_DIR = 'coverage/e2e-raw';

export const test = base.extend({
  context: async ({ context, browserName }, use, testInfo) => {
    if (browserName !== 'chromium') {
      await use(context);
      return;
    }
    const pages: Page[] = [];
    context.on('page', (page) => {
      pages.push(page);
      page.coverage.startJSCoverage({ resetOnNavigation: false }).catch(() => undefined); // closed before it began
    });
    await use(context);
    const entries: CoverageEntry[] = [];
    for (const page of pages) {
      if (page.isClosed()) continue;
      entries.push(...(await page.coverage.stopJSCoverage()));
    }
    mkdirSync(RAW_DIR, { recursive: true });
    writeFileSync(`${RAW_DIR}/${testInfo.testId}.json`, JSON.stringify(entries));
  },
});
