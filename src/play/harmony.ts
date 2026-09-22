// Auto-harmony ("think along"): the field picks the chord for the tone that is played. Rule-based, no lecturing:
// every chord of the map gets points, the highest wins. The weights hold for every style because they run over the
// degree offsets (semitones above the tonic: I 0, ii 2, iii 4, IV 5, V 7, vi 9, vii 11).
import type { Chord } from '../theory/chords';
import { chordAt, type Model } from '../theory/model';
import { pcOf, type PitchClass } from '../theory/pitch';
import type { Clock } from './clock';
import type { Pointer, PointerId } from './pointer';

// Fit of a tone to the chord (mandatory): root and fifth 1, other chord tones 0.9, seventh 0.6, otherwise 0 = not eligible
export const fitOf = (chord: Chord, pc: PitchClass): number => {
  if (chord.pcs.includes(pc)) {
    const interval = pcOf(pc - chord.root);
    return interval === 0 || interval === 7 ? 1 : 0.9;
  }
  return pc === chord.seventh ? 0.6 : 0;
};

// Grammar: transition weight "from>to" between degree offsets, everything else 0.1. IV→I weighs like IV→V: otherwise
// after IV every fifth of the key (G in C major) would land on V instead of I – "Alle meine Entchen" (A A A A G) and
// "Twinkle" (E E D) tipped over
export const PROGRESSIONS: Readonly<Record<string, number>> = {
  '0>5': 0.5,
  '0>7': 0.5,
  '0>9': 0.3,
  '5>7': 0.5,
  '5>0': 0.5,
  '7>0': 0.7,
  '7>9': 0.3,
  '9>5': 0.4,
  '9>2': 0.3,
  '2>7': 0.6,
  '4>9': 0.3,
};
export const progression = (from: PitchClass, to: PitchClass): number =>
  PROGRESSIONS[`${String(from)}>${String(to)}`] ?? 0.1;

// Preference for the primary chords, beginner-friendly: I before V before IV before vi before ii before iii
export const PREFER: Readonly<Partial<Record<PitchClass, number>>> = {
  0: 0.3,
  7: 0.25,
  5: 0.2,
  9: 0.15,
  2: 0.1,
  4: 0.05,
};
export const PHRASE_GAP = 1200; // ms of silence after which a tone starts a new phrase (no inertia, immediate decision)
export const PASSING_MS = 120; // how long a non-chord tone may lie before the field changes the chord
export const INERTIA = 0.8; // bonus of the sounding chord within a phrase

// Points of the chord `index` for the tone pc: fit · weight + preference, plus inertia (it is the sounding chord),
// grammar from the sounding chord and the cadence (from V to a chord of degree I +0.5 when the tone asks for it)
export const chordScore = (
  model: Model,
  index: number,
  pc: PitchClass,
  current: number | null,
  inertia: number,
  weight = 1,
): number => {
  const chord = chordAt(model, index);
  let score = fitOf(chord, pc) * weight + (PREFER[chord.offset] ?? 0) + (index === current ? inertia : 0);
  if (current !== null) {
    const sounding = chordAt(model, current);
    // Cadence only when the tone does not lie in the sounding chord anyway (a G over G7 does not pull to C)
    const cadence = sounding.offset === 7 && chord.offset === 0 && fitOf(sounding, pc) === 0 ? 0.5 : 0;
    score += progression(sounding.offset, chord.offset) + cadence;
  }
  return score;
};

export type Candidate = readonly [index: number, score: number];

// Best chord of [[index, points], …]: highest sum, ties go to the one nearer home; without candidates `fallback`
export const bestChord = (candidates: readonly Candidate[], fallback: number, home: number): number => {
  let best = fallback;
  let top = -Infinity;
  for (const [index, score] of candidates) {
    if (score > top + 1e-9 || (score > top - 1e-9 && Math.abs(index - home) < Math.abs(best - home))) {
      best = index;
      top = score;
    }
  }
  return best;
};

export interface HarmonyState {
  readonly current: number | null; // the chosen chord, null before the first decision
  readonly lastNoteAt: number; // ms, the last melody press
}

// Chord for the tone pc at time `now` (ms). If nothing fits (a tone outside the scale) the sounding chord stays – or
// home when none sounds yet
export const chooseChord = (model: Model, pc: PitchClass, state: HarmonyState, now: number): number => {
  const inertia = now - state.lastNoteAt > PHRASE_GAP ? 0 : INERTIA;
  const candidates = model.chords.flatMap((chord, index): Candidate[] =>
    fitOf(chord, pc) > 0 ? [[index, chordScore(model, index, pc, state.current, inertia)]] : [],
  );
  return bestChord(candidates, state.current ?? model.home, model.home);
};

export interface SongNote {
  readonly midi: number;
  readonly beats: number;
}

