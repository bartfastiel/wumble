import { describe, expect, it } from 'vitest';
import { MotionTracker, type Motion } from './motion';

const G = 9.81;
// A phone held upright in portrait, tilted back by `pitch` degrees and sideways by `roll` degrees
const held = (pitch: number, roll = 0): [number, number, number] => {
  const p = (pitch * Math.PI) / 180;
  const r = (roll * Math.PI) / 180;
  return [G * Math.sin(r), G * Math.cos(p) * Math.cos(r), G * Math.sin(p) * Math.cos(r)];
};

const run = (
  tracker: MotionTracker,
  from: number,
  ms: number,
  sample: (t: number) => { gravity: [number, number, number]; linear: [number, number, number] | null },
): Motion => {
  let m = tracker.update({ time: from, ...sample(from) });
  for (let t = from + 16; t <= from + ms; t += 16) m = tracker.update({ time: t, ...sample(t) });
  return m;
};

describe('MotionTracker', () => {
  it('does nothing while the device is held still', () => {
    const m = run(new MotionTracker(), 0, 2000, () => ({ gravity: held(10), linear: [0.05, -0.05, 0.05] }));
    expect(m.wah).toBe(0);
    expect(Math.abs(m.brightness)).toBeLessThan(0.01);
    expect(Math.abs(m.swell)).toBeLessThan(0.01);
    expect(m.accent).toBe(0);
  });

  it('opens a wah when tilted forward or back, its position following the tilt', () => {
    const tracker = new MotionTracker();
    run(tracker, 0, 300, () => ({ gravity: held(10), linear: null }));
    const back = run(tracker, 316, 600, () => ({ gravity: held(40), linear: null }));
    expect(back.wah).toBeCloseTo(1, 1);
    expect(back.wahPosition).toBeLessThan(-0.9);
    const forward = run(tracker, 932, 600, () => ({ gravity: held(-15), linear: null }));
    expect(forward.wah).toBeGreaterThan(0.7);
    expect(forward.wahPosition).toBeGreaterThan(0.7);
  });

  it('measures every tilt from the posture of the last rezero', () => {
    const tracker = new MotionTracker();
    run(tracker, 0, 300, () => ({ gravity: held(10), linear: null }));
    run(tracker, 316, 300, () => ({ gravity: held(50), linear: null }));
    tracker.rezero();
    expect(run(tracker, 632, 300, () => ({ gravity: held(50), linear: null })).wah).toBe(0);
  });

  it('moves the bow towards the bridge when tilted sideways', () => {
    const tracker = new MotionTracker();
    run(tracker, 0, 300, () => ({ gravity: held(10), linear: null }));
    expect(run(tracker, 316, 500, () => ({ gravity: held(10, 30), linear: null })).brightness).toBeGreaterThan(0.9);
    expect(run(tracker, 832, 500, () => ({ gravity: held(10, -15), linear: null })).brightness).toBeLessThan(-0.4);
  });

  it('swells when the device is lifted and glides back once it is held still', () => {
    const tracker = new MotionTracker();
    run(tracker, 0, 300, () => ({ gravity: held(0), linear: [0, 0, 0] }));
    // lifting by about 20 cm in 0.4 s: accelerate up, then brake
    const lifted = run(tracker, 316, 400, (t) => ({ gravity: held(0), linear: [0, t < 516 ? 5 : -5, 0] }));
    expect(lifted.swell).toBeGreaterThan(0.15);
    const lowered = run(new MotionTracker(), 0, 400, (t) => ({ gravity: held(0), linear: [0, t < 200 ? -5 : 5, 0] }));
    expect(lowered.swell).toBeLessThan(-0.15);
    const later = run(tracker, 732, 5000, () => ({ gravity: held(0), linear: [0, 0, 0] }));
    expect(Math.abs(later.swell)).toBeLessThan(0.02);
  });

  it('digs the bow in with every jolt of a shaking hand', () => {
    const tracker = new MotionTracker();
    run(tracker, 0, 200, () => ({ gravity: held(0), linear: [0, 0, 0] }));
    const shaken = run(tracker, 216, 48, () => ({ gravity: held(0), linear: [10, 0, 0] }));
    expect(shaken.accent).toBeGreaterThan(0.2);
    const calm = run(tracker, 280, 600, () => ({ gravity: held(0), linear: [0.2, 0, 0] }));
    expect(calm.accent).toBeLessThan(0.01);
  });
});
