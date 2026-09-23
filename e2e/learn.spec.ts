import { expect, test } from './fixtures';
import { openApp, stripePoint } from './helpers';

test.describe('learn mode', () => {
  test('tapping through "Alle meine Entchen" ends in the done modal', async ({ page }) => {
    await openApp(page, '', { quiet: true });
    await page.locator('wm-header button[data-panel=library]').click();
    await page.locator('wm-library button', { hasText: 'Alle meine Entchen' }).click();
    await expect(page.locator('wm-library')).not.toHaveClass(/open/);
    await expect(page.locator('wm-header h1')).toHaveText('Alle meine Entchen \u00b7 1/27');
    const spots = await page.evaluate(() =>
      window.__wumble.app.learn.placed.map((placed) => placed.spot?.tone ?? null),
    );
    expect(spots).toHaveLength(27);
    for (const [i, tone] of spots.entries()) {
      if (tone === null) throw new Error('note off the field');
      const point = await stripePoint(page, `tone:${String(tone)}`);
      await page.mouse.click(point.x, point.y);
      if (i < spots.length - 1) {
        await expect(page.locator('wm-header h1')).toHaveText(`Alle meine Entchen \u00b7 ${String(i + 2)}/27`);
      }
    }
    await expect(page.locator('wm-done')).toBeVisible();
    await expect(page.locator('wm-done h2')).toHaveText('Geschafft!');
    await expect(page.locator('wm-done p')).toHaveText('Alle meine Entchen');
    await page.locator('wm-done button.secondary').click();
    await expect(page.locator('wm-done')).toBeHidden();
    await expect(page.locator('wm-header h1')).toHaveText('Freies Spiel');
  });

  test('medium scores the hits and shows the badge', async ({ page }) => {
    await openApp(page, '#level=medium&song=alle-meine-entchen', { quiet: true });
    await expect(page.locator('wm-header .score')).toHaveText('0 P.');
    const tone = await page.evaluate(() => window.__wumble.app.learn.placed[0]?.spot?.tone ?? null);
    if (tone === null) throw new Error('note off the field');
    const point = await stripePoint(page, `tone:${String(tone)}`);
    await page.mouse.click(point.x, point.y);
    const score = await page.evaluate(() => window.__wumble.app.learn.score);
    expect(score).toBeGreaterThanOrEqual(10);
    await expect(page.locator('wm-header .score')).toHaveText(`${String(score)} P.`);
  });
});
