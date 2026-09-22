import { describe, expect, it } from 'vitest';
import { RECORDED } from './__fixtures__/recorded';
import { hueOf, keyBySignature, KEYS } from './keys';
import { NAMES_FLAT, NAMES_SHARP } from './pitch';

describe('KEYS', () => {
  it('run from six sharps to six flats', () => {
    expect(KEYS.map((key) => key.signature)).toEqual([6, 5, 4, 3, 2, 1, 0, -1, -2, -3, -4, -5, -6]);
  });

  it('match the reference: tonic, spelling and hue', () => {
    expect(KEYS).toHaveLength(RECORDED.keys.length);
    KEYS.forEach((key, i) => {
      const recorded = RECORDED.keys[i];
      expect(key.signature).toBe(recorded?.k);
      expect(key.tonic).toBe(recorded?.tonic);
      expect(key.names).toBe(recorded?.sharp === true ? NAMES_SHARP : NAMES_FLAT);
      expect(hueOf(key)).toBe(recorded?.hue);
    });
  });

  it('follow the circle of fifths', () => {
    expect(keyBySignature(1).tonic).toBe(7); // G
    expect(keyBySignature(-1).tonic).toBe(5); // F
    expect(keyBySignature(6).tonic).toBe(keyBySignature(-6).tonic); // F♯ = G♭
  });
});

describe('keyBySignature', () => {
  it('finds C major', () => {
    expect(keyBySignature(0)).toEqual({ signature: 0, tonic: 0, names: NAMES_SHARP });
  });

  it('rejects unknown signatures', () => {
    expect(() => keyBySignature(7)).toThrow(RangeError);
  });
});

describe('hueOf', () => {
  it('turns 30° per fifth, C major at 85°', () => {
    expect(hueOf(keyBySignature(0))).toBe(85);
    expect(hueOf(keyBySignature(1))).toBe(55);
    expect(hueOf(keyBySignature(-1))).toBe(115);
    expect(hueOf(keyBySignature(6))).toBe(hueOf(keyBySignature(-6)));
  });
});
