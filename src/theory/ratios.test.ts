import { describe, expect, it } from 'vitest';
import { RECORDED } from './__fixtures__/recorded';
import type { PitchClass } from './pitch';
import { CHORD_RATIOS, CHROMA_5, JUST_MAJOR, JUST_MINOR, meantoneRatio, PYTHAGOREAN } from './ratios';

const PITCH_CLASSES: readonly PitchClass[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

describe('ratio tables', () => {
  it('match the reference', () => {
    expect(CHROMA_5).toEqual(RECORDED.tables.CHROMA_5);
    expect(PYTHAGOREAN).toEqual(RECORDED.tables.PYTHAGOREAN);
    expect(PITCH_CLASSES.map(meantoneRatio)).toEqual(RECORDED.tables.MEANTONE);
    expect(CHORD_RATIOS).toEqual(RECORDED.tables.CHORD_RATIOS);
  });

  it('stay within the octave and rise with the semitone', () => {
    for (const table of [CHROMA_5, PYTHAGOREAN, PITCH_CLASSES.map(meantoneRatio)]) {
      expect(table[0]).toBe(1);
      for (let s = 1; s < 12; s++) {
        expect(table[s]).toBeGreaterThan(table[s - 1] ?? 2);
        expect(table[s]).toBeLessThan(2);
      }
    }
  });

  it('major and minor are 5-limit: pure fifth, pure thirds', () => {
    expect(JUST_MAJOR).toMatchObject({ 4: 1.25, 7: 1.5 });
    expect(JUST_MINOR).toMatchObject({ 7: 1.5 });
    expect(JUST_MINOR[3]).toBeCloseTo(6 / 5, 15);
  });
});

describe('meantoneRatio', () => {
  it('has pure major thirds: four fifths make exactly 5', () => {
    expect(meantoneRatio(4)).toBe(1.25);
    expect(meantoneRatio(8)).toBe(1.5625); // 25/16, two pure thirds
  });

  it('keeps the fifth flat by a quarter comma', () => {
    const cents = 1200 * Math.log2(meantoneRatio(7));
    expect(cents).toBeCloseTo(696.58, 2);
  });
});
