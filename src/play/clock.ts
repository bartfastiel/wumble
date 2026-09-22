// Wall clock in milliseconds and one-shot timers, injectable so tests run without waiting.
export interface Clock {
  now(): number;
  after(ms: number, callback: () => void): () => void; // returns the cancel
}

export const systemClock: Clock = {
  now: () => performance.now(),
  after: (ms, callback) => {
    const handle = setTimeout(callback, ms);
    return () => {
      clearTimeout(handle);
    };
  },
};
