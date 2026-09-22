import { expect, test } from './fixtures';
import { openApp } from './helpers';

test('the credits show once, and again when their text changed', async ({ page }) => {
  await openApp(page, '', { keepCredits: true });
  await expect(page.locator('wm-credits')).toBeVisible();
  await expect(page.locator('wm-credits h2')).toHaveText('Klänge und Lizenzen');
  await expect(page.locator('wm-credits li')).toHaveCount(2);
  await page.locator('wm-credits button').click();
  await expect(page.locator('wm-credits')).toBeHidden();
  await page.reload();
  await expect(page.locator('wm-header h1')).toHaveText('Freies Spiel');
  await expect(page.locator('wm-credits')).toBeHidden();
  // Another text was acknowledged before: this one is new
  await page.evaluate(() => {
    localStorage.setItem('wumble-credits', 'an-older-hash');
  });
  await page.reload();
  await expect(page.locator('wm-credits')).toBeVisible();
});
