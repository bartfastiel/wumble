// Photo of a sheet → notes: grayscale, borders, adaptive threshold, skew, staff lines, cleanup, components, noteheads,
// pitch. Pure code on pixel arrays, about 30 ms per image. Limits: one voice, treble clef, eighths count as quarters;
// dots, rests and accidentals in front of a note are overlooked, lyrics close under the notes can read as a note.
import { binarize, type BinaryImage, type Crop, paperWhite, whitenBorders } from './binarize';
import { removeLedgerLines, removeStaffLines, removeStems } from './cleanup';
import { connectedComponents } from './components';
import { findSkew, projectRows, rotate, thinInkPixels, thinRun } from './deskew';
import { findNoteheads, melodyOrder, type Notehead } from './noteheads';
import { stepMidi } from './pitch-from-staff';
import { type GrayImage, grayscale, type RgbaImage, scaleToWidth } from './raster';
import { findStaves, type Five, type Staff } from './staff-lines';

export interface ScannedNote {
  readonly midi: number;
  readonly beats: 1 | 2 | 4;
  readonly x: number; // centre in the (deskewed, scaled) scan image
  readonly y: number;
}

export interface Box {
  readonly x: number; // centre
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface ScanDebug {
  readonly profile: Float32Array; // row projection of the thin ink after deskewing
  readonly lines: readonly Five<Float32Array>[]; // per staff, per line: support points per strip
  readonly boxes: readonly Box[]; // one per note, in note order
}

export interface ScanResult {
  readonly notes: readonly ScannedNote[];
  readonly staves: readonly Staff[];
  readonly width: number; // size of the scanned image after scaling
  readonly height: number;
  readonly angle: number; // skew that was removed, degrees
  readonly crop: Crop; // area left after whitening the table edges
  readonly debug: ScanDebug;
}

export interface ScanOptions {
  readonly signature: number; // key signature: sharps positive, flats negative
}

export type ScanErrorCode = 'noStaff';

export class ScanError extends Error {
  readonly code: ScanErrorCode;
  readonly profile: Float32Array;
  readonly angle: number;

  constructor(code: ScanErrorCode, profile: Float32Array, angle: number) {
    super(code);
    this.name = 'ScanError';
    this.code = code;
    this.profile = profile;
    this.angle = angle;
  }
}

interface Leveled {
  readonly binary: BinaryImage;
  readonly profile: Float32Array;
  readonly angle: number;
}

// Binarize, find the skew, rotate the grayscale back by it and binarize again – then the lines are horizontal
const level = (gray: GrayImage, paper: number): Leveled => {
  const maxRun = thinRun(gray.width);
  const first = binarize(gray, paper);
  const skew = findSkew(first, maxRun);
  if (skew.angle === 0) return { binary: first, profile: skew.profile, angle: 0 };
  const binary = binarize(rotate(gray, skew.angle, paper), paper);
  const profile = projectRows(thinInkPixels(binary, maxRun), 0, binary.width, binary.height);
  return { binary, profile, angle: skew.angle };
};

const stripToNoteheads = (binary: BinaryImage, staves: readonly Staff[]): Notehead[] => {
  const minSpacing = Math.min(...staves.map((staff) => staff.spacing));
  const maxThickness = Math.max(...staves.map((staff) => staff.thickness)) + 1;
  removeStaffLines(binary, staves);
  removeLedgerLines(binary, minSpacing, maxThickness);
  const stems = removeStems(binary, minSpacing, maxThickness);
  const heads = findNoteheads(connectedComponents(binary), binary.width, staves, stems);
  return melodyOrder(heads, staves);
};

export const scanSheet = (image: RgbaImage, { signature }: ScanOptions): ScanResult => {
  const scaled = scaleToWidth(grayscale(image));
  const paper = paperWhite(scaled);
  const { image: gray, crop } = whitenBorders(scaled, paper);
  const { binary, profile, angle } = level(gray, paper);
  const staves = findStaves(profile, thinRun(gray.width), binary);
  if (staves.length === 0) throw new ScanError('noStaff', profile, angle);
  const heads = stripToNoteheads(binary, staves);
  return {
    notes: heads.map((head) => ({ midi: stepMidi(head.step, signature), beats: head.beats, x: head.x, y: head.y })),
    staves,
    width: gray.width,
    height: gray.height,
    angle,
    crop,
    debug: {
      profile,
      lines: staves.map((staff) => staff.lines),
      boxes: heads.map(({ x, y, w, h }) => ({ x, y, w, h })),
    },
  };
};
