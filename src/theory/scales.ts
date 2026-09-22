// Scales as semitone offsets above the root.
import type { PitchClass } from './pitch';

export type Scale = readonly PitchClass[];
export type Degree = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export type Heptatonic = readonly [PitchClass, PitchClass, PitchClass, PitchClass, PitchClass, PitchClass, PitchClass];

export const MAJOR: Heptatonic = [0, 2, 4, 5, 7, 9, 11];
export const MINOR: Heptatonic = [0, 2, 3, 5, 7, 8, 10]; // natural minor (aeolian)
export const DORIAN: Heptatonic = [0, 2, 3, 5, 7, 9, 10];
export const PHRYGIAN: Heptatonic = [0, 1, 3, 5, 7, 8, 10];
export const LYDIAN: Heptatonic = [0, 2, 4, 6, 7, 9, 11];
export const MIXOLYDIAN: Heptatonic = [0, 2, 4, 5, 7, 9, 10];
export const HARMONIC_MINOR: Heptatonic = [0, 2, 3, 5, 7, 8, 11];
export const MAJOR_PENTATONIC: Scale = [0, 2, 4, 7, 9];
export const MINOR_PENTATONIC: Scale = [0, 3, 5, 7, 10];
export const BLUES: Scale = [0, 3, 5, 6, 7, 10]; // root, minor third, fourth, tritone, fifth, minor seventh
export const WHOLE_TONE: Scale = [0, 2, 4, 6, 8, 10];
export const HARMONIC_SERIES: Scale = [0, 2, 4, 6, 7, 8, 10, 11]; // partials 8–15 rounded to semitones

// Scale step of a degree counted past the octave (degree 7 = root again)
export const stepOf = (scale: Heptatonic, degree: number): PitchClass => scale[(degree % 7) as Degree];
