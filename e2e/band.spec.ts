import { expect, test } from './fixtures';
import { openApp } from './helpers';

test.describe('band', () => {
  test('starts from the header and shows the loop button', async ({ page }) => {
    await openApp(page);
    await page.locator('wm-header button.band').click();
    expect(await page.evaluate(() => window.__wumble.app.band.running())).toBe(true);
    expect(await page.evaluate(() => window.__wumble.app.player.bandRunning)).toBe(true);
    await expect(page.locator('wm-header button.band')).toHaveClass(/on/);
    await expect(page.locator('wm-header button.loop')).toBeVisible();
    expect(await page.evaluate(() => location.hash)).toBe('#band=1');
    await page.locator('wm-header button.band').click();
    expect(await page.evaluate(() => window.__wumble.app.band.running())).toBe(false);
    await expect(page.locator('wm-header button.loop')).toBeHidden();
  });

  test('records a loop layer from the next bar start', async ({ page }) => {
    await openApp(page, '#tempo=100');
    await page.evaluate(() => {
      window.__wumble.app.store.update({ loopBars: 1 });
    });
    await page.locator('wm-header button.band').click(); // a gesture: the audio clock runs from here
    await page.locator('wm-header button.loop').click();
    await expect(page.locator('wm-header button.loop')).toHaveClass(/armed/);
    // The recording starts with the next bar – one bar of 2.4 s at 100 bpm at most, plus a margin for a slow
    // runner; the two tones go in as soon as it starts, pressed directly since a mouse click may come late
    const barMs = 2400;
    await page.waitForFunction(() => window.__wumble.app.looper.phase() === 'recording', undefined, {
      timeout: barMs + 3000,
    });
    await page.evaluate(() => {
      const { player } = window.__wumble.app;
      const tones = player.model.tones;
      player.press(1, tones.indexOf(64));
      player.release(1);
      player.press(2, tones.indexOf(65));
      player.release(2);
    });
    await expect(page.locator('wm-header button.loop')).toHaveClass(/rec/);
    await expect(page.locator('wm-header button.loop')).toHaveText('●1', { timeout: barMs + 3000 });
    const layers = await page.evaluate(() =>
      window.__wumble.app.looper.layers().map((layer) => ({ bars: layer.bars, tones: layer.events.length })),
    );
    expect(layers).toEqual([{ bars: 1, tones: 2 }]);
    await page.locator('wm-header button[data-panel=settings]').click();
    await expect(page.locator('wm-settings .loops div span')).toHaveText('Schicht 1 · 2 Töne · 1 Takt');
    await page.locator('wm-settings .loops div button').click();
    await expect(page.locator('wm-settings .loops p.hint')).toBeVisible();
    await expect(page.locator('wm-header button.loop')).toHaveText('●');
  });

  test('the echo takes the title', async ({ page }) => {
    await openApp(page);
    await page.locator('wm-header button[data-panel=library]').click();
    await page.locator('wm-library button', { hasText: 'Echo' }).click();
    await expect(page.locator('wm-header h1')).toHaveText('Hör zu …');
    await expect(page.locator('wm-header button.end')).toBeVisible();
    expect(await page.evaluate(() => window.__wumble.app.band.running())).toBe(true);
    await page.locator('wm-header button.end').click();
    await expect(page.locator('wm-header h1')).toHaveText('Freies Spiel');
    expect(await page.evaluate(() => window.__wumble.app.band.running())).toBe(false);
  });
});
