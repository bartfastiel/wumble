import { describe, expect, it } from 'vitest';
import { RECORDED } from './__fixtures__/recorded';
import {
  BLUES,
  DORIAN,
  HARMONIC_MINOR,
  HARMONIC_SERIES,
  LYDIAN,
  MAJOR,
  MAJOR_PENTATONIC,
  MINOR,
  MINOR_PENTATONIC,
  MIXOLYDIAN,
  PHRYGIAN,
  type Scale,
  stepOf,
  WHOLE_TONE,
} from './scales';

const SCALES: Record<string, Scale> = {
  MAJOR,
  MINOR,
  DORIAN,
  PHRYGIAN,
  LYDIAN,
  MIXOLYDIAN,
  HARMONIC_MINOR,
  MAJOR_PENTATONIC,
  MINOR_PENTATONIC,
  BLUES,
  WHOLE_TONE,
  HARMONIC_SERIES,
};

// The major scale started on another degree
const mode = (degree: number): number[] =>
  [0, 1, 2, 3, 4, 5, 6].map((i) => (stepOf(MAJOR, degree + i) - stepOf(MAJOR, degree) + 12) % 12);

describe('scales', () => {
  it.each(Object.entries(SCALES))('%s starts on the root and rises within the octave', (_, scale) => {
    expect(scale[0]).toBe(0);
    expect([...scale].sort((a, b) => a - b)).toEqual([...scale]);
    expect(new Set(scale).size).toBe(scale.length);
  });

  it('match the reference', () => {
    expect(MAJOR).toEqual(RECORDED.tables.MAJOR);
    expect(MINOR).toEqual(RECORDED.tables.MINOR);
  });

  it('modes are rotations of the major scale', () => {
    expect(mode(1)).toEqual(DORIAN);
    expect(mode(2)).toEqual(PHRYGIAN);
    expect(mode(3)).toEqual(LYDIAN);
    expect(mode(4)).toEqual(MIXOLYDIAN);
    expect(mode(5)).toEqual(MINOR);
  });
});

describe('stepOf', () => {
  it('wraps around the octave', () => {
    expect(stepOf(MAJOR, 0)).toBe(0);
    expect(stepOf(MAJOR, 6)).toBe(11);
    expect(stepOf(MAJOR, 7)).toBe(0);
    expect(stepOf(MAJOR, 9)).toBe(4);
  });
});
