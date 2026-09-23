// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { keyBySignature } from '../theory/keys';
import { buildModel } from '../theory/model';
import { FakeClock, FakeEngine } from './__fixtures__/fakes';
import {
  bindKeyboard,
  KEY_STEPS,
  keyChord,
  keyTone,
  type KeyboardOptions,
  MUTE,
  pointerIdOf,
} from './keyboard-bindings';
import { Player } from './player';
import { DEFAULTS } from './settings';
import { createStore } from './store';

const cMajor = buildModel(keyBySignature(0), 'classical');
const TONES = cMajor.tones.length;
const PER_OCTAVE = cMajor.style.scale.length;

const setup = (options: KeyboardOptions = {}): { player: Player; engine: FakeEngine; unbind: () => void } => {
  const engine = new FakeEngine();
  const store = createStore({ ...DEFAULTS, mode: 'twoHands' });
  const player = new Player({ engine, store, clock: new FakeClock() });
  return { player, engine, unbind: bindKeyboard(document, player, options) };
};
const key = (type: 'keydown' | 'keyup', code: string, init: KeyboardEventInit = {}): KeyboardEvent =>
  new KeyboardEvent(type, { code, bubbles: true, cancelable: true, ...init });

describe('keyTone', () => {
  it('lays fifteen keys around the middle of the field, the letter rows an octave apart', () => {
    expect(Object.keys(KEY_STEPS)).toHaveLength(15);
    const z = keyTone('KeyZ', TONES, PER_OCTAVE);
    expect(z).not.toBeNull();
    expect(keyTone('KeyA', TONES, PER_OCTAVE)).toBe((z ?? 0) + PER_OCTAVE);
    expect(keyTone('KeyK', TONES, PER_OCTAVE)).toBe((z ?? 0) + 14);
    // around the middle: the lowest key is in the upper half of the field, but not at its top
    expect(z).toBeGreaterThan(TONES / 4);
    expect((z ?? 0) + 14).toBeLessThan(TONES);
    expect(keyTone('Space', TONES, PER_OCTAVE)).toBeNull();
    expect(pointerIdOf('KeyA')).toBe('kKeyA');
  });

  it('never reaches past the field, however narrow it is', () => {
    for (const code of Object.keys(KEY_STEPS)) {
      const tone = keyTone(code, 8, 5);
      expect(tone).not.toBeNull();
      expect(tone).toBeGreaterThanOrEqual(0);
      expect(tone).toBeLessThan(8);
    }
  });
});

describe('keyChord', () => {
  it('maps the digits to the map, and zero to the chord that is already chosen', () => {
    expect(keyChord('Digit1')).toBe(0);
    expect(keyChord('Digit7')).toBe(6);
    expect(keyChord('Digit0')).toBe(MUTE);
    expect(keyChord('KeyA')).toBeNull();
  });
});

describe('bindKeyboard', () => {
  it('presses a key as its own pointer and releases it on keyup', () => {
    const { player, unbind } = setup();
    const down = key('keydown', 'KeyA');
    document.dispatchEvent(down);
    expect(down.defaultPrevented).toBe(true);
    expect(player.pointers.get('kKeyA')).toMatchObject({ tone: keyTone('KeyA', TONES, PER_OCTAVE) });
    document.dispatchEvent(key('keydown', 'KeyA')); // held keys repeat as new events on some systems
    expect(player.pointers.size).toBe(1);
    document.dispatchEvent(key('keyup', 'KeyA'));
    expect(player.pointers.size).toBe(0);
    unbind();
    document.dispatchEvent(key('keydown', 'KeyA'));
    expect(player.pointers.size).toBe(0);
  });

  it('chooses a chord with a digit and plays the melody with it', () => {
    const { player, unbind } = setup();
    document.dispatchEvent(key('keydown', 'Digit2'));
    expect(player.chord).toBe(1);
    expect(player.pointers.size).toBe(0); // a digit is no finger on the field
    document.dispatchEvent(key('keydown', 'KeyC'));
    expect(player.pointers.get('kKeyC')).toMatchObject({ chord: 1, tone: keyTone('KeyC', TONES, PER_OCTAVE) });
    document.dispatchEvent(key('keydown', 'Digit0'));
    expect(player.chord).toBe(1); // still the same chord, only the accompaniment stepped back
    expect(player.accompanying).toBe(false);
    unbind();
  });

  it('never chooses a chord the map does not have', () => {
    const { player, unbind } = setup();
    document.dispatchEvent(key('keydown', 'Digit9'));
    expect(player.chord).toBe(Math.min(8, player.mapSize - 1));
    expect(player.chord).toBeLessThan(player.mapSize);
    unbind();
  });

  it('ignores repeats, modifier chords, unknown keys, text inputs and whatever the caller says', () => {
    const ignore = vi.fn(() => false);
    const { player, unbind } = setup({ ignore });
    document.dispatchEvent(key('keydown', 'KeyA', { repeat: true }));
    document.dispatchEvent(key('keydown', 'KeyA', { ctrlKey: true }));
    document.dispatchEvent(key('keydown', 'KeyA', { altKey: true }));
    document.dispatchEvent(key('keydown', 'KeyA', { metaKey: true }));
    document.dispatchEvent(key('keydown', 'Space'));
    const input = document.createElement('input');
    document.body.append(input);
    input.dispatchEvent(key('keydown', 'KeyA'));
    expect(player.pointers.size).toBe(0);
    ignore.mockReturnValue(true);
    document.dispatchEvent(key('keydown', 'KeyA'));
    expect(player.pointers.size).toBe(0);
    unbind();
  });

  it('hands Escape and R to the caller', () => {
    const onEscape = vi.fn();
    const onRecord = vi.fn();
    const { player, unbind } = setup({ onEscape, onRecord });
    document.dispatchEvent(key('keydown', 'Escape'));
    document.dispatchEvent(key('keydown', 'KeyR'));
    expect(onEscape).toHaveBeenCalledTimes(1);
    expect(onRecord).toHaveBeenCalledTimes(1);
    expect(player.pointers.size).toBe(0);
    unbind();
    const bare = setup();
    document.dispatchEvent(key('keydown', 'Escape'));
    document.dispatchEvent(key('keydown', 'KeyR'));
    expect(bare.player.pointers.size).toBe(0);
    bare.unbind();
  });
});
