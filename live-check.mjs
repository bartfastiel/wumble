// Prüft die veröffentlichte Seite: lädt sie, klingt sie, meldet die Konsole etwas?
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const url = `https://wumble.wer-ist-daniel-schwarz.de/${readFileSync('C:/tmp/wumble-path.txt', 'utf8').trim()}/`;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const problems = [];
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') problems.push(`${m.type()}: ${m.text()}`);
});
page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
page.on('requestfailed', (r) => problems.push(`failed: ${r.url()} ${r.failure()?.errorText ?? ''}`));

await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForSelector('wm-field canvas');
const close = page.locator('wm-credits button');
if (await close.isVisible()) await close.click();
await page.waitForTimeout(600);

const box = await page.locator('wm-field canvas').boundingBox();
await page.mouse.click(box.x + 150, box.y + 320); // ein Akkord auf der Karte
await page.waitForTimeout(300);
await page.mouse.move(box.x + 750, box.y + 400);
await page.mouse.down();
await page.waitForTimeout(400);
await page.mouse.move(box.x + 950, box.y + 420, { steps: 12 });
await page.mouse.up();
await page.waitForTimeout(300);
await page.screenshot({ path: 'C:/tmp/wumble/live.png' });

// Ein Lied und die Band
await page.locator('wm-header button[data-panel=library]').click();
await page.locator('wm-library button', { hasText: 'Alle meine Entchen' }).click();
await page.waitForTimeout(400);
await page.locator('wm-header button.band').click();
await page.waitForTimeout(1500);
await page.screenshot({ path: 'C:/tmp/wumble/live-band.png' });

// Läuft ein Sample-Abruf?
const samples = await page.evaluate(() =>
  performance.getEntriesByType('resource').filter((r) => r.name.includes('/samples/')).length,
);
console.log('title:', await page.title());
console.log('samples geladen:', samples);
console.log('probleme:', problems.length === 0 ? 'keine' : JSON.stringify(problems, null, 1));
await browser.close();
