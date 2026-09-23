// The 13 styles as data: scale, chord map, just ratios and hints (see the ADR on the chord map per style).
import type { PitchClass } from './pitch';
import { JUST_MAJOR, JUST_MINOR, type Ratios } from './ratios';
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
  WHOLE_TONE,
} from './scales';
import type { TuningId } from './tuning';

// In the order of the settings list, grouped stage → school → nature
export const STYLE_IDS = [
  'classical',
  'blues',
  'rock',
  'techno',
  'jazz',
  'pentatonic',
  'dorian',
  'phrygian',
  'lydian',
  'mixolydian',
  'harmonicMinor',
  'wholeTone',
  'harmonicSeries',
] as const;
export type StyleId = (typeof STYLE_IDS)[number];
export type StyleGroup = 'stage' | 'school' | 'nature';
// Sound and groove suggestions of a style; their definitions belong to the audio and band modules
export type CombiId = 'piano' | 'organ' | 'guitar' | 'pop' | 'jazzTrio' | 'strings' | 'church';
export type GrooveId = 'pop' | 'blues' | 'rock' | 'techno' | 'jazz' | 'calm';

export interface Style {
  readonly group: StyleGroup;
  readonly scale: Scale;
  readonly ratios: Ratios; // just intonation per semitone above the tonic; the rest falls back to 5-limit
  readonly sharps?: readonly PitchClass[]; // scale tones spelled with ♯ although outside the major scale
  readonly tuning?: TuningId; // tuning the style switches to when chosen
  readonly combi: CombiId; // sound suggestion, applied when the style is chosen
  readonly groove: GrooveId;
  readonly tempo: number; // bpm suggestion for the band
}

export const STYLES: Readonly<Record<StyleId, Style>> = {
  classical: {
    group: 'stage',
    combi: 'piano',
    groove: 'pop',
    tempo: 100,
    scale: MAJOR,
    ratios: JUST_MAJOR,
  },
  blues: {
    group: 'stage',
    combi: 'organ',
    groove: 'blues',
    tempo: 100,
    scale: BLUES,
    // Septimal: blue notes lie between the keys – tritone 7/5, seventh 7/4 (−31 cents). The third stays 6/5: the
    // blue third is sung higher than the pure minor third, 7/6 would be lower still.
    ratios: { 0: 1, 3: 6 / 5, 5: 4 / 3, 6: 7 / 5, 7: 3 / 2, 10: 7 / 4 },
  },
  rock: {
    group: 'stage',
    combi: 'guitar',
    groove: 'rock',
    tempo: 120,
    scale: MINOR_PENTATONIC,
    // Seventh 7/4: distorted power chords stress the harmonic series, whose 7th partial is the "rock seventh"
    ratios: { 0: 1, 3: 6 / 5, 5: 4 / 3, 7: 3 / 2, 10: 7 / 4 },
  },
  techno: {
    group: 'stage',
    combi: 'pop',
    groove: 'techno',
    tempo: 128,
    scale: MINOR,
    ratios: JUST_MINOR,
  },
  // Four-note chords of the major scale
  jazz: {
    group: 'stage',
    combi: 'jazzTrio',
    groove: 'jazz',
    tempo: 130,
    scale: MAJOR,
    ratios: JUST_MAJOR,
  },

  // School: every tone of the scale fits every chord (Orff)
  pentatonic: {
    group: 'school',
    combi: 'strings',
    groove: 'pop',
    tempo: 104,
    scale: MAJOR_PENTATONIC,
    ratios: JUST_MAJOR,
  },
  // Modes (ionian = classical, aeolian = techno); the minor modes share the 5-limit minor table plus their
  // characteristic tone
  dorian: {
    group: 'school',
    combi: 'church',
    groove: 'pop',
    tempo: 108,
    scale: DORIAN,
    ratios: { ...JUST_MINOR, 9: 5 / 3 },
  },
  phrygian: {
    group: 'school',
    combi: 'church',
    groove: 'pop',
    tempo: 104,
    scale: PHRYGIAN,
    ratios: { ...JUST_MINOR, 1: 16 / 15 },
  },
  lydian: {
    group: 'school',
    combi: 'church',
    groove: 'pop',
    tempo: 108,
    scale: LYDIAN,
    ratios: { ...JUST_MAJOR, 6: 45 / 32 },
    sharps: [6], // the raised fourth is ♯IV, not ♭V
  },
  mixolydian: {
    group: 'school',
    combi: 'church',
    groove: 'pop',
    tempo: 110,
    scale: MIXOLYDIAN,
    ratios: { ...JUST_MAJOR, 10: 9 / 5 },
  },
  // Leading tone 15/8: the dominant turns major, the third degree augmented
  harmonicMinor: {
    group: 'school',
    combi: 'strings',
    groove: 'calm',
    tempo: 80,
    scale: HARMONIC_MINOR,
    ratios: { ...JUST_MINOR, 11: 15 / 8 },
  },
  wholeTone: {
    group: 'school',
    combi: 'pop',
    groove: 'calm',
    tempo: 70,
    scale: WHOLE_TONE,
    // Stacked thirds: 25/16 = two pure major thirds (C–E–G♯), with 9/5 also B♭–D–F♯ is pure; one wide third 32/25
    // per augmented triad is unavoidable because three pure thirds do not close the octave
    ratios: { 0: 1, 2: 9 / 8, 4: 5 / 4, 6: 45 / 32, 8: 25 / 16, 10: 9 / 5 },
    // Augmented triads on all six tones, below them I7♭5 as the whole-tone four-note chord
  },

  // Nature: partials 8–15 of alphorn and natural trumpet as semitones, the ratios are the true partials (alphorn fa
  // 11/8, 13/8, natural seventh 7/4). Rows as in blues so the twelve-bar blues stays playable.
  harmonicSeries: {
    group: 'nature',
    tuning: 'just',
    combi: 'church',
    groove: 'calm',
    tempo: 90,
    scale: HARMONIC_SERIES,
    sharps: [6], // the 11th partial is F♯ (alphorn fa)
    ratios: { 0: 1, 2: 9 / 8, 4: 5 / 4, 6: 11 / 8, 7: 3 / 2, 8: 13 / 8, 10: 7 / 4, 11: 15 / 8 },
  },
};
