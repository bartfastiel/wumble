// The shape of a chord as data: root, tones above it, an optional seventh and how it is named.
import type { PitchClass } from './pitch';
import type { Degree } from './scales';

export type Quality = 'major' | 'minor' | 'dim' | 'dim7' | 'aug' | '7' | '5' | 'm7' | 'maj7' | 'ø7' | '7♭5';

export interface ChordSpec {
  readonly degree: Degree | -1; // scale degree of the root, -1 outside the scale (♭VII, ♭III …)
  readonly root: PitchClass; // semitones above the tonic of the key
  readonly intervals: readonly PitchClass[]; // chord tones above the chord root
  readonly seventh: PitchClass | null;
  readonly quality: Quality;
  readonly sharp: boolean; // spelled with ♯ although outside the major scale
}
