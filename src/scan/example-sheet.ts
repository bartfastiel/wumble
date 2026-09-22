// The example sheet: "Alle meine Entchen" in C major on two staves of five bars, as printed – lines 1 px, a clef,
// 4/4, filled and hollow heads with stems, bar lines, ledger lines at C4. Optionally as a photo on a dark table.
import { simulatePhoto } from './photo-simulation';
import { type RgbaImage, toRgba } from './raster';
import { GrayCanvas } from './rasterizer';
import { MAJOR } from '../theory/scales';
import { pcOf } from '../theory/pitch';

export interface ExampleNote {
  readonly midi: number;
  readonly beats: 1 | 2 | 4;
}

const note = (midi: number, beats: 1 | 2 | 4 = 1): ExampleNote => ({ midi, beats });
const [C4, D4, E4, F4, G4, A4] = [60, 62, 64, 65, 67, 69];

// prettier-ignore
export const EXAMPLE_NOTES: readonly ExampleNote[] = [
  note(C4), note(D4), note(E4), note(F4), note(G4, 2), note(G4, 2),
  note(A4), note(A4), note(A4), note(A4), note(G4, 4),
  note(A4), note(A4), note(A4), note(A4), note(G4, 4),
  note(F4), note(F4), note(F4), note(F4), note(E4, 2), note(E4, 2),
  note(G4), note(G4), note(G4), note(G4), note(C4, 4),
];

export interface ExampleSheetOptions {
  readonly photo?: boolean;
  readonly angle?: number; // degrees, photo only
  readonly seed?: number; // noise seed, photo only
  readonly notes?: readonly ExampleNote[]; // another melody in the same layout, for tests
}

export const EXAMPLE_WIDTH = 1200;
export const EXAMPLE_HEIGHT = 620;
const SPACING = 14;
const LEFT = 70;
const RIGHT = EXAMPLE_WIDTH - 50;
const BARS_PER_STAFF = 5;
const staffBottom = (staff: number): number => 200 + staff * 220; // lowest line (E4)

// Thin lines sit on half pixels so they stay sharp – as the canvas version does it
const crisp = (value: number): number => Math.round(value) + 0.5;

// Bars of four beats
const barsOf = (notes: readonly ExampleNote[]): ExampleNote[][] => {
  const bars: ExampleNote[][] = [];
  let bar: ExampleNote[] = [];
  let sum = 0;
  for (const n of notes) {
    bar.push(n);
    sum += n.beats;
    if (sum >= 4) {
      bars.push(bar);
      bar = [];
      sum = 0;
    }
  }
  return bars;
};

// Head: filled, or hollow with thick sides and thin top and bottom like in engraving; whole notes are wider
const drawHead = (canvas: GrayCanvas, x: number, y: number, beats: number): void => {
  const whole = beats === 4;
  const outer = { cx: x, cy: y, rx: (whole ? 0.72 : 0.65) * SPACING, ry: 0.46 * SPACING, rotation: whole ? 0 : -0.35 };
  if (beats === 1) {
    canvas.fillEllipse(outer);
    return;
  }
  canvas.fillRing(outer, {
    cx: x,
    cy: y,
    rx: (whole ? 0.38 : 0.5) * SPACING,
    ry: 0.3 * SPACING,
    rotation: whole ? 1 : -0.7,
  });
};

// A stand-in for the treble clef: a thick upstroke, the loop around the G line and a wide hook below – the scanner
// has to ignore it just like the real one
const drawClef = (canvas: GrayCanvas, x: number, bottom: number): void => {
  const stroke = 0.5 * SPACING;
  canvas.verticalLine(x, bottom - 4.6 * SPACING, bottom + 0.9 * SPACING, stroke);
  const loop = { cx: x - 0.2 * SPACING, cy: bottom - SPACING, rx: 1.15 * SPACING, ry: 0.95 * SPACING, rotation: 0 };
  canvas.fillRing(loop, { ...loop, rx: loop.rx - stroke, ry: loop.ry - stroke });
  canvas.fillEllipse({
    cx: x - 0.5 * SPACING,
    cy: bottom + 0.9 * SPACING,
    rx: 1.2 * SPACING,
    ry: 0.4 * SPACING,
    rotation: 0,
  });
};

