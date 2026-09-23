// Geometry of the melody field: one stripe per tone, low to high, turning away at the edges.
// Every irregularity is bounded by the space beside it, so stripes never overlap however restless they look.
// The field has a focus – the stripe in the middle of the view. It can be dragged and settles on an octave.
import type { Fitness } from '../theory/fitness';

// Two ways to draw the same field: grown, or built (see the ADR on the two looks)
export type Look = 'organic' | 'precise';

export interface Stripe {
  readonly index: number;
  readonly midi: number;
  readonly step: number; // degree within the scale
  top: number;
  bottom: number;
  share: number; // fraction of the total width
}

export interface Edge {
  x: number;
  lean: number;
  room: number; // 0…1, how much of the wave and tilt the space beside it allows
  wish: number; // radians of extra tilt this edge would like
  readonly amp: number;
  readonly freq: number;
  readonly phase: number;
  readonly amp2: number;
  readonly freq2: number;
  readonly phase2: number;
  y0: number; // the height the tilt turns around
}

export interface FieldBox {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}

// Weight of a tone: how wide its stripe wants to be. Fitness decides most of it, the distance from the focus the
// rest – where the hand is playing there is room, the octaves further out need less.
export const FITNESS_WEIGHT: readonly [number, number, number, number] = [1.5, 1.22, 1, 0.6];
export const FOCUS_STEPS = 10; // how far the focus reaches, in scale steps
// How many tones lie wide at once: as many as the width can give a playable size to, never more than FOCUS_STEPS.
const PLAYABLE = 52; // pixels a pair of focused stripes wants
export const focusReach = (width: number): number => Math.max(4, Math.min(FOCUS_STEPS, width / PLAYABLE));
export const focusWeight = (steps: number, reach: number = FOCUS_STEPS): number =>
  0.24 + 0.76 * Math.exp(-((steps / reach) ** 2));

