// Time sources of the band, injected so tests run instantly on a fake clock: the audio clock in seconds and the
// interval/timeout the scheduler ticks with.
import type { AudioEngine } from '../audio/engine';

export interface Clock {
  now(): number; // seconds
}

export type Cancel = () => void;

export interface Timers {
  every(ms: number, fn: () => void): Cancel;
  after(ms: number, fn: () => void): Cancel;
}

export const STALL_MS = 1000;

// The audio clock is the band's time base. A context that does not run (no output device, suspended by the autoplay
// policy or an interruption) keeps currentTime still, and on a still clock the band never reaches the next bar: after
// STALL_MS without advance the clock goes on from the last audio time on the performance clock. Once the audio clock
// moves again it takes over – behind by the stall, so the scheduler sees a jump back and starts its timeline afresh.
export const audioClock = (engine: AudioEngine, monotonic: () => number = () => performance.now()): Clock => {
  let lastAudio: number | null = null;
  let advancedAt = 0; // performance time of the last advance
  let stalledAt: number | null = null; // performance time the fallback took over, null while the audio clock runs
  return {
    now: () => {
      const audio = engine.now();
      const wall = monotonic();
      if (audio !== lastAudio) {
        lastAudio = audio;
        advancedAt = wall;
        stalledAt = null;
        return audio;
      }
      if (stalledAt === null) {
        if (wall - advancedAt < STALL_MS) return audio;
        stalledAt = wall;
      }
      return audio + (wall - stalledAt) / 1000;
    },
  };
};

export const realTimers: Timers = {
  every: (ms, fn) => {
    const id = setInterval(fn, ms);
    return () => {
      clearInterval(id);
    };
  },
  after: (ms, fn) => {
    const id = setTimeout(fn, ms);
    return () => {
      clearTimeout(id);
    };
  },
};
