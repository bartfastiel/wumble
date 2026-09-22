import { describe, expect, it } from 'vitest';
import { CHORD_MAPS, type RoleId } from './chord-maps';
import type { Chord } from './chords';
import { keyBySignature } from './keys';
import { chordLabel, fieldLabels, LABEL_MODES, type Labeling, toneLabel, toneName } from './labels';
import { buildModel } from './model';
import { STYLE_IDS, type StyleId, STYLES } from './styles';

const C = keyBySignature(0);
const names: Labeling = { mode: 'names', german: false };
const german: Labeling = { mode: 'names', german: true };
const solfege: Labeling = { mode: 'solfege', german: false };
const degrees: Labeling = { mode: 'degrees', german: false };
const cMajor = buildModel(C, 'classical');

const roleChord = (styleId: StyleId, role: RoleId): Chord => {
  const index = CHORD_MAPS[styleId].findIndex((entry) => entry.role === role);
  const chord = buildModel(C, styleId).chords[index];
  if (chord === undefined) throw new Error(`no ${role} in ${styleId}`);
  return chord;
};

describe('toneName', () => {
  it('spells scale tones in the key and chromatic tones with flats', () => {
    expect(toneName(keyBySignature(2), STYLES.classical, 11)).toBe('C♯');
    expect(toneName(keyBySignature(2), STYLES.blues, 3)).toBe('F'); // ♭3 in D
    expect(toneName(C, STYLES.blues, 6)).toBe('G♭');
  });

  it('follows the style for sharps: lydian ♯4, the 11th partial F♯', () => {
    expect(toneName(C, STYLES.lydian, 6)).toBe('F♯');
    expect(toneName(C, STYLES.harmonicSeries, 6)).toBe('F♯');
  });
});

describe('toneLabel', () => {
  it('names, German names, syllables and degrees', () => {
    expect(toneLabel(C, STYLES.classical, 11, names)).toBe('B');
    expect(toneLabel(C, STYLES.classical, 11, german)).toBe('H');
    expect(toneLabel(C, STYLES.classical, 11, { mode: 'notes', german: false })).toBe('B');
    expect(toneLabel(C, STYLES.classical, 11, solfege)).toBe('ti');
    expect(toneLabel(C, STYLES.blues, 3, solfege)).toBe('me');
    expect(toneLabel(C, STYLES.lydian, 6, solfege)).toBe('fi');
    expect(toneLabel(C, STYLES.blues, 6, degrees)).toBe('♭5');
    expect(toneLabel(C, STYLES.lydian, 6, { mode: 'functions', german: false })).toBe('♯4');
  });
});

describe('chordLabel', () => {
  const g7 = roleChord('classical', 'dominantSeventh');
  const bDim = roleChord('classical', 'shortened');
  const tonic = roleChord('classical', 'tonic');

  it('writes the chord symbol with suffix', () => {
    expect(chordLabel(g7, true, names)).toBe('G7');
    expect(chordLabel(bDim, true, names)).toBe('B°');
    expect(chordLabel(bDim, true, german)).toBe('H°');
    expect(chordLabel(tonic, true, names)).toBe('C');
  });

  it('writes the syllable with the suffix set apart', () => {
    expect(chordLabel(g7, true, solfege)).toBe('so 7');
    expect(chordLabel(tonic, true, solfege)).toBe('do');
  });

  it('writes numerals and functions', () => {
    expect(chordLabel(g7, true, degrees)).toBe('V7');
    expect(chordLabel(g7, true, { mode: 'functions', german: false })).toBe('D7');
    expect(chordLabel(g7, false, { mode: 'functions', german: false })).toBe('V7');
  });
});

describe('fieldLabels', () => {
  it('labels every chord of the map and every tone of the field', () => {
    const labels = fieldLabels(cMajor, names);
    expect(labels.chords).toHaveLength(cMajor.map.length);
    expect(labels.tones).toHaveLength(cMajor.tones.length);
    expect(labels.chords[cMajor.home]).toBe('C');
    expect(labels.tones[0]).toBe('C');
  });

  it.each(STYLE_IDS)('%s gives every chord and every tone a label in every mode', (styleId) => {
    const model = buildModel(C, styleId);
    for (const mode of LABEL_MODES) {
      const { chords, tones } = fieldLabels(model, { mode, german: false });
      expect(chords).toHaveLength(model.map.length);
      expect(tones).toHaveLength(model.tones.length);
      expect(chords.every((label) => label.length > 0)).toBe(true);
      expect(tones.every((label) => label.length > 0)).toBe(true);
    }
  });

  it('repeats a pitch class in every octave', () => {
    const { tones } = fieldLabels(cMajor, names);
    const perOctave = cMajor.style.scale.length;
    expect(tones.slice(0, perOctave)).toEqual(tones.slice(perOctave, perOctave * 2));
  });
});
