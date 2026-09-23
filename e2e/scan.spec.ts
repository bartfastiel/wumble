import { GROUPS, SONGS } from '../src/learn/songs';
import { expect, test } from './fixtures';
import { openApp } from './helpers';

const EXAMPLE_NAMES = 'C D E F G G A A A A G A A A A G F F F F E E G G G G C';

// Green pixels of the overlay along the column x: the five lines of the first staff lie between y 150 and 250
const greenPixels = (x: number): number => {
  const canvas = document.querySelector<HTMLCanvasElement>('wm-scan canvas');
  const cx = canvas?.getContext('2d');
  if (!canvas || !cx) throw new Error('scan view missing');
  const { data } = cx.getImageData(x, 150, 1, 100);
  let green = 0;
  for (let i = 0; i < data.length; i += 4) {
    const [r = 0, g = 0, b = 0] = data.subarray(i, i + 3);
    if (g > r + 60 && g > b + 60) green++;
  }
  return green;
};

test.describe('sheet scan', () => {
  test('reads the example, draws the overlay and plays the song in the learn mode', async ({ page }) => {
    await openApp(page, '', { quiet: true });
    await page.locator('wm-header button[data-panel=library]').click();
    await page.locator('wm-library button', { hasText: 'Notenblatt scannen' }).click();
    await expect(page.locator('wm-scan')).toHaveClass(/open/);
    await expect(page.locator('wm-scan h1')).toHaveText('Notenblatt scannen');
    await expect(page.locator('wm-scan select')).toHaveValue('0');
    await expect(page.locator('wm-scan .result')).toBeHidden();
    await page.locator('wm-scan').getByRole('button', { name: 'Beispiel', exact: true }).click();
    await expect(page.locator('wm-scan p.result')).toHaveText(
      `27 Noten erkannt: ${EXAMPLE_NAMES} (·2 Halbe, ·4 Ganze; Tonart C-Dur / A-Moll)`,
    );
    const view = page.locator('wm-scan canvas');
    await expect(view).toBeVisible();
    expect(await view.evaluate((canvas) => (canvas as HTMLCanvasElement).width)).toBe(1400);
    expect(await page.evaluate(greenPixels, 700)).toBeGreaterThanOrEqual(5);
    await page.locator('wm-scan').getByRole('button', { name: 'Spielen' }).click();
    await expect(page.locator('wm-scan')).not.toHaveClass(/open/);
    await expect(page.locator('wm-header h1')).toHaveText(/^Gescannt: \d\d:\d\d · 1\/27$/);
    const state = await page.evaluate(() => {
      const { learn, songs, store } = window.__wumble.app;
      return {
        group: learn.song?.group,
        notes: learn.song?.notes.length,
        first: songs[0]?.title,
        count: songs.length,
        style: store.get().style,
      };
    });
    expect(state).toMatchObject({ group: 'scanned', notes: 27, count: SONGS.length + 1, style: 'classical' });
    expect(state.first).toMatch(/^Gescannt: /);
    await page.locator('wm-header button[data-panel=library]').click();
    await expect(page.locator('wm-library h2').first()).toHaveText('Gescannt');
    await expect(page.locator('wm-library h2 + button')).toHaveCount(GROUPS.length + 1); // and the scan on top
  });

  test('reads the example as a photo and follows a change of the key', async ({ page }) => {
    await openApp(page, '#scan', { quiet: true });
    await expect(page.locator('wm-scan')).toHaveClass(/open/);
    await page.locator('wm-scan').getByRole('button', { name: 'Beispiel als Foto' }).click();
    await expect(page.locator('wm-scan p.result')).toHaveText(new RegExp(`^27 Noten erkannt: ${EXAMPLE_NAMES} `));
    await page.locator('wm-scan select').selectOption('2');
    await expect(page.locator('wm-scan p.result')).toHaveText(
      /^27 Noten erkannt: C♯ D E F♯ G G A A A A G A A A A G F♯ F♯ F♯ F♯ E E G G G G C♯ \(·2 Halbe, ·4 Ganze; Tonart D-Dur \/ B-Moll\)$/,
    );
    await page.locator('wm-scan').getByRole('button', { name: 'Nochmal' }).click();
    await expect(page.locator('wm-scan .result')).toBeHidden();
    await page.locator('wm-scan .back').click();
    await expect(page.locator('wm-scan')).not.toHaveClass(/open/);
  });
});
