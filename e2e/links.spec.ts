import { expect, test } from './fixtures';
import { openApp } from './helpers';

test.describe('deep links', () => {
  test('a style link switches the style and its sound', async ({ page }) => {
    // The app opens on the blues: seventh chords on the blues scale, played on the organ
    await openApp(page);
    const blues = await page.evaluate(() => window.__wumble.app.store.model().chords.map((chord) => chord.label));
    expect(blues).toContain('C7'); // the blues sits on its tonic seventh
    expect(blues).toContain('F7'); // and the subdominant is a seventh chord too
    expect(blues).toContain('G7');
    expect(await page.evaluate(() => window.__wumble.app.store.get().combi)).toBe('organ');
    expect(await page.evaluate(() => location.hash)).toBe('');
    // #classical leads away from it, sound and all
    await page.goto('./#classical');
    await page.reload();
    const classical = await page.evaluate(() => window.__wumble.app.store.model().chords.map((c) => c.label));
    expect(classical).toContain('C'); // plain triads instead of the blues sevenths
    expect(classical).toContain('G');
    expect(await page.evaluate(() => window.__wumble.app.store.get().combi)).toBe('piano');
    expect(await page.evaluate(() => location.hash)).toBe('#style=classical&sound=piano');
  });

  test('#key=A&labels=names sets the key and the labels', async ({ page }) => {
    await openApp(page, '#key=A&labels=names');
    await expect(page.locator('wm-header h1')).toHaveText('Freies Spiel · A-Dur ♯♯♯');
    expect(await page.evaluate(() => window.__wumble.app.store.get())).toMatchObject({
      signature: 3,
      labels: 'names',
    });
    expect(await page.evaluate(() => location.hash)).toBe('#key=A&labels=names');
  });

  test('#song=alle-meine-entchen starts the learn mode', async ({ page }) => {
    await openApp(page, '#song=alle-meine-entchen');
    await expect(page.locator('wm-header h1')).toHaveText('Alle meine Entchen · 1/27');
    const state = await page.evaluate(() => {
      const { learn, store } = window.__wumble.app;
      return { song: learn.song?.title, pos: learn.pos, style: store.get().style, signature: store.get().signature };
    });
    expect(state).toEqual({ song: 'Alle meine Entchen', pos: 0, style: 'classical', signature: 0 });
  });

  test('#band=1&schema=blues starts the band on the twelve-bar blues', async ({ page }) => {
    await openApp(page, '#band=1&schema=blues');
    const state = await page.evaluate(() => {
      const { band, player, store } = window.__wumble.app;
      return {
        running: band.running(),
        schema: band.schema(),
        setting: store.get().schema,
        player: player.bandRunning,
      };
    });
    expect(state).toEqual({ running: true, schema: 'blues', setting: 'blues', player: true });
    await expect(page.locator('wm-header button.band')).toHaveClass(/on/);
    await expect(page.locator('wm-header button.loop')).toBeVisible();
  });

  test('a hash change applies the new link', async ({ page }) => {
    await openApp(page);
    await page.evaluate(() => {
      location.hash = '#song=bruder-jakob';
    });
    await expect(page.locator('wm-header h1')).toHaveText('Bruder Jakob · 1/32');
  });
});
