// Player: plays the loop layers (endlessly) and one-off sequences (echo, radio) in the same
// lookahead as the band. The frequency is looked up only then (tuning and sound apply immediately), the tone ends after
// `dur` beats, and for that long the stripe glows as a ghost.
import type { AudioEngine } from '../audio/engine';
import { BEATS_PER_BAR } from './patterns';
import type { Scheduler } from './scheduler';

export const PHRASE_LEVEL = 0.8; // level of generated phrases (echo, radio) relative to the melody layer; layers play at 1

export interface NoteEvent {
  readonly t: number; // beats
  dur: number; // beats – a recording knows it only on release
  readonly chord: number;
  readonly tone: number;
}
export interface Layer {
  readonly bars: number;
  readonly events: NoteEvent[];
}
export interface Sequence {
  readonly events: readonly NoteEvent[];
  readonly at: number; // position of t = 0 in beats
  readonly ghost: (index: number) => boolean; // whether the cell of a note glows
  next: number; // index of the next note to play
}
export interface Ghost {
  readonly chord: number;
  readonly tone: number; // index into the tones of the model
  readonly until: number; // audio time
}
export interface PlayerListener {
  reset?(position: number): void; // the timeline restarted at this position
  window?(from: number, to: number): void; // a planning window in beats, before its notes are placed
}

export interface PlayerOptions {
  readonly engine: () => AudioEngine;
  readonly scheduler: Scheduler;
  readonly melodyFrequency: (chord: number, tone: number) => number;
}

export interface Player {
  layers(): readonly Layer[];
  addLayer(layer: Layer): void;
  removeLayer(index: number): void;
  clearLayers(): void;
  add(events: readonly NoteEvent[], at: number, ghost?: (index: number) => boolean): Sequence;
  remove(sequence: Sequence): void;
  ghosts(): readonly Ghost[]; // stripes a playback sounds right now
  listen(listener: PlayerListener): void;
}

export const createPlayer = (options: PlayerOptions): Player => {
  const { engine, scheduler, melodyFrequency } = options;
  const layers: Layer[] = [];
  let sequences: Sequence[] = [];
  let ghosts: Ghost[] = [];
  let until = 0; // audio time up to which notes are placed
  const listeners: PlayerListener[] = [];

  const note = (event: NoteEvent, time: number, level: number, ghost: boolean): void => {
    const seconds = (event.dur * 60) / scheduler.tempo();
    engine()
      .melody(melodyFrequency(event.chord, event.tone), time, level)
      .release(time + seconds);
    if (ghost && !scheduler.rendering()) {
      scheduler.at(time, () => {
        ghosts.push({ chord: event.chord, tone: event.tone, until: time + seconds });
      });
    }
  };

  const playLayers = (from: number, to: number): void => {
    for (const layer of layers) {
      const length = layer.bars * BEATS_PER_BAR;
      for (const event of layer.events) {
        // the round of the event that falls into the window
        const position = Math.ceil((from - event.t) / length) * length + event.t;
        if (position < to) note(event, scheduler.timeAt(position), 1, true);
      }
    }
  };
  const playSequences = (from: number, to: number): void => {
    sequences = sequences.filter((sequence) => {
      for (const event of sequence.events.slice(sequence.next)) {
        const position = sequence.at + event.t;
        if (position >= to) break;
        const index = sequence.next++;
        if (position >= from) note(event, scheduler.timeAt(position), PHRASE_LEVEL, sequence.ghost(index));
      }
      return sequence.next < sequence.events.length;
    });
  };

  scheduler.follow({
    reset(time) {
      until = time;
      sequences = [];
      ghosts = [];
      const position = scheduler.beatAt(time);
      for (const listener of listeners) listener.reset?.(position);
    },
    tick(to) {
      if (to <= until) return;
      const from = scheduler.beatAt(until);
      const end = scheduler.beatAt(to);
      for (const listener of listeners) listener.window?.(from, end);
      playLayers(from, end);
      playSequences(from, end);
      until = to;
    },
  });

  return {
    layers: () => layers,
    addLayer(layer) {
      layers.push(layer);
    },
    removeLayer(index) {
      layers.splice(index, 1);
    },
    clearLayers() {
      layers.length = 0;
    },
    add(events, at, ghost = () => true) {
      const sequence: Sequence = { events, at, ghost, next: 0 };
      sequences.push(sequence);
      return sequence;
    },
    remove(sequence) {
      sequences = sequences.filter((candidate) => candidate !== sequence);
    },
    ghosts() {
      const now = scheduler.now();
      ghosts = ghosts.filter((ghost) => ghost.until > now);
      return ghosts;
    },
    listen(listener) {
      listeners.push(listener);
    },
  };
};
