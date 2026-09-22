import { describe, expect, it } from 'vitest';
import { FIXTURES, readPgm } from './__fixtures__/recorded';
import { EXAMPLE_HEIGHT, EXAMPLE_NOTES, EXAMPLE_WIDTH, renderExampleSheet } from './example-sheet';
import { type GrayImage, grayscale } from './raster';

const blackRows = (image: GrayImage): number[] => {
  const rows: number[] = [];
  for (let y = 0; y < image.height; y++) {
    let black = true;
    for (let x = 100; x < 1100 && black; x++) black = (image.data[y * image.width + x] ?? 0) < 40;
    if (black) rows.push(y);
  }
  return rows;
};

describe('EXAMPLE_NOTES', () => {
  it('are the 27 notes of "Alle meine Entchen" in ten bars of four beats', () => {
    expect(EXAMPLE_NOTES).toHaveLength(27);
    expect(EXAMPLE_NOTES.reduce((sum, note) => sum + note.beats, 0)).toBe(40);
    expect(EXAMPLE_NOTES.slice(0, 6).map((note) => note.midi)).toEqual([60, 62, 64, 65, 67, 67]);
  });
});

describe('renderExampleSheet', () => {
  const clean = grayscale(renderExampleSheet());

  it('has the size and staff lines of the reference recording', () => {
    expect(clean.width).toBe(EXAMPLE_WIDTH);
    expect(clean.height).toBe(EXAMPLE_HEIGHT);
    expect(blackRows(clean)).toEqual([144, 158, 172, 186, 200, 364, 378, 392, 406, 420]);
  });

  it('differs from the reference recording only in title, clef and digits', () => {
    const recorded = readPgm(FIXTURES.clean);
    expect(blackRows(recorded)).toEqual(blackRows(clean));
    let differing = 0;
    for (let i = 0; i < recorded.data.length; i++)
      if (Math.abs((recorded.data[i] ?? 0) - (clean.data[i] ?? 0)) > 128) differing++;
    expect(differing / recorded.data.length).toBeLessThan(0.01);
  });

  it('is white paper with black ink', () => {
    expect(clean.data[0]).toBe(255);
    expect(clean.data[200 * EXAMPLE_WIDTH + 600]).toBe(0); // on the lowest line
  });

  // Three photo renders: seconds under coverage on a slow runner
  it('puts the photo on a dark table, reproducibly per seed', { timeout: 60_000 }, () => {
    const photo = grayscale(renderExampleSheet({ photo: true }));
    expect(photo.data[0]).toBeLessThan(120);
    expect(photo.data[5 * EXAMPLE_WIDTH + 5]).toBeLessThan(120);
    expect(grayscale(renderExampleSheet({ photo: true })).data).toEqual(photo.data);
    expect(grayscale(renderExampleSheet({ photo: true, seed: 2 })).data).not.toEqual(photo.data);
  });
});
