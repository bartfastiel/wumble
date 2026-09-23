import { expect, test } from './fixtures';
import { openApp, relayQuery } from './helpers';

// One person opens a room, the others scan the code and join in – singing or playing the melody along.
test.describe('guests', () => {
  test('a guest plays the melody along in the key of the host', async ({ page, context }) => {
    await openApp(page, '', { query: relayQuery(), quiet: true });
    // The host opens the room
    await page.locator('wm-header button[data-panel=library]').click();
    await page.locator('wm-library button', { hasText: 'Publikum' }).click();
    await expect(page.locator('wm-audience p.code b')).not.toBeEmpty();
    const code = await page.evaluate(() => window.__wumble.app.room.code);
    await page.locator('wm-audience .back').click();
    // and says what it plays in
    await page.evaluate(() => {
      window.__wumble.app.store.update({ signature: 3, style: 'classical', combi: 'piano' });
    });

    const guest = await context.newPage();
    await guest.goto(`./${relayQuery()}#room=${String(code)}`);
    await guest.waitForFunction(() => '__wumble' in window);
    // The guest is asked first, and sees the host's sound greyed out
    await expect(guest.locator('wm-join')).toBeVisible();
    await expect(guest.locator('wm-join .tile[title="Klavier"]')).toBeDisabled();
    // The key and style arrived before any choice was made
    expect(await guest.evaluate(() => window.__wumble.app.store.get())).toMatchObject({
      signature: 3,
      style: 'classical',
    });

    await guest.locator('wm-join button.play').click();
    await expect(guest.locator('wm-join')).toBeHidden();
    // No chords, no band, no songs on a guest device
    await expect(guest.locator('wm-header .zone.chords')).toBeHidden();
    await expect(guest.locator('wm-header button[data-panel=library]')).toBeHidden();

    // What the guest plays shows up on the host's field, and nothing else changes there
    const before = await page.evaluate(() => window.__wumble.app.player.chord);
    await guest.evaluate(() => {
      const { player } = window.__wumble.app;
      player.press(1, player.model.tones.indexOf(69)); // A, the tonic of the host's key
    });
    await expect.poll(() => page.evaluate(() => window.__wumble.app.guestTones())).toEqual([69]);
    expect(await page.evaluate(() => window.__wumble.app.player.chord)).toBe(before);
    await expect.poll(() => page.evaluate(() => window.__wumble.app.room.musicians)).toBe(1);

    await guest.evaluate(() => {
      window.__wumble.app.player.release(1);
    });
    await expect.poll(() => page.evaluate(() => window.__wumble.app.guestTones())).toEqual([]);
    await guest.close();
  });

  test('a guest who came to sing gets the karaoke view instead', async ({ page, context }) => {
    await openApp(page, '', { query: relayQuery(), quiet: true });
    await page.locator('wm-header button[data-panel=library]').click();
    await page.locator('wm-library button', { hasText: 'Publikum' }).click();
    const code = await page.evaluate(() => window.__wumble.app.room.code);
    await page.locator('wm-audience .back').click();

    const guest = await context.newPage();
    await guest.goto(`./${relayQuery()}#room=${String(code)}`);
    await guest.locator('wm-join .tile[title^="Singen"]').click();
    await guest.locator('wm-join button.play').click();
    await expect(guest.locator('wm-listener')).toBeVisible();
    expect(await guest.evaluate(() => window.__wumble.app.guest)).toBeNull();
    await expect.poll(() => page.evaluate(() => window.__wumble.app.room.listeners)).toBe(1);
    await guest.close();
  });
});
