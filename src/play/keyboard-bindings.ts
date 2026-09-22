// The laptop keyboard as an instrument: physical keys via event.code, layout independent.
// Bottom letter row Z X C V B N M and home row A S D F G H J K play fifteen tones around the middle of the field;
// the digits 1–9 choose from the chord map, 0 is silence. Every key is its own pointer 'k' + code.
import { SILENT } from './chord-voice';
import type { Player } from './player';

export const KEY_STEPS: Readonly<Record<string, number>> = {
  KeyZ: 0,
  KeyX: 1,
  KeyC: 2,
  KeyV: 3,
  KeyB: 4,
  KeyN: 5,
  KeyM: 6,
  KeyA: 7,
  KeyS: 8,
  KeyD: 9,
  KeyF: 10,
  KeyG: 11,
  KeyH: 12,
  KeyJ: 13,
  KeyK: 14,
};

// Where the keyboard sits in a field that is eight octaves wide: around the middle
export const keyTone = (code: string, tones: number, perOctave: number): number | null => {
  const step = KEY_STEPS[code];
  if (step === undefined) return null;
  const middle = Math.floor(tones / 2 / perOctave) * perOctave;
  return Math.max(0, Math.min(tones - 1, middle - perOctave + step));
};

export const keyChord = (code: string): number | null => {
  const digit = /^Digit(\d)$/.exec(code);
  if (digit === null) return null;
  const value = Number(digit[1]);
  return value === 0 ? SILENT : value - 1;
};

export const pointerIdOf = (code: string): string => `k${code}`;

export interface KeyboardOptions {
  readonly ignore?: () => boolean; // a panel is open, a dialog shows, the page is a listener
  readonly onEscape?: () => void;
  readonly onRecord?: () => void; // R: record a loop layer
}

const isTextInput = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName);

export const bindKeyboard = (target: Document, player: Player, options: KeyboardOptions = {}): (() => void) => {
  const down = (event: KeyboardEvent): void => {
    if (event.repeat || event.ctrlKey || event.altKey || event.metaKey) return;
    if (event.code === 'Escape') {
      options.onEscape?.();
      return;
    }
    if (options.ignore?.() === true || isTextInput(event.target)) return;
    if (event.code === 'KeyR') {
      options.onRecord?.();
      return;
    }
    const chord = keyChord(event.code);
    if (chord !== null) {
      event.preventDefault();
      player.chooseChord(chord === SILENT ? SILENT : Math.min(chord, player.mapSize - 1));
      return;
    }
    const model = player.model;
    const tone = keyTone(event.code, model.tones.length, model.style.scale.length);
    const id = pointerIdOf(event.code);
    if (tone === null || player.pointers.has(id)) return;
    event.preventDefault();
    player.press(id, tone);
  };
  const up = (event: KeyboardEvent): void => {
    player.release(pointerIdOf(event.code));
  };
  target.addEventListener('keydown', down);
  target.addEventListener('keyup', up);
  return () => {
    target.removeEventListener('keydown', down);
    target.removeEventListener('keyup', up);
  };
};
