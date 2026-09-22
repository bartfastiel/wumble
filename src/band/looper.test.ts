import { describe, expect, it } from 'vitest';
import { createSetup, type Setup } from './__fixtures__/setup';
import { createLooper, LOOP_BARS, LOOP_BARS_DEFAULT, type Looper } from './looper';

// Classical at 60 bpm: a beat is a second, bar n starts at 0.05 + 4 n
const setup = (): { setup: Setup; looper: Looper; changes: number } => {
  const base = createSetup('classical');
  base.band.setTempo(60);
  const state = { setup: base, changes: 0 };
  const looper = createLooper({
    player: base.player,
    scheduler: base.band.scheduler,
    onChange: () => {
      state.changes++;
    },
  });
  return { ...state, looper };
};
const melodies = (base: Setup): number[] =>
  base.engine.calls.flatMap((call) => (call[0] === 'melody' ? [call[2]] : []));

describe('Looper', () => {
  it('records from the next bar start for loopBars bars, then loops the layer', () => {
    const state = setup();
    const { looper } = state;
    const base = state.setup;
    expect(looper.loopBars()).toBe(LOOP_BARS_DEFAULT);
    looper.setLoopBars(1);
    looper.record(); // without the band: nothing
    expect(looper.phase()).toBe('idle');
    base.band.start();
    base.time.advance(1);
    looper.record();
    expect(looper.phase()).toBe('armed');
    expect(looper.recording()).toEqual({ startPos: 4, endPos: 8, done: false });
    looper.down(1, 3, 5, base.time.clock.now()); // before the start: ignored
    base.time.advance(3.05 + 0.5); // bar 1 started at 4.05
    expect(looper.phase()).toBe('recording');
    looper.down(1, 3, 5, base.time.clock.now());
    base.time.advance(0.25);
    looper.up(1, base.time.clock.now());
    looper.up(2, base.time.clock.now()); // unknown pointer: ignored
    base.time.advance(2);
    looper.down(2, 1, 8, base.time.clock.now()); // held past the end: cut there
    base.time.advance(1.5);
    expect(looper.phase()).toBe('idle');
    expect(looper.recording()).toBeNull();
    looper.up(2, base.time.clock.now()); // after the recording closed: ignored
    expect(looper.layers()).toEqual([
      {
        bars: 1,
        events: [
          { t: 0.5, dur: 0.25, chord: 3, tone: 5 },
          { t: 2.75, dur: 1.25, chord: 1, tone: 8 },
        ],
      },
    ]);
    // the layer plays on immediately: bar 2 starts at 8.05
    base.time.advance(4.3);
    expect(melodies(base)).toEqual([8.55, 10.8, 12.55]);
    base.band.stop();
  });

  it('cuts a tone at the recording end, keeps a thirty-second at least and drops an empty layer', () => {
    const state = setup();
    const { looper } = state;
    const base = state.setup;
    looper.setLoopBars(1);
    base.band.start();
    base.time.advance(0.1);
    looper.record();
    base.time.advance(4.45); // bar 1 started at 4.05
    looper.down(1, 3, 5, base.time.clock.now());
    looper.up(1, base.time.clock.now()); // released at once
    base.time.advance(1);
    looper.down(2, 3, 6, base.time.clock.now());
    base.time.advance(2.45); // the lookahead has reached the end, the present has not
    expect(looper.recording()?.done).toBe(true);
    looper.up(2, base.time.clock.now() + 0.5); // past the end
    base.time.advance(0.15);
    expect(looper.recording()).toBeNull();
    expect(looper.layers()[0]?.events).toEqual([
      { t: 0.5, dur: 0.125, chord: 3, tone: 5 },
      { t: 1.5, dur: 2.5, chord: 3, tone: 6 },
    ]);
    looper.record();
    base.time.advance(8);
    expect(looper.layers()).toHaveLength(1); // the second recording had no events
    base.band.stop();
  });

  it('disarms when tapped again before the start and ignores a tap during the recording', () => {
    const state = setup();
    const { looper } = state;
    const base = state.setup;
    base.band.start();
    looper.record();
    expect(looper.phase()).toBe('armed');
    looper.record();
    expect(looper.phase()).toBe('idle');
    looper.record();
    base.time.advance(5);
    expect(looper.phase()).toBe('recording');
    looper.record();
    expect(looper.phase()).toBe('recording');
    base.band.stop();
  });

  it('overdubs: the next layer lies over the first, both relative to the bar counter', () => {
    const state = setup();
    const { looper } = state;
    const base = state.setup;
    looper.setLoopBars(1);
    base.band.start();
    base.time.advance(0.1);
    looper.record();
    base.time.advance(4.95); // beat 5: bar 1, beat 1
    looper.down(1, 3, 4, base.time.clock.now());
    looper.up(1, base.time.clock.now() + 0.5);
    base.time.advance(3.25);
    looper.record(); // arms for bar 3
    base.time.advance(5.75); // beat 14: bar 3, beat 2
    looper.down(2, 3, 9, base.time.clock.now());
    looper.up(2, base.time.clock.now() + 0.5);
    base.time.advance(3.05);
    expect(looper.layers().map((layer) => layer.events.map((event) => event.t))).toEqual([[1], [2]]);
    looper.remove(0);
    expect(looper.layers().map((layer) => layer.events.map((event) => event.t))).toEqual([[2]]);
    looper.clear();
    expect(looper.layers()).toEqual([]);
    base.band.stop();
  });

  it('drops a running recording when the band stops, keeps the layers and plays them after a restart', () => {
    const state = setup();
    const { looper } = state;
    const base = state.setup;
    looper.setLoopBars(1);
    base.band.start();
    base.time.advance(0.1);
    looper.record();
    base.time.advance(4.95);
    looper.down(1, 3, 4, base.time.clock.now());
    looper.up(1, base.time.clock.now() + 0.5);
    base.time.advance(4);
    looper.record();
    base.time.advance(4.5);
    expect(looper.phase()).toBe('recording');
    base.band.stop();
    expect(looper.phase()).toBe('idle');
    expect(looper.layers()).toHaveLength(1);
    base.engine.take();
    base.time.advance(1);
    base.band.start(); // bar 0 at 14.6, the layer's tone at beat 1
    base.time.advance(2);
    expect(melodies(base)).toEqual([15.6]);
    base.band.stop();
  });

  it('offers loops of 1, 2 and 4 bars', () => {
    expect(LOOP_BARS).toEqual([1, 2, 4]);
  });
});

describe('Looper edge cases', () => {
  it('ignores key presses without a recording and reports idle while a recording closes', () => {
    const base = createSetup('classical');
    base.band.setTempo(90); // bar 8/3 s: the bar ends between two ticks
    const looper = createLooper({ player: base.player, scheduler: base.band.scheduler });
    looper.setLoopBars(1);
    looper.down(1, 3, 4, 0);
    base.band.start();
    base.time.advance(0.1);
    looper.record();
    base.time.advance(3);
    looper.down(1, 3, 4, base.time.clock.now());
    looper.up(1, base.time.clock.now() + 0.2);
    base.time.advance(2.29); // 5.39 s: beat 8.01 – past the end, the closing tick at 5.4 has not run
    expect(looper.recording()).toMatchObject({ endPos: 8, done: true });
    expect(looper.phase()).toBe('idle');
    base.time.advance(0.02);
    expect(looper.recording()).toBeNull();
    expect(looper.layers()).toHaveLength(1);
    base.band.stop();
  });
});
