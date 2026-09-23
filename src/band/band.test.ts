import { describe, expect, it } from 'vitest';
import { chordOf } from '../theory/chords';
import { keyBySignature } from '../theory/keys';
import { buildModel, chordAt } from '../theory/model';
import { noteName, pcOf } from '../theory/pitch';
import { STYLE_IDS, STYLES } from '../theory/styles';
import { bassSemitones, createBand, nthOrLast } from './band';
import { type Call, drumTimes, isVoice, laneCalls, mulberry32 } from './__fixtures__/calls';
import { createFakeTime, createRecordingEngine } from './__fixtures__/fakes';
import { createSetup } from './__fixtures__/setup';
import { GROOVES } from './grooves';
import { PATTERNS } from './patterns';
import { TEMPO_MAX, TEMPO_MIN } from './scheduler';
import { SCHEMATA } from './schemata';

const midiOf = (hz: number): number => Math.round(69 + 12 * Math.log2(hz / 440));
const notesOf = (calls: readonly Call[]): string[] =>
  calls.flatMap((call) => (isVoice(call) ? [noteName(midiOf(call[3][0] ?? 0))] : []));
const pitchClasses = (calls: readonly Call[]): number[] =>
  calls.flatMap((call) => (isVoice(call) ? call[3].map((hz) => pcOf(midiOf(hz))) : []));

describe('Band.renderBars', () => {
  it.each(STYLE_IDS)('%s: plays drums, bass and chords of its own groove', (styleId) => {
    const setup = createSetup(styleId);
    const engine = createRecordingEngine();
    const end = setup.band.renderBars(engine, 2);
    expect(end).toBeGreaterThan(0);
    const groove = GROOVES[STYLES[styleId].groove];
    const pattern = PATTERNS[STYLES[styleId].groove];
    // Two bars means twice the pattern, and nothing the pattern does not contain
    expect(drumTimes(engine.calls, 'kick')).toHaveLength(pattern.drums.filter((hit) => hit.kind === 'kick').length * 2);
    expect(setup.band.groove()).toEqual(groove);
    expect(setup.engine.calls).toEqual([]); // the live engine stays silent while rendering
  });

  it.each(STYLE_IDS)('%s: every tone it plays belongs to the chord it follows', (styleId) => {
    const setup = createSetup(styleId);
    const model = buildModel(keyBySignature(0), styleId);
    const engine = createRecordingEngine();
    setup.setChordSource(model.home);
    setup.band.renderBars(engine, 1);
    const chord = chordAt(model, model.home);
    const allowed = new Set<number>([
      ...chord.pcs,
      ...(chord.seventh === null ? [] : [chord.seventh]),
      // the bass may add a sixth, a seventh, an octave and a chromatic leading tone
      ...[6, 8, 9, 10, 11].map((step) => pcOf(chord.root + step)),
    ]);
    for (const pc of pitchClasses(laneCalls(engine.calls, 'chord'))) expect(allowed).toContain(pc);
    for (const pc of pitchClasses(laneCalls(engine.calls, 'bass'))) expect(allowed).toContain(pc);
  });

  it('walks the bass through the turnaround: root, third, fifth, leading tone to the next root', () => {
    const setup = createSetup('jazz', 'turnaround');
    const engine = createRecordingEngine();
    setup.band.renderBars(engine, 4);
    expect(notesOf(laneCalls(engine.calls, 'bass'))).toEqual('C E G G♯ A C E C♯ D F A F♯ G B D B'.split(' '));
  });

  it('plays the boogie bass C C E E G G A A in the blues', () => {
    const setup = createSetup('blues');
    const engine = createRecordingEngine();
    setup.band.renderBars(engine, 1);
    expect(notesOf(laneCalls(engine.calls, 'bass'))).toEqual('C C E E G G A A'.split(' '));
  });

  it('arpeggiates C G C′ E♭ on the melody layer in techno', () => {
    const setup = createSetup('techno');
    const engine = createRecordingEngine();
    setup.band.renderBars(engine, 1);
    const melody = laneCalls(engine.calls, 'melody');
    expect(notesOf(melody).slice(0, 4)).toEqual(['C', 'G', 'C', 'D♯']);
    const midis = melody.flatMap((call) => (isVoice(call) ? [midiOf(call[3][0] ?? 0)] : []));
    expect(midis.slice(0, 4)).toEqual([48, 55, 60, 51]); // C3 G3 C4 E♭3
  });

  it('spaces the blues kicks exactly two beats apart', () => {
    const setup = createSetup('blues');
    const engine = createRecordingEngine();
    setup.band.renderBars(engine, 2, 1.5);
    const kicks = drumTimes(engine.calls, 'kick');
    for (const [i, want] of [1.5, 2.7, 3.9, 5.1].entries()) expect(kicks[i]).toBeCloseTo(want, 9);
    for (let i = 1; i < kicks.length; i++) expect((kicks[i] ?? 0) - (kicks[i - 1] ?? 0)).toBeCloseTo((2 * 60) / 100, 9);
  });

  it('renders the same thing twice, so a recording is reproducible', () => {
    const first = createRecordingEngine();
    const second = createRecordingEngine();
    createSetup('rock').band.renderBars(first, 2);
    createSetup('rock').band.renderBars(second, 2);
    expect(second.calls).toEqual(first.calls);
  });

  it('refuses to render while playing', () => {
    const setup = createSetup();
    setup.band.start();
    expect(() => setup.band.renderBars(createRecordingEngine(), 1)).toThrow('while running');
    setup.band.stop();
  });
});