// prettier-ignore
const FOUR = [
  '...#.',
  '..##.',
  '.#.#.',
  '#..#.',
  '#####',
  '...#.',
  '...#.',
];

// The digit 4 from a bitmap, `height` pixels tall with its baseline at `baseline`, centred on x
const drawFour = (canvas: GrayCanvas, x: number, baseline: number, height: number): void => {
  const cell = height / FOUR.length;
  const left = x - (cell * 5) / 2;
  const top = baseline - height;
  FOUR.forEach((row, r) => {
    for (let c = 0; c < row.length; c++) {
      if (row.charAt(c) === '#')
        canvas.fillRect(left + c * cell, top + r * cell, left + (c + 1) * cell, top + (r + 1) * cell);
    }
  });
};

const stepOf = (midi: number): number => MAJOR.indexOf(pcOf(midi)) - 2 + 7 * (Math.floor(midi / 12) - 1 - 4);

const drawNote = (canvas: GrayCanvas, x: number, bottom: number, n: ExampleNote): void => {
  const step = stepOf(n.midi);
  const y = bottom - (step * SPACING) / 2;
  for (let ledger = -2; ledger >= step; ledger -= 2) {
    canvas.horizontalLine(x - 1.1 * SPACING, x + 1.1 * SPACING, crisp(bottom - (ledger * SPACING) / 2), 1);
  }
  drawHead(canvas, x, y, n.beats);
  if (n.beats < 4) {
    // Stem up on the right below the middle line, otherwise down on the left
    const up = step < 6;
    const stemX = x + (up ? 0.6 : -0.6) * SPACING;
    canvas.verticalLine(stemX, y, y + (up ? -3.3 : 3.3) * SPACING, 1.6);
  }
};

const drawStaff = (canvas: GrayCanvas, staff: number, bars: readonly (readonly ExampleNote[])[]): void => {
  const bottom = staffBottom(staff);
  for (let i = 0; i < 5; i++) canvas.horizontalLine(LEFT, RIGHT, crisp(bottom - i * SPACING), 1);
  drawClef(canvas, LEFT + 1.8 * SPACING, bottom);
  drawFour(canvas, LEFT + 4.4 * SPACING, bottom - 2 * SPACING - 1, 1.5 * SPACING);
  drawFour(canvas, LEFT + 4.4 * SPACING, bottom - 1, 1.5 * SPACING);
  // Bars as wide as their notes (plus one margin), notes spread evenly
  const start = LEFT + 6.5 * SPACING;
  const unit = (RIGHT - start) / bars.reduce((sum, bar) => sum + bar.length + 1, 0);
  let x = start;
  for (const bar of bars) {
    bar.forEach((n, i) => {
      drawNote(canvas, x + unit * (i + 1), bottom, n);
    });
    x += unit * (bar.length + 1);
    canvas.verticalLine(crisp(x), bottom - 4 * SPACING, bottom, 1.2);
  }
};

export const renderExampleSheet = ({
  photo = false,
  angle = 1.5,
  seed = 1,
  notes = EXAMPLE_NOTES,
}: ExampleSheetOptions = {}): RgbaImage => {
  const canvas = new GrayCanvas(EXAMPLE_WIDTH, EXAMPLE_HEIGHT);
  const bars = barsOf(notes);
  drawStaff(canvas, 0, bars.slice(0, BARS_PER_STAFF));
  drawStaff(canvas, 1, bars.slice(BARS_PER_STAFF));
  const sheet = canvas.image();
  return toRgba(photo ? simulatePhoto(sheet, { angle, seed }) : sheet);
};
