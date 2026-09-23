import { expect, test } from './fixtures';
import { openApp } from './helpers';

test('the welcome page opens every time and starts the music on Play', async ({ page }) => {
  await openApp(page, '', { keepWelcome: true });
  await expect(page.locator('wm-welcome')).toBeVisible();
  await expect(page.locator('wm-welcome h2')).toHaveText('Wumble');
  // three lines, one per area of the field
  await expect(page.locator('wm-welcome .where')).toHaveCount(3);
  await expect(page.locator('wm-welcome button')).toHaveText('Spielen');

  // nothing runs before the click – a browser would not let it anyway
  expect(await page.evaluate(() => window.__wumble.app.band.running())).toBe(false);
  await page.locator('wm-welcome button').click();
  await expect(page.locator('wm-welcome')).toBeHidden();
  expect(await page.evaluate(() => window.__wumble.app.band.running())).toBe(true);
  expect(await page.evaluate(() => window.__wumble.app.radio.on())).toBe(true);
  expect(await page.evaluate(() => window.__wumble.app.player.accompanying)).toBe(true);

  // and it is there again after a reload: the sound needs the gesture every time
  await page.reload();
  await expect(page.locator('wm-welcome')).toBeVisible();
});

test('a hand on the map takes the lead from the running schema', async ({ page }) => {
  await openApp(page, '#schema=pop&tempo=160');
  // wait until the schema really leads – only then is stepping back worth anything
  await expect
    .poll(() => page.evaluate(() => window.__wumble.app.band.bandChord()), { timeout: 10_000 })
    .not.toBeNull();
  const chord = await page.evaluate(() => {
    const { player } = window.__wumble.app;
    const own = player.model.chords.findIndex((candidate) => candidate.offset === 5); // the subdominant
    player.chooseChord(own);
    return { own, chosen: player.chord };
  });
  expect(chord.chosen).toBe(chord.own);
  // the schema stops showing a chord of its own for a while
  expect(await page.evaluate(() => window.__wumble.app.band.bandChord())).toBeNull();
});
