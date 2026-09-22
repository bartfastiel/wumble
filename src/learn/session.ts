// The learn mode as a state machine without DOM or clock: the UI feeds presses, releases and
// ticks with its own `now` and draws from the state. A tone counts as played once the right spot was pressed and
// released again – or once the dot has run down over the note's duration (beats · 60 / bpm), even while the finger
// still rests. A resting finger does not trigger the next tone; that needs a new press or a slide into the next spot.
import { keyBySignature } from '../theory/keys';
import { buildModel, type Model } from '../theory/model';
import { DOT_MOVE_MS, FLOATER_MS, type RingGroup, visibleGroups } from './geometry';
import { type FieldSpot, type PlacedNote, placeNotes, sameSpot } from './learn-spot';
import {
  awardPoints,
  learnVisibility,
  type Level,
  type LevelId,
  LEVELS,
  WRONG_PENALTY,
  WRONG_THROTTLE_MS,
} from './levels';
import { Records } from './records';
import type { Song } from './song-notation';

export type PointerId = number | string;

// The right spot is pressed: the dot runs down over `dur` ms
export interface Hold {
  readonly id: PointerId;
  readonly spot: FieldSpot;
  readonly t0: number;
  readonly dur: number;
}
// The dot flies from the previous spot to the current one within DOT_MOVE_MS
export interface DotMove {
  readonly from: FieldSpot;
  readonly t0: number;
}
// The rings of the run that began at `fromPos` move inwards, the innermost becomes the circle
export interface RingMove {
  readonly fromPos: number;
  readonly t0: number;
}
// "+87" rises from the spot and fades, "−100" sinks
export interface Floater {
  readonly spot: FieldSpot;
  readonly text: string;
  readonly t0: number;
  readonly up: boolean;
}
export interface Award {
  readonly delta: number;
  readonly spot: FieldSpot;
}
export interface Finish {
  readonly song: Song;
  readonly scored: boolean; // false in easy: no points, no record
  readonly score: number;
  readonly best: number | null; // the record before this run
  readonly newRecord: boolean;
}
export interface LearnListener {
  readonly onHit?: (pos: number) => void; // the right spot was pressed – the moment a syllable starts
  readonly onAdvance?: (pos: number) => void;
  readonly onFinish?: (result: Finish) => void;
}

interface Run {
  readonly song: Song;
  readonly levelId: LevelId;
  readonly level: Level;
  readonly model: Model;
  readonly placed: readonly PlacedNote[];
  pos: number;
  score: number;
  hold: Hold | null;
  anim: DotMove | null;
  ringAnim: RingMove | null;
  toneStartedAt: number;
  floaters: Floater[];
}

export class LearnSession {
  private run: Run | null = null;
  private wrongAt = Number.NEGATIVE_INFINITY;
  private readonly records: Records;
  private readonly listener: LearnListener;

  constructor(records = new Records(), listener: LearnListener = {}) {
    this.records = records;
    this.listener = listener;
  }

  start(song: Song, levelId: LevelId, now: number): void {
    const model = buildModel(keyBySignature(song.k), song.style);
    this.run = {
      song,
      levelId,
      level: LEVELS[levelId],
      model,
      placed: placeNotes(model, song.notes),
      pos: 0,
      score: 0,
      hold: null,
      anim: null,
      ringAnim: null,
      toneStartedAt: now,
      floaters: [],
    };
  }

  stop(): void {
    this.run = null;
  }

  get song(): Song | null {
    return this.run?.song ?? null;
  }
  get levelId(): LevelId | null {
    return this.run?.levelId ?? null;
  }
  get model(): Model | null {
    return this.run?.model ?? null;
  }
  get placed(): readonly PlacedNote[] {
    return this.run?.placed ?? [];
  }
  get pos(): number {
    return this.run?.pos ?? 0;
  }
  get score(): number {
    return this.run?.score ?? 0;
  }
  get hold(): Hold | null {
    return this.run?.hold ?? null;
  }
  get anim(): DotMove | null {
    return this.run?.anim ?? null;
  }
  get ringAnim(): RingMove | null {
    return this.run?.ringAnim ?? null;
  }
  get toneStartedAt(): number {
    return this.run?.toneStartedAt ?? 0;
  }
  get floaters(): readonly Floater[] {
    return this.run?.floaters ?? [];
  }
  get done(): boolean {
    return this.run !== null && this.run.pos >= this.run.placed.length;
  }

