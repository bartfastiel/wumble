import { describe, expect, it } from 'vitest';
import {
  CONTROL_LEN,
  GLOBALS,
  METER_LEN,
  SHARED_CONTROL_BYTES,
  VOICE_STRIDE,
  defaultControls,
  peakOf,
  publish,
  readMeter,
  sharedControls,
  snapshot,
  writeVoice,
} from './layout';

describe('control block', () => {
  it('places a voice at its stride', () => {
    const controls = defaultControls();
    writeVoice(controls, 2, { gate: true, note: 7, midi: 63.5, dynamics: 0.75, vibratoRate: 6, vibratoDepth: 0.5 });
    expect([...controls.slice(2 * VOICE_STRIDE, 3 * VOICE_STRIDE)]).toEqual([1, 7, 63.5, 0.75, 6, 0.5]);
    expect(controls[0]).toBe(0);
  });

  it('starts at full volume with some room', () => {
    const controls = defaultControls();
    expect(controls).toHaveLength(CONTROL_LEN);
    expect(controls[GLOBALS]).toBe(1);
    expect(controls[GLOBALS + 1]).toBeCloseTo(0.35);
  });
});

describe('meter block', () => {
  it('reads a voice and the peak', () => {
    const meters = new Float32Array(METER_LEN);
    meters.set([0.5, 0.25, 1], 3);
    meters[METER_LEN - 1] = 0.75;
    expect(readMeter(meters, 1)).toEqual({ level: 0.5, dynamics: 0.25, active: true });
    expect(readMeter(meters, 0).active).toBe(false);
    expect(peakOf(meters)).toBe(0.75);
  });
});

describe('seqlock', () => {
  it('hands over a consistent copy', () => {
    const shared = sharedControls(new SharedArrayBuffer(SHARED_CONTROL_BYTES));
    const controls = defaultControls();
    writeVoice(controls, 0, { gate: true, note: 1, midi: 60, dynamics: 0.5, vibratoRate: 0, vibratoDepth: 0 });
    publish(shared, controls);
    const into = new Float32Array(CONTROL_LEN);
    expect(snapshot(shared, into)).toBe(true);
    expect([...into]).toEqual([...controls]);
    expect(shared.sequence[0]).toBe(2);
  });

  it('refuses to read while a write is under way', () => {
    const shared = sharedControls(new SharedArrayBuffer(SHARED_CONTROL_BYTES));
    Atomics.store(shared.sequence, 0, 3);
    const into = new Float32Array(CONTROL_LEN).fill(9);
    expect(snapshot(shared, into)).toBe(false);
    expect(into[0]).toBe(9);
  });
});
