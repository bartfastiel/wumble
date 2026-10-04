// What a finger means while it holds a note: pressure is the bow's weight, sliding up and down draws it harder or
// lighter, and a rocking finger is vibrato – just as a violinist rocks the fingertip on the string.
//
// Everything here works in shares of the playing area (x and y from 0 to 1), so it is the same on every screen.
import { type Key, keyAt, keyWithHysteresis } from './keys';

export interface Sample {
  readonly time: number; // ms
  readonly x: number; // 0 … 1 of the playing width
  readonly y: number; // 0 … 1 of the playing height, 0 at the top
  readonly pressure: number; // as the browser reports it
}

export type Haptic = 'start' | 'step' | 'key';

export interface Expression {
  readonly key: number;
  readonly tone: number; // fractional MIDI number
  readonly dynamics: number; // 0 = piano, 1 = forte, a little beyond both
  readonly bendCents: number;
  readonly haptic: Haptic | undefined;
}

export const DYNAMICS_MIN = -0.1;
export const DYNAMICS_MAX = 1.15;
export const MAX_BEND = 45; // cents – far wider than a violinist's vibrato, on purpose for now
const CENTS_PER_KEY_WIDTH = 260; // rocking by a tenth of a key width bends by 26 cents
const VIBRATO_SETTLE = 220; // ms: slower drifts of the finger are not vibrato
const DRAG_RANGE = 1.6; // sliding up a third of the height adds about half the dynamic range
const STEPS = 6; // dynamic levels that each give a tiny haptic tick
const TICK_GAP = 70; // ms between two ticks at most

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

// Values a browser reports when it has no idea how hard a finger presses
const MEANINGLESS = new Set([0, 0.5, 1]);

/** Learns whether this device reports real pressure, and over which range. */
export class PressureSense {
  private readonly seen = new Set<number>();
  private low = 0.5;
  private high = 0.95;

  observe(pressure: number): void {
    if (MEANINGLESS.has(pressure)) return;
    if (this.seen.size < 8) this.seen.add(pressure);
    this.low = Math.min(this.low, pressure);
    this.high = Math.max(this.high, pressure);
  }

  get supported(): boolean {
    return this.seen.size >= 4;
  }

  // 0 at the lightest touch seen so far, 1 at the firmest
  normalised(pressure: number): number {
    return clamp((pressure - this.low) / (this.high - this.low), 0, 1);
  }
}

export class Finger {
  key: number;
  private readonly startY: number;
  private readonly strike: number;
  private slowX: number;
  private lastTime: number;
  private level: number;
  private lastTick: number;

  constructor(
    private readonly keys: readonly Key[],
    private readonly sense: PressureSense,
    first: Sample,
  ) {
    sense.observe(first.pressure);
    this.key = keyAt(keys, first.x);
    this.startY = first.y;
    // Without pressure, where the key is struck sets the start: lightly at the top, firmly towards the player
    this.strike = 0.3 + 0.55 * clamp(first.y, 0, 1);
    this.slowX = first.x;
    this.lastTime = first.time;
    this.level = -1;
    this.lastTick = first.time;
  }

  private dynamics(sample: Sample): number {
    const drag = (this.startY - sample.y) * DRAG_RANGE;
    const base = this.sense.supported
      ? 0.05 + 1.1 * this.sense.normalised(sample.pressure) ** 0.7 + (sample.y - 0.5) * 0.15
      : this.strike;
    return clamp(base + drag, DYNAMICS_MIN, DYNAMICS_MAX);
  }

  private keyWidth(): number {
    const key = this.keys[this.key];
    return key === undefined ? 1 : key.right - key.left;
  }

  private express(sample: Sample, haptic: Haptic | undefined): Expression {
    const dynamics = this.dynamics(sample);
    const level = Math.round(clamp(dynamics, 0, 1) * STEPS);
    let tick = haptic;
    if (tick === undefined && level !== this.level && this.level >= 0 && sample.time - this.lastTick > TICK_GAP) {
      tick = 'step';
    }
    if (tick !== undefined) this.lastTick = sample.time;
    this.level = level;
    const bend = clamp(((sample.x - this.slowX) / this.keyWidth()) * CENTS_PER_KEY_WIDTH, -MAX_BEND, MAX_BEND);
    return { key: this.key, tone: this.keys[this.key]?.tone ?? 60, dynamics, bendCents: bend, haptic: tick };
  }

  start(sample: Sample): Expression {
    return this.express(sample, 'start');
  }

  move(sample: Sample): Expression {
    this.sense.observe(sample.pressure);
    const dt = Math.max(0, sample.time - this.lastTime);
    this.lastTime = sample.time;
    this.slowX += (sample.x - this.slowX) * (1 - Math.exp(-dt / VIBRATO_SETTLE));
    const next = keyWithHysteresis(this.keys, sample.x, this.key);
    if (next !== this.key) {
      // Legato onto the neighbour: the bow keeps going, the vibrato starts afresh from here
      this.key = next;
      this.slowX = sample.x;
      return this.express(sample, 'key');
    }
    return this.express(sample, undefined);
  }
}