// Offline variant for a sheet: [{ midi, beats }] → chord index per note, greedy with inertia (no Viterbi needed). The
// same weights; the fit counts with the note length (eighth 0.63, quarter 0.75, half 1, whole 1.5), the lying chord
// may bridge a foreign tone (a passing tone – it keeps inertia and preference, only the fit is missing) and a change
// away from the bar start (running beat sum mod 4 ≠ 0) costs 0.4
export const harmonizeSong = (model: Model, notes: readonly SongNote[]): number[] => {
  let current: number | null = null;
  let beat = 0;
  return notes.map((note) => {
    const pc = pcOf(note.midi);
    const weight = Math.min(1.5, 0.5 + note.beats / 4);
    const penalty = current !== null && beat % 4 !== 0 ? 0.4 : 0;
    const candidates = model.chords.flatMap((chord, index): Candidate[] =>
      index === current || fitOf(chord, pc) > 0
        ? [[index, chordScore(model, index, pc, current, INERTIA, weight) - (index === current ? 0 : penalty)]]
        : [],
    );
    beat += note.beats;
    current = bestChord(candidates, current ?? model.home, model.home);
    return current;
  });
};

// "These would have fitted too": every chord whose triad contains the tone
export const alternativeChords = (model: Model, pc: PitchClass): number[] =>
  model.chords.flatMap((chord, index) => (chord.pcs.includes(pc) ? [index] : []));

// What the live controller needs from the playing field
export interface HarmonyField {
  model(): Model;
  pointers(): Iterable<Pointer>;
  hasPointer(id: PointerId): boolean;
  playMelody(pointer: Pointer, chord: number, at: number): void; // the voice, tuned to that chord
  holdChord(chord: number, at: number): void;
  audioNow(): number;
  changed(): void; // something to redraw
}

interface Pending {
  readonly id: PointerId;
  readonly pc: PitchClass;
}

// Live: the melody tone sounds at once, the chord is chosen by the field. If the tone fits the sounding chord, that
// chord stays and is not struck again. If it does not fit, the field waits PASSING_MS: if the finger still lies, the
// chord changes – if it is gone already, it was a passing tone. At the start of a phrase (no chord yet or more than
// PHRASE_GAP of silence) the decision is immediate. Choosing on the map always wins: then the human leads.
export class Harmony implements HarmonyState {
  current: number | null = null;
  lastNoteAt = 0;
  private pending: (Pending & { readonly cancel: () => void }) | null = null;

  constructor(
    private readonly field: HarmonyField,
    private readonly clock: Clock,
  ) {}

  get pendingId(): PointerId | null {
    return this.pending?.id ?? null;
  }

  // A melody tone was pressed (the pointer is new and not yet among the field's pointers). Returns the chord the tone
  // sounds with: the chosen one, or the current one while the decision waits
  melody(id: PointerId, pointer: Pointer, pc: PitchClass, at: number): number {
    const now = this.clock.now();
    const { chord, deferred } = this.decideOrDefer(pc, now);
    this.lastNoteAt = now;
    this.field.playMelody(pointer, chord, at);
    if (deferred) this.defer({ id, pc });
    else this.follow(chord, at);
    return chord;
  }

  // Released before the decision: a passing tone, the old chord stays
  cancel(id: PointerId): void {
    if (this.pending?.id !== id) return;
    this.pending.cancel();
    this.pending = null;
  }

  // Chosen on the map: this chord is the current one now
  lead(chord: number, at: number): void {
    this.lastNoteAt = this.clock.now();
    this.follow(chord, at);
  }

  // A chord becomes the current one – there is only ever one sounding, so nothing needs counting.
  follow(chord: number, at: number): void {
    this.current = chord;
    this.field.holdChord(chord, at);
  }

  // A new model: the thinking starts over
  reset(): void {
    this.pending?.cancel();
    this.pending = null;
    this.current = null;
  }

  // The chord a new melody tone gets: decided now, or the current one while the decision waits (deferred)
  private decideOrDefer(pc: PitchClass, now: number): { chord: number; deferred: boolean } {
    const model = this.field.model();
    if (this.current === null || now - this.lastNoteAt > PHRASE_GAP) {
      return { chord: chooseChord(model, pc, this, now), deferred: false };
    }
    return { chord: this.current, deferred: fitOf(chordAt(model, this.current), pc) === 0 };
  }

  private defer(pending: Pending): void {
    this.pending?.cancel();
    const cancel = this.clock.after(PASSING_MS, () => {
      this.decide(pending);
    });
    this.pending = { ...pending, cancel };
  }

  // Deferred decision: if the finger still lies, the field picks the chord
  private decide(pending: Pending): void {
    this.pending = null;
    if (!this.field.hasPointer(pending.id)) return;
    this.follow(chooseChord(this.field.model(), pending.pc, this, this.clock.now()), this.field.audioNow());
    this.field.changed();
  }
}
