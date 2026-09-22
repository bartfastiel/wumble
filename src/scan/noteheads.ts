// Noteheads among the components: by size (0.8–2.2 × 0.6–1.4 line spacings, wider than tall) and core – a dark core
// is a filled head (quarter), a bright one a hollow head (half, or whole without a stem next to it). Their step above
// the lowest line gives the pitch; the two digits of the time signature stand on top of each other and fall away.
import type { Stem } from './cleanup';
import type { Component, Labeled } from './components';
import { numberAt } from './raster';
import { lineAt, type Staff } from './staff-lines';

export interface Notehead {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly step: number; // 0 = lowest line (E4), every step half a line spacing
  readonly beats: 1 | 2 | 4;
  readonly staff: number; // index into the staves
}

// The nearest staff in whose surroundings (three spacings above, two and a half below) the centroid lies
const staffIndexOf = (staves: readonly Staff[], cy: number): number => {
  let best = -1;
  let bestDistance = Infinity;
  staves.forEach((staff, i) => {
    const [top, , , , bottom] = staff.ys;
    const distance = Math.abs(cy - (top + bottom) / 2);
    if (cy >= top - 3 * staff.spacing && cy <= bottom + 2.5 * staff.spacing && distance < bestDistance) {
      bestDistance = distance;
      best = i;
    }
  });
  return best;
};

const headSized = (w: number, h: number, spacing: number): boolean =>
  w >= 0.8 * spacing && w <= 2.2 * spacing && h >= 0.6 * spacing && h <= 1.4 * spacing && h <= 1.05 * w;

// Share of the component's own pixels in a small circle (radius 0.15 spacings) around the centroid
const coreShare = (component: Component, labels: Int32Array, width: number, spacing: number): number => {
  const radius = 0.15 * spacing;
  let inside = 0;
  let own = 0;
  for (let y = component.y0; y <= component.y1; y++) {
    for (let x = component.x0; x <= component.x1; x++) {
      const u = (x - component.cx) / radius;
      const v = (y - component.cy) / radius;
      if (u * u + v * v > 1) continue;
      inside++;
      if (labels[y * width + x] === component.id) own++;
    }
  }
  return own / Math.max(1, inside);
};

const beatsOf = (solid: boolean, stem: boolean): 1 | 2 | 4 => {
  if (solid) return 1;
  return stem ? 2 : 4;
};

const hasStemBeside = (stems: readonly Stem[], component: Component, spacing: number): boolean =>
  stems.some(
    (stem) =>
      Math.abs(stem.x - component.cx) <= 0.9 * spacing &&
      stem.y0 <= component.y1 + 0.5 * spacing &&
      stem.y1 >= component.y0 - 0.5 * spacing,
  );

const noteheadOf = (
  component: Component,
  labeled: Labeled,
  width: number,
  staves: readonly Staff[],
  stems: readonly Stem[],
): Notehead | null => {
  const staffIndex = staffIndexOf(staves, component.cy);
  const staff = staves[staffIndex];
  if (staff === undefined) return null;
  const { spacing } = staff;
  const w = component.x1 - component.x0 + 1;
  const h = component.y1 - component.y0 + 1;
  if (!headSized(w, h, spacing)) return null;
  const fill = component.size / (w * h);
  const solid = coreShare(component, labeled.labels, width, spacing) >= 0.5;
  // Filled heads are compact and at most 1.8 spacings wide; hollow ones are neither sparse nor a blob
  if (solid ? fill < 0.45 || w > 1.8 * spacing : fill < 0.15 || fill > 0.85) return null;
  const stem = hasStemBeside(stems, component, spacing);
  const [topLine, , , , bottomLine] = staff.lines;
  const yBottom = lineAt(bottomLine, component.cx, width);
  const spacingHere = (yBottom - lineAt(topLine, component.cx, width)) / 4;
  return {
    x: component.cx,
    y: component.cy,
    w,
    h,
    step: Math.round((yBottom - component.cy) / (spacingHere / 2)),
    beats: beatsOf(solid, stem),
    staff: staffIndex,
  };
};

export const findNoteheads = (
  labeled: Labeled,
  width: number,
  staves: readonly Staff[],
  stems: readonly Stem[],
): Notehead[] =>
  labeled.components.flatMap((component) => {
    const head = noteheadOf(component, labeled, width, staves, stems);
    return head === null ? [] : [head];
  });

// Two candidates on top of each other (same x) do not occur in a single voice – those are the digits of the time
// signature (4/4), both go. The rest is the melody: per staff by x, staves top to bottom.
export const melodyOrder = (heads: readonly Notehead[], staves: readonly Staff[]): Notehead[] => {
  const spacings = staves.map((staff) => staff.spacing);
  return heads
    .filter(
      (head) =>
        !heads.some(
          (other) =>
            other !== head &&
            other.staff === head.staff &&
            Math.abs(other.x - head.x) < 0.6 * numberAt(spacings, head.staff),
        ),
    )
    .sort((a, b) => a.staff - b.staff || a.x - b.x);
};
