import { describe, expect, it } from 'vitest';
import { BarClock } from './bar-clock';
import { STEPS_PER_BAR } from './patterns';

describe('BarClock', () => {
  it('starts at the beginning of the bar and fills the gaps between two steps', () => {
    const clock = new BarClock();
    expect(clock.progress(0)).toBe(0);
    clock.mark(0, 1000);
    clock.mark(1, 1125); // one step later, so a step is 125 ms
    const quarter = clock.progress(1125 + 62.5);
    expect(quarter).toBeGreaterThan(1 / STEPS_PER_BAR);
    expect(quarter).toBeLessThan(2 / STEPS_PER_BAR);
  });

  it('runs from zero to one over a bar and never past it', () => {
    const clock = new BarClock();
    let now = 0;
    for (let step = 0; step < STEPS_PER_BAR; step++) {
      clock.mark(step, now);
      now += 125;
    }
    expect(clock.progress(now - 125)).toBeCloseTo((STEPS_PER_BAR - 1) / STEPS_PER_BAR, 5);
    expect(clock.progress(now + 10_000)).toBe(1); // it waits for the next step rather than running away
  });

  it('never learns a step length from a pause or a restart', () => {
    const clock = new BarClock();
    clock.mark(0, 0);
    clock.mark(1, 125);
    clock.mark(2, 125 + 60_000); // the tab was asleep
    clock.mark(3, 125 + 60_125);
    const after = clock.progress(125 + 60_125 + 125);
    expect(after).toBeGreaterThan(3 / STEPS_PER_BAR);
    expect(after).toBeLessThanOrEqual(5 / STEPS_PER_BAR);
  });

  it('forgets where it was when the band stops', () => {
    const clock = new BarClock();
    clock.mark(8, 1000);
    clock.reset();
    expect(clock.progress(2000)).toBe(0);
  });
});
