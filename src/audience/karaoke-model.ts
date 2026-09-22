// The listener's karaoke view as a pure model: syllables in lines, the active syllable and how far it has filled, the
// ball that hops to the next syllable, plus the waiting, free play and done states. The UI only draws a frame.
//
// Synchronisation despite latency – the heart of it. Every `pos` carries the server time sᵢ of the press of note i but
// arrives after the network delay, so the listener predicts where the player is now:
//   · expected duration of the current syllable d = beatsᵢ / v with the tempo estimate v (tempo-tracker.ts);
//     fill = (now − sᵢ) / d, capped at 1
//   · target = i + fill, at most i + 1: once the fill reaches 1 the ball hops to the next syllable and waits there for
//     the next `pos` – it never runs more than one syllable ahead
//   · a `pos` for i + 1 does not jump: the difference between the last shown value and the new target is kept as a
//     correction that decays over 250 ms (shown = target + correction · (1 − ease)³); only a gap of more than one
//     syllable (skipped notes, restart) jumps directly
import { KEYS, keyBySignature } from '../theory/keys';
import { pcOf } from '../theory/pitch';
import type { IncomingMessage, PositionMessage, SongMessage, ToneMessage } from './messages';
import { TempoTracker } from './tempo-tracker';

export type KaraokeMode = 'waiting' | 'song' | 'free' | 'done';

export interface KaraokeNote {
  readonly midi: number;
  readonly beats: number;
  readonly text: string | null;
}
export interface KaraokeSong {
  readonly title: string;
  readonly bpm: number;
  readonly notes: readonly KaraokeNote[];
  readonly syllables: readonly string[]; // the lyrics, or note names for songs without
  readonly lines: readonly (readonly number[])[]; // syllable indices per line
}
export interface Ball {
  readonly at: number; // syllable the ball sits on or hops to
  readonly from: number | null; // syllable it hops from while `progress` < 1
  readonly progress: number; // 0…1 along the arc
  readonly bob: number; // 0…1 gentle bobbing while waiting
}
export interface ToneDisplay {
  readonly name: string;
  readonly chord: string;
  readonly at: number; // server time of the press, for a short flash
}
export interface KaraokeFrame {
  readonly mode: KaraokeMode;
  readonly hue: number | null;
  readonly line: number; // line of the active syllable
  readonly active: number; // syllable being sung, −1 outside a song
  readonly fill: number; // 0…1 of the active syllable
  readonly shown: number; // the displayed position, active + fill after the correction
  readonly current: number; // note of the last `pos`
  readonly tempo: number; // beats per second
  readonly ball: Ball | null;
  readonly tone: ToneDisplay | null;
}

export const CORRECTION_MS = 250;
export const ARC_MS = 220;
export const DONE_MS = 4000;
export const BOB_PERIOD_MS = 300;
const EPSILON = 1e-6;
const DEFAULT_BPM = 100;

// Lines of about 6–9 syllables, preferably after punctuation (from 6), never inside a word, at the latest after 12
export const MIN_LINE = 6;
export const FULL_LINE = 9;
export const MAX_LINE = 12;
const SENTENCE_END = /[,.;:!?]['’"”)]?$/;
const MELISMA = '_';

// Does a word end with syllable i? Not with a trailing hyphen, and not when a melisma `_` follows (it belongs to the
// word before it)
export const isWordEnd = (syllables: readonly string[], i: number): boolean => {
  let j = i;
  while (j > 0 && syllables[j] === MELISMA) j--;
  return !(syllables[j] ?? '').endsWith('-') && syllables[i + 1] !== MELISMA;
};

export const breakLines = (syllables: readonly string[]): number[][] => {
  const lines: number[][] = [];
  let line: number[] = [];
  syllables.forEach((syllable, i) => {
    line.push(i);
    if (i === syllables.length - 1) return;
    const sentence = SENTENCE_END.test(syllable);
    const wordEnd = isWordEnd(syllables, i);
    if ((wordEnd && ((line.length >= MIN_LINE && sentence) || line.length >= FULL_LINE)) || line.length >= MAX_LINE) {
      lines.push(line);
      line = [];
    }
  });
  lines.push(line);
  return lines;
};

// The syllable as shown: the hyphen that marks a continued word is dropped
export const syllableText = (syllable: string): string => syllable.replace(/-$/, '');

// Messages come from the network: every field is checked before use
const numberOr = <T>(value: unknown, fallback: T): number | T =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;
const field = (value: unknown, name: string): unknown =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>)[name] : undefined;
const toNote = (note: unknown): KaraokeNote => {
  const beats = numberOr(field(note, 'beats'), 0);
  const text = field(note, 'text');
  return {
    midi: Math.trunc(numberOr(field(note, 'midi'), 0)),
    beats: beats > 0 ? beats : 1,
    text: typeof text === 'string' ? text : null,
  };
};

// A `lied` message → song, or null when it carries no notes; songs without lyrics show the note names of their key
export const songFromMessage = (message: SongMessage): KaraokeSong | null => {
  const rawNotes: unknown = message.notes;
  if (!Array.isArray(rawNotes) || rawNotes.length === 0) return null;
  const notes = (rawNotes as readonly unknown[]).map(toNote);
  const key = KEYS.find((k) => k.signature === Math.trunc(numberOr(message.k, 0))) ?? keyBySignature(0);
  const syllables = notes.map((note) => note.text ?? key.names[pcOf(note.midi)]);
  const bpm = numberOr(message.bpm, 0);
  const title: unknown = message.title;
  return {
    title: typeof title === 'string' ? title : '',
    bpm: bpm > 0 ? bpm : DEFAULT_BPM,
    notes,
    syllables,
    lines: breakLines(syllables),
  };
};

