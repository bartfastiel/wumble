// What a finger means while it holds a note: pressure is the bow's weight, sliding up and down draws it harder or
// lighter, and a rocking finger makes the tone pulse in strength. The pitch never moves – it is always exactly the
// key's; everything a finger does lives in loudness and colour.
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
  readonly tone: number; // fractional MIDI number, the key's own
  readonly dynamics: number; // 0 = piano, 1 = forte, a little beyond both
  readonly tremor: number; // -1 … 1: how the rocking finger swings the strength right now
  readonly haptic: Haptic | undefined;
}

export const DYNAMICS_MIN = -0.1;
export const DYNAMICS_MAX = 1.15;
const TREMOR_DEPTH = 0.14; // of the dynamic range, at the widest swing
const TREMOR_PER_KEY_WIDTH = 7; // rocking by a seventh of the key width is the widest swing
const TREMOR_SETTLE = 220; // ms: slower drifts of the finger are not a swing
// Easing off: a finger relaxes far less than it pressed in – the contact stays flat – so a step back from the
// firmest point of this touch counts for more than the same step on the way in
const RELEASE_GAIN = 2.5;
const DRAG_RANGE = 1.6; // sliding up a third of the height adds about half the dynamic range
const STEPS = 6; // dynamic levels that each give a tiny haptic tick
const TICK_GAP = 70; // ms between two ticks at most

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

// Values a browser reports when it has no idea how hard a finger presses (1 is also a real reading at full pressure)
const MEANINGLESS = new Set([0, 0.5, 1]);

/** Learns whether this device reports real pressure, and over which range. */
export class PressureSense {
  private readonly seen = new Set<number>();
  private low = 0.5;
  private high = 0.95;

  observe(pressure: number): void {
    if (pressure > 0 && pressure !== 0.5) this.high = Math.max(this.high, pressure);
    if (MEANINGLESS.has(pressure)) return;
    if (this.seen.size < 8) this.seen.add(pressure);
    this.low = Math.min(this.low, pressure);
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
  private peak = 0; // the firmest this touch has pressed, normalised
  private level = -1;
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
    this.lastTick = first.time;
  }

  private pressed(pressure: number): number {
    const now = this.sense.normalised(pressure);
    this.peak = Math.max(this.peak, now);
    return Math.max(0, this.peak - (this.peak - now) * RELEASE_GAIN);
  }

  private tremor(x: number): number {
    const key = this.keys[this.key];
    const width = key === undefined ? 1 : key.right - key.left;
    return clamp(((x - this.slowX) / width) * TREMOR_PER_KEY_WIDTH, -1, 1);
  }

  private express(sample: Sample, haptic: Haptic | undefined): Expression {
    const drag = (this.startY - sample.y) * DRAG_RANGE;
    const base = this.sense.supported
      ? 0.05 + 1.1 * this.pressed(sample.pressure) ** 0.7 + (sample.y - 0.5) * 0.15
      : this.strike;
    const tremor = this.tremor(sample.x);
    const dynamics = clamp(base + drag + tremor * TREMOR_DEPTH, DYNAMICS_MIN, DYNAMICS_MAX);

    const level = Math.round(clamp(dynamics, 0, 1) * STEPS);
    let tick = haptic;
    if (tick === undefined && level !== this.level && this.level >= 0 && sample.time - this.lastTick > TICK_GAP) {
      tick = 'step';
    }
    if (tick !== undefined) this.lastTick = sample.time;
    this.level = level;
    return { key: this.key, tone: this.keys[this.key]?.tone ?? 60, dynamics, tremor, haptic: tick };
  }

  start(sample: Sample): Expression {
    return this.express(sample, 'start');
  }

  move(sample: Sample): Expression {
    this.sense.observe(sample.pressure);
    const dt = Math.max(0, sample.time - this.lastTime);
    this.lastTime = sample.time;
    this.slowX += (sample.x - this.slowX) * (1 - Math.exp(-dt / TREMOR_SETTLE));
    const next = keyWithHysteresis(this.keys, sample.x, this.key);
    if (next !== this.key) {
      // Legato onto the neighbour: the bow keeps going, the swing starts afresh from here
      this.key = next;
      this.slowX = sample.x;
      return this.express(sample, 'key');
    }
    return this.express(sample, undefined);
  }
}
