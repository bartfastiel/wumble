// Radio: while the band plays, the generator keeps producing phrases of two bars with half a
// bar of rest in between and plays them as melody with ghost glow – each continues from the last tone of the previous
// one. When the human plays (any melody press), the running phrase breaks off and the next comes after two bars of
// rest at the earliest ("joining in"). Silent while the echo runs.
import type { Model } from '../theory/model';
import type { Band } from './band';
import { BEATS_PER_BAR } from './patterns';
import { composePhrase, type Rng } from './phrases';
import type { Player, Sequence } from './player';

const PHRASE_BARS = 2;
const PHRASE_SPACING = 10; // beats from one phrase start to the next: two bars plus half a bar of rest
const HUMAN_REST = 8; // beats of rest after the human played

export interface RadioOptions {
  readonly band: Band;
  readonly player: Player;
  readonly model: () => Model;
  readonly rng: Rng;
  readonly muted: () => boolean; // the echo runs
}

export interface RadioStatus {
  readonly next: number; // position of the next phrase in beats
  readonly playing: boolean;
}

export interface Radio {
  on(): boolean;
  setOn(on: boolean): void; // on: the first phrase from the next bar start; off: the running one breaks off
  pause(): void; // the human plays: hush, next phrase two bars later at the earliest
  hush(): void;
  status(): RadioStatus;
}

const nextBar = (position: number): number => Math.ceil(position / BEATS_PER_BAR) * BEATS_PER_BAR;

export const createRadio = (options: RadioOptions): Radio => {
  const { band, player, model, rng, muted } = options;
  const { scheduler } = band;
  let on = false;
  let next = 0;
  let sequence: Sequence | null = null;
  let lastCol: number | null = null;

  const hush = (): void => {
    if (sequence === null) return;
    player.remove(sequence);
    sequence = null;
  };
  const begin = (position: number): void => {
    next = nextBar(position);
    sequence = null;
    lastCol = null;
  };
  // With the planning window [from, to) in beats: the next phrase is due as soon as the window reaches it
  const tick = (from: number, to: number): void => {
    if (!on || muted() || (!band.running() && !scheduler.rendering())) {
      hush();
      return;
    }
    if (next < from) next = nextBar(from); // continuing after a pause (echo): at the next bar start
    if (to < next) return;
    const bar = next / BEATS_PER_BAR;
    const notes = composePhrase(model(), PHRASE_BARS, [band.chordForBar(bar), band.chordForBar(bar + 1)], rng, lastCol);
    const events = notes.map((note) => ({
      ...note,
      chord: band.chordForBar(bar + Math.floor(note.t / BEATS_PER_BAR)),
    }));
    sequence = player.add(events, next);
    for (const note of notes) lastCol = note.tone; // the next phrase continues from the last tone
    next += PHRASE_SPACING;
  };
  player.listen({ reset: begin, window: tick });

  return {
    on: () => on,
    setOn(value) {
      on = value;
      if (on) begin(band.running() ? scheduler.beatAt(scheduler.now()) + 0.5 : 0);
      else hush();
    },
    pause() {
      if (!on || !band.running()) return;
      hush();
      next = Math.max(next, nextBar(scheduler.beatAt(scheduler.now()) + HUMAN_REST));
    },
    hush,
    status: () => ({ next, playing: sequence !== null }),
  };
};
