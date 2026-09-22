import { expect, test } from './fixtures';
import { openApp, stripePoint, tonePoint } from './helpers';

test.describe('free play', () => {
  test('a tap sounds one tone and lets it glow', async ({ page }) => {
    await openApp(page);
    const point = await tonePoint(page, 64); // E4
    await page.mouse.move(point.x, point.y);
    await page.mouse.down();
    const held = await page.evaluate(() => {
      const { player } = window.__wumble.app;
      const [pointer] = player.pointers.values();
      return {
        pointers: player.pointers.size,
        lit: [...player.lit.keys()],
        sounding: pointer === undefined ? null : player.model.tones[pointer.tone],
      };
    });
    expect(held.pointers).toBe(1);
    expect(held.lit).toEqual([held.sounding]); // exactly the stripe that was touched, nothing else
    await page.mouse.up();
    expect(await page.evaluate(() => window.__wumble.app.player.pointers.size)).toBe(0);
  });

  test('sliding onto another stripe is a glissando', async ({ page }) => {
    await openApp(page);
    const from = await tonePoint(page, 64);
    const to = await tonePoint(page, 67);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 6 });
    const sounding = await page.evaluate(() => {
      const { player } = window.__wumble.app;
      const [first] = player.pointers.values();
      return first === undefined ? null : player.model.tones[first.tone];
    });
    expect(sounding).toBe(67);
    // only the stripes the finger touched glow, not the whole field
    const lit = await page.evaluate(() => [...window.__wumble.app.player.lit.keys()].length);
    expect(lit).toBeLessThan(6);
    await page.mouse.up();
  });

  test('a chord chosen on the map keeps sounding after the finger is gone', async ({ page }) => {
    await openApp(page);
    const home = await page.evaluate(() => window.__wumble.app.store.model().home);
    const point = await stripePoint(page, `chord:${String(home)}`);
    await page.mouse.click(point.x, point.y);
    expect(await page.evaluate(() => window.__wumble.app.player.chord)).toBe(home);
    expect(await page.evaluate(() => window.__wumble.app.player.pointers.size)).toBe(0);
  });

  test('the laptop keyboard plays a tone and the digits choose a chord', async ({ page }) => {
    await openApp(page);
    await page.keyboard.down('KeyA');
    const pressed = await page.evaluate(() => {
      const pointer = window.__wumble.app.player.pointers.get('kKeyA');
      return pointer === undefined ? null : window.__wumble.app.player.model.tones[pointer.tone];
    });
    expect(pressed).not.toBeNull();
    await page.keyboard.up('KeyA');
    expect(await page.evaluate(() => window.__wumble.app.player.pointers.size)).toBe(0);
    await page.keyboard.press('Digit2');
    expect(await page.evaluate(() => window.__wumble.app.player.chord)).toBe(1);
    await page.keyboard.press('Digit0');
    expect(await page.evaluate(() => window.__wumble.app.player.chord)).toBe(-1); // silence
  });
});
