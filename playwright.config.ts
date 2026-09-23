import { defineConfig, devices } from '@playwright/test';

const url = 'http://127.0.0.1:4173/';
const ci = process.env.CI !== undefined;
const VIEWPORT = { width: 1100, height: 800 };

export default defineConfig({
  testDir: 'e2e',
  globalSetup: './e2e/relay-setup.ts',
  globalTeardown: './e2e/relay-teardown.ts',
  fullyParallel: true,
  forbidOnly: ci,
  // WebKit on a shared CI runner needs noticeably longer than Chromium for the first paint of the canvas
  timeout: ci ? 60_000 : 30_000,
  retries: ci ? 2 : 0,
  // Every spec drives audio and an animated canvas; too many at once starve each other on a shared runner
  workers: ci ? 2 : undefined,
  reporter: ci ? [['list'], ['html', { open: 'never' }]] : 'list',
  // German is the schema of the user texts; the specs check them in German
  use: { baseURL: url, trace: 'retain-on-failure', locale: 'de-DE' },
  projects: [
    // Audio may start without a gesture so deep links like #band=1 run their clock in the tests
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: VIEWPORT,
        launchOptions: { args: ['--autoplay-policy=no-user-gesture-required'] },
      },
    },
    { name: 'webkit', use: { ...devices['Desktop Safari'], viewport: VIEWPORT } },
  ],
  webServer: { command: 'npm run preview', url, reuseExistingServer: !ci },
});
