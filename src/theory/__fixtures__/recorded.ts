// Reference values for the golden tests of the theory modules: the keys, the staff positions of every tone, and the
// tables the rest of the theory is built on. Typed here so a test reads them without casting.
import keys from './keys.json';
import notes from './notes.json';
import tables from './tables.json';
import type { StyleId } from '../styles';

export interface KeyFixture {
  readonly k: number;
  readonly tonic: number;
  readonly sharp: boolean;
  readonly hue: number;
  readonly signature: string;
  readonly label: string;
  readonly title: string;
  readonly labelGerman: string;
  readonly titleGerman: string;
}
export interface NoteFixture {
  readonly step: number; // steps above the bottom line of the staff
  readonly accidental: string;
}
export interface TablesFixture {
  readonly MAJOR: readonly number[];
  readonly MINOR: readonly number[];
  readonly CHROMA_5: readonly number[];
  readonly PYTHAGOREAN: readonly number[];
  readonly MEANTONE: readonly number[];
  readonly CHORD_RATIOS: Readonly<Record<string, number>>;
  readonly SHARP_POS: readonly number[];
  readonly FLAT_POS: readonly number[];
}

export const RECORDED = {
  keys: keys as readonly KeyFixture[],
  tables: tables as unknown as TablesFixture,
  notes: notes as Readonly<Record<string, readonly NoteFixture[]>>,
};

export interface FixtureId {
  readonly signature: number;
  readonly styleId: StyleId;
}

// The keys of the note fixtures read "<signature>/<style>"
export const parseId = (id: string): FixtureId => {
  const [signature = '', style = ''] = id.split('/');
  return { signature: Number(signature), styleId: style as StyleId };
};

// The recorded staff positions cover fifteen tones from G3 upwards; the field itself reaches much further.
export const REFERENCE_LOWEST = 55;
export const REFERENCE_COUNT = 15;
export const referenceTones = (tones: readonly number[]): readonly number[] =>
  tones.filter((midi) => midi >= REFERENCE_LOWEST).slice(0, REFERENCE_COUNT);
