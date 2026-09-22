// Removes what is not a notehead – staff lines, ledger lines and beams, stems and bar lines – and only where the ink
// is as thin as a line or a stem, so heads sitting on them are not cut apart. The functions edit the binary image in
// place: the scanner owns it and the steps build on each other.
import { type BinaryImage, inkRunDown, inkRunRight } from './binarize';
import { lineAt, type Staff } from './staff-lines';

export interface Stem {
  readonly x: number;
  readonly y0: number;
  readonly y1: number; // exclusive
}

// Clears the vertical run through (x, y) when it is at most `maxRun` long and touches the line centre `lineY` (±1):
// then it is only the line, not an object. A slur that merely grazes the line stays. Returns the run's last row.
const clearThinRun = (image: BinaryImage, x: number, y: number, maxRun: number, lineY: number): number => {
  const { width, data } = image;
  let top = y;
  while (top > 0 && data[(top - 1) * width + x] === 1) top--;
  const bottom = inkRunDown(image, x, y) - 1;
  if (bottom - top + 1 <= maxRun && top <= lineY + 1 && bottom >= lineY - 1) {
    for (let yy = top; yy <= bottom; yy++) data[yy * width + x] = 0;
  }
  return bottom;
};

const clearLineAtColumn = (image: BinaryImage, x: number, lineY: number, maxRun: number): void => {
  let y = Math.max(0, lineY - maxRun);
  const last = Math.min(image.height - 1, lineY + maxRun);
  while (y <= last) {
    y = image.data[y * image.width + x] === 1 ? clearThinRun(image, x, y, maxRun, lineY) + 1 : y + 1;
  }
};

export const removeStaffLines = (image: BinaryImage, staves: readonly Staff[]): void => {
  for (const staff of staves) {
    const maxRun = staff.thickness + 1;
    for (const points of staff.lines) {
      for (let x = 0; x < image.width; x++) {
        clearLineAtColumn(image, x, Math.round(lineAt(points, x, image.width)), maxRun);
      }
    }
  }
};

// Horizontal runs from 1.8 spacings on: ledger lines, beams and line remains – only the thin line falls
export const removeLedgerLines = (image: BinaryImage, minSpacing: number, maxThickness: number): void => {
  const { width, height, data } = image;
  for (let y = 0; y < height; y++) {
    let x = 0;
    while (x < width) {
      if (data[y * width + x] !== 1) {
        x++;
        continue;
      }
      const end = inkRunRight(image, x, y);
      if (end - x >= 1.8 * minSpacing) {
        for (let xx = x; xx < end; xx++) clearThinRun(image, xx, y, maxThickness, y);
      }
      x = end;
    }
  }
};

const horizontalRunWidth = (image: BinaryImage, x: number, y: number): number => {
  let left = x;
  while (left > 0 && image.data[y * image.width + left - 1] === 1) left--;
  return inkRunRight(image, x, y) - left;
};

// Clears the run x, [y0, y1) except its wide rows: those belong to an object. Lying close together (one head),
// everything between them stays too, so the narrow sides of a hollow head do not vanish with the stem.
const clearNarrowRows = (
  source: BinaryImage,
  target: Uint8Array,
  x: number,
  y0: number,
  y1: number,
  maxWidth: number,
  minSpacing: number,
): number => {
  const wide: boolean[] = [];
  for (let y = y0; y < y1; y++) wide.push(horizontalRunWidth(source, x, y) > maxWidth);
  const first = wide.indexOf(true);
  const last = wide.lastIndexOf(true);
  const block = first >= 0 && last - first <= 1.5 * minSpacing;
  let cleared = 0;
  for (let y = y0; y < y1; y++) {
    const i = y - y0;
    if (block ? i >= first && i <= last : wide[i] === true) continue;
    target[y * source.width + x] = 0;
    cleared++;
  }
  return cleared;
};

// Vertical runs from 0.7 spacings on that are at most `maxWidth` wide at the spot: stems and bar lines. Runs of which
// at least 1.2 spacings fall count as stems (a whole note is a hollow head without one). Runs are read in an untouched
// copy so every column of a stem sees the same run.
export const removeStems = (image: BinaryImage, minSpacing: number, maxThickness: number): Stem[] => {
  const { width, height, data } = image;
  const source: BinaryImage = { width, height, data: data.slice() };
  const maxWidth = Math.max(3, Math.round(minSpacing * 0.25), maxThickness + 1);
  const stems: Stem[] = [];
  for (let x = 0; x < width; x++) {
    let y = 0;
    while (y < height) {
      if (source.data[y * width + x] !== 1) {
        y++;
        continue;
      }
      const end = inkRunDown(source, x, y);
      if (end - y >= 0.7 * minSpacing) {
        const cleared = clearNarrowRows(source, data, x, y, end, maxWidth, minSpacing);
        if (cleared >= 1.2 * minSpacing) stems.push({ x, y0: y, y1: end });
      }
      y = end;
    }
  }
  return stems;
};
