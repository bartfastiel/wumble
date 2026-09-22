// Reference images and results for the golden tests of the sheet scanner: the example sheet as the app draws
// it (clean and as a simulated photo), a scan from Wikimedia Commons, and what the scanner read from them.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { GrayImage } from '../raster';
import expected from './expected.json';

export interface SongNote {
  readonly midi: number;
  readonly beats: number;
}
export interface PocNote extends SongNote {
  readonly x: number;
  readonly y: number;
  readonly step: number;
  readonly staff: number;
}
export interface PocStaff {
  readonly spacing: number;
  readonly thickness: number;
  readonly ys: readonly number[];
}
export interface PocScan {
  readonly ok: boolean;
  readonly angle: number;
  readonly width: number;
  readonly height: number;
  readonly staves: readonly PocStaff[];
  readonly notes: readonly PocNote[];
}

export const RECORDED = {
  song: expected.song as readonly SongNote[],
  clean: expected.clean as PocScan,
  photo: expected.photo as PocScan,
  commons: expected.commons as PocScan,
};

const here = dirname(fileURLToPath(import.meta.url));

// Binary PGM (P5, 8 bit): header "P5\n<width> <height>\n255\n", then one byte per pixel
export const readPgm = (name: string): GrayImage => {
  const bytes = readFileSync(join(here, name));
  const header = /^P5\n(\d+) (\d+)\n255\n/.exec(bytes.subarray(0, 32).toString('latin1'));
  if (header === null) throw new Error(`${name} is no 8-bit binary PGM`);
  const width = Number(header[1]);
  const height = Number(header[2]);
  const data = new Uint8Array(bytes.buffer, bytes.byteOffset + header[0].length, width * height);
  return { width, height, data };
};

export const FIXTURES = {
  clean: 'example-clean.pgm',
  photo: 'example-photo.pgm',
  commons: 'entchen-commons.pgm',
} as const;
