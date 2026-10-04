import { expect, test } from './fixtures';
import { collectErrors } from './helpers';
import type {} from '../src/next/platform/test-hook'; // window.__wumbleNext

// The second generation: WebGL and a Rust synth in an AudioWorklet
test.describe('next: the violin', () => {
  test('starts from the button and sounds while a finger holds a key', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('./next/');
    await page.locator('#start').click();
    // A browser build without Web Audio (Playwright's WebKit on Windows) must say so instead of failing silently
    if (!(await page.evaluate(() => 'AudioContext' in window))) {
      await expect(page.locator('#status')).toContainText('nicht starten');
      return;
    }
    await expect(page.locator('body')).toHaveAttribute('data-engine', 'running');
    expect(await page.evaluate(() => window.__wumbleNext.engine()?.shared)).toBe(true);

    const centre = await page.evaluate(() => window.__wumbleNext.keyCentre(4));
    if (!centre) throw new Error('no key');
    await page.mouse.move(centre.x, centre.y);
    await page.mouse.down();
    await expect
      .poll(() => page.evaluate(() => window.__wumbleNext.engine()?.meters.at(-1) ?? 0), { timeout: 5000 })
      .toBeGreaterThan(0.01);
    await page.mouse.up();
    await expect
      .poll(() => page.evaluate(() => window.__wumbleNext.engine()?.meters.at(-1) ?? 1), { timeout: 5000 })
      .toBeLessThan(0.001);
    expect(errors).toEqual([]);
  });
});
