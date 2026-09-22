// What the scan panel draws over the sheet, as plain geometry: the staff lines as polylines,
// every head as a box in the colour of its duration with the note name above, and the row profile as a curve when no
// staff was found. The panel only strokes and fills what it gets here.
import { t } from '../i18n';
import { SCAN_WIDTH } from '../scan/raster';
import type { ScanError, ScanResult } from '../scan/sheet-scanner';
import { lineAt } from '../scan/staff-lines';
import { keyLabel } from '../theory/key-labels';
import type { Key } from '../theory/keys';
import { germanName, pcOf } from '../theory/pitch';

export interface Point {
  readonly x: number;
  readonly y: number;
}
export interface OverlayBox {
  readonly x: number; // top left
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly color: string;
  readonly label: string;
}
export interface ScanOverlay {
  readonly width: number;
  readonly height: number;
  readonly angle: number; // the image is drawn turned back by it
  readonly lines: readonly (readonly Point[])[];
  readonly boxes: readonly OverlayBox[];
  readonly profile: readonly Point[]; // only without a staff
}

// Quarter orange, half blue, whole violet
export const HEAD_COLORS: Readonly<Record<1 | 2 | 4, string>> = { 1: '#e8641b', 2: '#1b6fe8', 4: '#9a1be8' };
export const LINE_COLOR = 'rgba(0,170,60,.85)';
export const PROFILE_COLOR = 'rgba(220,40,40,.9)';
const LINE_STEP = 20; // px between the support points of a drawn staff line
const PROFILE_WIDTH = 140; // px of the profile curve at the right edge
const PROFILE_MARGIN = 10;

export const noteName = (key: Key, midi: number, german: boolean): string => {
  const name = key.names[pcOf(midi)];
  return german ? germanName(name) : name;
};

// "G", "G·2" for a half, "G·4" for a whole
export const headLabel = (name: string, beats: number): string => (beats > 1 ? `${name}·${String(beats)}` : name);

export const scanOverlay = (result: ScanResult, key: Key, german: boolean): ScanOverlay => ({
  width: result.width,
  height: result.height,
  angle: result.angle,
  lines: result.debug.lines.flatMap((staff) =>
    staff.map((points) =>
      Array.from({ length: Math.floor(result.width / LINE_STEP) + 1 }, (_, i) => {
        const x = i * LINE_STEP;
        return { x, y: lineAt(points, x, result.width) };
      }),
    ),
  ),
  boxes: result.debug.boxes.map((box, i) => {
    const note = result.notes[i];
    const beats = note?.beats ?? 1;
    return {
      x: box.x - box.w / 2,
      y: box.y - box.h / 2,
      w: box.w,
      h: box.h,
      color: HEAD_COLORS[beats],
      label: note === undefined ? '' : headLabel(noteName(key, note.midi, german), beats),
    };
  }),
  profile: [],
});

// No staff: the row profile as a curve at the right edge, so the picture shows what the scanner saw
export const errorOverlay = (error: ScanError): ScanOverlay => {
  const top = Math.max(1, ...error.profile);
  return {
    width: SCAN_WIDTH,
    height: error.profile.length,
    angle: error.angle,
    lines: [],
    boxes: [],
    profile: Array.from(error.profile, (value, y) => ({
      x: SCAN_WIDTH - PROFILE_MARGIN - (PROFILE_WIDTH * value) / top,
      y,
    })),
  };
};

// "27 Noten erkannt: C D E … (·2 Halbe, ·4 Ganze; Tonart C-Dur / A-Moll)"
export const recognizedText = (result: ScanResult, key: Key, german: boolean): string =>
  result.notes.length === 0
    ? t('scan.noNotes')
    : t('scan.recognized', {
        count: result.notes.length,
        names: result.notes.map((note) => noteName(key, note.midi, german)).join(' '),
        key: keyLabel(key, german),
      });

// Label font: bold, about a 45th of the width, at least 14 px
export const labelPx = (width: number): number => Math.max(14, Math.round(width / 45));
