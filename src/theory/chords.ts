// A concrete chord of a spec in a key, how a tone relates to it and the voicing.
import type { ChordSpec, Quality } from './chord-spec';
import type { Key } from './keys';
import { NAMES_FLAT, pcOf, type PitchClass } from './pitch';
import { type Degree, MAJOR } from './scales';

export interface Chord {
  readonly degree: Degree | -1;
  readonly offset: PitchClass; // semitones of the chord root above the tonic of the key
  readonly sharp: boolean;
  readonly root: PitchClass;
  readonly pcs: readonly PitchClass[];
  readonly seventh: PitchClass | null;
  readonly quality: Quality;
  readonly name: string; // root as spelled in the key
  readonly label: string; // C, dm, b, E♭+, G7, Cmaj7 …
}

const TRIADS = new Set<Quality>(['major', 'minor', 'dim', 'aug']);
export const isTriad = (quality: Quality): boolean => TRIADS.has(quality);

// Major upper case, minor and diminished lower case, augmented with +, otherwise the quality as suffix
const chordLabel = (name: string, quality: Quality): string => {
  if (quality === 'minor' || quality === 'dim') return name.toLowerCase();
  if (quality === 'major') return name;
  return name + (quality === 'aug' ? '+' : quality);
};

export const chordOf = (key: Key, spec: ChordSpec): Chord => {
  const root = pcOf(key.tonic + spec.root);
  // Roots outside the major scale (♭VII, ♭III, ♭VI) are spelled with ♭ even in sharp keys: B♭7, not A♯7 – except ♯IV
  const name = (MAJOR.includes(spec.root) || spec.sharp ? key.names : NAMES_FLAT)[root];
  return {
    degree: spec.degree,
    offset: spec.root,
    sharp: spec.sharp,
    root,
    pcs: spec.intervals.map((interval) => pcOf(root + interval)),
    seventh: spec.seventh === null ? null : pcOf(root + spec.seventh),
    quality: spec.quality,
    name,
    label: chordLabel(name, spec.quality),
  };
};

// Chord tone (bright), seventh (medium) or passing tone (dark)
export type ToneKind = 'chord' | 'seventh' | 'scale';
export const toneKind = (chord: Chord, midi: number): ToneKind => {
  const pc = pcOf(midi);
  if (chord.pcs.includes(pc)) return 'chord';
  return pc === chord.seventh ? 'seventh' : 'scale';
};

export interface Voicing {
  readonly bass: number;
  readonly chord: readonly number[];
}

// Close position around C3…B3, the bass an octave below
export const voicing = (chord: Chord): Voicing => {
  const rootMidi = 48 + chord.root;
  const notes = chord.pcs.map((pc) => rootMidi + pcOf(pc - chord.root));
  return {
    bass: rootMidi - 12,
    chord: chord.seventh === null ? notes : [...notes, rootMidi + pcOf(chord.seventh - chord.root)],
  };
};
