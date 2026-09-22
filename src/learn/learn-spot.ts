// Where a song note lands on the field: its chord and its stripe; null when the style has no such tone.
import type { Chord } from '../theory/chords';
import type { Model } from '../theory/model';
import { pcOf } from '../theory/pitch';
import type { SongNote } from './song-notation';

export interface FieldSpot {
  readonly chord: number;
  readonly tone: number;
}

export const sameSpot = (a: FieldSpot | null, b: FieldSpot | null): boolean =>
  a !== null && b !== null && a.chord === b.chord && a.tone === b.tone;

// Chord by its root (finds ♭VII, ♭III … too), else by the degree, else by the tone, else the tonic
const chordFor = (model: Model, note: SongNote): number => {
  const root = pcOf(model.key.tonic + note.root);
  const pc = pcOf(note.midi);
  const lookups: readonly ((chord: Chord) => boolean)[] = [
    (chord) => chord.root === root,
    (chord) => chord.degree === note.degree,
    (chord) => chord.pcs.includes(pc),
  ];
  for (const matches of lookups) {
    const index = model.chords.findIndex(matches);
    if (index >= 0) return index;
  }
  return model.home;
};

export const learnSpot = (model: Model, note: SongNote): FieldSpot | null => {
  const tone = model.tones.indexOf(note.midi);
  return tone < 0 ? null : { chord: chordFor(model, note), tone };
};

// A song placed on the field: every note with its spot
export interface PlacedNote {
  readonly note: SongNote;
  readonly spot: FieldSpot | null;
}

export const placeNotes = (model: Model, notes: readonly SongNote[]): PlacedNote[] =>
  notes.map((note) => ({ note, spot: learnSpot(model, note) }));
