import { describe, expect, it } from 'vitest';
import { ClockSync, median, SAMPLE_COUNT } from './clock-sync';

describe('median', () => {
  it('takes the middle value of an odd count and the upper middle of an even count', () => {
    expect(median([5, 1, 3])).toBe(3);
    expect(median([4, 1, 3, 2])).toBe(3);
    expect(median([7])).toBe(7);
    expect(median([])).toBe(0);
  });
});

describe('ClockSync', () => {
  it('starts unsynced at offset zero', () => {
    const clock = new ClockSync();
    expect(clock.synced).toBe(false);
    expect(clock.offset).toBe(0);
    expect(clock.rtt).toBe(0);
    expect(clock.serverNow(1000)).toBe(1000);
  });

  it('derives the offset from a pong: server time minus the midpoint of the round trip', () => {
    const clock = new ClockSync();
    const sample = clock.record(1000, 4100, 1200);
    expect(sample).toEqual({ offset: 3000, rtt: 200 });
    expect(clock.offset).toBe(3000);
    expect(clock.rtt).toBe(200);
    expect(clock.synced).toBe(true);
    expect(clock.serverNow(2000)).toBe(5000);
  });

  it('uses the median of the last five samples, so one slow round trip does not matter', () => {
    const clock = new ClockSync();
    clock.record(0, 3000, 0);
    clock.record(0, 3010, 20);
    clock.record(0, 3500, 0); // a stray sample
    expect(clock.offset).toBe(3000);
    clock.record(0, 2990, 0);
    clock.record(0, 3005, 10);
    expect(clock.offset).toBe(3000);
    for (let i = 0; i < SAMPLE_COUNT; i++) clock.record(0, 4000 + i, 0);
    expect(clock.offset).toBe(4002); // the old samples have dropped out
  });

  it('keeps the offset and stays synced across a reset until new samples arrive', () => {
    const clock = new ClockSync();
    clock.record(0, 3000, 0);
    clock.reset();
    expect(clock.synced).toBe(true);
    expect(clock.offset).toBe(3000);
    clock.record(0, 100, 0);
    expect(clock.offset).toBe(100);
  });
});
