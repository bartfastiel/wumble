// Reference values for the golden tests of the learn mode: every song as it parses, the levels and how a dot
// fades on them, and the geometry of the dots and rings.
import geometry from './geometry.json';
import levels from './levels.json';
import songs from './songs.json';
import visibility from './visibility.json';

export interface NoteFixture {
  readonly midi: number;
  readonly degree: number;
  readonly root: number;
  readonly beats: number;
  readonly text: string | null;
}
export interface CellFixture {
  readonly row: number;
  readonly col: number;
}
export interface SongFixture {
  readonly title: string;
  readonly k: number;
  readonly bpm: number;
  readonly style: string;
  readonly group: string;
  readonly slug: string;
  readonly subtitle: string;
  readonly notes: readonly NoteFixture[];
  readonly cells: readonly (CellFixture | null)[];
}
export interface RingFixture {
  readonly ri: number;
  readonly ro: number;
}
export interface RunFixture {
  readonly title: string;
  readonly pos: number;
  readonly rings: readonly RingFixture[];
}
export interface GeometryFixture {
  readonly unit: number;
  readonly rings: Readonly<Record<string, readonly RingFixture[]>>;
  readonly radius: Readonly<Record<string, number>>;
  readonly alpha: readonly number[];
  readonly ease: readonly number[];
  readonly gap: number;
  readonly runs: readonly RunFixture[];
}
export interface LevelFixture {
  readonly delay: number | null;
  readonly fade: number | null;
  readonly factor: number | null;
  readonly rings: boolean | null;
}
export interface VisibilityFixture {
  readonly times: readonly number[];
  readonly easy: readonly number[];
  readonly medium: readonly number[];
  readonly hard: readonly number[];
}

export const RECORDED = {
  songs: songs as readonly SongFixture[],
  geometry: geometry as GeometryFixture,
  levels: levels as Readonly<Record<string, LevelFixture>>,
  visibility: visibility as VisibilityFixture,
};
