// Roman numerals (I, ii, V7, ♭VII7, ♯iv°) and Riemann functions (T, Sp, D7 …) of a chord.
import { mapOf } from './chord-maps';
import type { Quality } from './chord-spec';
import type { Chord } from './chords';
import type { Chromatic, PitchClass, Spelling } from './pitch';
import type { StyleId } from './styles';

// Numerals per semitone above the tonic; chromatic tones borrow the neighbouring numeral with ♭ or ♯
const NUMERALS: Readonly<Record<Spelling, Chromatic<string>>> = {
  flat: ['I', '♭II', 'II', '♭III', 'III', 'IV', '♭V', 'V', '♭VI', 'VI', '♭VII', 'VII'],
  sharp: ['I', '♯I', 'II', '♯II', 'III', 'IV', '♯IV', 'V', '♯V', 'VI', '♯VI', 'VII'],
};
// I, ii, vii°, ♭III+, ii7 – other qualities are appended as they are (V7, Imaj7, viiø7)
const ROMAN_SUFFIX: Partial<Record<Quality, string>> = { major: '', minor: '', dim: '°', aug: '+', m7: '7' };
const LOWER_CASE = new Set<Quality>(['minor', 'dim', 'm7', 'ø7']);
// Riemann functions by how far the chord's root stands above the tonic – not by its place in the scale, which
// would say something different in a scale that has no seven notes.
const MAIN: Readonly<Partial<Record<PitchClass, string>>> = { 0: 'T', 5: 'S', 7: 'D' };
// A parallel stands a third under its function, a Gegenklang a third over it; both are minor where the function is
// major, which is why their symbols carry the small letter and are only used for a minor chord.
const RELATIVE: Readonly<Partial<Record<PitchClass, string>>> = { 2: 'Sp', 4: 'Tg', 9: 'Tp' };
const MINOR_QUALITIES = new Set<Quality>(['minor', 'm7']);
const SHORTENED_QUALITIES = new Set<Quality>(['dim', 'dim7', 'ø7']); // vii° is the dominant seventh without its root

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

// The function of a chord, or its numeral where the three functions and their relatives have no name for it – a
// major second degree is the "zweite Stufe" the map calls it, and II7 says that where DD would argue with the map.
export const functionOf = (chord: Chord, functional: boolean): string => {
  if (!functional) return romanOf(chord);
  const minor = MINOR_QUALITIES.has(chord.quality);
  const seventh = chord.seventh === null ? '' : '7';
  const main = MAIN[chord.offset];
  // A main function turns small where the chord turns minor: the minor subdominant of a major key is s, not S
  if (main !== undefined) return (minor ? main.toLowerCase() : main) + seventh;
  if (chord.offset === 11 && SHORTENED_QUALITIES.has(chord.quality)) return `Đ${chord.seventh === null ? '' : '9'}`;
  const relative = RELATIVE[chord.offset];
  return relative !== undefined && minor ? relative + seventh : romanOf(chord);
};
