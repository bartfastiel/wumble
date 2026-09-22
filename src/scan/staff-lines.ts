// Staff lines from the row profile: candidate rows merge to lines, five equidistant lines are a staff, and every
// line is refined per strip so that a slightly bent sheet still reads.
import type { BinaryImage } from './binarize';
import { byteAt, floatAt, numberAt } from './raster';

export const STRIPS = 8;
export type Five<T> = readonly [T, T, T, T, T]; // one entry per staff line, top → bottom

export interface Line {
  readonly y: number; // centre, weighted by the profile
  readonly thickness: number;
}

export interface Staff {
  readonly spacing: number; // median distance of the five lines
  readonly thickness: number; // median line thickness
  readonly ys: Five<number>;
  readonly lines: Five<Float32Array>; // per line: support point per strip
}
type StaffLines = Omit<Staff, 'lines'>;

// Rows above 40 % of the strongest merge to a line; bands thicker than `maxThickness` are no lines
export const linesFromProfile = (profile: Float32Array, maxThickness: number): Line[] => {
  const cutoff = 0.4 * profile.reduce((top, value) => Math.max(top, value), 0);
  const lines: Line[] = [];
  let y = 0;
  while (y < profile.length) {
    if (floatAt(profile, y) <= cutoff) {
      y++;
      continue;
    }
    let end = y;
    let sum = 0;
    let weighted = 0;
    while (end < profile.length && floatAt(profile, end) > cutoff) {
      sum += floatAt(profile, end);
      weighted += floatAt(profile, end) * end;
      end++;
    }
    if (end - y <= maxThickness) lines.push({ y: weighted / sum, thickness: end - y });
    y = end;
  }
  return lines;
};

const sorted = (values: readonly number[]): number[] => [...values].sort((a, b) => a - b);

const staffOf = ([a, b, c, d, e]: Five<Line>): StaffLines | null => {
  const gaps = [b.y - a.y, c.y - b.y, d.y - c.y, e.y - d.y];
  const byLength = sorted(gaps);
  const spacing = (numberAt(byLength, 1) + numberAt(byLength, 2)) / 2;
  if (spacing < 4 || gaps.some((gap) => Math.abs(gap - spacing) > 0.2 * spacing)) return null;
  const thickness = numberAt(sorted([a, b, c, d, e].map((line) => line.thickness)), 2);
  return { spacing, thickness, ys: [a.y, b.y, c.y, d.y, e.y] };
};

// Five lines with equal spacing (±20 %) are a staff; the spacing and the thickness are medians
export const groupStaves = (lines: readonly Line[]): StaffLines[] => {
  const staves: StaffLines[] = [];
  let i = 0;
  while (i + 4 < lines.length) {
    const [a, b, c, d, e] = lines.slice(i, i + 5);
    const staff = a && b && c && d && e ? staffOf([a, b, c, d, e]) : null;
    if (staff === null) {
      i++;
    } else {
      staves.push(staff);
      i += 5;
    }
  }
  return staves;
};

// Height of a line at column x: linear between the strip centres
export const lineAt = (points: Float32Array, x: number, width: number): number => {
  const stripWidth = width / STRIPS;
  const s = Math.min(STRIPS - 1, Math.max(0, x / stripWidth - 0.5));
  const i = Math.min(STRIPS - 2, Math.floor(s));
  const f = s - i;
  return floatAt(points, i) * (1 - f) + floatAt(points, i + 1) * f;
};

const inkInRow = (image: BinaryImage, y: number, xa: number, xb: number): number => {
  let count = 0;
  for (let x = xa; x < xb; x++) count += byteAt(image.data, y * image.width + x);
  return count;
};

// Per strip the row with the most ink within ±spacing/4 of the prediction; strips without a clear line keep it
const refineLine = (image: BinaryImage, y0: number, window: number): Float32Array => {
  const stripWidth = image.width / STRIPS;
  const points = new Float32Array(STRIPS);
  for (let s = 0; s < STRIPS; s++) {
    const xa = Math.round(s * stripWidth);
    const xb = Math.round((s + 1) * stripWidth);
    let bestY = y0;
    let bestCount = 0;
    for (let y = Math.round(y0) - window; y <= Math.round(y0) + window; y++) {
      if (y < 0 || y >= image.height) continue;
      const count = inkInRow(image, y, xa, xb);
      if (count > bestCount) {
        bestCount = count;
        bestY = y;
      }
    }
    points[s] = bestCount > 0.3 * stripWidth ? bestY : y0;
  }
  return points;
};

export const refineStaff = (image: BinaryImage, staff: StaffLines): Staff => {
  const window = Math.max(2, Math.round(staff.spacing / 4));
  const refine = (y: number): Float32Array => refineLine(image, y, window);
  const [a, b, c, d, e] = staff.ys;
  return { ...staff, lines: [refine(a), refine(b), refine(c), refine(d), refine(e)] };
};

export const findStaves = (profile: Float32Array, maxThickness: number, image: BinaryImage): Staff[] =>
  groupStaves(linesFromProfile(profile, maxThickness)).map((staff) => refineStaff(image, staff));
