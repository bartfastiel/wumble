import { expect, test } from './fixtures';
import { openApp } from './helpers';

test.describe('settings', () => {
  test('persist after a reload and update the title', async ({ page }) => {
    await openApp(page);
    await page.locator('wm-header button[data-panel=settings]').click();
    await expect(page.locator('wm-settings')).toHaveClass(/open/);
    await page.locator('wm-settings input[value=names]').check();
    await page.locator('wm-settings input[value="3"]').check(); // A major
    await page.locator('wm-settings input[value=just]').check();
    await page.locator('wm-settings .back').click();
    await expect(page.locator('wm-header h1')).toHaveText('Freies Spiel · A-Dur ♯♯♯');
    expect(await page.evaluate(() => location.hash)).toBe('#key=A&tuning=just&labels=names');
    await page.goto('./'); // no hash: the stored settings must come back on their own
    await expect(page.locator('wm-header h1')).toHaveText('Freies Spiel · A-Dur ♯♯♯');
    const settings = await page.evaluate(() => window.__wumble.app.store.get());
    expect(settings).toMatchObject({ signature: 3, labels: 'names', tuning: 'just' });
    expect(await page.evaluate(() => document.documentElement.style.getPropertyValue('--hue'))).toBe('355');
  });

  test('a style applies its sound and tempo, the share button copies the link', async ({ page, context }) => {
    await openApp(page);
    await page.locator('wm-header button[data-panel=settings]').click();
    await page.locator('wm-settings input[name=Stil][value=blues]').check();
    // The band is playing, so the tempo stays where it is – only the sound follows the style
    const running = await page.evaluate(() => window.__wumble.app.store.get());
    expect(running).toMatchObject({ style: 'blues', combi: 'organ', tempo: 100 });
    await expect(page.locator('wm-settings input[value=organ]')).toBeChecked();
    // with the band stopped, the style brings its own tempo along
    await page.evaluate(() => {
      window.__wumble.app.stopBand();
    });
    await page.locator('wm-settings input[name=Stil][value=classical]').check();
    await page.locator('wm-settings input[name=Stil][value=blues]').check();
    await expect(page.locator('wm-settings output')).toHaveText('96 bpm');
    await context.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => undefined);
    await page.locator('wm-settings button.share').click();
    await expect(page.locator('wm-settings button.share')).toHaveText('Kopiert: #style=blues&sound=organ&band=0');
  });
});
