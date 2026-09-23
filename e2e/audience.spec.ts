// Player and listener on two pages through the built relay (started by relay-setup.ts).
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { openApp, relayQuery } from './helpers';

const CONNECT_TIMEOUT = 10_000;

// The player hits note `index` of the running song directly – a mouse click may come late
const hit = (page: Page, index: number): Promise<void> =>
  page.evaluate((i) => {
    const { learn, player } = window.__wumble.app;
    const spot = learn.placed[i]?.spot;
    if (spot === null || spot === undefined) throw new Error('note off the field');
    player.press(1, spot.tone);
    player.release(1);
  }, index);

test.describe('audience', () => {
  test('a listener follows the song of the player and applauds', async ({ page, context }) => {
    await openApp(page, '', { query: relayQuery() });
    await page.locator('wm-header button[data-panel=library]').click();
    await page.locator('wm-library button', { hasText: 'Publikum' }).click();
    await expect(page.locator('wm-audience')).toHaveClass(/open/);
    const code = (await page.locator('wm-audience p.code b').textContent()) ?? '';
    expect(code).toMatch(/^[a-z0-9]{5}$/);
    await expect(page.locator('wm-audience p.status')).toHaveText('Verbunden – Raum offen', {
      timeout: CONNECT_TIMEOUT,
    });
    await expect(page.locator('wm-audience p.count')).toHaveText('0 Zuhörer');
    await expect(page.locator('wm-audience canvas')).toBeVisible();
    await expect(page.locator('wm-audience p.link')).toHaveText(new RegExp(`#room=${code}$`));
    await expect(page.locator('wm-audience input[type=url]')).toBeVisible(); // the page is local

    const listener = await context.newPage();
    await listener.goto(`./${relayQuery()}#room=${code}`);
    await expect(listener.locator('body')).toHaveClass(/listening/);
    await expect(listener).toHaveTitle(`Wumble · Raum ${code}`);
    await expect(listener.locator('wm-listener .status')).toHaveText(`Raum ${code} · verbunden`, {
      timeout: CONNECT_TIMEOUT,
    });
    await expect(listener.locator('wm-listener .note')).toHaveText('Wartet auf das nächste Lied …');
    await expect(listener.locator('wm-grid')).toBeHidden();
    await expect(page.locator('wm-audience p.count')).toHaveText('1 Zuhörer');

    await page.locator('wm-audience .back').click();
    await page.locator('wm-header button[data-panel=library]').click();
    await page.locator('wm-library button', { hasText: 'Alle meine Entchen' }).click();
    await expect(listener.locator('wm-listener .title')).toHaveText('Alle meine Entchen');
    const syllables = listener.locator('wm-listener .line.cur .s');
    await expect(syllables).toHaveCount(9); // "Alle meine Entchen schwimmen auf"
    await expect(syllables.first()).toHaveText('Al');
    await expect(syllables.first()).toHaveClass(/cur/);

    await hit(page, 0);
    await hit(page, 1);
    await expect(page.locator('wm-header h1')).toHaveText('Alle meine Entchen · 3/27');
    await expect(syllables.first()).toHaveClass(/done/);
    await expect(syllables.nth(1)).toHaveClass(/cur/);
    await expect(listener.locator('wm-listener .ball')).toBeVisible();

    await listener.locator('wm-listener button.applause').click();
    await expect
      .poll(() => page.evaluate(() => window.__wumble.root.field.floating.map((floater) => floater.text)))
      .toContain('clap');

    for (let i = 2; i < 27; i++) await hit(page, i);
    await expect(page.locator('wm-done')).toBeVisible();
    await expect(listener.locator('wm-listener .big')).toHaveText('Geschafft');
    await page.locator('wm-done button.secondary').click();
    await expect(listener.locator('wm-listener .title')).toHaveText('Freies Spiel');
    await page.evaluate(() => {
      const { player } = window.__wumble.app;
      player.press(2, player.model.tones.indexOf(67));
      player.release(2);
    });
    await expect(listener.locator('wm-listener .tone')).toHaveText('G');
    // with the accompaniment muted the tone stands alone; the chord is back as soon as it sounds again
    await page.evaluate(() => {
      const { player } = window.__wumble.app;
      player.chooseChord(player.chord); // mute
      player.press(3, player.model.tones.indexOf(64));
      player.release(3);
    });
    await expect(listener.locator('wm-listener .chord')).toBeEmpty();
    await page.evaluate(() => {
      const { player } = window.__wumble.app;
      player.chooseChord(player.model.home);
      player.press(4, player.model.tones.indexOf(64));
      player.release(4);
    });
    await expect(listener.locator('wm-listener .chord')).toHaveText('C');
  });
});
