// Test doubles: a clock with timers that run when the test advances the time, and an audio engine that records every
// call, so a test can read back what the band played.
import type { AudioEngine, DrumKind } from '../../audio/engine';
import type { Clock, Timers } from '../clock';
import type { Call } from './calls';

export interface FakeTime {
  readonly clock: Clock;
  readonly timers: Timers;
  advance(seconds: number): void; // runs due timers in time order, then lands on the target time
  pending(): number; // timers waiting
}

interface Task {
  at: number;
  readonly fn: () => void;
  readonly origin: number; // seconds; an interval's n-th run lies at origin + n · every, without drift
  readonly every: number | null; // seconds, null for a timeout
  runs: number;
}

export const createFakeTime = (): FakeTime => {
  let now = 0;
  let tasks: Task[] = [];
  const add = (ms: number, fn: () => void, every: number | null): (() => void) => {
    const task: Task = { at: now + ms / 1000, fn, origin: now, every, runs: 0 };
    tasks.push(task);
    return () => {
      tasks = tasks.filter((candidate) => candidate !== task);
    };
  };
  const due = (until: number): Task | undefined =>
    tasks.filter((task) => task.at <= until).sort((a, b) => a.at - b.at)[0];
  return {
    clock: { now: () => now },
    timers: {
      every: (ms, fn) => add(ms, fn, ms / 1000),
      after: (ms, fn) => add(ms, fn, null),
    },
    advance(seconds) {
      const target = now + seconds;
      for (let task = due(target); task !== undefined; task = due(target)) {
        now = Math.max(now, task.at);
        task.runs++;
        if (task.every === null) tasks = tasks.filter((candidate) => candidate !== task);
        else task.at = task.origin + (task.runs + 1) * task.every;
        task.fn();
      }
      now = target;
    },
    pending: () => tasks.length,
  };
};

const round = (value: number, digits: number): number => Math.round(value * 10 ** digits) / 10 ** digits;

export interface RecordingEngine extends AudioEngine {
  readonly calls: Call[];
  take(): Call[]; // the calls so far, then start afresh
  lastCallAt(): number; // audio time of the last drum or voice call
  ensured(): number; // how often ensure() was called
  released(): number; // releaseAll() calls
}

export const createRecordingEngine = (clock: Clock = { now: () => 0 }): RecordingEngine => {
  let calls: Call[] = [];
  let voices = 0;
  let lastCallAt = 0;
  let ensured = 0;
  let released = 0;
  const record = (call: Call): void => {
    calls.push(call);
    lastCallAt = call[2];
  };
  const voice = (kind: 'melody' | 'chord' | 'bass', freqs: readonly number[], at: number, gain = 1) => {
    const id = voices++;
    record([kind, id, round(at, 6), freqs.map((hz) => round(hz, 3)), round(gain, 6)]);
    return {
      release(end: number) {
        calls.push(['release', id, round(end, 6)]);
      },
    };
  };
  return {
    get calls() {
      return calls;
    },
    take() {
      const out = calls;
      calls = [];
      voices = 0;
      lastCallAt = 0;
      return out;
    },
    lastCallAt: () => lastCallAt,
    ensured: () => ensured,
    released: () => released,
    fadeIn() {
      // nothing to fade in a recording
    },
    ensure() {
      ensured++;
      return clock.now();
    },
    now: () => clock.now(),
    melody: (freq, at, gain) => voice('melody', [freq], at, gain),
    chord: (freqs, at, gain) => voice('chord', freqs, at, gain),
    bass: (freq, at, gain) => voice('bass', [freq], at, gain),
    drum(kind: DrumKind, at, velocity = 1) {
      record(['drum', kind, round(at, 6), round(velocity, 6)]);
    },
    setCombi: () => Promise.resolve(),
    releaseAll() {
      released++;
    },
  };
};
