// Reference values for the golden tests of the audio modules: the sound and combi tables, and per recording
// the root, loop and SHA-256 of the MP3 it stands for.
import combis from './combis.json';
import samples from './samples.json';
import sounds from './sounds.json';

export interface SampleFixture {
  readonly root: number;
  readonly loop: readonly [number, number] | null;
  readonly bytes: number;
  readonly sha256: string;
}
export interface CombiFixture {
  readonly name: string;
  readonly hint: string;
  readonly melody: unknown;
  readonly chord: unknown;
  readonly bass: unknown;
}

export const RECORDED = {
  sounds: sounds as Readonly<Record<string, Readonly<Record<string, unknown>>>>,
  combis: combis as Readonly<Record<string, CombiFixture>>,
  samples: samples as unknown as Readonly<Record<string, readonly SampleFixture[]>>,
};
