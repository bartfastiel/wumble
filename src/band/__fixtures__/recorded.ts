// Reference values for the golden tests of the band: the tables a groove is built from, and one recorded radio run.
import type { DrumKind } from '../../audio/engine';
import type { Lane } from '../grooves';
import type { Call } from './calls';
import radio from './radio.json';
import tables from './tables.json';

export interface RenderFixture {
  readonly style: string;
  readonly schema: string;
  readonly bars: number;
  readonly t0: number;
  readonly tempo: number;
  readonly seed: number;
  readonly calls: readonly Call[];
}
export interface TablesFixture {
  readonly GROOVES: Readonly<Record<string, Readonly<Record<string, string | number>>>>;
  readonly SCHEMATA: Readonly<Record<string, readonly number[] | null>>;
  readonly VEL: Readonly<Record<string, number>>;
  readonly LEVEL: Readonly<Record<string, number>>;
  readonly DRUM_LANES: readonly string[];
  readonly TONE_LANES: readonly string[];
  readonly PHRASE_LEVEL: number;
}

// The call tuples are plain arrays in JSON, hence the detour via unknown
export const RECORDED = {
  tables: tables as unknown as TablesFixture,
  radio: radio as unknown as RenderFixture,
};

// The lane names of the tables, as the engine spells them
const LANES: Readonly<Record<string, Lane>> = {
  kick: 'kick',
  snare: 'snare',
  hat: 'hatClosed',
  ohat: 'hatOpen',
  clap: 'clap',
  ride: 'ride',
  bass: 'bass',
  chord: 'chord',
  pad: 'pad',
};

export const laneOf = (name: string): Lane => {
  const lane = LANES[name];
  if (lane === undefined) throw new Error(`unknown lane ${name}`);
  return lane;
};

export const drumKindOf = (name: string): DrumKind => {
  const lane = laneOf(name);
  if (lane === 'bass' || lane === 'chord' || lane === 'pad') throw new Error(`${name} is not a drum`);
  return lane;
};
