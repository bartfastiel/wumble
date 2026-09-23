import { describe, expect, it } from 'vitest';
import { Quality } from './quality';

const feed = (quality: Quality, ms: number, times: number, clock: { t: number }): number => {
  let changes = 0;
  for (let i = 0; i < times; i++) {
    clock.t += ms;
    if (quality.sample(ms)) changes++;
  }
  return changes;
};

const setup = (ceiling = 3) => {
  const clock = { t: 0 };
  return { clock, quality: new Quality({ ceiling, now: () => clock.t }) };
};

describe('Quality', () => {
  it('starts one step below what the device could do, because the first frames are the expensive ones', () => {
    expect(new Quality({ ceiling: 3 }).scale).toBe(1.5);
    expect(new Quality({ ceiling: 2 }).scale).toBe(1.5);
    expect(new Quality({ ceiling: 1 }).scale).toBe(1);
  });

  it('never asks for more pixels than the device has', () => {
    const { quality, clock } = setup(1);
    feed(quality, 5, 400, clock);
    expect(quality.scale).toBe(1);
  });

  it('gives up resolution when the frames run long', () => {
    const { quality, clock } = setup(3);
    const before = quality.scale;
    feed(quality, 40, 300, clock);
    expect(quality.scale).toBeLessThan(before);
    expect(quality.scale).toBe(1);
  });

  it('takes it back when there is room again', () => {
    const { quality, clock } = setup(3);
    feed(quality, 40, 300, clock);
    expect(quality.scale).toBe(1);
    feed(quality, 6, 400, clock);
    expect(quality.scale).toBe(2);
  });

  it('says when the canvas has to be resized, and not more often than it settles', () => {
    const { quality, clock } = setup(3);
    clock.t += 1000;
    expect(quality.sample(40)).toBe(false); // one long frame is not a verdict
    const changes = feed(quality, 40, 60, clock);
    expect(changes).toBeGreaterThan(0);
    expect(changes).toBeLessThan(5); // it steps, it does not oscillate
  });

  it('drops the trimmings before it drops resolution, and widens what counts as a wide stripe', () => {
    const { quality, clock } = setup(3);
    feed(quality, 40, 120, clock);
    expect(quality.detail).toBe(false);
    expect(quality.detailWidth).toBeGreaterThan(9);
    feed(quality, 5, 400, clock);
    expect(quality.detail).toBe(true);
    expect(quality.detailWidth).toBe(9);
  });
});
