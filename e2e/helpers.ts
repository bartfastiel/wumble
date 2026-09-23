// Shared steps of the end-to-end tests: open the app (with a hash), get past the welcome page, aim at the canvas.
import { expect, type Page } from '@playwright/test';
import type {} from '../src/ui/test-hook'; // window.__wumble

export const collectErrors = (page: Page): string[] => {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
};

export interface OpenOptions {
  readonly keepWelcome?: boolean; // the welcome page stays open, so a test can look at it
  readonly query?: string; // e.g. the relay of the audience tests
}

// Opens the app and presses Play, which is what starts the sound – unless `keepWelcome`
export const openApp = async (
  page: Page,
  hash = '',
  { keepWelcome = false, query = '' }: OpenOptions = {},
): Promise<void> => {
  await page.goto(`./${query}${hash}`);
  await expect(page.locator('wm-header h1')).not.toBeEmpty();
  await page.waitForFunction(() => '__wumble' in window);
  if (keepWelcome) return;
  const play = page.locator('wm-welcome button');
  if (await play.isVisible()) await play.click();
};

// The relay of relay-setup.ts, as the app's `?relay=` override
export const relayQuery = (): string => `?relay=ws://127.0.0.1:${process.env.KF_RELAY_PORT ?? ''}/ws`;

export interface PagePoint {
  readonly x: number;
  readonly y: number;
}

// Where to click on the canvas: `tone:<index>` for a stripe, `chord:<index>` for a chord of the map
export const stripePoint = async (page: Page, target: string): Promise<PagePoint> => {
  const box = await page.locator('wm-field canvas').boundingBox();
  if (box === null) throw new Error('canvas not visible');
  const centre = await page.evaluate((what) => {
    const [kind, value] = what.split(':');
    const index = Number(value);
    return kind === 'chord' ? window.__wumble.spotCentre(index) : window.__wumble.stripeCentre(index);
  }, target);
  if (centre === null) throw new Error(`${target} is not on the field`);
  return { x: box.x + centre.x, y: box.y + centre.y };
};

// Where to click for a MIDI note, wherever the field happens to put it
export const tonePoint = async (page: Page, midi: number): Promise<PagePoint> => {
  const tone = await page.evaluate((m) => window.__wumble.app.store.model().tones.indexOf(m), midi);
  if (tone < 0) throw new Error(`${String(midi)} is not on the field`);
  return stripePoint(page, `tone:${String(tone)}`);
};

// Two frames: the field draws on the next animation frame after a change
export const nextFrames = (page: Page, frames = 2): Promise<void> =>
  page.evaluate(
    (n) =>
      new Promise<void>((resolve) => {
        const step = (left: number): void => {
          if (left === 0) {
            resolve();
            return;
          }
          requestAnimationFrame(() => {
            step(left - 1);
          });
        };
        step(n);
      }),
    frames,
  );
