// Geometry of the melody field: one stripe per tone, low to high, turning away at the edges.
// Every irregularity is bounded by the space beside it, so stripes never overlap however restless they look.
import type { Fitness } from '../theory/fitness';

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
  readonly wish: number; // radians of extra tilt this edge would like
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

// Weight of a tone: how wide its stripe wants to be. Fitness decides most of it, register the rest —
// the middle, where most playing happens, keeps the room the outer octaves do not need.
export const FITNESS_WEIGHT: readonly [number, number, number, number] = [1.5, 1.22, 1, 0.6];
export const CENTRE_MIDI = 65;
export const registerWeight = (midi: number): number => 0.24 + 0.76 * Math.exp(-(((midi - CENTRE_MIDI) / 17.5) ** 2));

// Stable pseudo-randomness: the same field looks the same in every session.
export const noise = (seed: number): number => {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

const BASE_TILT = (2.4 * Math.PI) / 180;
const EDGE_TILT = (26 * Math.PI) / 180;

export class Field {
  box: FieldBox = { left: 0, right: 0, top: 0, bottom: 0 };
  stripes: Stripe[] = [];
  edges: Edge[] = [];

  layout(box: FieldBox, tones: readonly number[], stepsPerOctave: number): void {
    this.box = box;
    const span = box.bottom - box.top;
    const middle = (box.top + box.bottom) / 2;
    const count = tones.length;
    this.stripes = tones.map((midi, index) => {
      const u = count > 1 ? index / (count - 1) - 0.5 : 0;
      const bell = Math.exp(-(u * u) / 0.055);
      const length = span * (0.36 + 0.62 * bell);
      const centre = middle - u * span * 0.17 + (noise(index * 19 + 1) - 0.5) * span * 0.02;
      return {
        index,
        midi,
        step: index % stepsPerOctave,
        top: Math.max(box.top, centre - length / 2),
        bottom: Math.min(box.bottom, centre + length / 2),
        share: 1 / count,
      };
    });
    this.edges = Array.from({ length: count + 1 }, (_, j) => {
      const inner = j > 0 && j < count;
      const u = count > 0 ? j / count - 0.5 : 0;
      const before = this.stripes[Math.max(0, j - 1)];
      const after = this.stripes[Math.min(count - 1, j)];
      return {
        x: 0,
        lean: Math.tan(BASE_TILT),
        room: 1,
        wish: u * 2 * EDGE_TILT + BASE_TILT + (noise(j * 3 + 5) - 0.5) * 0.01,
        amp: inner ? 2 + noise(j * 13) * 4.5 : 0,
        freq: ((0.8 + noise(j * 7 + 2) * 1.2) * Math.PI) / Math.max(1, span),
        phase: noise(j * 29) * 6.283,
        amp2: inner ? 0.8 + noise(j * 5 + 9) * 2.2 : 0,
        freq2: ((1.9 + noise(j * 11) * 1.8) * Math.PI) / Math.max(1, span),
        phase2: noise(j * 37) * 6.283,
        y0: ((before?.top ?? 0) + (before?.bottom ?? 0) + (after?.top ?? 0) + (after?.bottom ?? 0)) / 4,
      };
    });
    this.settle();
  }

  // Widths follow fitness, but move there gently rather than jumping.
  breathe(fitness: readonly Fitness[], seconds: number): void {
    const weights = this.stripes.map((stripe, i) => FITNESS_WEIGHT[fitness[i] ?? 2] * registerWeight(stripe.midi));
    const total = weights.reduce((sum, w) => sum + w, 0) || 1;
    const speed = Math.min(1, seconds * 5);
    this.stripes.forEach((stripe, i) => {
      const target = (weights[i] ?? 1) / total;
      stripe.share += (target - stripe.share) * speed;
    });
    this.settle();
  }

  private settle(): void {
    const { left, right, top, bottom } = this.box;
    const span = Math.max(1, bottom - top);
    let x = left;
    this.stripes.forEach((stripe, i) => {
      const edge = this.edges[i];
      if (edge !== undefined) edge.x = x;
      x += stripe.share * (right - left);
    });
    const last = this.edges[this.stripes.length];
    if (last !== undefined) last.x = right;

    for (let j = 0; j < this.edges.length; j++) {
      const edge = this.edges[j];
      if (edge === undefined) continue;
      const before = j > 0 ? edge.x - (this.edges[j - 1]?.x ?? edge.x) : Number.POSITIVE_INFINITY;
      const after = j < this.edges.length - 1 ? (this.edges[j + 1]?.x ?? edge.x) - edge.x : Number.POSITIVE_INFINITY;
      const narrow = Math.min(before, after);
      edge.room = Math.max(0, Math.min(1, narrow / 30));
      const swing = Math.max(0, narrow * 0.34 - 2) / span;
      const wanted = Math.tan(edge.wish) - Math.tan(BASE_TILT);
      edge.lean = Math.tan(BASE_TILT) + Math.max(-swing, Math.min(swing, wanted));
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
