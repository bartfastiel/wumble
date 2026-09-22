import { describe, expect, it, vi } from 'vitest';
import { keyBySignature } from '../theory/keys';
import { buildModel, chordAt, toneOf } from '../theory/model';
import { mtof } from '../theory/pitch';
import { chordFrequencies, melodyFrequency } from '../theory/tuning';
import { SILENT } from './chord-voice';
import { FakeClock, FakeEngine } from './__fixtures__/fakes';
import { LIT_MS, Player, type PlayerListener } from './player';
import { DEFAULTS, type Settings } from './settings';
import { createStore, type Store } from './store';

const setup = (
  patch: Partial<Settings> = {},
): { player: Player; engine: FakeEngine; clock: FakeClock; store: Store } => {
  const engine = new FakeEngine();
  const clock = new FakeClock();
  const store = createStore({ ...DEFAULTS, ...patch });
  return { player: new Player({ engine, store, clock }), engine, clock, store };
};
const cMajor = buildModel(keyBySignature(0), 'classical');
const c4 = cMajor.tones.indexOf(60);
const e4 = cMajor.tones.indexOf(64);
const g4 = cMajor.tones.indexOf(67);
const tonic = cMajor.home;

describe('Player: a tone is a tone', () => {
  it('sounds the melody tone alone and releases it with the pointer', () => {
    const { player, engine } = setup();
    engine.time = 1.5;
    player.press(1, c4);
    expect(engine.ensured).toBe(1);
    expect(engine.voices.map((voice) => voice.kind)).toEqual(['melody']);
    expect(engine.voices[0]?.freqs).toEqual([mtof(60)]);
    expect(engine.voices[0]?.at).toBe(1.5);
    expect(player.pointers.get(1)).toEqual({ chord: SILENT, tone: c4, voices: [expect.anything()] });
    engine.time = 2;
    player.release(1);
    expect(engine.active()).toHaveLength(0);
    expect(player.pointers.size).toBe(0);
  });

  it('plays several fingers at once and lets them go together', () => {
    const { player, engine } = setup();
    player.press(1, c4);
    player.press(2, e4);
    player.press('k', g4);
    expect(engine.ofKind('melody')).toHaveLength(3);
    expect(player.pointers.size).toBe(3);
    player.releaseAll();
    expect(engine.active()).toHaveLength(0);
    expect(player.pointers.size).toBe(0);
  });

  it('presses the same pointer again on another tone without leaking a voice', () => {
    const { player, engine } = setup();
    player.press(1, c4);
    player.press(1, e4);
    expect(engine.ofKind('melody')).toHaveLength(2);
    expect(engine.active('melody')).toHaveLength(1);
    expect(player.pointers.get(1)?.tone).toBe(e4);
  });

  it('rejects a tone that is not on the field', () => {
    const { player } = setup();
    expect(() => {
      player.press(1, cMajor.tones.length);
    }).toThrow(RangeError);
  });
});