// Stable pseudo-randomness: the same field looks the same in every session.
export const noise = (seed: number): number => {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

const BASE_TILT = (2.4 * Math.PI) / 180;
const EDGE_TILT = (26 * Math.PI) / 180;
const LEAN_PER_WIDTH = 0.9; // a stripe may drift sideways by this much of its own width over the whole height
const SLIDE_SPEED = 9; // how fast the focus follows its target
const STILL = 1e-4; // below this nothing is moving any more

export class Field {
  box: FieldBox = { left: 0, right: 0, top: 0, bottom: 0 };
  stripes: Stripe[] = [];
  edges: Edge[] = [];
  look: Look = 'organic';
  focus = 0; // the stripe in the middle of the view, fractional while it slides
  private target = 0;
  private perOctave = 7;

  layout(box: FieldBox, tones: readonly number[], stepsPerOctave: number, focus?: number): void {
    this.box = box;
    const count = tones.length;
    this.perOctave = Math.max(1, stepsPerOctave);
    this.stripes = tones.map((midi, index) => ({
      index,
      midi,
      step: index % this.perOctave,
      top: box.top,
      bottom: box.bottom,
      share: 1 / Math.max(1, count),
    }));
    // The focus can only be clamped once the stripes exist
    this.target = this.clamp(focus ?? this.target);
    this.focus = this.target;
    this.edges = Array.from({ length: count + 1 }, (_, j) => ({
      x: 0,
      lean: Math.tan(BASE_TILT),
      room: 1,
      wish: BASE_TILT,
      amp: j > 0 && j < count ? 2 + noise(j * 13) * 4.5 : 0,
      freq: ((0.8 + noise(j * 7 + 2) * 1.2) * Math.PI) / Math.max(1, box.bottom - box.top),
      phase: noise(j * 29) * 6.283,
      amp2: j > 0 && j < count ? 0.8 + noise(j * 5 + 9) * 2.2 : 0,
      freq2: ((1.9 + noise(j * 11) * 1.8) * Math.PI) / Math.max(1, box.bottom - box.top),
      phase2: noise(j * 37) * 6.283,
      y0: (box.top + box.bottom) / 2,
    }));
    this.settle();
  }

  // The octave a fresh field opens on: the one holding `midi`
  octaveOf(midi: number): number {
    const nearest = this.stripes.reduce(
      (best, stripe) => (Math.abs(stripe.midi - midi) < Math.abs(best.midi - midi) ? stripe : best),
      this.stripes[0] ?? { index: 0, midi: 0 },
    );
    return this.snapped(nearest.index);
  }

  // A finger drags the field: the focus follows at once, without settling
  slide(steps: number): void {
    this.target = this.clamp(this.target + steps);
    this.focus = this.target;
  }

  // The finger lifts: the nearest octave takes over and the field glides there
  release(): void {
    this.target = this.snapped(this.target);
  }

  // Where the field is heading – the slider draws its mark there
  get settling(): number {
    return this.target;
  }

  set settling(value: number) {
    this.target = this.clamp(value);
  }

  // Widths follow fitness, but move there gently rather than jumping. Returns whether anything is still moving,
  // so the canvas knows it has to keep drawing.
  breathe(fitness: readonly Fitness[], seconds: number): boolean {
    const drift = (this.target - this.focus) * Math.min(1, seconds * SLIDE_SPEED);
    this.focus += drift;
    if (Math.abs(this.target - this.focus) < STILL) this.focus = this.target;
    const reach = focusReach(this.box.right - this.box.left);
    const weights = this.stripes.map((_, i) => FITNESS_WEIGHT[fitness[i] ?? 2] * focusWeight(i - this.focus, reach));
    const total = weights.reduce((sum, w) => sum + w, 0) || 1;
    const speed = Math.min(1, seconds * 5);
    let moved = Math.abs(drift) > STILL;
    this.stripes.forEach((stripe, i) => {
      const target = (weights[i] ?? 1) / total;
      const step = (target - stripe.share) * speed;
      if (Math.abs(target - stripe.share) > STILL / Math.max(1, this.stripes.length)) moved = true;
      stripe.share += step;
    });
    this.settle();
    return moved;
  }

  private clamp(focus: number): number {
    return Math.max(0, Math.min(this.stripes.length - 1, focus));
  }

  private snapped(focus: number): number {
    return this.clamp(Math.round(focus / this.perOctave) * this.perOctave);
  }

  // Everything that follows from the shares and the focus: heights, edges, tilt.
  private settle(): void {
    const { left, right, top, bottom } = this.box;
    const span = Math.max(1, bottom - top);
    const middle = (top + bottom) / 2;
    const precise = this.look === 'precise';

    this.stripes.forEach((stripe, i) => {
      const away = (i - this.focus) / Math.max(1, this.stripes.length / 2);
      const bell = Math.exp(-(away * away) / 0.055);
      const length = span * (0.36 + 0.62 * bell);
      const wander = precise ? 0 : (noise(i * 19 + 1) - 0.5) * span * 0.02;
      const centre = middle - (precise ? 0 : away * span * 0.17) + wander;
      stripe.top = Math.max(top, centre - length / 2);
      stripe.bottom = Math.min(bottom, centre + length / 2);
    });

    let x = left;
    this.stripes.forEach((stripe, i) => {
      const edge = this.edges[i];
      if (edge !== undefined) edge.x = x;
      x += stripe.share * (right - left);
    });
    const last = this.edges[this.stripes.length];
    if (last !== undefined) last.x = right;

    for (const [j, edge] of this.edges.entries()) {
      const before = this.stripes[Math.max(0, j - 1)];
      const after = this.stripes[Math.min(this.stripes.length - 1, j)];
      edge.y0 =
        ((before?.top ?? top) + (before?.bottom ?? bottom) + (after?.top ?? top) + (after?.bottom ?? bottom)) / 4;
      const away = (j - this.focus) / Math.max(1, this.stripes.length);
      edge.wish = away * 2 * EDGE_TILT + BASE_TILT + (precise ? 0 : (noise(j * 3 + 5) - 0.5) * 0.01);
      const gapBefore = j > 0 ? edge.x - (this.edges[j - 1]?.x ?? edge.x) : Number.POSITIVE_INFINITY;
      const gapAfter = j < this.edges.length - 1 ? (this.edges[j + 1]?.x ?? edge.x) - edge.x : Number.POSITIVE_INFINITY;
      const narrow = Math.min(gapBefore, gapAfter);
      edge.room = precise ? 0 : Math.max(0, Math.min(1, narrow / 30));
      if (precise) {
        edge.lean = 0;
        continue;
      }
      const swing = Math.max(0, narrow * LEAN_PER_WIDTH - 2) / span;
      edge.lean = Math.max(-swing, Math.min(swing, Math.tan(edge.wish)));
    }
  }

  edgeAt(index: number, y: number): number {
    const edge = this.edges[index];
    if (edge === undefined) return this.box.left;
    const k = edge.room;
    return (
      edge.x +
      (y - edge.y0) * edge.lean +
      k *
        (edge.amp * Math.sin((y - this.box.top) * edge.freq + edge.phase) +
          edge.amp2 * Math.sin((y - this.box.top) * edge.freq2 + edge.phase2))
    );
  }

  at(x: number, y: number): Stripe | null {
    for (let i = 0; i < this.stripes.length; i++)
      if (x >= this.edgeAt(i, y) && x < this.edgeAt(i + 1, y)) return this.stripes[i] ?? null;
    return null;
  }

  // Where the stripe is touched decides the colour of the voice: airy near the top, woody near the bottom.
  airAt(y: number): number {
    const { top, bottom } = this.box;
    return 1 - Math.max(0, Math.min(1, (y - top) / Math.max(1, bottom - top)));
  }
}
