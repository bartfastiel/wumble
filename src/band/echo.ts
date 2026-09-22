// Echo game: the band plays a phrase, you play it back. It runs on the band's clock – the
// first time a bar of count-in ("listen"), then the phrase (stripes glow by level: easy all, medium the first only,
// hard none), then "your turn": only the tones count, in order; rhythm and chord do not matter, wrong tones in between
// are skipped – after three wrong ones the phrase simply comes again. Once all tones are hit the phrase grows
// by one tone (the old part stays – a memory game) and is played again; the title shows "Echo · 5 tones" until it
// starts. No points, no error sound. If the echo started the band, it also stops it.
import { t } from '../i18n';
import type { Model } from '../theory/model';
import type { Band } from './band';
import { BEATS_PER_BAR } from './patterns';
import { composePhrase, type PhraseNote, type Rng } from './phrases';
import type { NoteEvent, Player, Sequence } from './player';

export type Difficulty = 'easy' | 'medium' | 'hard';
export type EchoPhase = 'listen' | 'wait' | 'play';
export interface EchoStatus {
  readonly phase: EchoPhase;
  readonly n: number; // tones of the phrase
  readonly progress: number; // tones hit in this round
  readonly wrong: number; // wrong tones in succession
  readonly tones: readonly number[]; // the phrase shown
}

interface EchoState {
  phase: EchoPhase;
  n: number;
  progress: number;
  wrong: number;
}

const FIRST_TONES = 3;
const WRONG_TO_REPEAT = 3;
const GROW_BARS = 2;
const MIN_LEAD = 2; // beats between now and a repeat

export interface EchoOptions {
  readonly band: Band;
  readonly player: Player;
  readonly model: () => Model;
  readonly rng: Rng;
  readonly difficulty: () => Difficulty;
  readonly onChange?: () => void; // phase or count changed – the title shows it
}

export interface Echo {
  start(): void;
  stop(): void;
  press(tone: number): void; // melody key pressed
  active(): boolean;
  status(): EchoStatus | null;
  title(): string;
}

export const createEcho = (options: EchoOptions): Echo => {
  const { band, player, model, rng, difficulty, onChange } = options;
  const { scheduler } = band;
  let state: EchoState | null = null;
  let phrase: PhraseNote[] = []; // the whole phrase, grows by two bars when needed
  let bars = 0;
  let sequence: Sequence | null = null;
  let startedBand = false;

  const changed = (): void => onChange?.();
  const hush = (): void => {
    if (sequence === null) return;
    player.remove(sequence);
    sequence = null;
  };

  // Extend the phrase by two bars that continue from its last tone, until it has `n` tones
  const grow = (n: number, firstBar: number): void => {
    while (phrase.length < n) {
      const chords = [band.chordForBar(firstBar + bars), band.chordForBar(firstBar + bars + 1)];
      const from = phrase.at(-1)?.tone ?? null;
      const offset = bars * BEATS_PER_BAR;
      phrase.push(
        ...composePhrase(model(), GROW_BARS, chords, rng, from).map((note) => ({ ...note, t: note.t + offset })),
      );
      bars += GROW_BARS;
    }
  };

  // Play the first n tones: the first time after a whole bar of count-in, otherwise at the next bar start at least
  // two beats away. Chords per bar from the band (schema or current chord), ghosts by level
  const play = (current: EchoState, first: boolean): void => {
    const position = scheduler.beatAt(scheduler.now());
    const bar = first ? Math.floor(position / BEATS_PER_BAR) + 2 : Math.ceil((position + MIN_LEAD) / BEATS_PER_BAR);
    const at = bar * BEATS_PER_BAR;
    grow(current.n, bar);
    const shown: NoteEvent[] = phrase
      .slice(0, current.n)
      .map((note) => ({ ...note, chord: band.chordForBar(bar + Math.floor(note.t / BEATS_PER_BAR)) }));
    const end = Math.max(...shown.map((note) => note.t + note.dur));
    const level = difficulty();
    hush();
    sequence = player.add(shown, at, (index) => level === 'easy' || (level === 'medium' && index === 0));
    current.phase = first ? 'listen' : 'wait';
    changed();
    scheduler.at(scheduler.timeAt(at), () => {
      current.phase = 'listen';
      changed();
    });
    scheduler.at(scheduler.timeAt(at + end), () => {
      current.phase = 'play';
      current.progress = 0;
      current.wrong = 0;
      changed();
    });
  };

  const stop = (): void => {
    if (state === null) return;
    state = null;
    hush();
    changed();
    if (startedBand) band.stop();
  };
  band.onStop(stop);

  return {
    start() {
      if (state !== null) return;
      startedBand = !band.running();
      state = { phase: 'listen', n: FIRST_TONES, progress: 0, wrong: 0 };
      phrase = [];
      bars = 0;
      band.start();
      play(state, true);
    },
    stop,
    // Only the tones in order: right → on, all → one tone more; three wrong → once more
    press(tone) {
      if (state?.phase !== 'play') return;
      if (phrase[state.progress]?.tone === tone) {
        state.wrong = 0;
        if (++state.progress < state.n) return;
        state.n++;
        play(state, false);
      } else if (++state.wrong >= WRONG_TO_REPEAT) play(state, false);
    },
    active: () => state !== null,
    status: () => (state === null ? null : { ...state, tones: phrase.slice(0, state.n).map((note) => note.tone) }),
    title() {
      if (state === null) return '';
      if (state.phase === 'listen') return t('band.echo.listen');
      if (state.phase === 'play') return t('band.echo.yourTurn');
      return t('band.echo.tones', { n: state.n });
    },
  };
};
