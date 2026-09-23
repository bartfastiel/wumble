import { expect, test } from './fixtures';
import { openApp } from './helpers';

test.describe('band', () => {
  test('plays from the start and stops from the header', async ({ page }) => {
    await openApp(page); // Play starts the band
    expect(await page.evaluate(() => window.__wumble.app.band.running())).toBe(true);
    expect(await page.evaluate(() => window.__wumble.app.player.bandRunning)).toBe(true);
    await expect(page.locator('wm-header button.band')).toHaveClass(/on/);
    await expect(page.locator('wm-header button.loop')).toBeVisible();
    expect(await page.evaluate(() => location.hash)).toBe('');
    await page.locator('wm-header button.band').click();
    expect(await page.evaluate(() => window.__wumble.app.band.running())).toBe(false);
    expect(await page.evaluate(() => location.hash)).toBe('#band=0');
    await expect(page.locator('wm-header button.loop')).toBeHidden();
    await page.locator('wm-header button.band').click();
    expect(await page.evaluate(() => window.__wumble.app.band.running())).toBe(true);
  });

  test('records a loop layer from the next bar start', async ({ page }) => {
    await openApp(page, '#tempo=100');
    await page.evaluate(() => {
      window.__wumble.app.store.update({ loopBars: 1 });
    });
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

  test('a schema chooses on the map, as if a hand had done it', async ({ page }) => {
    // Twelve-bar blues at 160 bpm: bar 1 is I, bar 5 is IV – 1.5 s per bar
    await openApp(page, '#band=1&schema=blues&tempo=160');
    await expect
      .poll(() => page.evaluate(() => window.__wumble.app.player.chord), { timeout: 5000 })
      .toBeGreaterThanOrEqual(0);
    const home = await page.evaluate(() => {
      const { player } = window.__wumble.app;
      return player.model.chords[player.chord]?.offset;
    });
    expect(home).toBe(0);
    // by bar 5 the band has moved to the subdominant, and the map says so
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const { player } = window.__wumble.app;
            return player.model.chords[player.chord]?.offset;
          }),
        { timeout: 15_000 },
      )
      .toBe(5);
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
    // the band keeps playing: it was already running before the echo asked for it
    expect(await page.evaluate(() => window.__wumble.app.band.running())).toBe(true);
  });
});
