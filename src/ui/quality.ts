// How much the field is allowed to cost. A phone with three device pixels per CSS pixel paints nine times the area
// of a plain one, and an older one does it on a slower core – the same drawing that flows on a laptop crawls there.
// So the field measures its own frames and gives up resolution before it gives up smoothness: a little softer is
// always better than a little late, on an instrument that is played with a finger.

const STEPS = [1, 1.25, 1.5, 2] as const; // pixels per CSS pixel, coarsest first
const SLOW = 22; // ms between frames: below ~45 fps something has to go
// A screen hands out frames on its own beat – 16.7 ms on most, less on a fast one – so "there is room" cannot mean
// "faster than that". It means: the frames arrive on the beat, nothing is being missed.
const FAST = 17.5;
const SETTLE = 900; // ms between two changes, so a change does not judge itself
const MEMORY = 0.12; // how fast the average follows the last frame

export interface QualityOptions {
  readonly ceiling?: number; // the device's own pixel ratio: never ask for more than it has
  readonly now?: () => number;
}

export class Quality {
  private index: number;
  private average = 16;
  private changedAt = 0;
  private readonly ceiling: number;
  private readonly clock: () => number;

  constructor({ ceiling = 2, now = () => performance.now() }: QualityOptions = {}) {
    this.ceiling = ceiling;
    this.clock = now;
    // Start one step below the device's best: the first frames are the expensive ones, and climbing is cheap
    this.index = Math.max(0, this.highest() - 1);
  }

  // Pixels per CSS pixel the canvas should be rendered at
  get scale(): number {
    return Math.min(this.ceiling, STEPS[this.index] ?? 1);
  }

  // Whether the field can afford the trimmings: shadows, the glance along a stripe, the fine outlines
  get detail(): boolean {
    return this.average < SLOW;
  }

  // How wide a stripe has to be before it is drawn with all of that
  get detailWidth(): number {
    return this.detail ? 9 : 16;
  }

  // One frame took `ms`. Returns true when the canvas has to be resized because the scale changed.
  sample(ms: number): boolean {
    this.average += (ms - this.average) * MEMORY;
    const now = this.clock();
    if (now - this.changedAt < SETTLE) return false;
    if (this.average > SLOW && this.index > 0) return this.moveTo(this.index - 1, now);
    if (this.average < FAST && this.index < this.highest()) return this.moveTo(this.index + 1, now);
    return false;
  }

  private moveTo(index: number, now: number): boolean {
    this.index = index;
    this.changedAt = now;
    this.average = 16; // the new scale has to prove itself, not inherit the old verdict
    return true;
  }

  private highest(): number {
    let fits = 0;
    for (const [i, step] of STEPS.entries()) if (step <= this.ceiling) fits = i;
    return fits;
  }
}
