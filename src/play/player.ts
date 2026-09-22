// Playing the field: a pointer is a finger or a key on one stripe, and it sounds that tone and nothing else.
// The chord comes from the map and keeps sounding on its own. Play modes: full, single tones, auto-harmony.
import type { AudioEngine } from '../audio/engine';
import { chordAt, type Model, toneOf } from '../theory/model';
import { pcOf, type PitchClass } from '../theory/pitch';
import { chordFrequencies, melodyFrequency } from '../theory/tuning';
import { ChordVoice, SILENT } from './chord-voice';
import { type Clock, systemClock } from './clock';
import { Harmony } from './harmony';
import type { Pointer, PointerId } from './pointer';
import type { Store } from './store';

export const LIT_MS = 260; // how long a played tone keeps glowing – a short trail behind the finger

export interface PressEvent {
  readonly id: PointerId;
  readonly tone: number; // index into the tones of the model
  readonly pointer: Pointer;
  readonly chord: number; // index of the chord that sounds with it
  readonly at: number;
}
export interface ReleaseEvent {
  readonly id: PointerId;
  readonly pointer: Pointer;
  readonly at: number;
}
// For the learn mode, the loop and the audience; `change` asks for a redraw
export interface PlayerListener {
  press?(event: PressEvent): void;
  release?(event: ReleaseEvent): void;
  change?(): void;
}

export interface PlayerDependencies {
  readonly engine: AudioEngine;
  readonly store: Store;
  readonly clock?: Clock;
}

export class Player {
  readonly pointers = new Map<PointerId, Pointer>();
  readonly chordVoice: ChordVoice;
  readonly harmony: Harmony;
  readonly lit = new Map<number, number>(); // midi → time until which it glows
  bandRunning = false;
  private readonly engine: AudioEngine;
  private readonly store: Store;
  private readonly clock: Clock;
  private readonly listeners = new Set<PlayerListener>();

  constructor({ engine, store, clock = systemClock }: PlayerDependencies) {
    this.engine = engine;
    this.store = store;
    this.clock = clock;
    this.chordVoice = new ChordVoice(engine, {
      chord: (index) => chordAt(store.model(), index),
      frequencies: (index) => chordFrequencies(store.model(), store.get().tuning, index),
      bandRunning: () => this.bandRunning,
      light: (midi) => {
        this.light(midi);
      },
    });
    this.harmony = new Harmony(
      {
        model: () => store.model(),
        pointers: () => this.pointers.values(),
        hasPointer: (id) => this.pointers.has(id),
        playMelody: (pointer, chord, at) => {
          pointer.chord = chord;
          this.startMelody(pointer, at);
        },
        holdChord: (chord, at) => {
          this.chordVoice.choose(chord, at);
        },
        audioNow: () => engine.now(),
        changed: () => {
          this.changed();
        },
      },
      clock,
    );
    store.subscribe((settings, previous) => {
      if (settings.signature === previous.signature && settings.style === previous.style) return;
      this.harmony.reset();
      this.chordVoice.choose(SILENT, engine.now());
    });
  }

  get chord(): number {
    return this.chordVoice.current;
  }

  get model(): Model {
    return this.store.model();
  }

  get mapSize(): number {
    return this.store.model().map.length;
  }

  // A chord from the map, or SILENT for melody without accompaniment
  chooseChord(index: number): void {
    const at = this.engine.ensure();
    this.chordVoice.choose(index, at);
    if (index !== SILENT) this.harmony.lead(index, at);
    this.changed();
  }

  press(id: PointerId, tone: number): void {
    if (this.pointers.has(id)) this.release(id);
    const at = this.engine.ensure();
    const pointer: Pointer = { chord: this.chordVoice.current, tone, voices: [] };
    if (this.store.get().mode === 'autoHarmony') this.harmony.melody(id, pointer, this.pitchClassOf(tone), at);
    else this.startMelody(pointer, at);
    this.pointers.set(id, pointer);
    for (const listener of this.listeners) listener.press?.({ id, tone, pointer, chord: pointer.chord, at });
    this.changed();
  }

  // The pointer moved onto another stripe: a glissando. The same tone again needs a new press.
  slide(id: PointerId, tone: number): void {
    const pointer = this.pointers.get(id);
    if (pointer === undefined || pointer.tone === tone) return;
    if (toneOf(this.store.model(), pointer.tone) === toneOf(this.store.model(), tone)) return;
    this.release(id);
    this.press(id, tone);
  }

  release(id: PointerId): void {
    const pointer = this.pointers.get(id);
    if (pointer === undefined) return;
    const at = this.engine.now();
    for (const voice of pointer.voices) voice.release(at);
    this.pointers.delete(id);
    this.harmony.cancel(id);
    for (const listener of this.listeners) listener.release?.({ id, pointer, at });
    this.changed();
  }

  releaseAll(): void {
    for (const id of this.pointers.keys()) this.release(id);
  }

  subscribe(listener: PlayerListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  isLit(midi: number, now = this.clock.now()): boolean {
    const until = this.lit.get(midi);
    if (until === undefined) return false;
    if (until > now) return true;
    this.lit.delete(midi);
    return false;
  }

  private light(midi: number): void {
    this.lit.set(midi, this.clock.now() + LIT_MS);
  }

  private pitchClassOf(tone: number): PitchClass {
    return pcOf(toneOf(this.store.model(), tone));
  }

  private startMelody(pointer: Pointer, at: number): void {
    const model = this.store.model();
    const frequency = melodyFrequency(model, this.store.get().tuning, pointer.chord, pointer.tone);
    pointer.voices.push(this.engine.melody(frequency, at));
    this.light(toneOf(model, pointer.tone));
  }

  private changed(): void {
    for (const listener of this.listeners) listener.change?.();
  }
}
