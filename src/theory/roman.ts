// Roman numerals (I, ii, V7, ♭VII7, ♯iv°) and Riemann functions (T, Sp, D7 …) of a chord.
import { mapOf } from './chord-maps';
import type { Quality } from './chord-spec';
import type { Chord } from './chords';
import type { Chromatic, Spelling } from './pitch';
import type { Degree } from './scales';
import type { StyleId } from './styles';

// Numerals per semitone above the tonic; chromatic tones borrow the neighbouring numeral with ♭ or ♯
const NUMERALS: Readonly<Record<Spelling, Chromatic<string>>> = {
  flat: ['I', '♭II', 'II', '♭III', 'III', 'IV', '♭V', 'V', '♭VI', 'VI', '♭VII', 'VII'],
  sharp: ['I', '♯I', 'II', '♯II', 'III', 'IV', '♯IV', 'V', '♯V', 'VI', '♯VI', 'VII'],
};
// I, ii, vii°, ♭III+, ii7 – other qualities are appended as they are (V7, Imaj7, viiø7)
const ROMAN_SUFFIX: Partial<Record<Quality, string>> = { major: '', minor: '', dim: '°', aug: '+', m7: '7' };
const LOWER_CASE = new Set<Quality>(['minor', 'dim', 'm7', 'ø7']);
// Riemann per degree, Đ = shortened dominant seventh (vii°)
const FUNCTIONS: Readonly<Record<Degree, string>> = { 0: 'T', 1: 'Sp', 2: 'Dp', 3: 'S', 4: 'D', 5: 'Tp', 6: 'Đ' };

export const romanOf = (chord: Chord): string => {
  const numeral = NUMERALS[chord.sharp ? 'sharp' : 'flat'][chord.offset];
  const cased = LOWER_CASE.has(chord.quality) ? numeral.toLowerCase() : numeral;
  return cased + (ROMAN_SUFFIX[chord.quality] ?? chord.quality);
};

// Riemann's functions only read cleanly where the map has a major tonic with a dominant and a subdominant;
// the minor and modal styles stay with numerals.
export const isFunctional = (styleId: StyleId): boolean => {
  const map = mapOf(styleId);
  const home = map.find((c) => c.step === 0 && c.side === 0);
  return (
    home !== undefined &&
    (home.shape === 'major' || home.shape === 'maj7') &&
    map.some((c) => c.role === 'dominant' || c.role === 'dominantSeventh') &&
    map.some((c) => c.role === 'subdominant')
  );
};

// With a seventh: D7; jazz: T7 = Cmaj7, Đ9 = Bø7
const functionSeventh = (chord: Chord, degree: Degree): string => {
  if (chord.seventh === null) return '';
  return degree === 6 ? '9' : '7';
};

export const functionOf = (chord: Chord, functional: boolean): string => {
  if (!functional) return romanOf(chord);
  const degree = chord.degree as Degree; // a functional style has every chord on a scale degree
  return FUNCTIONS[degree] + functionSeventh(chord, degree);
};
