// Song notation: tokens "Note Octave / [♭]Degree [: beats]" such as G4/V:2 or Bb4/bVII:.5,
// lyrics as one syllable per note ("Al- le mei- ne", "_" continues the previous syllable).
import { type Degree, MAJOR } from '../theory/scales';
import type { StyleId } from '../theory/styles';

// scanned: this session only · feasts: the songs a room actually sings together, at Christmas and at birthdays
export type SongGroup = 'scanned' | 'feasts' | 'children' | 'world' | 'bluesRockJazz' | 'exercises';

// A part of a song: its own notes, and the syllables that go on them. Without text it is played, not sung – a short
// lead-in, so everyone knows where the first word falls.
export interface SongPart {
  readonly notes: string;
  readonly text?: string;
}

export interface SongDefinition {
  readonly title: string;
  readonly k: number; // key signature: sharps positive, flats negative
  readonly bpm: number;
  readonly style?: StyleId; // default classical
  readonly group: SongGroup;
  readonly notes: string; // the melody of one verse
  readonly text?: string; // the words of the first verse, one syllable per note
  readonly verses?: readonly string[]; // further verses: the same melody, other words
  readonly chorus?: SongPart; // sung after every verse
  readonly intro?: string; // a few notes before the singing starts, so the first word is not a surprise
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

// One part, with its syllables laid on its notes. A syllable count that differs from the note count aborts the
// load: it protects against lyrics that have slipped by one and would then be wrong for the whole song.
const parsePart = (title: string, notes: string, text: string | undefined): SongNote[] => {
  const tokens = words(notes);
  const syllables = text === undefined ? null : words(text);
  if (syllables !== null && syllables.length !== tokens.length) {
    throw new Error(
      `lyrics do not match: "${title}" has ${String(tokens.length)} notes but ${String(syllables.length)} syllables`,
    );
  }
  return tokens.map((token, i) => {
    const note = parseNote(token);
    const syllable = syllables?.[i];
    return syllable === undefined ? note : { ...note, text: syllable };
  });
};

// The whole song as it is sung: the lead-in, then every verse with the chorus after it. A song without verses is
// one verse, which is how every song in the library was written before there were any.
export const parseSong = (def: SongDefinition): Song => {
  const notes: SongNote[] = [];
  if (def.intro !== undefined) notes.push(...parsePart(def.title, def.intro, undefined));
  const verses = def.verses ?? [def.text].filter((verse) => verse !== undefined);
  const sung = verses.length === 0 ? [undefined] : verses;
  for (const verse of sung) {
    notes.push(...parsePart(def.title, def.notes, verse));
    if (def.chorus !== undefined) notes.push(...parsePart(def.title, def.chorus.notes, def.chorus.text));
  }
  return { title: def.title, k: def.k, bpm: def.bpm, style: def.style ?? 'classical', group: def.group, notes };
};

// Deep-link id of a song: "Hänschen klein" → "ha-nschen-klein" (NFD splits the umlaut, the mark becomes a dash)
export const slug = (title: string): string =>
  title
    .toLowerCase()
    .normalize('NFD')
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replaceAll(/^-|-$/g, '');
