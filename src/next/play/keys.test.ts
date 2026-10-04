import { describe, expect, it } from 'vitest';
import { GAP, bluesKeys, justTone, keyAt, keyWithHysteresis } from './keys';

describe('bluesKeys', () => {
  const keys = bluesKeys(60);

  it('are the blues scale of C and the octave above: seven keys', () => {
    expect(keys.map((k) => k.midi)).toEqual([60, 63, 65, 66, 67, 70, 72]);
  });

  it('are tuned septimally: the blue seventh lies 31 cents below the key', () => {
    const seventh = keys[5];
    expect(seventh?.tone).toBeCloseTo(70 - 0.3117, 3);
    expect(keys[4]?.tone).toBeCloseTo(67.0196, 3); // pure fifth
    expect(keys[6]?.tone).toBeCloseTo(72, 6);
  });

  it('fill the width from left to right, the carrying tones widest', () => {
    expect(keys[0]?.left).toBeCloseTo(GAP);
    expect(keys.at(-1)?.right).toBeCloseTo(1 - GAP);
    const width = (i: number): number => (keys[i]?.right ?? 0) - (keys[i]?.left ?? 0);
    expect(width(0)).toBeGreaterThan(width(3)); // root over the tritone
    expect(width(4)).toBeGreaterThan(width(2)); // fifth over the fourth
    for (let i = 1; i < keys.length; i++) expect(keys[i]?.left).toBeGreaterThan(keys[i - 1]?.right ?? 1);
  });
});

describe('justTone', () => {
  it('reaches into the next octave', () => {
    expect(justTone(60, 19)).toBeCloseTo(79.0196, 3);
  });
});

describe('keyAt', () => {
  const keys = bluesKeys(60);

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
    expect(keyWithHysteresis(keys, second.left + 0.001, 0)).toBe(0);
    expect(keyWithHysteresis(keys, (second.left + second.right) / 2, 0)).toBe(1);
    expect(keyWithHysteresis(keys, (second.left + second.right) / 2, 1)).toBe(1);
  });
});
