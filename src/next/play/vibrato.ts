// Vibrato from the way a finger rocks: a sweep in one direction is not vibrato, a finger that turns back and forth is.
// How often it turns sets the rate, how far it swings sets the depth. The synth then plays an even oscillation at that
// rate – the finger only has to suggest it, it does not have to draw every wave.

export interface Vibrato {
  readonly rate: number; // Hz
  readonly depth: number; // 0 … 1
}

export const NO_VIBRATO: Vibrato = { rate: 0, depth: 0 };

const WINDOW = 600; // ms of turns that count
const MIN_SWING = 0.0025; // of the playing width: smaller wobbles are the finger resting, not rocking
const FULL_SWING = 0.025; // of the playing width: a swing this wide is the deepest vibrato
const RATE_MIN = 3;
const RATE_MAX = 9;
const RISE = 60; // ms: vibrato answers almost at once …
const FALL = 260; // ms: … and fades a little slower when the rocking stops

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

interface Turn {
  readonly time: number;
  readonly swing: number; // distance travelled since the previous turn
}

export class VibratoDetector {
  private direction = 0; // -1, 0, 1
  private extreme: number; // furthest point in the current direction
  private anchor: number; // where the current direction began
  private turns: Turn[] = [];
  private depth = 0;
  private rate = 0;
  private lastTime: number;

  constructor(x: number, time: number) {
    this.extreme = x;
    this.anchor = x;
    this.lastTime = time;
  }

  private turn(time: number, swing: number): void {
    this.turns.push({ time, swing });
  }

  update(x: number, time: number): Vibrato {
    const dt = Math.max(0, time - this.lastTime);
    this.lastTime = time;

    // A turn counts once the finger has come back from its furthest point by more than a resting wobble
    if (this.direction === 0) {
      if (Math.abs(x - this.anchor) > MIN_SWING) {
        this.direction = x > this.anchor ? 1 : -1;
        this.extreme = x;
      }
    } else if ((this.direction > 0 && x > this.extreme) || (this.direction < 0 && x < this.extreme)) {
      this.extreme = x;
    } else if (Math.abs(x - this.extreme) > MIN_SWING) {
      this.turn(time, Math.abs(this.extreme - this.anchor));
      this.anchor = this.extreme;
      this.direction = -this.direction;
      this.extreme = x;
    }
    this.turns = this.turns.filter((t) => time - t.time <= WINDOW);

    // Two turns in the window make a swing back and forth: that is vibrato. A straight sweep never turns.
    let targetDepth = 0;
    if (this.turns.length >= 2) {
      const first = this.turns[0]?.time ?? time;
      const last = this.turns.at(-1)?.time ?? time;
      const span = Math.max(1, last - first);
      // two turns make one cycle
      this.rate = clamp(((this.turns.length - 1) / 2 / span) * 1000, RATE_MIN, RATE_MAX);
      const swing = this.turns.reduce((sum, t) => sum + t.swing, 0) / this.turns.length;
      targetDepth = clamp((swing - MIN_SWING) / (FULL_SWING - MIN_SWING), 0.15, 1);
    }
    const settle = targetDepth > this.depth ? RISE : FALL;
    this.depth += (targetDepth - this.depth) * (1 - Math.exp(-dt / settle));
    if (this.depth < 0.01 && targetDepth === 0) this.depth = 0;
    return { rate: this.depth > 0 ? this.rate : 0, depth: this.depth };
  }
}
