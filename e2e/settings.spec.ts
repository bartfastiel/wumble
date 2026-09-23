import { expect, test } from './fixtures';
import { openApp } from './helpers';

// The bar carries the settings now: one icon per subject, one panel of pictures under it.
const open = (page: Parameters<typeof openApp>[0], section: string): Promise<void> =>
  page.locator(`wm-header button[data-section=${section}]`).click();

const tile = (page: Parameters<typeof openApp>[0], label: string) => page.locator(`.pop .tile[title^="${label}"]`);

test.describe('settings', () => {
  test('persist after a reload and update the title', async ({ page }) => {
    await openApp(page);
    await open(page, 'view');
    await tile(page, 'Notennamen').click();
    await open(page, 'key');
    await page.locator('.wheel .seat', { hasText: 'A' }).first().click();
    await open(page, 'sound');
    await tile(page, 'Rein').click();
    await page.keyboard.press('Escape');
    await expect(page.locator('wm-header h1')).toHaveText('Freies Spiel · A-Dur ♯♯♯');
    expect(await page.evaluate(() => location.hash)).toBe('#key=A&tuning=just&labels=names');
    await page.goto('./'); // no hash: the stored settings must come back on their own
    await expect(page.locator('wm-header h1')).toHaveText('Freies Spiel · A-Dur ♯♯♯');
    const settings = await page.evaluate(() => window.__wumble.app.store.get());
    expect(settings).toMatchObject({ signature: 3, labels: 'names', tuning: 'just' });
    // The polished look holds its own cool light; the grown one takes the hue of the key
    expect(await page.evaluate(() => document.documentElement.style.getPropertyValue('--hue'))).toBe('216');
    // the key button wears the key it chose
    await expect(page.locator('wm-header button[data-section=key] .sign')).toHaveText('A');
  });

  test('a style applies its sound and tempo, the share button copies the link', async ({ page }) => {
    await openApp(page);
    await open(page, 'style');
    await tile(page, 'Blues').click();
    // The band is playing, so the tempo stays where it is – only the sound follows the style
    expect(await page.evaluate(() => window.__wumble.app.store.get())).toMatchObject({
      style: 'blues',
      combi: 'organ',
      tempo: 100,
    });
    await open(page, 'sound');
    await expect(tile(page, 'Orgel')).toHaveClass(/on/);
    // with the band stopped, the style brings its own tempo along
    await page.evaluate(() => {
      window.__wumble.app.stopBand();
    });
    await open(page, 'style');
    await tile(page, 'Klassisch').click();
    await tile(page, 'Blues').click();
    await open(page, 'tempo');
    await expect(page.locator('.dial .read')).toHaveText('100');
    await page.keyboard.press('Escape');
    // The link is the URL: sharing writes it there and puts it on the clipboard
    await page.locator('wm-header button[data-action=share]').click();
    expect(await page.evaluate(() => location.hash)).toBe('#band=0'); // the blues is the default now
  });
});
