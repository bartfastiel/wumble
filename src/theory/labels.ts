// "Show me what you do": labels of the tones and of the chords, relative to the tonic of the key.
import type { Quality } from './chord-spec';
import type { Chord } from './chords';
import type { Key } from './keys';
import type { Model } from './model';
import { type Chromatic, germanName, NAMES_FLAT, pcOf, type PitchClass, type Spelling } from './pitch';
import { functionOf, isFunctional, romanOf } from './roman';
import { MAJOR } from './scales';
import type { Style } from './styles';

export const LABEL_MODES = ['names', 'notes', 'solfege', 'degrees', 'functions'] as const;
export type LabelMode = (typeof LABEL_MODES)[number];
export interface Labeling {
  readonly mode: LabelMode;
  readonly german: boolean; // H instead of B
}

type Spelled = Readonly<Record<Spelling, Chromatic<string>>>;
// Relative solmisation, movable do
const SOLFEGE: Spelled = {
  flat: ['do', 'ra', 're', 'me', 'mi', 'fa', 'se', 'so', 'le', 'la', 'te', 'ti'],
  sharp: ['do', 'di', 're', 'ri', 'mi', 'fa', 'fi', 'so', 'si', 'la', 'li', 'ti'],
};
const DEGREES: Spelled = {
  flat: ['1', '♭2', '2', '♭3', '3', '4', '♭5', '5', '♭6', '6', '♭7', '7'],
  sharp: ['1', '♯1', '2', '♯2', '3', '4', '♯4', '5', '♯5', '6', '♯6', '7'],
};
// Chord symbol: C, Dm, B°, E♭+ – other qualities as they are (G7, C5, Cmaj7, Bø7)
const SYMBOL_SUFFIX: Partial<Record<Quality, string>> = { major: '', minor: 'm', dim: '°', aug: '+' };

const spell = (name: string, german: boolean): string => (german ? germanName(name) : name);

// Tones outside the major scale are spelled with ♭ (me, ♭3) unless the style lists them as ♯ (fi, ♯4 in lydian)
const isSharp = (style: Style, semitone: PitchClass): boolean => (style.sharps ?? []).includes(semitone);
const spellingOf = (style: Style, semitone: PitchClass): Spelling => (isSharp(style, semitone) ? 'sharp' : 'flat');

// Note name of the tone `semitone` above the tonic, spelled like the chord roots (English)
export const toneName = (key: Key, style: Style, semitone: PitchClass): string =>
  (MAJOR.includes(semitone) || isSharp(style, semitone) ? key.names : NAMES_FLAT)[pcOf(key.tonic + semitone)];

// Tone label: note name (also for "notes", the fallback of narrow cells), syllable or degree
export const toneLabel = (key: Key, style: Style, semitone: PitchClass, { mode, german }: Labeling): string => {
  if (mode === 'names' || mode === 'notes') return spell(toneName(key, style, semitone), german);
  return (mode === 'solfege' ? SOLFEGE : DEGREES)[spellingOf(style, semitone)][semitone];
};

// Chord label: chord symbol (Dm7), syllable with suffix (re m7), numeral (ii7) or function (Sp7)
export const chordLabel = (chord: Chord, functional: boolean, { mode, german }: Labeling): string => {
  const suffix = SYMBOL_SUFFIX[chord.quality] ?? chord.quality;
  switch (mode) {
    case 'names':
    case 'notes':
      return spell(chord.name, german) + suffix;
    case 'solfege':
      return SOLFEGE[chord.sharp ? 'sharp' : 'flat'][chord.offset] + (suffix === '' ? '' : ` ${suffix}`);
    case 'degrees':
      return romanOf(chord);
    case 'functions':
      return functionOf(chord, functional);
  }
};

export interface FieldLabels {
  readonly chords: readonly string[]; // one per chord of the map
  readonly tones: readonly string[];
}

export const fieldLabels = (model: Model, labeling: Labeling): FieldLabels => {
  const { key, style, styleId } = model;
  const functional = isFunctional(styleId);
  return {
    chords: model.chords.map((chord) => chordLabel(chord, functional, labeling)),
    tones: model.tones.map((midi) => toneLabel(key, style, pcOf(midi - key.tonic), labeling)),
  };
};