describe('Band live', () => {
  it('starts on bar 1 after 50 ms and keeps the kicks two beats apart', () => {
    const setup = createSetup('blues', 'blues');
    setup.time.advance(10);
    setup.band.start();
    expect(setup.band.running()).toBe(true);
    expect(setup.engine.ensured()).toBe(1);
    setup.time.advance(5.2);
    const kicks = drumTimes(setup.engine.calls, 'kick');
    expect(kicks[0]).toBeCloseTo(10.05, 9);
    expect(kicks.length).toBeGreaterThanOrEqual(4);
    for (let i = 1; i < kicks.length; i++) expect((kicks[i] ?? 0) - (kicks[i - 1] ?? 0)).toBeCloseTo((2 * 60) / 100, 9);
    expect(setup.band.scheduler.position().bar).toBe(2);
  });

  it('calls the UI on every beat and shows the chord of every bar of the schema', () => {
    const setup = createSetup('classical', 'pop');
    const model = buildModel(keyBySignature(0), 'classical');
    setup.band.start();
    setup.time.advance(0.05 + 2.4 * 2 + 0.01);
    expect(setup.beats).toHaveLength(9);
    [0.05, 0.65, 1.25, 1.85, 2.45].forEach((expected, i) => {
      expect(setup.beats[i]).toBeCloseTo(expected, 9);
    });
    // pop is I – V – vi – IV
    expect(setup.chords.map((chord) => chordAt(model, chord ?? -1).offset)).toEqual([0, 7, 9]);
    expect(setup.band.bandChord()).toBe(setup.chords.at(-1));
    setup.band.setSchema('follow');
    expect(setup.band.bandChord()).toBeNull();
    expect(setup.chords.at(-1)).toBeNull();
  });

  it('stops: releases the sounding voices and drops planned UI callbacks', () => {
    const setup = createSetup('classical', 'pop');
    setup.band.start();
    setup.time.advance(0.3);
    const stopped: number[] = [];
    setup.band.onStop(() => stopped.push(setup.time.clock.now()));
    setup.band.stop();
    expect(setup.band.running()).toBe(false);
    expect(stopped).toEqual([0.3]);
    expect(setup.chords.at(-1)).toBeNull();
    const releases = setup.engine.calls.filter((call) => call[0] === 'release' && Math.abs(call[2] - 0.3) < 1e-9);
    expect(releases.length).toBeGreaterThan(0); // the pad and the bass held at 0.3 s
    const beats = setup.beats.length;
    setup.time.advance(5);
    expect(setup.beats).toHaveLength(beats);
    expect(setup.time.pending()).toBe(0);
    setup.band.stop(); // a second stop is harmless
  });

  it('toggles', () => {
    const setup = createSetup();
    setup.band.toggle();
    expect(setup.band.running()).toBe(true);
    setup.band.start(); // a second start is harmless
    setup.band.toggle();
    expect(setup.band.running()).toBe(false);
  });

  it('follows the play through the chord source and moves held tones at the next eighth', () => {
    const setup = createSetup('classical', 'follow');
    const model = buildModel(keyBySignature(0), 'classical');
    const tonic = model.home;
    const dominant = model.chords.findIndex((chord) => chord.offset === 7 && chord.seventh !== null);
    setup.setChordSource(tonic);
    setup.band.start();
    setup.time.advance(0.05 + 0.3);
    setup.setChordSource(dominant);
    setup.time.advance(0.6);
    const chords = setup.engine.calls.filter((call) => call[0] === 'chord');
    const ascending = (a: number, b: number): number => a - b;
    const first = chords[0];
    const last = chords.at(-1);
    expect(first).toBeDefined();
    expect(last).toBeDefined();
    expect(pitchClasses(first === undefined ? [] : [first]).sort(ascending)).toEqual(
      [...chordAt(model, tonic).pcs].sort(ascending),
    );
    expect(pitchClasses(last === undefined ? [] : [last])).toContain(pcOf(chordAt(model, dominant).root));
    expect(setup.band.currentChord()).toBe(dominant);
    expect(setup.band.chordForBar(7)).toBe(dominant);
    setup.band.stop();
  });

  it('changes the tempo from the next step and clamps it', () => {
    const setup = createSetup('classical');
    setup.band.start();
    setup.time.advance(0.05 + 0.6);
    setup.band.setTempo(120);
    setup.time.advance(1.2);
    const kicks = drumTimes(setup.engine.calls, 'kick');
    // pop kicks on 1 and "3 and": 0.05, then at 100 bpm 2.5 beats later would be 1.55 – at 120 bpm the steps shrink
    expect(kicks[0]).toBeCloseTo(0.05, 9);
    expect(kicks[1]).toBeGreaterThan(0.05 + 0.6);
    expect(kicks[1]).toBeLessThan(1.55);
    setup.band.setTempo(500);
    expect(setup.band.tempo()).toBe(TEMPO_MAX);
    setup.band.setTempo(10.4);
    expect(setup.band.tempo()).toBe(TEMPO_MIN);
    setup.band.setTempo(99.6);
    expect(setup.band.tempo()).toBe(100);
    setup.band.stop();
  });

  it('taps the tempo from the second tap on', () => {
    const setup = createSetup('classical');
    setup.band.tap();
    expect(setup.band.tempo()).toBe(100);
    setup.time.advance(0.5);
    setup.band.tap();
    expect(setup.band.tempo()).toBe(120);
    setup.time.advance(0.5);
    setup.band.tap();
    expect(setup.band.tempo()).toBe(120);
  });

  it('exposes the groove of the style and the output engine', () => {
    const setup = createSetup('jazz');
    expect(setup.band.groove()).toEqual(GROOVES.jazz);
    expect(setup.band.schema()).toBe('follow');
    expect(setup.band.output()).toBe(setup.engine);
  });

  it('steps back for two bars when a hand chooses a chord of its own', () => {
    const setup = createSetup('classical', 'pop');
    const model = buildModel(keyBySignature(0), 'classical');
    setup.band.start();
    setup.time.advance(0.05 + 0.1);
    const own = model.chords.findIndex((chord) => chord.offset === 5); // the subdominant, not in bar 1 of pop
    setup.setChordSource(own);
    setup.band.yield();
    expect(setup.band.currentChord()).toBe(own); // the hand leads
    expect(setup.band.bandChord()).toBeNull(); // and the map stops showing a schema chord
    // two bars later the schema takes over again: pop is I - V - vi - IV, so bar 3 is the submediant
    setup.time.advance(2.4 * 2 + 0.1);
    expect(chordAt(model, setup.band.currentChord()).offset).toBe(9);
    expect(setup.band.bandChord()).not.toBeNull();
    setup.band.stop();
  });

  it.each(Object.keys(SCHEMATA))('%s: names a chord for every bar, or follows the play', (id) => {
    const setup = createSetup('classical', id as 'pop');
    setup.band.start();
    setup.time.advance(0.05 + 2.4 * 4);
    const shown = setup.chords;
    if (SCHEMATA[id as 'pop'].bars === null) expect(shown.every((chord) => chord === null)).toBe(true);
    else expect(shown.every((chord) => chord !== null)).toBe(true);
    setup.band.stop();
  });
});

