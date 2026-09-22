import { afterEach, describe, expect, it, vi } from 'vitest';
import { systemClock } from './clock';

describe('systemClock', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('reads performance.now and runs timers that were not cancelled', () => {
    vi.useFakeTimers();
    const start = systemClock.now();
    const fired = vi.fn();
    const cancelled = vi.fn();
    systemClock.after(100, fired);
    systemClock.after(100, cancelled)();
    vi.advanceTimersByTime(100);
    expect(fired).toHaveBeenCalledTimes(1);
    expect(cancelled).not.toHaveBeenCalled();
    expect(systemClock.now()).toBeGreaterThanOrEqual(start);
  });
});