interface Arc {
  readonly from: number;
  readonly startedAt: number;
}

export class KaraokeModel {
  private mode: KaraokeMode = 'waiting';
  private song: KaraokeSong | null = null;
  private lineOf: number[] = [];
  private hue: number | null = null;
  private tone: ToneDisplay | null = null;
  private doneAt = 0;
  private tempo = new TempoTracker(DEFAULT_BPM);
  // Sync state: note of the last `pos` and its server time, the displayed position, the running correction, the ball
  private current = -1;
  private currentAt = 0;
  private shown = 0;
  private correction = 0;
  private correctionAt = 0;
  private line = -1;
  private ballAt = 0;
  private arc: Arc | null = null;

  // `now` is the server clock (relay-client.ts serverNow), used for the prediction and the animations alike
  constructor(private readonly now: () => number) {}

  get currentSong(): KaraokeSong | null {
    return this.song;
  }

  receive(message: IncomingMessage): void {
    switch (message.t) {
      case 'song':
        this.startSong(message);
        break;
      case 'pos':
        this.position(message);
        break;
      case 'end':
        if (this.mode === 'song') this.end();
        break;
      case 'free':
        this.freePlay(message.hue);
        break;
      case 'tone':
        this.showTone(message);
        break;
      default:
        break;
    }
  }

  // New song: syllables, lines, tempo from bpm, the view at the start; the first syllable waits for the first note
  startSong(message: SongMessage): void {
    const song = songFromMessage(message);
    if (song === null) return;
    this.song = song;
    this.hue = numberOr(message.hue, this.hue);
    this.lineOf = [];
    song.lines.forEach((line, index) => {
      for (const syllable of line) this.lineOf[syllable] = index;
    });
    this.tempo = new TempoTracker(song.bpm);
    this.current = -1;
    this.currentAt = 0;
    this.shown = 0;
    this.correction = 0;
    this.correctionAt = 0;
    this.line = 0;
    this.ballAt = 0;
    this.arc = null;
    this.mode = 'song';
  }

  // `pos`: update the tempo estimate, set the new target, keep the difference to the display as a soft correction
  position(message: PositionMessage): void {
    const song = this.song;
    if (this.mode !== 'song' || song === null) return;
    const index = Math.max(0, Math.min(song.notes.length - 1, Math.trunc(numberOr(message.i, 0))));
    const serverTime = numberOr(message.s, this.now());
    this.tempo.onset(index, serverTime, (k) => song.notes[k]?.beats ?? 1);
    const before = this.current < 0 ? index : this.shown;
    this.current = index;
    this.currentAt = serverTime;
    this.correction = before - this.target(this.now());
    this.correctionAt = this.now();
    if (Math.abs(this.correction) > 1) this.correction = 0;
  }

  // Song over: "done" for four seconds, then back to waiting
  end(): void {
    this.mode = 'done';
    this.doneAt = this.now();
  }

  freePlay(hue: number): void {
    this.hue = numberOr(hue, this.hue);
    this.mode = 'free';
  }

  showTone(message: ToneMessage): void {
    this.mode = 'free';
    const name: unknown = message.name;
    const chord: unknown = message.chord;
    this.tone = {
      name: typeof name === 'string' && name !== '' ? name : '♪',
      chord: typeof chord === 'string' ? chord : '',
      at: this.now(),
    };
  }

  // Target position: note i plus the predicted fill, at most i + 1
  private target(now: number): number {
    const beats = this.song?.notes[this.current]?.beats ?? 1;
    const duration = (1000 * beats) / this.tempo.tempo;
    return Math.min(this.current + 1, this.current + (now - this.currentAt) / duration);
  }

  // Per frame: displayed position, active syllable and fill, line, ball
  frame(): KaraokeFrame {
    const now = this.now();
    if (this.mode === 'done' && now - this.doneAt >= DONE_MS) {
      this.mode = 'waiting';
      this.song = null;
    }
    const song = this.song;
    const idle = {
      mode: this.mode,
      hue: this.hue,
      line: this.line,
      active: -1,
      fill: 0,
      shown: this.shown,
      current: this.current,
      tempo: this.tempo.tempo,
      ball: null,
      tone: this.tone,
    };
    if (this.mode !== 'song' || song === null) return idle;
    if (this.current < 0) return { ...idle, active: 0 }; // the first syllable waits for the first note
    const ease = Math.min(1, (now - this.correctionAt) / CORRECTION_MS);
    this.shown = this.target(now) + this.correction * (1 - ease) ** 3;
    const active = Math.max(0, Math.min(this.current, Math.floor(this.shown + EPSILON)));
    const fill = Math.min(1, Math.max(0, this.shown - active));
    const line = this.lineOf[active] ?? 0;
    if (line !== this.line) {
      this.line = line;
      this.arc = null;
    }
    return { ...idle, line, active, fill, shown: this.shown, ball: this.ball(song, now) };
  }

  // The ball sits above the syllable, hops in an arc (220 ms) to the next one as soon as the fill reaches 1, waits there
  private ball(song: KaraokeSong, now: number): Ball {
    const want = Math.min(song.notes.length - 1, this.current + 1, Math.floor(this.shown + EPSILON));
    if (want !== this.ballAt) {
      this.arc = want === this.ballAt + 1 ? { from: this.ballAt, startedAt: now } : null; // only a hop to the next one is animated
      this.ballAt = want;
    }
    if (this.arc !== null) {
      const progress = (now - this.arc.startedAt) / ARC_MS;
      if (progress < 1) return { at: this.ballAt, from: this.arc.from, progress, bob: 0 };
      this.arc = null;
    }
    return { at: this.ballAt, from: null, progress: 1, bob: Math.abs(Math.sin(now / BOB_PERIOD_MS)) };
  }
}