  visibility(now: number): number {
    return this.run === null ? 1 : learnVisibility(this.run.level, this.run.toneStartedAt, now);
  }

  // The dot groups to draw for the current position
  groups(unit: number): RingGroup[] {
    return this.run === null ? [] : visibleGroups(this.run.placed, this.run.pos, this.run.level, unit);
  }

  // Something moves: the UI keeps drawing frames
  animating(now: number): boolean {
    const run = this.run;
    if (run === null) return false;
    return (
      run.hold !== null ||
      run.anim !== null ||
      run.ringAnim !== null ||
      run.floaters.length > 0 ||
      this.visibility(now) < 1
    );
  }

  // Right spot pressed: the dot begins to run down. The first finger counts, further ones do not interfere; another
  // spot only sounds – from medium on, a wrong melody spot costs 100 points (the chord stripe stays free), when
  // sliding across several spots at most once per WRONG_THROTTLE_MS. With `toneOnly` (auto harmony) only the stripe
  // counts – the other hand picks the chord
  press(id: PointerId, spot: FieldSpot, now: number, toneOnly = false): Award | null {
    const run = this.run;
    if (run === null) return null;
    const current = run.placed[run.pos];
    if (current === undefined) return null;
    const target = current.spot;
    if (target === null) return null;
    if (target.tone !== spot.tone || (target.chord !== spot.chord && !toneOnly)) {
      if (run.level.factor === 0 || spot.tone < 0 || now - this.wrongAt <= WRONG_THROTTLE_MS) return null;
      this.wrongAt = now;
      return this.award(run, WRONG_PENALTY, spot, now);
    }
    if (run.hold !== null) return null;
    run.hold = { id, spot: target, t0: now, dur: (current.note.beats * 60000) / run.song.bpm };
    this.listener.onHit?.(run.pos);
    return run.level.factor === 0 ? null : this.award(run, awardPoints(run.level, this.visibility(now)), spot, now);
  }

  // Released before the dot ran down: the tone still counts, it goes on immediately
  release(id: PointerId, now: number): void {
    const run = this.run;
    if (run?.hold?.id === id) this.advance(run, run.hold, now);
  }

  // Once per frame: a dot that ran down advances, finished animations and faded floaters go
  tick(now: number): void {
    const run = this.run;
    if (run === null) return;
    if (run.hold !== null && now - run.hold.t0 >= run.hold.dur) this.advance(run, run.hold, now);
    if (run.anim !== null && now - run.anim.t0 >= DOT_MOVE_MS) run.anim = null;
    if (run.ringAnim !== null && now - run.ringAnim.t0 >= DOT_MOVE_MS) run.ringAnim = null;
    run.floaters = run.floaters.filter((floater) => now - floater.t0 < FLOATER_MS);
  }

  // Tone done: move on, the dot flies to the next spot; if the same tone follows, the rings move inwards instead.
  // After the last tone the run is finished, from medium on with points and record
  private advance(run: Run, hold: Hold, now: number): void {
    const next = run.placed[run.pos + 1];
    run.anim = { from: hold.spot, t0: now };
    run.ringAnim = next !== undefined && sameSpot(hold.spot, next.spot) ? { fromPos: run.pos, t0: now } : null;
    run.hold = null;
    run.toneStartedAt = now;
    run.pos++;
    if (run.pos < run.placed.length) {
      this.listener.onAdvance?.(run.pos);
      return;
    }
    const scored = run.level.factor > 0;
    const best = scored ? this.records.get(run.song, run.levelId) : null;
    const newRecord = scored && this.records.submit(run.song, run.levelId, run.score);
    this.listener.onFinish?.({ song: run.song, scored, score: run.score, best, newRecord });
  }

  // Credit or deduct points, with a floating number from the spot
  private award(run: Run, delta: number, spot: FieldSpot, now: number): Award {
    run.score += delta;
    run.floaters.push({ spot, text: `${delta < 0 ? '−' : '+'}${String(Math.abs(delta))}`, t0: now, up: delta > 0 });
    return { delta, spot };
  }
}