describe('nthOrLast', () => {
  it('returns the entry or the last one', () => {
    expect(nthOrLast([1, 2, 3], 1)).toBe(2);
    expect(nthOrLast([1, 2], 5)).toBe(2);
    expect(() => nthOrLast([], 0)).toThrow(RangeError);
  });
});

describe('bassSemitones', () => {
  const chordOn = (style: 'classical' | 'jazz' | 'rock', offset: number, seventh: boolean) => {
    const model = buildModel(keyBySignature(0), style);
    const index = model.chords.findIndex((chord) => chord.offset === offset && (chord.seventh !== null) === seventh);
    return chordAt(model, index);
  };

  it('takes third, fifth and seventh from the chord and falls back for power chords and triads', () => {
    const g7 = chordOn('classical', 7, true); // G B D + F
    expect(['1', '3', '5', '6', '7', '8'].map((degree) => bassSemitones(g7, degree as '1'))).toEqual([
      0, 4, 7, 9, 10, 12,
    ]);
    expect(bassSemitones(chordOn('jazz', 0, true), '7')).toBe(11); // Cmaj7
    expect(bassSemitones(chordOn('classical', 0, false), '7')).toBe(10); // no seventh: the minor one
    // C5, a power chord: no third, so the fifth stands in for it
    const power = chordOf(keyBySignature(0), {
      degree: 0,
      root: 0,
      intervals: [0, 7],
      seventh: null,
      quality: '5',
      sharp: false,
    });
    expect(bassSemitones(power, '3')).toBe(7);
    expect(bassSemitones(power, '5')).toBe(7);
  });
});

describe('Band without UI hooks', () => {
  it('runs without beat and chord callbacks and leads the bass below the next root when following', () => {
    const time = createFakeTime();
    const engine = createRecordingEngine(time.clock);
    const model = buildModel(keyBySignature(0), 'jazz');
    const aMinorSeventh = model.chords.findIndex((chord) => chord.offset === 9 && chord.seventh !== null);
    const band = createBand({
      engine,
      clock: time.clock,
      timers: time.timers,
      model: () => model,
      tuning: () => 'equal',
      chordSource: () => aMinorSeventh,
    });
    band.setTempo(120);
    band.start();
    time.advance(2.2);
    band.stop();
    expect(notesOf(laneCalls(engine.calls, 'bass')).slice(0, 4)).toEqual(['A', 'C', 'E', 'G♯']);
    expect(band.bandChord()).toBeNull();
  });
});

describe('mulberry32', () => {
  it('repeats the same numbers for the same seed', () => {
    const first = Array.from({ length: 5 }, mulberry32(7));
    const again = Array.from({ length: 5 }, mulberry32(7));
    expect(again).toEqual(first);
    expect(first.every((value) => value >= 0 && value < 1)).toBe(true);
  });
});
