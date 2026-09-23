import { expect, test } from './fixtures';
import { collectErrors, openApp } from './helpers';

test('the app starts without console errors and shows the field', async ({ page }) => {
  const errors = collectErrors(page);
  await openApp(page, '', { keepWelcome: true });
  await expect(page).toHaveTitle('Wumble');
  await expect(page.locator('wm-header h1')).toHaveText('Freies Spiel');
  await expect(page.locator('wm-field canvas')).toBeVisible();
  await expect(page.locator('wm-welcome')).toBeVisible();
  const layout = await page.evaluate(() => window.__wumble.layout());
  expect(layout.width).toBeGreaterThan(0);
  expect(layout.height).toBeGreaterThan(0);
  expect(layout.stripes).toBeGreaterThan(20);
  expect(errors).toEqual([]);
});
