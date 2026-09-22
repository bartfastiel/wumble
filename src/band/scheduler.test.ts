import { describe, expect, it } from 'vitest';
import { createFakeTime } from './__fixtures__/fakes';
import { createScheduler, type Follower, LOOKAHEAD, RESTART_DELAY, type Scheduler, TICK } from './scheduler';

// Straight sixteenths: step s at s · beat / 4
const straight = (step: number, beat: number): number => (step * beat) / 4;

const setup = (): { time: ReturnType<typeof createFakeTime>; scheduler: Scheduler; steps: number[] } => {
  const time = createFakeTime();
  const steps: number[] = [];
  const scheduler = createScheduler({
    clock: time.clock,
    timers: time.timers,
    stepOffset: straight,
    onStep: (at) => steps.push(at),
  });
  return { time, scheduler, steps };
};

describe('Scheduler', () => {
  it('plans 120 ms ahead every 25 ms, step by step at the tempo', () => {
    const { time, scheduler, steps } = setup();
    scheduler.setTempo(120); // beat 0.5 s, step 0.125 s
    scheduler.start(0.1);
    expect(steps).toEqual([0.1]); // the first tick plans up to 0.12: only step 0
    expect(scheduler.position()).toEqual({ bar: 0, step: 1 });
    time.advance(TICK / 1000); // 0.025: plans up to 0.145, step 1 at 0.225 is not due yet
    expect(steps).toEqual([0.1]);
    time.advance((4 * TICK) / 1000); // 0.125: plans up to 0.245
    expect(steps).toEqual([0.1, 0.225]);
    time.advance(2);
    expect(steps.slice(0, 17)).toEqual(Array.from({ length: 17 }, (_, i) => 0.1 + i * 0.125));
    expect(scheduler.position().bar).toBe(1);
    expect(LOOKAHEAD).toBeCloseTo(0.12, 12);
  });

  it('applies a tempo change from the next step', () => {
    const { time, scheduler, steps } = setup();
    scheduler.setTempo(120);
    scheduler.start(0);
    time.advance(0.3); // steps 0…3 planned (up to 0.42)
    scheduler.setTempo(60); // beat 1 s, step 0.25 s
    time.advance(1);
    expect(steps.slice(0, 6)).toEqual([0, 0.125, 0.25, 0.375, 0.5, 0.75]);
  });

  it('converts between beats and audio time via the bar starts', () => {
    const { time, scheduler } = setup();
    scheduler.setTempo(60);
    scheduler.start(2);
    time.advance(9); // bars at 2, 6, 10 s
    expect(scheduler.beatAt(2)).toBe(0);
    expect(scheduler.beatAt(3.5)).toBe(1.5);
    expect(scheduler.beatAt(7)).toBe(5);
    expect(scheduler.beatAt(1)).toBe(-1); // before the first bar: continued linearly
    expect(scheduler.beatAt(30)).toBe(28);
    expect(scheduler.timeAt(0)).toBe(2);
    expect(scheduler.timeAt(5)).toBe(7);
    expect(scheduler.timeAt(-2)).toBe(0);
    expect(scheduler.timeAt(100)).toBe(102);
    expect(scheduler.now()).toBe(9);
  });

  it('forgets bar starts older than four bars and stays linear', () => {
    const { time, scheduler } = setup();
    scheduler.setTempo(120); // bar 2 s
    scheduler.start(0);
    time.advance(20);
    expect(scheduler.beatAt(0)).toBe(0);
    expect(scheduler.beatAt(19)).toBe(38);
    expect(scheduler.timeAt(38)).toBe(19);
  });

  it('answers 0 before it ever started', () => {
    const { scheduler } = setup();
    expect(scheduler.beatAt(5)).toBe(0);
    expect(scheduler.timeAt(5)).toBe(0);
    expect(scheduler.running()).toBe(false);
  });

  it('fires UI callbacks at audio time and drops them on stop', () => {
    const { time, scheduler } = setup();
    const fired: number[] = [];
    scheduler.start(0);
    scheduler.at(0.5, () => fired.push(time.clock.now()));
    scheduler.at(-1, () => fired.push(time.clock.now())); // in the past: as soon as possible
    scheduler.at(3, () => fired.push(time.clock.now()));
    time.advance(1);
    expect(fired).toEqual([0, 0.5]);
    scheduler.stop();
    time.advance(5);
    expect(fired).toEqual([0, 0.5]);
    expect(time.pending()).toBe(0);
  });

  it('lets a callback wait until a lagging clock has reached its time', () => {
    // The audio clock reads 10 ms behind the timers' time, like a context that advances in chunks
    const time = createFakeTime();
    const lag = 0.01;
    const fired: number[] = [];
    const scheduler = createScheduler({
      clock: { now: () => time.clock.now() - lag },
      timers: time.timers,
      stepOffset: straight,
      onStep: () => undefined,
    });
    scheduler.start(0);
    scheduler.at(0.5, () => fired.push(time.clock.now()));
    time.advance(0.505); // the timer fired at 0.51 – the clock stood at 0.5 then
    expect(fired).toEqual([]);
    time.advance(0.01);
    expect(fired).toEqual([0.51]);
  });

  it('starts the timeline afresh when the clock jumps back and tells the band', () => {
    // The fallback clock ran ahead while the audio clock stood still; then the audio clock took over
    const time = createFakeTime();
    let offset = 0;
    const steps: number[] = [];
    const restarts: number[] = [];
    const events: string[] = [];
    const scheduler = createScheduler({
      clock: { now: () => time.clock.now() + offset },
      timers: time.timers,
      stepOffset: straight,
      onStep: (at) => steps.push(at),
      onRestart: (at) => restarts.push(at),
    });
    scheduler.follow({ reset: (at) => events.push(`reset ${String(at)}`), tick: () => undefined });
    scheduler.setTempo(60);
    scheduler.start(0);
    scheduler.at(5, () => events.push('planned'));
    time.advance(2.5);
    expect(scheduler.position()).toEqual({ bar: 0, step: 11 });
    offset = -2; // the audio clock is two seconds behind the fallback it replaces
    time.advance(0.03); // the next tick sees the jump
    const at = restarts[0] ?? 0;
    expect(at).toBeCloseTo(2.525 - 2 + RESTART_DELAY, 9);
    expect(events).toEqual(['reset 0', `reset ${String(at)}`]);
    expect(scheduler.position()).toEqual({ bar: 0, step: 1 });
    expect(steps.at(-1)).toBe(at);
    expect(scheduler.beatAt(at)).toBe(0);
    time.advance(10);
    expect(events).not.toContain('planned'); // planned on the old timeline
    expect(scheduler.position().bar).toBe(2);
  });

  it('ignores a second start and a second stop', () => {
    const { time, scheduler, steps } = setup();
    scheduler.start(0);
    scheduler.start(5);
    time.advance(0.1);
    expect(steps[0]).toBe(0);
    scheduler.stop();
    scheduler.stop();
    expect(scheduler.running()).toBe(false);
  });

  it('renders offline through the same steps and tells the followers', () => {
    const { scheduler, steps } = setup();
    scheduler.setTempo(60);
    const events: string[] = [];
    const follower: Follower = {
      reset: (at) => events.push(`reset ${String(at)}`),
      tick: (to) => events.push(`tick ${String(to)}`),
    };
    scheduler.follow(follower);
    expect(scheduler.rendering()).toBe(false);
    expect(scheduler.render(1, 10)).toBe(14);
    expect(steps).toHaveLength(16);
    expect(steps[0]).toBe(10);
    expect(steps[15]).toBe(13.75);
    expect(events[0]).toBe('reset 10');
    expect(events[1]).toBe('tick 10.25');
    expect(events.at(-2)).toBe('tick 14');
    expect(events.at(-1)).toBe('reset 0');
    expect(scheduler.rendering()).toBe(false);
    expect(scheduler.position()).toEqual({ bar: 1, step: 0 });
  });

  it('reports rendering while it renders and refuses to render while running', () => {
    const time = createFakeTime();
    const seen: boolean[] = [];
    const scheduler = createScheduler({
      clock: time.clock,
      timers: time.timers,
      stepOffset: straight,
      onStep: () => seen.push(scheduler.rendering()),
    });
    scheduler.render(1, 0);
    expect(seen).toEqual(Array.from({ length: 16 }, () => true));
    scheduler.start(0);
    expect(() => scheduler.render(1, 0)).toThrow('while running');
    scheduler.stop();
  });

  it('resets the followers on start and stop and ticks them with the planning window', () => {
    const { time, scheduler } = setup();
    const events: string[] = [];
    scheduler.follow({
      reset: (at) => events.push(`reset ${String(at)}`),
      tick: (to) => events.push(`tick ${String(to)}`),
    });
    scheduler.start(1);
    expect(events).toEqual(['reset 1', 'tick 0.12']);
    time.advance(0.025);
    expect(events).toEqual(['reset 1', 'tick 0.12', 'tick 0.145']);
    scheduler.stop();
    expect(events.at(-1)).toBe('reset 0');
  });
});
