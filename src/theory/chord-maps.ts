// The chord map of a style: which chords it offers, where they sit and what they do there.
// Vertical is pull (negative steps lead home, positive ones lead away), horizontal holds substitutes.
import type { ChordSpec, Quality } from './chord-spec';
import { type PitchClass, pcOf } from './pitch';
import type { Degree } from './scales';
import type { StyleId } from './styles';

export type ChordShape = 'major' | 'minor' | 'dom7' | 'maj7' | 'min7' | 'dim' | 'dim7' | 'halfDim' | 'aug' | 'domFlat5';

export const SHAPE_INTERVALS: Readonly<Record<ChordShape, readonly number[]>> = {
  major: [0, 4, 7],
  minor: [0, 3, 7],
  dom7: [0, 4, 7, 10],
  maj7: [0, 4, 7, 11],
  min7: [0, 3, 7, 10],
  dim: [0, 3, 6],
  dim7: [0, 3, 6, 9],
  halfDim: [0, 3, 6, 10],
  aug: [0, 4, 8],
  domFlat5: [0, 4, 6, 10],
};

const QUALITY_OF: Readonly<Record<ChordShape, Quality>> = {
  major: 'major',
  minor: 'minor',
  dom7: '7',
  maj7: 'maj7',
  min7: 'm7',
  dim: 'dim',
  dim7: 'dim7',
  halfDim: 'ø7',
  aug: 'aug',
  domFlat5: '7♭5',
};

export const SHAPE_SUFFIX: Readonly<Record<ChordShape, string>> = {
  major: '',
  minor: 'm',
  dom7: '7',
  maj7: 'maj7',
  min7: 'm7',
  dim: '°',
  dim7: '°7',
  halfDim: 'ø7',
  aug: '+',
  domFlat5: '7♭5',
};

// Names of the roles, translated in the i18n module
export const ROLE_IDS = [
  'tonic',
  'tonicSeventh',
  'dominant',
  'dominantSeventh',
  'subdominant',
  'minorSubdominant',
  'majorSubdominant',
  'parallel',
  'counter',
  'subtonic',
  'shortened',
  'diminished',
  'augmented',
  'neapolitan',
  'secondDegree',
  'thirdDegree',
  'sixthDegree',
  'seventhDegree',
  'tritone',
  'turnaround',
  'passing',
  'naturalSeventh',
  'silence',
] as const;
export type RoleId = (typeof ROLE_IDS)[number];

export interface MapChord {
  readonly semitones: number; // above the tonic
  readonly shape: ChordShape;
  readonly step: number;
  readonly side: number; // 0 on the axis of pull, ±1 beside it
  readonly role: RoleId;
}

const chord = (semitones: number, shape: ChordShape, step: number, role: RoleId, side = 0): MapChord => ({
  semitones,
  shape,
  step,
  side,
  role,
});

const MAJOR_MAP: readonly MapChord[] = [
  chord(7, 'dom7', -2, 'dominantSeventh'),
  chord(7, 'major', -1, 'dominant'),
  chord(11, 'dim', -1, 'shortened', 1),
  chord(4, 'minor', 0, 'counter', -1),
  chord(0, 'major', 0, 'tonic'),
  chord(9, 'minor', 0, 'parallel', 1),
  chord(0, 'dom7', 1, 'tonicSeventh'),
  chord(5, 'major', 2, 'subdominant'),
  chord(2, 'minor', 2, 'parallel', -1),
  chord(5, 'minor', 3, 'minorSubdominant'),
];

const MINOR_MAP: readonly MapChord[] = [
  chord(7, 'dom7', -2, 'dominantSeventh'),
  chord(7, 'minor', -1, 'dominant'),
  chord(10, 'major', -1, 'subtonic', 1),
  chord(3, 'major', 0, 'parallel', -1),
  chord(0, 'minor', 0, 'tonic'),
  chord(8, 'major', 0, 'counter', 1),
  chord(5, 'minor', 2, 'subdominant'),
  chord(1, 'major', 2, 'neapolitan', -1),
  chord(5, 'major', 3, 'majorSubdominant'),
];

