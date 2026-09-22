// Lookahead scheduler of the band: every 25 ms the steps of the next 120 ms are put on the audio
// timeline (setInterval is imprecise, the audio clock is not); the grid is sixteenths with the counters bar/step.
// The bar starts it records are the clock for loop, echo and radio: position in beats from bar 0 ↔ audio time.
import type { Cancel, Clock, Timers } from './clock';
import { BEATS_PER_BAR, STEPS_PER_BAR } from './patterns';

export const LOOKAHEAD = 0.12; // seconds planned ahead
export const TICK = 25; // ms between ticks
export const RESTART_DELAY = 0.05; // seconds between a clock jump and the fresh bar 0
export const TEMPO_MIN = 60;
export const TEMPO_MAX = 160;
export const TEMPO_DEFAULT = 100;

// Loop, echo and radio run in the same lookahead: reset when the timeline restarts at t, tick with the end of every
// planning window
export interface Follower {
  reset(time: number): void;
  tick(to: number): void;
}

export interface Position {
  readonly bar: number;
  readonly step: number;
}

export interface SchedulerOptions {
  readonly clock: Clock;
  readonly timers: Timers;
  readonly stepOffset: (step: number, beat: number) => number; // seconds from the bar start, swing applied
  readonly onStep: (time: number) => void; // schedule the events of position() at audio time
  readonly onRestart?: (time: number) => void; // the clock jumped back (clock.ts): the timeline begins again at `time`
}

export interface Scheduler {
  now(): number;
  tempo(): number;
  setTempo(bpm: number): void; // clamped to 60…160, effective from the next step
  position(): Position;
  running(): boolean;
  rendering(): boolean;
  start(at: number): void; // on bar 0, step 0 at audio time `at`
  stop(): void; // drops planned UI callbacks, resets the followers
  render(bars: number, from: number): number; // offline: the same steps synchronously, returns the end time
  beatAt(time: number): number; // position in beats from bar 0
  timeAt(position: number): number;
  at(time: number, fn: () => void): void; // UI callback at audio time, dropped on stop
  follow(follower: Follower): void;
}

interface BarStart {
  readonly bar: number;
  readonly time: number;
}
const REMEMBERED_BARS = 4;

export const createScheduler = (options: SchedulerOptions): Scheduler => {
  const { clock, timers, stepOffset, onStep, onRestart } = options;
  let tempo = TEMPO_DEFAULT;
  let bar = 0;
  let step = 0;
  let nextTime = 0;
  let lastNow = 0;
  let stopTicking: Cancel | null = null;
  let rendering = false;
  const pending = new Map<number, Cancel>();
  let pendingId = 0;
  const followers: Follower[] = [];
  // Bar starts of the last bars – the scheduler plans ahead, so the entries reach further than the present; before
  // the first entry and beyond the last the grid continues linearly (swing moves eighths and sixteenths only)
  let barStarts: BarStart[] = [];

  const beat = (): number => 60 / tempo;
  const markBar = (n: number, time: number): void => {
    barStarts.push({ bar: n, time });
    if (barStarts.length > REMEMBERED_BARS) barStarts.shift();
  };
  const beatAt = (time: number): number => {
    let entry = barStarts[0];
    for (const start of barStarts) if (start.time <= time) entry = start;
    return entry === undefined ? 0 : entry.bar * BEATS_PER_BAR + (time - entry.time) / beat();
  };
  const timeAt = (position: number): number => {
    let entry = barStarts[0];
    for (const start of barStarts) if (start.bar * BEATS_PER_BAR <= position) entry = start;
    return entry === undefined ? 0 : entry.time + (position - entry.bar * BEATS_PER_BAR) * beat();
  };

  // One step further; the duration holds at the current tempo and groove, so a change applies from the next step
  const advance = (time: number): number => {
    const duration = stepOffset(step + 1, beat()) - stepOffset(step, beat());
    if (++step === STEPS_PER_BAR) {
      step = 0;
      bar++;
      markBar(bar, time + duration);
    }
    return time + duration;
  };
  const rewind = (time: number): void => {
    bar = 0;
    step = 0;
    nextTime = time;
    barStarts = [];
    markBar(0, time);
    for (const follower of followers) follower.reset(time);
  };
  const dropPending = (): void => {
    for (const cancel of pending.values()) cancel();
    pending.clear();
  };
  // The audio clock took over from the fallback and lies behind it: steps planned on the fallback clock would come
  // late by the stall, so the timeline starts afresh – bar 0 in a moment, the followers reset, planned callbacks gone
  const restart = (now: number): void => {
    dropPending();
    rewind(now + RESTART_DELAY);
    onRestart?.(nextTime);
  };
  const tick = (): void => {
    const now = clock.now();
    if (now < lastNow) restart(now);
    lastNow = now;
    const until = now + LOOKAHEAD;
    while (nextTime < until) {
      onStep(nextTime);
      nextTime = advance(nextTime);
    }
    for (const follower of followers) follower.tick(until);
  };

  return {
    now: () => clock.now(),
    tempo: () => tempo,
    setTempo(bpm) {
      tempo = Math.min(TEMPO_MAX, Math.max(TEMPO_MIN, Math.round(bpm)));
    },
    position: () => ({ bar, step }),
    running: () => stopTicking !== null,
    rendering: () => rendering,
    start(at) {
      if (stopTicking !== null) return;
      lastNow = clock.now();
      rewind(at);
      stopTicking = timers.every(TICK, tick);
      tick();
    },
    stop() {
      if (stopTicking === null) return;
      stopTicking();
      stopTicking = null;
      dropPending();
      for (const follower of followers) follower.reset(0);
    },
    render(bars, from) {
      if (stopTicking !== null) throw new Error('cannot render while running');
      rendering = true;
      rewind(from);
      let time = from;
      for (let n = 0; n < bars * STEPS_PER_BAR; n++) {
        onStep(time);
        time = advance(time);
        for (const follower of followers) follower.tick(time);
      }
      rendering = false;
      for (const follower of followers) follower.reset(0);
      return time;
    },
    beatAt,
    timeAt,
    // The audio clock moves in chunks (a render quantum, a device buffer): a timer for the remaining time can fire a
    // moment before the clock reaches `time` – then it is set again, so the callback always sees the time reached
    at(time, fn) {
      const id = ++pendingId;
      const arm = (): void => {
        const cancel = timers.after(Math.max(0, (time - clock.now()) * 1000), () => {
          if (clock.now() < time) {
            arm();
            return;
          }
          pending.delete(id);
          fn();
        });
        pending.set(id, cancel);
      };
      arm();
    },
    follow(follower) {
      followers.push(follower);
    },
  };
};
