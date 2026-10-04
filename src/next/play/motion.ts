// What the hand holding the device does to the sound. Everything is measured against the posture when the first
// finger landed, so there is no posture to learn, and a device lying still on a table does nothing at all.
//
//  tilting forward and back – a wah: a resonance sweeping from dark to bright, off in the starting posture
//  tilting sideways         – where the bow meets the string: soft over the fingerboard, glassy at the bridge
//  lifting and lowering     – a swell: up is louder, down softer, gliding back once the device is held still
//  shaking                  – bow accents: every jolt digs in, a quick shake becomes a string tremolo
//
// A browser cannot know how high a device is – only how it accelerates, sixty times a second. Integrating that into
// a position drifts by metres within seconds, so lifting is a gesture that relaxes, not a level that stays.

export interface MotionSample {
  readonly time: number; // ms
  readonly gravity: readonly [number, number, number]; // accelerationIncludingGravity, m/s², device axes
  readonly linear: readonly [number, number, number] | null; // acceleration without gravity, if the device has it
}

export interface Motion {
  readonly wah: number; // 0 … 1, how far the wah is open (0 = off)
  readonly wahPosition: number; // -1 dark … 1 bright
  readonly brightness: number; // -1 over the fingerboard … 1 at the bridge
  readonly swell: number; // added to the dynamics
  readonly accent: number; // added to the dynamics, momentary
}

export const STILL: Motion = { wah: 0, wahPosition: 0, brightness: 0, swell: 0, accent: 0 };

const DEG = Math.PI / 180;
const WAH_DEAD = 4 * DEG; // a hand is never quite still
const WAH_FULL = 30 * DEG;
const ROLL_FULL = 30 * DEG;
const GRAVITY_SETTLE = 60; // ms: smooths the tilt without lagging a hand
const SWELL_VELOCITY_LEAK = 450; // ms
const SWELL_POSITION_LEAK = 1500; // ms: how long a lifted swell takes to glide back
const SWELL_PER_METRE = 2.5; // lifting by 20 cm adds half the dynamic range
const SWELL_MAX = 0.5;
const SHAKE_THRESHOLD = 1.5; // m/s²: below this a hand is only holding
const LIFT_THRESHOLD = 0.3; // m/s²: sensors carry a small bias, which must not integrate into a swell
const SHAKE_FULL = 12;
const ACCENT_MAX = 0.35;
const ACCENT_RISE = 15; // ms
const ACCENT_FALL = 110; // ms

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
const length = (v: readonly number[]): number => Math.hypot(...v);
const follow = (dt: number, time: number): number => 1 - Math.exp(-dt / time);

// Tilt of the screen towards the sky (pitch) and of the device's side (roll), from where gravity points
const pitchOf = (g: readonly number[]): number => Math.atan2(g[2] ?? 0, Math.hypot(g[0] ?? 0, g[1] ?? 0));
const rollOf = (g: readonly number[]): number => Math.atan2(g[0] ?? 0, Math.hypot(g[1] ?? 0, g[2] ?? 0));

export class MotionTracker {
  private gravity: [number, number, number] | null = null;
  private reference: { pitch: number; roll: number } | null = null;
  private velocity = 0;
  private height = 0;
  private accent = 0;
  private lastTime: number | null = null;

  // A new phrase begins: the posture of this moment becomes neutral
  rezero(): void {
    this.reference = this.gravity ? { pitch: pitchOf(this.gravity), roll: rollOf(this.gravity) } : null;
    this.velocity = 0;
    this.height = 0;
  }

  update(sample: MotionSample): Motion {
    const dt = this.lastTime === null ? 0 : Math.max(0, Math.min(100, sample.time - this.lastTime));
    this.lastTime = sample.time;
    const g = sample.gravity;
    if (this.gravity === null) this.gravity = [g[0], g[1], g[2]];
    else {
      const k = follow(dt, GRAVITY_SETTLE);
      this.gravity = [
        this.gravity[0] + (g[0] - this.gravity[0]) * k,
        this.gravity[1] + (g[1] - this.gravity[1]) * k,
        this.gravity[2] + (g[2] - this.gravity[2]) * k,
      ];
    }
    this.reference ??= { pitch: pitchOf(this.gravity), roll: rollOf(this.gravity) };

    // Wah from tilting forward and back
    const pitch = pitchOf(this.gravity) - this.reference.pitch;
    const tilt = Math.abs(pitch);
    const wah = clamp((tilt - WAH_DEAD) / (WAH_FULL - WAH_DEAD), 0, 1);
    // Leaning back (screen towards the sky) is the heel of the pedal, dark; leaning forward the toe, bright
    const wahPosition = clamp(-pitch / WAH_FULL, -1, 1);
    const brightness = clamp((rollOf(this.gravity) - this.reference.roll) / ROLL_FULL, -1, 1);

    // Lifting: acceleration along gravity, integrated twice with leaks so it can never run away
    const linear = sample.linear;
    const g0 = length(this.gravity);
    let up = 0;
    let jolt = 0;
    if (linear && g0 > 1) {
      up = (linear[0] * this.gravity[0] + linear[1] * this.gravity[1] + linear[2] * this.gravity[2]) / g0;
      up = Math.abs(up) < LIFT_THRESHOLD ? 0 : up - Math.sign(up) * LIFT_THRESHOLD;
      jolt = length(linear);
    }
    const seconds = dt / 1000;
    this.velocity = (this.velocity + up * seconds) * (1 - follow(dt, SWELL_VELOCITY_LEAK));
    this.height = (this.height + this.velocity * seconds) * (1 - follow(dt, SWELL_POSITION_LEAK));
    const swell = clamp(this.height * SWELL_PER_METRE, -SWELL_MAX, SWELL_MAX);

    // Shaking: every jolt beyond a holding hand digs the bow in
    const target = clamp((jolt - SHAKE_THRESHOLD) / (SHAKE_FULL - SHAKE_THRESHOLD), 0, 1) * ACCENT_MAX;
    this.accent += (target - this.accent) * follow(dt, target > this.accent ? ACCENT_RISE : ACCENT_FALL);

    return { wah, wahPosition, brightness, swell, accent: this.accent };
  }
}