export const CHORD_MAPS: Readonly<Record<StyleId, readonly MapChord[]>> = {
  classical: MAJOR_MAP,
  techno: MINOR_MAP,
  jazz: [
    chord(7, 'dom7', -2, 'dominantSeventh'),
    chord(11, 'halfDim', -1, 'shortened', 1),
    chord(4, 'min7', 0, 'counter', -1),
    chord(0, 'maj7', 0, 'tonic'),
    chord(9, 'min7', 0, 'parallel', 1),
    chord(2, 'min7', 1, 'turnaround'),
    chord(5, 'maj7', 2, 'subdominant'),
    chord(2, 'dom7', 2, 'secondDegree', -1),
  ],
  blues: [
    chord(7, 'dom7', -2, 'dominant'),
    chord(2, 'min7', -1, 'turnaround'),
    chord(0, 'dom7', 0, 'tonic'),
    chord(9, 'min7', 0, 'parallel', 1),
    chord(6, 'dim', 1, 'passing', -1),
    chord(5, 'dom7', 2, 'subdominant'),
  ],
  rock: [
    chord(7, 'minor', -1, 'dominant'),
    chord(10, 'major', -1, 'subtonic', 1),
    chord(0, 'minor', 0, 'tonic'),
    chord(3, 'major', 0, 'parallel', -1),
    chord(5, 'minor', 2, 'subdominant'),
  ],
  pentatonic: [
    chord(7, 'major', -1, 'dominant'),
    chord(0, 'major', 0, 'tonic'),
    chord(9, 'minor', 0, 'parallel', 1),
    chord(5, 'major', 2, 'subdominant'),
  ],
  dorian: [
    chord(7, 'min7', -1, 'dominant'),
    chord(10, 'major', -1, 'subtonic', 1),
    chord(3, 'major', 0, 'parallel', -1),
    chord(0, 'min7', 0, 'tonic'),
    chord(9, 'dim', 0, 'sixthDegree', 1),
    chord(5, 'major', 2, 'majorSubdominant'),
    chord(2, 'minor', 2, 'parallel', -1),
  ],
  phrygian: [
    chord(1, 'major', -1, 'secondDegree'),
    chord(10, 'major', -1, 'subtonic', 1),
    chord(3, 'major', 0, 'parallel', -1),
    chord(0, 'minor', 0, 'tonic'),
    chord(8, 'major', 0, 'counter', 1),
    chord(5, 'minor', 2, 'subdominant'),
    chord(1, 'maj7', 2, 'secondDegree', -1),
  ],
  lydian: [
    chord(7, 'major', -1, 'dominant'),
    chord(11, 'minor', -1, 'seventhDegree', 1),
    chord(4, 'minor', 0, 'counter', -1),
    chord(0, 'maj7', 0, 'tonic'),
    chord(9, 'minor', 0, 'parallel', 1),
    chord(2, 'major', 2, 'secondDegree'),
    chord(6, 'dim', 2, 'tritone', -1),
  ],
  mixolydian: [
    chord(7, 'minor', -1, 'dominant'),
    chord(4, 'dim', -1, 'thirdDegree', 1),
    chord(9, 'minor', 0, 'parallel', -1),
    chord(0, 'dom7', 0, 'tonic'),
    chord(2, 'minor', 0, 'secondDegree', 1),
    chord(5, 'major', 2, 'subdominant'),
    chord(10, 'major', 2, 'subtonic', -1),
  ],
  harmonicMinor: [
    chord(7, 'dom7', -2, 'dominantSeventh'),
    chord(7, 'major', -1, 'dominant'),
    chord(11, 'dim7', -1, 'diminished', 1),
    chord(3, 'aug', 0, 'augmented', -1),
    chord(0, 'minor', 0, 'tonic'),
    chord(8, 'major', 0, 'counter', 1),
    chord(5, 'minor', 2, 'subdominant'),
    chord(2, 'dim', 2, 'parallel', -1),
  ],
  wholeTone: [chord(2, 'aug', -1, 'augmented'), chord(0, 'aug', 0, 'tonic'), chord(0, 'domFlat5', 2, 'tritone')],
  harmonicSeries: [
    chord(7, 'major', -1, 'dominant'),
    chord(0, 'major', 0, 'tonic'),
    chord(0, 'dom7', 1, 'naturalSeventh'),
    chord(5, 'major', 2, 'subdominant'),
  ],
};

export const mapOf = (style: StyleId): readonly MapChord[] => CHORD_MAPS[style];

export const tonicChordOf = (style: StyleId): MapChord => {
  const home = CHORD_MAPS[style].find((c) => c.step === 0 && c.side === 0);
  if (home === undefined) throw new RangeError(`no tonic chord in map ${style}`);
  return home;
};

export const pitchesOf = (chord: MapChord, tonic: PitchClass): readonly PitchClass[] =>
  SHAPE_INTERVALS[chord.shape].map((i) => pcOf(tonic + chord.semitones + i));

export const rootOf = (chord: MapChord, tonic: PitchClass): PitchClass => pcOf(tonic + chord.semitones);

// The map feeds the chord machinery: every entry becomes a spec the rest of the app can use.
export const specOf = (
  chord: MapChord,
  scale: readonly PitchClass[],
  sharps: readonly PitchClass[] = [],
): ChordSpec => {
  const all = SHAPE_INTERVALS[chord.shape];
  const seventh = all.find((i) => i === 9 || i === 10 || i === 11);
  const root = pcOf(chord.semitones);
  const degree = scale.indexOf(root);
  return {
    degree: degree < 0 ? -1 : (degree as Degree),
    root,
    intervals: all.filter((i) => i < 9).map(pcOf),
    seventh: seventh === undefined ? null : pcOf(seventh),
    quality: QUALITY_OF[chord.shape],
    sharp: sharps.includes(root),
  };
};

export const specsOfMap = (
  style: StyleId,
  scale: readonly PitchClass[],
  sharps: readonly PitchClass[] = [],
): readonly ChordSpec[] => CHORD_MAPS[style].map((chord) => specOf(chord, scale, sharps));
