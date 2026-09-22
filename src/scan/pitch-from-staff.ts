// Pitch from the staff position: the step above the lowest line (E4) names the natural, the key signature adds its
// sharp or flat, and the octave is folded into the grid's range.
import { MAJOR, stepOf } from '../theory/scales';

const LETTERS = 'CDEFGAB';
const SHARP_ORDER = 'FCGDAEB';
const FLAT_ORDER = 'BEADGCF';

const signatureAlteration = (letter: string, signature: number): number => {
  if (signature > 0) return SHARP_ORDER.slice(0, signature).includes(letter) ? 1 : 0;
  if (signature < 0) return FLAT_ORDER.slice(0, -signature).includes(letter) ? -1 : 0;
  return 0;
};

// Step 0 = E4, every step one letter: E F G A B C D …; the key signature (sharps positive, flats negative) alters it
export const stepMidi = (step: number, signature: number): number => {
  const index = step + 2; // letters counted from C4
  const letterIndex = ((index % 7) + 7) % 7;
  const letter = LETTERS.charAt(letterIndex);
  const octave = 4 + Math.floor(index / 7);
  return 12 * (octave + 1) + stepOf(MAJOR, letterIndex) + signatureAlteration(letter, signature);
};

// Shifts by octaves until the tone lies within [lowest, highest]
export const foldIntoRange = (midi: number, lowest: number, highest: number): number => {
  let folded = midi;
  while (folded < lowest) folded += 12;
  while (folded > highest) folded -= 12;
  return folded;
};