describe('Player: the chord comes from the map', () => {
  it('keeps the chosen chord sounding after the finger is gone', () => {
    const { player, engine } = setup();
    player.chooseChord(tonic);
    expect(engine.ofKind('chord')).toHaveLength(1);
    expect(engine.ofKind('bass')).toHaveLength(1);
    expect(engine.voices.find((voice) => voice.kind === 'bass')?.freqs).toEqual([
      chordFrequencies(cMajor, 'equal', tonic).bass,
    ]);
    expect(player.chord).toBe(tonic);
    expect(engine.active('chord')).toHaveLength(1); // nothing released it
  });

  it('swaps one chord for the next and falls silent on the field of silence', () => {
    const { player, engine } = setup();
    player.chooseChord(tonic);
    engine.time = 1;
    player.chooseChord(0);
    expect(engine.ofKind('chord')).toHaveLength(2);
    expect(engine.active('chord')).toHaveLength(1);
    player.chooseChord(SILENT);
    expect(player.chord).toBe(SILENT);
    expect(engine.active()).toHaveLength(0);
  });

  it('tunes the melody to the chord that sounds with it', () => {
    const { player, engine } = setup({ tuning: 'adaptive' });
    player.chooseChord(tonic);
    player.press(1, e4);
    expect(engine.ofKind('melody')[0]?.freqs).toEqual([melodyFrequency(cMajor, 'adaptive', tonic, e4)]);
  });

  it('leaves chord and bass to the band while it runs', () => {
    const { player, engine } = setup();
    player.bandRunning = true;
    player.chooseChord(tonic);
    expect(engine.voices).toHaveLength(0);
    expect(player.chord).toBe(tonic); // the choice still counts: the band reads it
    player.bandRunning = false;
    player.chordVoice.refresh(engine.now());
    expect(engine.ofKind('chord')).toHaveLength(1);
  });

  it('forgets the chord when key or style change', () => {
    const { player, store, engine } = setup();
    player.chooseChord(tonic);
    store.update({ style: 'blues' });
    expect(player.chord).toBe(SILENT);
    expect(engine.active()).toHaveLength(0);
    expect(player.harmony.current).toBeNull();
  });
});

describe('Player.slide', () => {
  it('is a glissando: the old tone releases and the new one presses', () => {
    const { player, engine } = setup();
    player.press(1, c4);
    player.slide(1, e4);
    expect(engine.ofKind('melody')).toHaveLength(2);
    expect(engine.active('melody')).toHaveLength(1);
    expect(player.pointers.get(1)?.tone).toBe(e4);
  });

  it('does nothing on the same tone, or without a pointer', () => {
    const { player, engine } = setup();
    player.press(1, c4);
    player.slide(1, c4);
    player.slide(99, e4);
    expect(engine.ofKind('melody')).toHaveLength(1);
  });
});

describe('Player: auto-harmony', () => {
  it('lets the field choose the chord for the tone', () => {
    const { player, engine } = setup({ mode: 'autoHarmony' });
    player.press(1, c4);
    expect(player.chord).toBeGreaterThanOrEqual(0);
    expect(chordAt(cMajor, player.chord).pcs).toContain(0);
    expect(engine.ofKind('chord')).toHaveLength(1);
  });

  it('does not choose anything in two-hands mode', () => {
    const { player, engine } = setup();
    player.press(1, c4);
    expect(player.chord).toBe(SILENT);
    expect(engine.ofKind('chord')).toHaveLength(0);
  });
});

describe('Player: listeners and lit tones', () => {
  it('reports press and release with the audio time, until unsubscribed', () => {
    const { player, engine } = setup();
    const pressed = vi.fn();
    const released = vi.fn();
    const listener: PlayerListener = { press: pressed, release: released, change: vi.fn() };
    const off = player.subscribe(listener);
    engine.time = 3;
    player.press(1, g4);
    expect(pressed).toHaveBeenCalledWith(expect.objectContaining({ id: 1, tone: g4, chord: SILENT, at: 3 }));
    player.release(1);
    expect(released).toHaveBeenCalledWith(expect.objectContaining({ id: 1, at: 3 }));
    off();
    player.press(2, c4);
    expect(pressed).toHaveBeenCalledTimes(1);
  });

  it('keeps a played tone glowing for a moment, and only that one', () => {
    const { player, clock } = setup();
    player.press(1, c4);
    expect(player.isLit(toneOf(cMajor, c4))).toBe(true);
    expect(player.isLit(toneOf(cMajor, c4) + 12)).toBe(false); // the same pitch class an octave up stays dark
    clock.time += LIT_MS + 1;
    expect(player.isLit(toneOf(cMajor, c4))).toBe(false);
    expect(player.lit.size).toBe(0); // and forgotten
  });

  it('lights only the tones a glissando actually touched', () => {
    const { player } = setup();
    player.press(1, c4);
    player.slide(1, e4);
    player.slide(1, g4);
    const glowing = cMajor.tones.filter((midi) => player.isLit(midi));
    expect(glowing).toEqual([60, 64, 67]);
  });
});
