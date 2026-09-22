import { describe, expect, it } from 'vitest';
import type { BinaryImage } from './binarize';
import type { Stem } from './cleanup';
import { connectedComponents } from './components';
import { findNoteheads, melodyOrder, type Notehead } from './noteheads';
import { type Staff, STRIPS } from './staff-lines';

const WIDTH = 240;
const HEIGHT = 200;
const SPACING = 10;

const staffAt = (bottom: number): Staff => {
  const line = (i: number): Float32Array => new Float32Array(STRIPS).fill(bottom - i * SPACING);
  return {
    spacing: SPACING,
    thickness: 1,
    ys: [bottom - 4 * SPACING, bottom - 3 * SPACING, bottom - 2 * SPACING, bottom - SPACING, bottom],
    lines: [line(4), line(3), line(2), line(1), line(0)],
  };
};
const STAFF = staffAt(90);

interface Blob {
  readonly cx: number;
  readonly cy: number;
  readonly w?: number;
  readonly h?: number;
  readonly hole?: readonly [number, number]; // hollow heads have a hole of this size around the centre
}

// Rectangular blobs stand in for heads: 13 × 9 pixels, hollow ones with a 9 × 5 hole
const draw = (blobs: readonly Blob[]): BinaryImage => {
  const data = new Uint8Array(WIDTH * HEIGHT);
  for (const { cx, cy, w = 13, h = 9, hole } of blobs) {
    const x0 = cx - Math.floor(w / 2);
    const y0 = cy - Math.floor(h / 2);
    const [holeW, holeH] = hole ?? [0, 0];
    const hx = cx - Math.floor(holeW / 2);
    const hy = cy - Math.floor(holeH / 2);
    for (let y = y0; y < y0 + h; y++) {
      for (let x = x0; x < x0 + w; x++) {
        const inHole = x >= hx && x < hx + holeW && y >= hy && y < hy + holeH;
        if (!inHole) data[y * WIDTH + x] = 1;
      }
    }
  }
  return { width: WIDTH, height: HEIGHT, data };
};

const heads = (blobs: readonly Blob[], stems: readonly Stem[] = [], staves: readonly Staff[] = [STAFF]): Notehead[] =>
  findNoteheads(connectedComponents(draw(blobs)), WIDTH, staves, stems);

describe('findNoteheads', () => {
  it('reads a filled head as a quarter on its step', () => {
    expect(heads([{ cx: 60, cy: 90 }])).toEqual([{ x: 60, y: 90, w: 13, h: 9, step: 0, beats: 1, staff: 0 }]);
    expect(heads([{ cx: 60, cy: 75 }])[0]?.step).toBe(3);
  });

  it('reads a hollow head as a half with a stem beside it, otherwise as a whole', () => {
    const hollow: Blob = { cx: 60, cy: 80, hole: [9, 5] };
    const stem: Stem = { x: 66, y0: 50, y1: 82 };
    expect(heads([hollow], [stem])[0]?.beats).toBe(2);
    expect(heads([hollow])[0]?.beats).toBe(4);
    expect(heads([hollow], [{ x: 90, y0: 50, y1: 82 }])[0]?.beats).toBe(4);
  });

  it('rejects the wrong sizes: tall, narrow, wide, sparse and blob-like', () => {
    expect(heads([{ cx: 60, cy: 80, h: 16 }])).toEqual([]);
    expect(heads([{ cx: 60, cy: 80, w: 9, h: 11 }])).toEqual([]);
    expect(heads([{ cx: 60, cy: 80, w: 20 }])).toEqual([]);
    expect(heads([{ cx: 60, cy: 80, w: 6 }])).toEqual([]);
    expect(heads([{ cx: 60, cy: 80, hole: [3, 4] }])).toEqual([]);
  });

  it('ignores ink far from any staff', () => {
    expect(heads([{ cx: 60, cy: 150 }])).toEqual([]);
    expect(heads([{ cx: 60, cy: 15 }])).toEqual([]);
  });

  it('assigns a head to the nearest staff', () => {
    const staves = [staffAt(90), staffAt(190)];
    expect(heads([{ cx: 60, cy: 170 }], [], staves)[0]).toMatchObject({ staff: 1, step: 4 });
    expect(heads([{ cx: 60, cy: 110 }], [], staves)[0]).toMatchObject({ staff: 0, step: -4 });
  });
});

describe('melodyOrder', () => {
  const head = (x: number, staff: number): Notehead => ({ x, y: 0, w: 13, h: 9, step: 0, beats: 1, staff });

  it('drops stacked candidates and sorts by staff, then x', () => {
    const ordered = melodyOrder([head(150, 1), head(40, 0), head(20, 0), head(20, 0), head(90, 0)], [STAFF, STAFF]);
    expect(ordered.map((h) => [h.staff, h.x])).toEqual([
      [0, 40],
      [0, 90],
      [1, 150],
    ]);
  });

  it('keeps heads at the same x on different staves', () => {
    expect(melodyOrder([head(20, 0), head(20, 1)], [STAFF, STAFF])).toHaveLength(2);
  });
});
