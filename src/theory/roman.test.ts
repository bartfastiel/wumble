import { describe, expect, it } from 'vitest';
import { CHORD_MAPS, type RoleId } from './chord-maps';
import type { Chord } from './chords';
import { keyBySignature } from './keys';
import { buildModel, type Model } from './model';
import { functionOf, isFunctional, romanOf } from './roman';
import { STYLE_IDS, type StyleId } from './styles';

const modelOf = (styleId: StyleId): Model => buildModel(keyBySignature(0), styleId);
// The chord playing that role, as the style's own map spells it
const roleChord = (styleId: StyleId, role: RoleId): Chord => {
  const index = CHORD_MAPS[styleId].findIndex((entry) => entry.role === role);
  if (index < 0) throw new Error(`no ${role} in ${styleId}`);
  const chord = modelOf(styleId).chords[index];
  if (chord === undefined) throw new Error(`no chord ${String(index)}`);
  return chord;
};

describe('romanOf', () => {
  it('writes major upper case, minor and diminished lower case', () => {
    expect(romanOf(roleChord('classical', 'tonic'))).toBe('I');
    expect(romanOf(roleChord('classical', 'parallel'))).toBe('vi');
    expect(romanOf(roleChord('classical', 'shortened'))).toBe('vii°');
    expect(romanOf(roleChord('classical', 'subdominant'))).toBe('IV');
    expect(romanOf(roleChord('classical', 'dominantSeventh'))).toBe('V7');
  });

  it('marks chromatic roots with ♭, the lydian fourth with ♯', () => {
    expect(romanOf(roleChord('rock', 'subtonic'))).toBe('♭VII');
    expect(romanOf(roleChord('techno', 'parallel'))).toBe('♭III');
    expect(romanOf(roleChord('lydian', 'tritone'))).toBe('♯iv°');
    expect(romanOf(roleChord('techno', 'neapolitan'))).toBe('♭II');
  });

  it('appends four-note qualities as they are', () => {
    expect(romanOf(roleChord('jazz', 'tonic'))).toBe('Imaj7');
    expect(romanOf(roleChord('jazz', 'shortened'))).toBe('viiø7');
    expect(romanOf(roleChord('jazz', 'secondDegree'))).toBe('II7');
    expect(romanOf(roleChord('wholeTone', 'augmented'))).toBe('II+');
    expect(romanOf(roleChord('blues', 'tonic'))).toBe('I7');
  });

  it.each(STYLE_IDS)('%s: every chord gets a numeral', (styleId) => {
    for (const chord of modelOf(styleId).chords) {
      const numeral = romanOf(chord);
      expect(numeral.length).toBeGreaterThan(0);
      expect(/^[♭♯]?[IiVv]+/.test(numeral)).toBe(true);
    }
  });
});

describe('isFunctional', () => {
  it('holds where the map has a major tonic with a dominant and a subdominant', () => {
    expect(isFunctional('classical')).toBe(true);
    expect(isFunctional('jazz')).toBe(true);
    expect(isFunctional('techno')).toBe(false); // minor tonic
    expect(isFunctional('wholeTone')).toBe(false); // no dominant
  });
});

describe('functionOf', () => {
  it('names Riemann functions, with the seventh appended', () => {
    expect(functionOf(roleChord('classical', 'tonic'), true)).toBe('T');
    expect(functionOf(roleChord('classical', 'dominantSeventh'), true)).toBe('D7');
    expect(functionOf(roleChord('classical', 'subdominant'), true)).toBe('S');
    expect(functionOf(roleChord('classical', 'parallel'), true)).toBe('Tp');
    expect(functionOf(roleChord('jazz', 'tonic'), true)).toBe('T7');
    expect(functionOf(roleChord('jazz', 'shortened'), true)).toBe('Đ9');
  });

  // The name on the tile and the symbol under it say the same thing: the Gegenklang is Tg, not Dp
  it('names the Gegenklang after the tonic, like the map does', () => {
    expect(functionOf(roleChord('classical', 'counter'), true)).toBe('Tg');
    expect(functionOf(roleChord('jazz', 'counter'), true)).toBe('Tg7');
  });

  it('writes a main function small where the chord is minor', () => {
    expect(functionOf(roleChord('classical', 'minorSubdominant'), true)).toBe('s');
    expect(functionOf(roleChord('classical', 'subdominant'), true)).toBe('S');
  });

  // The function follows the distance from the tonic, not the place in the scale: a pentatonic scale has five
  // notes, so its fourth chord is not its fourth degree
  it('reads the same in a scale that has no seven notes', () => {
    expect(functionOf(roleChord('pentatonic', 'dominant'), true)).toBe('D');
    expect(functionOf(roleChord('pentatonic', 'subdominant'), true)).toBe('S');
    expect(functionOf(roleChord('pentatonic', 'parallel'), true)).toBe('Tp');
  });

  it('leaves the numeral where the functions have no name for a chord', () => {
    expect(functionOf(roleChord('jazz', 'secondDegree'), true)).toBe('II7');
  });

  it('falls back to numerals for non-functional styles', () => {
    const minorTonic = roleChord('techno', 'tonic');
    expect(functionOf(minorTonic, false)).toBe(romanOf(minorTonic));
  });

  it.each(STYLE_IDS)('%s: every chord gets a name, and never the word for a missing one', (styleId) => {
    const functional = isFunctional(styleId);
    for (const chord of modelOf(styleId).chords) {
      const name = functionOf(chord, functional);
      expect(name).toMatch(/^([TSDtsd]|Tp|Tg|Sp|Đ|[♭♯]?[IiVv]+)/);
      expect(name).not.toContain('undefined');
    }
  });
});
