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
    await openApp(page, '#style=classical&tempo=100'); // the major field, where 64 and 65 are next to each other
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
    await expect(page.locator('wm-header button.loop')).toHaveAttribute('data-layers', '1', { timeout: barMs + 3000 });
    const layers = await page.evaluate(() =>
      window.__wumble.app.looper.layers().map((layer) => ({ bars: layer.bars, tones: layer.events.length })),
    );
    expect(layers).toEqual([{ bars: 1, tones: 2 }]);
    await page.locator('wm-header button[data-section=tempo]').click();
    await expect(page.locator('.layers .layer .marks i')).toHaveCount(2); // one mark per tone
    await page.locator('.layers .layer button').click();
    await expect(page.locator('.layers .layer')).toHaveCount(0);
    await expect(page.locator('wm-header button.loop')).toHaveAttribute('data-layers', '');
  });

  test('the map promises the chord the schema will play next, and how far off it is', async ({ page }) => {
    // Twelve-bar blues at 160 bpm: bars 1–4 are I, bar 5 is IV, so the subdominant is promised from the start
    await openApp(page, '#band=1&schema=blues&tempo=160');
    const ahead = (): Promise<{ role: string; progress: number } | null> =>
      page.evaluate(() => window.__wumble.root.field.upcoming);
    await expect.poll(async () => (await ahead())?.role).toBe('subdominant');
    const early = (await ahead())?.progress ?? 1;
    // the ring closes as the bars run out, and never past the change itself
    await expect.poll(async () => (await ahead())?.progress ?? 0).toBeGreaterThan(early + 0.1);
    const later = await ahead();
    expect(later?.role).toBe('subdominant');
    expect(later?.progress ?? 0).toBeLessThanOrEqual(1);
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
