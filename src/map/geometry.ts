// Layout of the chord map: pull runs vertically, substitutes stand beside their chord, and nothing overlaps.
import type { Look } from '../field/geometry';
import { noise } from '../field/geometry';
import type { MapChord } from '../theory/chord-maps';

export interface MapSpot {
  readonly chord: MapChord;
  x: number;
  y: number;
  readonly seed: number;
  base: number; // the radius it was laid out with
  limit: number; // capped so that no two spots can touch
  radius: number; // what is drawn, follows the pull
}

export interface MapBox {
  readonly width: number;
  readonly height: number;
  readonly top: number;
}

const AXIS_RADIUS = 52;
const SIDE_RADIUS = 38;

// The built look puts the map in three columns: the far side, the axis, the substitutes. Nothing drifts, nothing
// has to be pushed apart afterwards.
const gridColumns = (box: MapBox): Readonly<Record<number, number>> => {
  const inset = 18;
  const step = (box.width - 2 * inset) / 3;
  const at = (column: number): number => inset + (column + 0.5) * step;
  return { [-1]: at(0), 0: at(1), 1: at(2) };
};

export const layoutMap = (chords: readonly MapChord[], box: MapBox, look: Look = 'organic'): MapSpot[] => {
  const precise = look === 'precise';
  const steps = chords.map((c) => c.step);
  const lowest = Math.min(...steps, 0);
  const highest = Math.max(...steps, 0);
  const dy = Math.min(104, (box.height - 140) / Math.max(1, highest - lowest));
  const dx = Math.min(86, box.width * 0.3);
  const originY = box.height / 2 - ((lowest + highest) / 2) * dy;
  const columns = gridColumns(box);
  const columnOf = (side: number): number => columns[side] ?? box.width / 2;

  const spots: MapSpot[] = chords.map((chord, i) => ({
    chord,
    seed: i * 17 + 3,
    x: precise ? columnOf(chord.side) : box.width / 2 + chord.side * dx + (noise(i * 5) - 0.5) * 22,
    y: originY + chord.step * dy + (precise ? 0 : (noise(i * 9 + 3) - 0.5) * 16),
    base: chord.side === 0 ? AXIS_RADIUS : SIDE_RADIUS,
    limit: chord.side === 0 ? AXIS_RADIUS : SIDE_RADIUS,
    radius: 24,
  }));

  if (!precise) separate(spots, box);
  for (const spot of spots) {
    let nearest = Number.POSITIVE_INFINITY;
    for (const other of spots)
      if (other !== spot) nearest = Math.min(nearest, Math.hypot(other.x - spot.x, other.y - spot.y));
    spot.limit = Math.min(spot.base, nearest * 0.47);
  }
  return spots;
};

// Two chords that overlap push each other apart, gently, so the map keeps its shape
const pushApart = (p: MapSpot, q: MapSpot): void => {
  const dx = q.x - p.x;
  const dy = q.y - p.y;
  const distance = Math.hypot(dx, dy) || 0.01;
  const wanted = (p.base + q.base) * 0.82;
  if (distance >= wanted) return;
  const push = ((wanted - distance) / distance) * 0.3;
  p.x -= dx * push;
  p.y -= dy * push;
  q.x += dx * push;
  q.y += dy * push;
};

const keepInside = (spot: MapSpot, box: MapBox): void => {
  spot.x = Math.max(spot.base + 6, Math.min(box.width - spot.base - 6, spot.x));
  spot.y = Math.max(spot.base + box.top, Math.min(box.height - spot.base - 10, spot.y));
};

const separate = (spots: readonly MapSpot[], box: MapBox): void => {
  for (let pass = 0; pass < 30; pass++) {
    for (const [a, p] of spots.entries()) {
      for (const q of spots.slice(a + 1)) pushApart(p, q);
    }
    for (const spot of spots) keepInside(spot, box);
  }
};

// The chosen chord grows, the others follow their pull. Nothing ever reaches its neighbour. Returns whether
// anything is still moving, so the canvas knows it has to keep drawing.
export const breatheMap = (
  spots: readonly MapSpot[],
  chosen: MapSpot | null,
  pullOf: (spot: MapSpot) => number,
  seconds: number,
): boolean => {
  const speed = Math.min(1, seconds * 6);
  let moved = false;
  for (const spot of spots) {
    const wanted = (spot === chosen ? 1.16 : 0.58 + pullOf(spot) * 0.5) * spot.limit;
    if (Math.abs(wanted - spot.radius) > 0.01) moved = true;
    spot.radius += (wanted - spot.radius) * speed;
  }
  return moved;
};

export const spotAt = (spots: readonly MapSpot[], x: number, y: number): MapSpot | null => {
  for (const spot of spots) if (Math.hypot(spot.x - x, spot.y - y) < spot.limit * 1.08) return spot;
  return null;
};
