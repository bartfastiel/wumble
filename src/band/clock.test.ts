import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRecordingEngine } from './__fixtures__/fakes';
import { audioClock, realTimers, STALL_MS } from './clock';

describe('audioClock', () => {
  it('reads the engine time', () => {
    let now = 0;
    const engine = createRecordingEngine({ now: () => now });
    const clock = audioClock(engine);
    now = 2.5;
    expect(clock.now()).toBe(2.5);
  });

  it('goes on with the performance clock once the audio clock stood still for a second', () => {
    let wall = 10_000;
    const clock = audioClock(createRecordingEngine({ now: () => 0 }), () => wall);
    expect(clock.now()).toBe(0);
    wall += STALL_MS - 1;
    expect(clock.now()).toBe(0); // a context that is about to resume is no stall
    wall += 1;
    expect(clock.now()).toBe(0); // the fallback starts here, without a jump
    wall += 250;
    expect(clock.now()).toBeCloseTo(0.25, 9);
    wall += 2000;
    expect(clock.now()).toBeCloseTo(2.25, 9);
  });

  it('hands back to the audio clock as soon as it advances, even from a later stall', () => {
    let audio = 3;
    let wall = 0;
    const clock = audioClock(createRecordingEngine({ now: () => audio }), () => wall);
    clock.now();
    wall += STALL_MS + 500;
    expect(clock.now()).toBe(3); // the fallback begins with this read, without a jump
    wall += 500;
    expect(clock.now()).toBeCloseTo(3.5, 9);
    audio = 3.01; // the context resumed: the band clock jumps back to it
    wall += 10;
    expect(clock.now()).toBe(audio);
    audio = 3.02;
    wall += 10;
    expect(clock.now()).toBe(audio);
    wall += STALL_MS + 100; // a second stall, from the value it stopped at
    expect(clock.now()).toBe(audio);
    wall += 100;
    expect(clock.now()).toBeCloseTo(3.12, 9);
  });

  it('uses performance.now by default', () => {
    const clock = audioClock(createRecordingEngine({ now: () => 1 }));
    expect(clock.now()).toBe(1);
  });
});

describe('realTimers', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('wraps setInterval and setTimeout with cancel functions', () => {
    const calls: string[] = [];
    const stopInterval = realTimers.every(10, () => calls.push('every'));
    const cancelTimeout = realTimers.after(25, () => calls.push('after'));
    const cancelled = realTimers.after(5, () => calls.push('cancelled'));
    cancelled();
    vi.advanceTimersByTime(30);
    expect(calls).toEqual(['every', 'every', 'after', 'every']);
    stopInterval();
    cancelTimeout();
    vi.advanceTimersByTime(30);
    expect(calls).toHaveLength(4);
  });
});
