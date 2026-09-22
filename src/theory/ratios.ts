// Frequency ratios per semitone above a reference tone.
import type { Chromatic, PitchClass } from './pitch';

export type Ratios = Partial<Readonly<Record<PitchClass, number>>>;

// 5-limit major: pure thirds and fifths
export const JUST_MAJOR: Ratios = { 0: 1, 2: 9 / 8, 4: 5 / 4, 5: 4 / 3, 7: 3 / 2, 9: 5 / 3, 11: 15 / 8 };
// 5-limit minor (aeolian)
export const JUST_MINOR: Ratios = { 0: 1, 2: 9 / 8, 3: 6 / 5, 5: 4 / 3, 7: 3 / 2, 8: 8 / 5, 10: 9 / 5 };

// 5-limit chromatic scale: the fallback for semitones a style's table leaves out
export const CHROMA_5: Chromatic<number> = [
  1,
  16 / 15,
  9 / 8,
  6 / 5,
  5 / 4,
  4 / 3,
  45 / 32,
  3 / 2,
  8 / 5,
  5 / 3,
  9 / 5,
  15 / 8,
];
// Chain of pure fifths 3/2; the thirds turn sharp (81/64 = +7.8 cents)
export const PYTHAGOREAN: Chromatic<number> = [
  1,
  256 / 243,
  9 / 8,
  32 / 27,
  81 / 64,
  4 / 3,
  729 / 512,
  3 / 2,
  128 / 81,
  27 / 16,
  16 / 9,
  243 / 128,
];
// Position of each semitone in the chain of fifths around the root, −3 (♭) … +8 (♯)
const MEANTONE_FIFTHS: Readonly<Record<PitchClass, number>> = {
  0: 0,
  7: 1,
  2: 2,
  9: 3,
  4: 4,
  11: 5,
  6: 6,
  1: 7,
  8: 8,
  3: -3,
  10: -2,
  5: -1,
};
// Quarter-comma meantone: fifth q = 5^(1/4), so four fifths make exactly 5 – pure major thirds 5/4 – and the wolf
// fifth lies between G♯ and E♭. Ratio q^k brought into the octave [1, 2).
export const meantoneRatio = (semitone: PitchClass): number => {
  let ratio = 5 ** (MEANTONE_FIFTHS[semitone] / 4);
  while (ratio >= 2) ratio /= 2;
  while (ratio < 1) ratio *= 2;
  return ratio;
};
// Chord tones tuned from the chord root: interval in semitones → ratio (the dominant seventh becomes 7/4 elsewhere)
export const CHORD_RATIOS: Readonly<Record<PitchClass, number>> = {
  0: 1,
  1: 16 / 15,
  2: 9 / 8,
  3: 6 / 5,
  4: 5 / 4,
  5: 4 / 3,
  6: 7 / 5,
  7: 3 / 2,
  8: 8 / 5,
  9: 5 / 3,
  10: 9 / 5,
  11: 15 / 8,
};
