import { describe, expect, it } from 'vitest';
import { FIXTURES, RECORDED, readPgm, type SongNote } from './__fixtures__/recorded';
import { EXAMPLE_NOTES, renderExampleSheet } from './example-sheet';
import { SCAN_WIDTH, toRgba } from './raster';
import { type ScannedNote, ScanError, scanSheet } from './sheet-scanner';

interface Rate {
  readonly count: number;
  readonly pitches: number; // matching by position
  readonly beats: number;
}

const rate = (notes: readonly ScannedNote[], expected: readonly SongNote[]): Rate => {
  let pitches = 0;
  let beats = 0;
  notes.forEach((note, i) => {
    if (note.midi === expected[i]?.midi) pitches++;
    if (note.beats === expected[i]?.beats) beats++;
  });
  return { count: notes.length, pitches, beats };
};

const caught = (run: () => unknown): unknown => {
  try {
    run();
  } catch (error) {
    return error;
  }
  return undefined;
};

const PERFECT: Rate = { count: 27, pitches: 27, beats: 27 };
const NINETY_PERCENT = Math.ceil(0.9 * 27);
// A simulated photo takes seconds under coverage on a slow runner – the tests read a few angles and seeds only
const PHOTO_TIMEOUT_MS = 60_000;

describe('scanSheet on the fixtures of the reference recording', () => {
  it('reads all 27 notes with their durations from the clean example sheet', () => {
    const result = scanSheet(toRgba(readPgm(FIXTURES.clean)), { signature: 0 });
    expect(rate(result.notes, RECORDED.song)).toEqual(PERFECT);
    expect(result.angle).toBe(0);
    expect(result.staves).toHaveLength(2);
    expect(result.width).toBe(SCAN_WIDTH);
  });

  it('reads at least 90 % of the simulated photo (1.5°, seed 1) – actually all of it', () => {
    const result = scanSheet(toRgba(readPgm(FIXTURES.photo)), { signature: 0 });
    const { pitches, beats } = rate(result.notes, RECORDED.song);
    expect(pitches).toBeGreaterThanOrEqual(NINETY_PERCENT);
    expect(rate(result.notes, RECORDED.song)).toEqual(PERFECT);
    expect(beats).toBe(27);
    expect(result.angle).toBe(1.5);
  });

  it('reads the pitches of the real Wikimedia Commons scan', () => {
    const result = scanSheet(toRgba(readPgm(FIXTURES.commons)), { signature: 0 });
    const names = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
    expect(result.notes.map((note) => names[note.midi % 12]).join(' ')).toBe(
      'C D E F G G A A A A G A A A A G F F F F E E D D D D C',
    );
    expect(rate(result.notes, RECORDED.commons.notes).pitches).toBe(27);
  });

  it('places the boxes where the reference recording found the heads', () => {
    const result = scanSheet(toRgba(readPgm(FIXTURES.clean)), { signature: 0 });
    const scale = SCAN_WIDTH / RECORDED.clean.width;
    result.debug.boxes.forEach((box, i) => {
      expect(Math.abs(box.x / scale - (RECORDED.clean.notes[i]?.x ?? 0))).toBeLessThan(1.5);
      expect(Math.abs(box.y / scale - (RECORDED.clean.notes[i]?.y ?? 0))).toBeLessThan(1.5);
    });
    expect(result.debug.lines).toHaveLength(2);
    expect(result.debug.profile).toHaveLength(result.height);
  });
});

describe('scanSheet on the rendered example sheet', { timeout: PHOTO_TIMEOUT_MS }, () => {
  it('reads the clean sheet completely', () => {
    const result = scanSheet(renderExampleSheet(), { signature: 0 });
    expect(rate(result.notes, EXAMPLE_NOTES)).toEqual(PERFECT);
    expect(result.crop).toEqual({ x0: 0, y0: 0, x1: SCAN_WIDTH, y1: result.height });
  });

  it.each([-5, -3, -1.5, 0, 1.5, 3, 4.5, 6])('reads the photo at %s°', (angle) => {
    for (const seed of [1, 2]) {
      const result = scanSheet(renderExampleSheet({ photo: true, angle, seed }), { signature: 0 });
      expect(result.angle).toBeCloseTo(angle, 1);
      expect(rate(result.notes, EXAMPLE_NOTES).pitches).toBeGreaterThanOrEqual(NINETY_PERCENT);
    }
  });

  it('reads the photo at 1.5° completely with the first seeds', () => {
    for (const seed of [1, 2, 3]) {
      const result = scanSheet(renderExampleSheet({ photo: true, angle: 1.5, seed }), { signature: 0 });
      expect(rate(result.notes, EXAMPLE_NOTES)).toEqual(PERFECT);
    }
  });

  it('reads high notes with their stems down and ledger lines above the staff', () => {
    const notes = [71, 72, 74, 76, 77, 79, 81, 83].map((midi) => ({ midi, beats: 1 as const }));
    const result = scanSheet(renderExampleSheet({ notes }), { signature: 0 });
    expect(result.notes.map((note) => note.midi)).toEqual([71, 72, 74, 76, 77, 79, 81, 83]);
    expect(result.notes.every((note) => note.beats === 1)).toBe(true);
  });

  it('transposes with the key signature', () => {
    const result = scanSheet(renderExampleSheet(), { signature: 2 });
    expect(result.notes.slice(0, 4).map((note) => note.midi)).toEqual([61, 62, 64, 66]); // C♯ D E F♯
  });

  it('gives up beyond the skew search at 7° and hands over the profile for a hint', () => {
    const image = renderExampleSheet({ photo: true, angle: 7 });
    const error = caught(() => scanSheet(image, { signature: 0 }));
    expect(error).toBeInstanceOf(ScanError);
    expect(error).toMatchObject({ name: 'ScanError', code: 'noStaff', angle: 6 });
    expect((error as ScanError).profile.length).toBeGreaterThan(0);
  });

  it('finds no staff on blank paper', () => {
    const blank = { width: 200, height: 100, data: new Uint8ClampedArray(200 * 100 * 4).fill(255) };
    expect(() => scanSheet(blank, { signature: 0 })).toThrow(/noStaff/);
  });
});
