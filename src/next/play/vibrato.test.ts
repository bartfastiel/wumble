import { describe, expect, it } from 'vitest';
import { VibratoDetector } from './vibrato';

// A finger rocking around x0 with the given rate (Hz) and swing (share of the width), sampled every 4 ms as on a Pixel
const rock = (detector: VibratoDetector, rate: number, swing: number, ms: number, from = 0) => {
  let result = detector.update(0.5, from);
  for (let t = from + 4; t <= from + ms; t += 4) {
    result = detector.update(0.5 + (swing / 2) * Math.sin((2 * Math.PI * rate * t) / 1000), t);
  }
  return result;
};

describe('VibratoDetector', () => {
  it('stays silent while the finger rests or sweeps in one direction', () => {
    const resting = new VibratoDetector(0.5, 0);
    for (let t = 4; t < 800; t += 4) expect(resting.update(0.5 + 0.0005 * Math.sin(t), t).depth).toBe(0);
    const sweeping = new VibratoDetector(0.2, 0);
    let last = sweeping.update(0.2, 0);
    for (let t = 4; t < 800; t += 4) last = sweeping.update(0.2 + t / 2000, t);
    expect(last.depth).toBe(0);
  });

  it('answers a rocking finger within a fraction of a second', () => {
    const v = rock(new VibratoDetector(0.5, 0), 6, 0.02, 300);
    expect(v.depth).toBeGreaterThan(0.3);
  });

  it('takes its rate from how often the finger turns', () => {
    expect(rock(new VibratoDetector(0.5, 0), 5, 0.02, 1200).rate).toBeCloseTo(5, 0);
    expect(rock(new VibratoDetector(0.5, 0), 7, 0.02, 1200).rate).toBeCloseTo(7, 0);
  });

  it('takes its depth from how far the finger swings', () => {
    const small = rock(new VibratoDetector(0.5, 0), 6, 0.008, 1200).depth;
    const wide = rock(new VibratoDetector(0.5, 0), 6, 0.03, 1200).depth;
    expect(wide).toBeGreaterThan(small + 0.3);
    expect(wide).toBeLessThanOrEqual(1);
  });

  it('fades out once the finger stops rocking', () => {
    const detector = new VibratoDetector(0.5, 0);
    rock(detector, 6, 0.02, 1000);
    let v = detector.update(0.5, 1004);
    for (let t = 1008; t < 3000; t += 4) v = detector.update(0.5, t);
    expect(v).toEqual({ rate: 0, depth: 0 });
  });
});
