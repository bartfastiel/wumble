// Sizes of the learn dots: circle, rings of repeated notes, preview groups and the animation curves. Everything in
// units of the dot size `unit`, which the field derives from the width of a stripe; the UI draws from this.
import { type PlacedNote, sameSpot } from './learn-spot';
import type { Level } from './levels';

export const RING_GAP = 3;
export const DOT_MOVE_MS = 160; // the dot flies to the next spot, the rings move inwards
export const FLOATER_MS = 900; // "+87" rises and fades

export interface Ring {
  readonly ri: number; // inner radius, 0 for the circle
  readonly ro: number;
}

export interface RingGroup {
  readonly pos: number;
  readonly rings: readonly Ring[];
}

// The area is proportional to the duration, one beat ≈ 0.30 of the spot edge, capped at half the spot edge
export const noteRadius = (beats: number, unit: number): number => Math.min(unit * 0.5, unit * 0.3 * Math.sqrt(beats));

// Directly successive notes on the same spot, starting at `pos`
const runFrom = (placed: readonly PlacedNote[], pos: number): PlacedNote[] => {
  const first = placed[pos];
  if (first === undefined) return [];
  const run = [first];
  for (const next of placed.slice(pos + 1)) {
    if (!sameSpot(first.spot, next.spot)) break;
    run.push(next);
  }
  return run;
};

// Run of repeated notes from `pos`: the first is a circle, every further one a ring around it with gap RING_GAP, the
// ring area equal to the note's circle area (ro² = ri² + radius²). If the outermost ring exceeds 0.75·unit, the whole
// group is scaled down
export const ringGeometry = (placed: readonly PlacedNote[], pos: number, unit: number): Ring[] => {
  const rings: Ring[] = [];
  let outer = 0;
  for (const [i, { note }] of runFrom(placed, pos).entries()) {
    const ri = i === 0 ? 0 : outer + RING_GAP;
    outer = Math.hypot(ri, noteRadius(note.beats, unit));
    rings.push({ ri, ro: outer });
  }
  const scale = Math.min(1, (unit * 0.75) / outer);
  return scale < 1 ? rings.map(({ ri, ro }) => ({ ri: ri * scale, ro: ro * scale })) : rings;
};

// The current run shows all its rings – in hard only the circle
const currentRun = (level: Level, rings: readonly Ring[]): number => (level.rings ? rings.length : 1);

// Visible groups from `pos`: the current run completely (circle + rings), then preview until about four tones show –
// at least the next spot. A cut preview run keeps the sizes of the whole run. With a delay (medium/hard) there is no
// preview, only the current run – in hard alone its circle, without rings
export const visibleGroups = (placed: readonly PlacedNote[], pos: number, level: Level, unit: number): RingGroup[] => {
  const groups: RingGroup[] = [];
  const preview = level.delay === 0;
  let next = pos;
  let shown = 0;
  const wantsMore = (): boolean => (preview ? groups.length < 2 || shown < 4 : groups.length === 0);
  while (next < placed.length && wantsMore()) {
    const rings = ringGeometry(placed, next, unit);
    const wanted = groups.length === 0 ? currentRun(level, rings) : Math.max(1, 4 - shown);
    const count = Math.min(rings.length, wanted);
    groups.push({ pos: next, rings: rings.slice(0, count) });
    next += count;
    shown += count;
  }
  return groups;
};

// The current tone is bright, everything upcoming fades with its distance k
export const learnAlpha = (k: number): number => [1, 0.55, 0.38, 0.25][k] ?? Math.max(0.15, 0.25 - 0.05 * (k - 3));

// Ease-out cubic, clamped at 1
export const ease = (k: number): number => 1 - (1 - Math.min(1, k)) ** 3;
