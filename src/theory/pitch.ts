// Pitches: MIDI number, frequency, pitch class and note names.
export type PitchClass = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;
export type Chromatic<T> = readonly [T, T, T, T, T, T, T, T, T, T, T, T]; // one entry per pitch class
export type NoteNames = Chromatic<string>;
export type Spelling = 'sharp' | 'flat';

export const NAMES_SHARP: NoteNames = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
export const NAMES_FLAT: NoteNames = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];
const GERMAN: Record<string, string> = { B: 'H', 'B♭': 'B' };

export const pcOf = (midi: number): PitchClass => (((midi % 12) + 12) % 12) as PitchClass;

export const mtof = (midi: number): number => 440 * 2 ** ((midi - 69) / 12);

export const noteName = (midi: number, flat = false): string => (flat ? NAMES_FLAT : NAMES_SHARP)[pcOf(midi)];

// German spelling: B → H, B♭ → B
export const germanName = (name: string): string => GERMAN[name] ?? name;
