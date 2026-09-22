import { describe, expect, it } from 'vitest';
import { keyBySignature } from '../theory/keys';
import { buildModel } from '../theory/model';
import { mtof } from '../theory/pitch';
import { laneCalls } from './__fixtures__/calls';
import { createFakeTime, createRecordingEngine } from './__fixtures__/fakes';
import { createSetup } from './__fixtures__/setup';
import { createPlayer, PHRASE_LEVEL } from './player';
import { createScheduler } from './scheduler';

const classical = buildModel(keyBySignature(0), 'classical');
const home = classical.home;
const c4 = classical.tones.indexOf(60);
const e4 = classical.tones.indexOf(64);
const g4 = classical.tones.indexOf(67);
const a4 = classical.tones.indexOf(69);

describe('Player', () => {
  it('plays the loop layers round by round, each in its own length', () => {
    const setup = createSetup('classical');
    setup.band.setTempo(60);
    setup.player.addLayer({ bars: 1, events: [{ t: 0, dur: 1, chord: home, tone: c4 }] });
    setup.player.addLayer({ bars: 2, events: [{ t: 4, dur: 1, chord: home, tone: g4 }] });
    const engine = createRecordingEngine();
    setup.band.renderBars(engine, 4);
    const melody = laneCalls(engine.calls, 'melody');
    const round = (hz: number): number => Math.round(hz * 1e3) / 1e3;
    const starts = melody.flatMap((call) => (call[0] === 'melody' ? [[call[2], round(call[3][0] ?? 0)]] : []));
    // the one-bar layer four times, the two-bar layer twice on its second bar
    expect(starts).toEqual([
      [0, round(mtof(60))],
      [4, round(mtof(60))],
      [4, round(mtof(67))],
      [8, round(mtof(60))],
      [12, round(mtof(60))],
      [12, round(mtof(67))],
    ]);
    expect(PHRASE_LEVEL).toBeGreaterThan(0);
  });

  it('plays one-off sequences from their position, at the phrase level, and forgets them when done', () => {
    const setup = createSetup('classical');
    setup.band.setTempo(60);
    setup.band.start();
    const events = [
      { t: 0, dur: 1, chord: home, tone: c4 },
      { t: 1, dur: 0.5, chord: home, tone: e4 },
      { t: 6, dur: 2, chord: 0, tone: g4 },
    ];
    const sequence = setup.player.add(events, 4);
    setup.time.advance(5);
    const notes = setup.engine.calls.filter((call) => call[0] === 'melody');
    expect(notes).toEqual([
      ['melody', expect.any(Number), 4.05, [261.626], PHRASE_LEVEL],
      ['melody', expect.any(Number), 5.05, [329.628], PHRASE_LEVEL],
    ]);
    expect(setup.engine.calls).toContainEqual(['release', notes[0]?.[1], 5.05]);
    expect(sequence.next).toBe(2);
    setup.player.remove(sequence);
    setup.time.advance(8);
    expect(setup.engine.calls.filter((call) => call[0] === 'melody')).toHaveLength(2);
    setup.band.stop();
  });

  it('skips the notes of a sequence that lie before the window it was added in', () => {
    const setup = createSetup('classical');
    setup.band.setTempo(60);
    setup.band.start();
    setup.time.advance(2);
    setup.player.add(
      [
        { t: 0, dur: 1, chord: home, tone: c4 },
        { t: 3, dur: 1, chord: home, tone: e4 },
      ],
      0,
    );
    setup.time.advance(3);
    const notes = setup.engine.calls.filter((call) => call[0] === 'melody');
    expect(notes).toHaveLength(1);
    expect(notes[0]?.[2]).toBeCloseTo(3.05, 9);
    setup.band.stop();
  });

  it('lets stripes glow as ghosts while a playback sounds, not while rendering', () => {
    const setup = createSetup('classical');
    setup.band.setTempo(60);
    setup.player.addLayer({ bars: 1, events: [{ t: 1, dur: 0.5, chord: home, tone: a4 }] });
    setup.band.renderBars(createRecordingEngine(), 1);
    setup.band.start();
    setup.time.advance(1.1);
    expect(setup.player.ghosts()).toEqual([{ chord: home, tone: a4, until: 1.55 }]);
    setup.time.advance(0.5);
    expect(setup.player.ghosts()).toEqual([]);
    setup.band.stop();
  });

  it('ghosts only the notes a sequence marks', () => {
    const setup = createSetup('classical');
    setup.band.setTempo(60);
    setup.band.start();
    setup.player.add(
      [
        { t: 0, dur: 1, chord: home, tone: e4 },
        { t: 1, dur: 1, chord: home, tone: g4 },
      ],
      1,
      (index) => index === 0,
    );
    setup.time.advance(1.5);
    expect(setup.player.ghosts().map((ghost) => ghost.tone)).toEqual([e4]);
    setup.band.stop();
    expect(setup.player.ghosts()).toEqual([]);
  });

  it('manages layers and tells the listeners about windows and resets', () => {
    const setup = createSetup('classical');
    const events: string[] = [];
    setup.player.listen({
      reset: (position) => events.push(`reset ${position.toFixed(3)}`),
      window: (from, to) => events.push(`window ${from.toFixed(3)} ${to.toFixed(3)}`),
    });
    setup.player.listen({}); // a listener without hooks is fine
    setup.player.addLayer({ bars: 1, events: [] });
    setup.player.addLayer({ bars: 2, events: [] });
    expect(setup.player.layers().map((layer) => layer.bars)).toEqual([1, 2]);
    setup.player.removeLayer(0);
    expect(setup.player.layers().map((layer) => layer.bars)).toEqual([2]);
    setup.player.clearLayers();
    expect(setup.player.layers()).toEqual([]);
    setup.band.start();
    setup.time.advance(0.025);
    setup.band.stop();
    // the stop resets the timeline to audio time 0, which lies 50 ms before bar 0
    expect(events).toEqual(['reset 0.000', 'window 0.000 0.117', 'window 0.117 0.158', 'reset -0.083']);
  });
});

describe('Player on a scheduler that starts in the future', () => {
  it('places nothing until the timeline reaches the start', () => {
    const time = createFakeTime();
    const engine = createRecordingEngine(time.clock);
    const scheduler = createScheduler({
      clock: time.clock,
      timers: time.timers,
      stepOffset: (step, beat) => (step * beat) / 4,
      onStep: () => undefined,
    });
    const player = createPlayer({ engine: () => engine, scheduler, melodyFrequency: () => 440 });
    const windows: number[] = [];
    player.listen({ window: (_, to) => windows.push(to) });
    player.addLayer({ bars: 1, events: [{ t: 0, dur: 1, chord: 0, tone: 0 }] });
    scheduler.start(5);
    time.advance(1);
    expect(windows).toEqual([]);
    expect(engine.calls).toEqual([]);
    time.advance(4.5);
    expect(windows.length).toBeGreaterThan(0);
    expect(engine.calls[0]?.[2]).toBe(5);
    scheduler.stop();
  });
});
