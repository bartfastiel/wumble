import { describe, expect, it } from 'vitest';
import { keyBySignature, KEYS } from '../theory/keys';
import { notePosition } from '../theory/staff-position';
import { STYLES } from '../theory/styles';
import { foldIntoRange, stepMidi } from './pitch-from-staff';

describe('stepMidi', () => {
  it('counts naturals from E4 on the lowest line in C major', () => {
    expect([-2, -1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((step) => stepMidi(step, 0))).toEqual([
      60, 62, 64, 65, 67, 69, 71, 72, 74, 76, 77, 79, 81, 83, 84,
    ]);
    expect(stepMidi(-9, 0)).toBe(48); // C3
    expect(stepMidi(-7, 0)).toBe(52); // E3
  });

  // Alteration of the letters C D E F G A B (steps −2…4) by every key signature
  it.each([
    [6, [1, 1, 1, 1, 1, 1, 0]],
    [5, [1, 1, 0, 1, 1, 1, 0]],
    [4, [1, 1, 0, 1, 1, 0, 0]],
    [3, [1, 0, 0, 1, 1, 0, 0]],
    [2, [1, 0, 0, 1, 0, 0, 0]],
    [1, [0, 0, 0, 1, 0, 0, 0]],
    [0, [0, 0, 0, 0, 0, 0, 0]],
    [-1, [0, 0, 0, 0, 0, 0, -1]],
    [-2, [0, 0, -1, 0, 0, 0, -1]],
    [-3, [0, 0, -1, 0, 0, -1, -1]],
    [-4, [0, -1, -1, 0, 0, -1, -1]],
    [-5, [0, -1, -1, 0, -1, -1, -1]],
    [-6, [-1, -1, -1, 0, -1, -1, -1]],
  ])('applies the key signature %s', (signature, alterations) => {
    const naturals = [60, 62, 64, 65, 67, 69, 71];
    const expected = naturals.map((midi, i) => midi + (alterations[i] ?? 0));
    expect([-2, -1, 0, 1, 2, 3, 4].map((step) => stepMidi(step, signature))).toEqual(expected);
  });

  // Six accidentals bring E♯ and C♭, which the twelve note names spell as F and B
  it('is the inverse of the staff position in every key up to five accidentals', () => {
    for (const key of KEYS.filter((k) => Math.abs(k.signature) < 6)) {
      for (let step = -9; step <= 16; step++) {
        expect(notePosition(stepMidi(step, key.signature), key, STYLES.classical)).toEqual({ step, accidental: '' });
      }
    }
  });

  it('reads E♯ in F♯ major and C♭ in G♭ major enharmonically', () => {
    expect(stepMidi(0, 6)).toBe(65);
    expect(stepMidi(5, -6)).toBe(71);
  });

  it('keeps F♯ in G major an octave apart', () => {
    expect(stepMidi(1, 1)).toBe(66);
    expect(stepMidi(8, 1)).toBe(78);
    expect(stepMidi(-6, keyBySignature(1).signature)).toBe(54);
  });
});

describe('foldIntoRange', () => {
  it('shifts by octaves until the tone fits', () => {
    expect(foldIntoRange(48, 55, 84)).toBe(60);
    expect(foldIntoRange(96, 55, 84)).toBe(84);
    expect(foldIntoRange(67, 55, 84)).toBe(67);
    expect(foldIntoRange(36, 55, 84)).toBe(60);
  });
});
