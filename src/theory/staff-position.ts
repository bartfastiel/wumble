// Position of a tone on the treble staff: step 0 = E4 on the lowest line, every step half a line spacing.
import type { Key } from './keys';
import { toneName } from './labels';
import { pcOf } from './pitch';
import type { Style } from './styles';

const LETTERS = 'CDEFGAB';
const SHARP_ORDER = 'FCGDAEB';
const FLAT_ORDER = 'BEADGCF';
// Steps of the key signature's accidentals: sharps in the order of fifths F C G D A E B, flats B E A D G C F
export const SHARP_POSITIONS: readonly number[] = [8, 5, 9, 6, 3, 7, 4];
export const FLAT_POSITIONS: readonly number[] = [4, 7, 3, 6, 2, 5, 1];

export const signaturePositions = (signature: number): number[] =>
  (signature > 0 ? SHARP_POSITIONS : FLAT_POSITIONS).slice(0, Math.abs(signature));

export type Accidental = '' | '♯' | '♭' | '♮';
export interface StaffPosition {
  readonly step: number;
  readonly accidental: Accidental; // in front of the head: none when the key already has it, ♮ when the key alters the letter
}

type Alteration = -1 | 0 | 1;
const MARKS: Readonly<Record<Alteration, Accidental>> = { 1: '♯', 0: '♮', '-1': '♭' };

const alterationOf = (mark: string): Alteration => {
  if (mark === '♯') return 1;
  if (mark === '♭') return -1;
  return 0;
};

const keyAlteration = (letter: string, signature: number): Alteration => {
  if (signature > 0) return SHARP_ORDER.slice(0, signature).includes(letter) ? 1 : 0;
  if (signature < 0) return FLAT_ORDER.slice(0, -signature).includes(letter) ? -1 : 0;
  return 0;
};

// Letter and ♯/♭ come from the spelling, the octave from the MIDI number of the natural (midi − alteration), so
// that B♯3 and C♭4 stay with their letter
export const notePosition = (midi: number, key: Key, style: Style): StaffPosition => {
  const name = toneName(key, style, pcOf(midi - key.tonic));
  const letter = name.charAt(0);
  const alteration = alterationOf(name.charAt(1));
  const octave = Math.floor((midi - alteration) / 12) - 1;
  const step = LETTERS.indexOf(letter) - 2 + 7 * (octave - 4);
  const accidental = alteration === keyAlteration(letter, key.signature) ? '' : MARKS[alteration];
  return { step, accidental };
};
