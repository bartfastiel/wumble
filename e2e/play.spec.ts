import { expect, test } from './fixtures';
import { openApp, stripePoint, tonePoint } from './helpers';

test.describe('free play', () => {
  test('a tap sounds the tone it landed on', async ({ page }) => {
    await openApp(page, '#style=classical', { quiet: true });
    const point = await tonePoint(page, 64); // E4
    await page.mouse.move(point.x, point.y);
    await page.mouse.down();
    const held = await page.evaluate(() => {
      const { player } = window.__wumble.app;
      const [pointer] = player.pointers.values();
      return {
        pointers: player.pointers.size,
        sounding: pointer === undefined ? null : player.model.tones[pointer.tone],
      };
    });
    expect(held).toEqual({ pointers: 1, sounding: 64 });
    await page.mouse.up();
    expect(await page.evaluate(() => window.__wumble.app.player.pointers.size)).toBe(0);
  });

  test('sliding onto another stripe is a glissando', async ({ page }) => {
    await openApp(page, '#style=classical', { quiet: true });
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
    // only the stripes the finger touched ever glow, never the whole field
    const lit = await page.evaluate(() => [...window.__wumble.app.player.lit.keys()].length);
    expect(lit).toBeLessThan(6);
    await page.mouse.up();
  });

  test('a chord chosen on the map keeps sounding after the finger is gone', async ({ page }) => {
    await openApp(page, '', { quiet: true });
    const home = await page.evaluate(() => window.__wumble.app.store.model().home);
    const point = await stripePoint(page, `chord:${String(home)}`);
    await page.mouse.click(point.x, point.y);
    expect(await page.evaluate(() => window.__wumble.app.player.chord)).toBe(home);
    expect(await page.evaluate(() => window.__wumble.app.player.pointers.size)).toBe(0);
  });

  test('on a phone held upright the map gives way and the focused tones stay hittable', async ({ page }) => {
    await page.setViewportSize({ width: 412, height: 839 });
    await openApp(page, '', { quiet: true });
    const box = await page.locator('wm-field canvas').boundingBox();
    if (box === null) throw new Error('canvas not visible');
    const shape = await page.evaluate(() => {
      const field = window.__wumble.root.field.geometry;
      const xs = field.edges.map((edge) => edge.x);
      const widths = xs.slice(1).map((x, i) => x - (xs[i] ?? 0));
      return { map: xs[0] ?? 0, widest: Math.max(...widths) };
    });
    // the chord map steps aside: most of a narrow screen belongs to the stripes
    expect(shape.map).toBeLessThan(box.width * 0.4);
    // and what is left still carries a stripe wide enough to aim at
    expect(shape.widest).toBeGreaterThan(14);
    const point = await tonePoint(page, 65); // F4, in the middle of the view
    await page.mouse.click(point.x, point.y);
    expect(await page.evaluate(() => window.__wumble.app.player.pointers.size)).toBe(0);
  });

  test('the strip below the field pulls the octaves past and settles on one', async ({ page }) => {
    await openApp(page, '', { quiet: true });
    const box = await page.locator('wm-field canvas').boundingBox();
    if (box === null) throw new Error('canvas not visible');
    const focusOf = (): Promise<{ focus: number; settling: number }> =>
      page.evaluate(() => {
        const field = window.__wumble.root.field.geometry;
        return { focus: field.focus, settling: field.settling };
      });
    const before = await focusOf();
    const y = box.y + box.height - 26;
    await page.mouse.move(box.x + box.width - 200, y);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width - 340, y, { steps: 12 });
    // the field follows the finger at once, without waiting for it to lift
    const dragged = await focusOf();
    expect(dragged.settling).toBeGreaterThan(before.settling);
    await page.mouse.up();
    // and settles on an octave
    const perOctave = await page.evaluate(() => window.__wumble.app.store.model().style.scale.length);
    const settled = await focusOf();
    expect(settled.settling % perOctave).toBe(0);
    await expect.poll(async () => (await focusOf()).focus).toBe(settled.settling);
  });

  test('the laptop keyboard plays a tone and the digits choose a chord', async ({ page }) => {
    await openApp(page, '', { quiet: true });
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
    // 0 is not another chord but the one already chosen: it steps the accompaniment back
    await page.keyboard.press('Digit0');
    expect(await page.evaluate(() => window.__wumble.app.player.chord)).toBe(1);
    expect(await page.evaluate(() => window.__wumble.app.player.accompanying)).toBe(false);
  });
});
