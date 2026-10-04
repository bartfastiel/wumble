import { describe, expect, it } from 'vitest';
import { GAP, VIOLIN, bluesKeys, justTone, keyAt, keyWithHysteresis } from './keys';

describe('bluesKeys', () => {
  const keys = bluesKeys();
  const byMidi = (midi: number) => keys.find((k) => k.midi === midi);
  const width = (midi: number): number => (byMidi(midi)?.right ?? 0) - (byMidi(midi)?.left ?? 0);

  it('are every tone of the blues scale of C across the violin, from its G string to C7', () => {
    expect(keys[0]?.midi).toBe(55);
    expect(keys.at(-1)?.midi).toBe(96);
    expect(keys).toHaveLength(21);
    expect(keys.slice(2, 9).map((k) => k.midi)).toEqual([60, 63, 65, 66, 67, 70, 72]);
  });

  it('sound septimally tuned against the tonic, below it as well as above', () => {
    expect(byMidi(70)?.tone).toBeCloseTo(70 - 0.3117, 3); // the blue seventh, 31 cents below the key
    expect(byMidi(67)?.tone).toBeCloseTo(67.0196, 3); // a pure fifth
    expect(byMidi(55)?.tone).toBeCloseTo(55.0196, 3); // the fifth an octave lower
    expect(byMidi(84)?.tone).toBeCloseTo(84, 6);
  });

  it('let the key of the music decide the width: the carrying tones widest, the tonic marked', () => {
    expect(width(60)).toBeGreaterThan(width(66)); // root over the tritone
    expect(width(67)).toBeGreaterThan(width(65)); // fifth over the fourth
    expect(width(72)).toBeCloseTo(width(60)); // the same tone in every octave
    expect(keys.filter((k) => k.tonic).map((k) => k.midi)).toEqual([60, 72, 84, 96]);
    expect(byMidi(60)?.fitness).toBe(0);
  });

  it('fill the width from left to right without overlapping', () => {
    expect(keys[0]?.left).toBeCloseTo(GAP);
    expect(keys.at(-1)?.right).toBeCloseTo(1 - GAP);
    for (let i = 1; i < keys.length; i++) expect(keys[i]?.left).toBeGreaterThan(keys[i - 1]?.right ?? 1);
  });

  it('follow another range', () => {
    expect(bluesKeys({ ...VIOLIN, low: 60, high: 72 }).map((k) => k.midi)).toEqual([60, 63, 65, 66, 67, 70, 72]);
  });
});

describe('justTone', () => {
  it('reaches into the next octave and below the tonic', () => {
    expect(justTone(60, 19)).toBeCloseTo(79.0196, 3);
    expect(justTone(60, -2)).toBeCloseTo(58 - 0.3117, 3);
  });
});

describe('keyAt', () => {
  const keys = bluesKeys();

  it('finds the key under the finger and the nearer key in a gap', () => {
    const first = keys[0];
    const second = keys[1];
    if (first === undefined || second === undefined) throw new Error('keys');
    expect(keyAt(keys, (first.left + first.right) / 2)).toBe(0);
    expect(keyAt(keys, first.right + GAP * 0.4)).toBe(0);
    expect(keyAt(keys, second.left - GAP * 0.1)).toBe(1);
    expect(keyAt(keys, 2)).toBe(keys.length - 1);
  });

  it('keeps the current key until the finger is well inside the next one', () => {
    const second = keys[1];
    if (second === undefined) throw new Error('keys');
    expect(keyWithHysteresis(keys, second.left + 0.0001, 0)).toBe(0);
    expect(keyWithHysteresis(keys, (second.left + second.right) / 2, 0)).toBe(1);
    expect(keyWithHysteresis(keys, (second.left + second.right) / 2, 1)).toBe(1);
  });
});
