// Song notation: tokens "Note Octave / [♭]Degree [: beats]" such as G4/V:2 or Bb4/bVII:.5,
// lyrics as one syllable per note ("Al- le mei- ne", "_" continues the previous syllable).
import { type Degree, MAJOR } from '../theory/scales';
import type { StyleId } from '../theory/styles';

export type SongGroup = 'scanned' | 'children' | 'world' | 'bluesRockJazz' | 'exercises'; // scanned: this session only

export interface SongDefinition {
  readonly title: string;
  readonly k: number; // key signature: sharps positive, flats negative
  readonly bpm: number;
  readonly style?: StyleId; // default classical
  readonly group: SongGroup;
  readonly notes: string;
  readonly text?: string;
}

export interface SongNote {
  readonly midi: number;
  readonly degree: Degree; // scale degree of the chord
  readonly root: number; // chord root in semitones above the tonic of the key (♭VII → 10)
  readonly beats: number;
  readonly text?: string;
}

export interface Song {
  readonly title: string;
  readonly k: number;
  readonly bpm: number;
  readonly style: StyleId;
  readonly group: SongGroup;
  readonly notes: readonly SongNote[];
}

const TOKEN =
  /^(?<letter>[A-G])(?<accidental>[#b♯♭]?)(?<octave>\d)\/(?<flat>[b♭]?)(?<numeral>[ivIV]+)(?::(?<beats>[\d.]+))?$/;
type Letter = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';
type Accidental = '' | '#' | '♯' | 'b' | '♭';
const BASE: Readonly<Record<Letter, number>> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const ACCIDENTAL: Readonly<Record<Accidental, number>> = { '': 0, '#': 1, '♯': 1, b: -1, '♭': -1 };
const NUMERALS = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii'];
// The named groups of TOKEN; `beats` is absent when the token has no ":beats" part
interface Token extends Record<string, string> {
  readonly letter: Letter;
  readonly accidental: Accidental;
  readonly octave: string;
  readonly flat: string;
  readonly numeral: string;
  readonly beats?: string;
}

const parseNote = (token: string): SongNote => {
  const groups = TOKEN.exec(token)?.groups;
  if (groups === undefined) throw new Error(`invalid note: ${token}`);
  const { letter, accidental, octave, flat, numeral, beats } = groups as Token;
  const degree = NUMERALS.indexOf(numeral.toLowerCase());
  if (degree < 0) throw new Error(`invalid degree: ${token}`);
  return {
    midi: 12 * (Number(octave) + 1) + BASE[letter] + ACCIDENTAL[accidental],
    degree: degree as Degree,
    root: MAJOR[degree as Degree] - (flat === '' ? 0 : 1),
    beats: beats === undefined ? 1 : Number(beats),
  };
};

const words = (text: string): string[] => text.trim().split(/\s+/);

// A syllable count that differs from the note count aborts the load: it protects against shifted lyrics
export const parseSong = (def: SongDefinition): Song => {
  const tokens = words(def.notes);
  const syllables = def.text === undefined ? null : words(def.text);
  if (syllables !== null && syllables.length !== tokens.length) {
    throw new Error(
      `lyrics do not match: "${def.title}" has ${String(tokens.length)} notes but ${String(syllables.length)} syllables`,
    );
  }
  const notes = tokens.map((token, i) => {
    const note = parseNote(token);
    const text = syllables?.[i];
    return text === undefined ? note : { ...note, text };
  });
  return { title: def.title, k: def.k, bpm: def.bpm, style: def.style ?? 'classical', group: def.group, notes };
};

// Deep-link id of a song: "Hänschen klein" → "ha-nschen-klein" (NFD splits the umlaut, the mark becomes a dash)
export const slug = (title: string): string =>
  title
    .toLowerCase()
    .normalize('NFD')
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replaceAll(/^-|-$/g, '');
