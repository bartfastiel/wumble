import { describe, expect, it } from 'vitest';
import { DYNAMICS_MAX, Finger, PressureSense, type Sample } from './expression';
import { bluesKeys } from './keys';

const keys = bluesKeys();
const centre = (i: number): number => ((keys[i]?.left ?? 0) + (keys[i]?.right ?? 0)) / 2;
const widthOf = (i: number): number => (keys[i]?.right ?? 0) - (keys[i]?.left ?? 0);
const at = (time: number, x: number, y: number, pressure = 0.5): Sample => ({ time, x, y, pressure });

// A device that reports real pressure, as a Pixel 6 Pro does in 1/63 steps
const pressureDevice = (): PressureSense => {
  const sense = new PressureSense();
  for (const p of [34, 40, 48, 55, 63]) sense.observe(p / 63);
  return sense;
};

describe('PressureSense', () => {
  it('ignores the values browsers report without a sensor', () => {
    const sense = new PressureSense();
    for (const p of [0, 0.5, 1, 0.5, 0]) sense.observe(p);
    expect(sense.supported).toBe(false);
  });

  it('trusts a device once it has seen a few different values, and stretches its range', () => {
    const sense = pressureDevice();
    expect(sense.supported).toBe(true);
    expect(sense.normalised(34 / 63)).toBeLessThan(0.1);
    expect(sense.normalised(1)).toBe(1);
  });
});

describe('Finger', () => {
  it('starts on the key it lands on, at exactly its pitch, with a haptic start', () => {
    const finger = new Finger(keys, new PressureSense(), at(0, centre(4), 0.5));
    const e = finger.start(at(0, centre(4), 0.5));
    expect(e.key).toBe(4);
    expect(e.tone).toBe(keys[4]?.tone);
    expect(e.haptic).toBe('start');
    expect(e.tremor).toBe(0);
  });

  it('without pressure, strikes softly at the top of a key and firmly at the bottom', () => {
    const top = new Finger(keys, new PressureSense(), at(0, centre(2), 0.05)).start(at(0, centre(2), 0.05));
    const bottom = new Finger(keys, new PressureSense(), at(0, centre(2), 0.95)).start(at(0, centre(2), 0.95));
    expect(bottom.dynamics).toBeGreaterThan(top.dynamics + 0.4);
  });

  it('with pressure, a light tap plays lightly and a firm one firmly', () => {
    const sense = pressureDevice();
    const light = new Finger(keys, sense, at(0, centre(6), 0.5, 34 / 63)).start(at(0, centre(6), 0.5, 34 / 63));
    const firm = new Finger(keys, sense, at(0, centre(6), 0.5, 1)).start(at(0, centre(6), 0.5, 1));
    expect(light.dynamics).toBeLessThan(0.3);
    expect(firm.dynamics).toBeGreaterThan(1);
  });

  it('with pressure, grows louder as the finger presses in, without moving', () => {
    const sense = pressureDevice();
    const finger = new Finger(keys, sense, at(0, centre(8), 0.5, 36 / 63));
    const light = finger.start(at(0, centre(8), 0.5, 36 / 63));
    const firm = finger.move(at(800, centre(8), 0.5, 1));
    expect(firm.dynamics).toBeGreaterThan(light.dynamics + 0.7);
    expect(firm.dynamics).toBeLessThanOrEqual(DYNAMICS_MAX);
  });

  it('follows readily when the finger eases off after pressing hard', () => {
    const sense = pressureDevice();
    const finger = new Finger(keys, sense, at(0, centre(8), 0.5, 40 / 63));
    finger.start(at(0, centre(8), 0.5, 40 / 63));
    finger.move(at(300, centre(8), 0.5, 1));
    // a flattened fingertip relaxes only part of the way back: that must still bring the bow down to piano
    const eased = finger.move(at(700, centre(8), 0.5, 52 / 63));
    expect(eased.dynamics).toBeLessThan(0.45);
    // and pressing in again finds forte again
    expect(finger.move(at(900, centre(8), 0.5, 1)).dynamics).toBeGreaterThan(1);
  });

  it('draws harder when sliding up the key and lighter when sliding down', () => {
    const finger = new Finger(keys, new PressureSense(), at(0, centre(3), 0.6));
    const start = finger.start(at(0, centre(3), 0.6)).dynamics;
    expect(finger.move(at(50, centre(3), 0.4)).dynamics).toBeGreaterThan(start + 0.25);
    expect(finger.move(at(100, centre(3), 0.8)).dynamics).toBeLessThan(start - 0.25);
  });

  it('turns a rocking finger into a swing of strength, never of pitch, and lets a slow drift pass', () => {
    const finger = new Finger(keys, new PressureSense(), at(0, centre(5), 0.5));
    const still = finger.start(at(0, centre(5), 0.5));
    const rocked = finger.move(at(8, centre(5) + widthOf(5) * 0.08, 0.5));
    expect(rocked.tremor).toBeGreaterThan(0.3);
    expect(rocked.dynamics).toBeGreaterThan(still.dynamics);
    expect(rocked.tone).toBe(still.tone);
    let e = rocked;
    for (let t = 16; t < 3000; t += 8) e = finger.move(at(t, centre(5) + widthOf(5) * 0.08, 0.5));
    expect(Math.abs(e.tremor)).toBeLessThan(0.01);
  });

  it('never swings beyond its depth', () => {
    const finger = new Finger(keys, new PressureSense(), at(0, centre(6), 0.5));
    finger.start(at(0, centre(6), 0.5));
    expect(finger.move(at(4, centre(6) - widthOf(6) * 0.4, 0.5)).tremor).toBe(-1);
  });

  it('slides legato onto a neighbour, lands on its exact pitch and tells the hand', () => {
    const finger = new Finger(keys, new PressureSense(), at(0, centre(2), 0.5));
    finger.start(at(0, centre(2), 0.5));
    const e = finger.move(at(300, centre(3), 0.5));
    expect(e.key).toBe(3);
    expect(e.tone).toBe(keys[3]?.tone);
    expect(e.haptic).toBe('key');
    expect(e.tremor).toBe(0);
  });

  it('ticks once per dynamic step, not on every event', () => {
    const finger = new Finger(keys, new PressureSense(), at(0, centre(0), 0.9));
    finger.start(at(0, centre(0), 0.9));
    const ticks = [100, 200, 210, 220].map((t, i) => finger.move(at(t, centre(0), 0.9 - 0.12 * (i + 1))).haptic);
    expect(ticks[0]).toBe('step');
    expect(ticks.slice(1).filter((h) => h === 'step').length).toBeLessThanOrEqual(1);
  });
});
