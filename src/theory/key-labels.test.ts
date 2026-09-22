import { describe, expect, it } from 'vitest';
import { setLocale, t } from '../i18n';
import { RECORDED } from './__fixtures__/recorded';
import { keyLabel, keyTitle, signatureLabel } from './key-labels';
import { keyBySignature, KEYS } from './keys';
import { TUNING_IDS } from './tuning';

describe('keyLabel and keyTitle', () => {
  it('match the reference in German, with and without German note names', () => {
    setLocale('de');
    KEYS.forEach((key, i) => {
      const recorded = RECORDED.keys[i];
      expect(keyLabel(key)).toBe(recorded?.label);
      expect(keyLabel(key, true)).toBe(recorded?.labelGerman);
      expect(keyTitle(key)).toBe(recorded?.title);
      expect(keyTitle(key, true)).toBe(recorded?.titleGerman);
      expect(signatureLabel(key.signature)).toBe(recorded?.signature);
    });
  });

  it('read naturally in English', () => {
    setLocale('en');
    expect(keyLabel(keyBySignature(0))).toBe('C major / A minor');
    expect(keyLabel(keyBySignature(-2))).toBe('B♭ major / G minor');
    expect(keyTitle(keyBySignature(3))).toBe('A major ♯♯♯');
    expect(keyTitle(keyBySignature(0))).toBe('C major');
  });
});

describe('signatureLabel', () => {
  it('counts sharps or flats, a dash for none', () => {
    expect(signatureLabel(3)).toBe('3 ♯');
    expect(signatureLabel(-1)).toBe('1 ♭');
    expect(signatureLabel(0)).toBe('–');
  });
});

describe('tuning names', () => {
  it('exist in every locale', () => {
    for (const locale of ['de', 'en'] as const) {
      setLocale(locale);
      for (const id of TUNING_IDS) {
        expect(t(`theory.tuning.${id}.name`)).not.toBe(`theory.tuning.${id}.name`);
        expect(t(`theory.tuning.${id}.hint`)).not.toBe(`theory.tuning.${id}.hint`);
      }
    }
  });
});
