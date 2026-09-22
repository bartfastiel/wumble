// The band: one button, and everything sounds like a band. Drums, bass and chords play in the
// groove of the style over the chords – from a schema or following the play – on the lookahead scheduler.
import type { AudioEngine, VoiceHandle } from '../audio/engine';
import { type Chord, voicing } from '../theory/chords';
import { chordAt, type Model } from '../theory/model';
import { pcOf, type PitchClass } from '../theory/pitch';
import { chordFrequencies, type ChordFrequencies, melodyFrequency, type TuningId } from '../theory/tuning';
import type { Clock, Timers } from './clock';
import { type Groove, GROOVES, LEVEL } from './grooves';
import { type ArpDegree, type BassDegree, GATE, PATTERNS, stepOffset, type ToneNote } from './patterns';
import { createScheduler, type Scheduler } from './scheduler';
import { type SchemaId, SCHEMATA, schemaChord } from './schemata';
import { createTapTempo } from './tap-tempo';

const START_DELAY = 0.05; // seconds between the button and the first beat
const ARP_INDEX: Readonly<Record<Exclude<ArpDegree, '8'>, number>> = { '1': 0, '3': 1, '5': 2, '7': 3 };

export interface BandOptions {
  readonly engine: AudioEngine;
  readonly clock: Clock;
  readonly timers: Timers;
  readonly model: () => Model;
  readonly tuning: () => TuningId;
  readonly chordSource: () => number; // while following the play: song → auto-harmony → last chosen chord → home
  readonly onBeat?: () => void; // every beat, at audio time
  readonly onChord?: (chord: number | null) => void; // the chord the band plays in a schema, null when following
}

export interface Band {
  readonly scheduler: Scheduler;
  start(): void; // immediately on bar 1
  stop(): void; // releases the band's voices, drops planned UI callbacks
  toggle(): void;
  running(): boolean;
  tempo(): number;
  setTempo(bpm: number): void;
  tap(): void;
  schema(): SchemaId;
  setSchema(id: SchemaId): void;
  groove(): Groove;
  currentChord(): number; // the chord the band plays now
  chordForBar(bar: number): number; // what the band will play in bar `bar` – known in a schema, else the current one
  bandChord(): number | null;
  output(): AudioEngine; // the engine currently written to – a recording stub while rendering
  renderBars(engine: AudioEngine, bars: number, from?: number): number; // offline, the same path as live
  onStop(listener: () => void): void;
}

interface Sounding {
  readonly note: ToneNote;
  readonly chord: number;
  readonly end: number;
  readonly voice: VoiceHandle;
}

// The entry at `index`, or the last one when the list is shorter – a power chord has no third to play
export const nthOrLast = <T>(list: readonly T[], index: number): T => {
  const entry = list[Math.min(index, list.length - 1)];
  if (entry === undefined) throw new RangeError('empty list');
  return entry;
};

// Semitones of a bass degree above the bass root of the chord: third and fifth from the chord (power chord: the
// fifth), sixth 9, seventh from the chord or 10, octave 12
export const bassSemitones = (chord: Chord, degree: Exclude<BassDegree, 'L'>): number => {
  const interval = (index: number): PitchClass => pcOf(nthOrLast(chord.pcs, index) - chord.root);
  switch (degree) {
    case '1':
      return 0;
    case '3':
      return interval(1);
    case '5':
      return interval(2);
    case '6':
      return 9;
    case '7':
      return chord.seventh === null ? 10 : pcOf(chord.seventh - chord.root);
    case '8':
      return 12;
  }
};

// Arpeggio tone from the chord frequencies: 1 3 5 7 = chord tones from below, 8 = octave of the root
const arpeggioHz = (frequencies: ChordFrequencies, degree: ArpDegree): number =>
  degree === '8' ? nthOrLast(frequencies.chord, 0) * 2 : nthOrLast(frequencies.chord, ARP_INDEX[degree]);

export const createBand = (options: BandOptions): Band => {
  const { clock, timers, model, tuning, chordSource, onBeat, onChord } = options;
  let output = options.engine;
  let schemaId: SchemaId = 'follow';
  let sounding: Sounding[] = [];
  let bandChord: number | null = null;
  const stopListeners: (() => void)[] = [];
  const tapTempo = createTapTempo(clock);

  const groove = (): Groove => GROOVES[model().style.groove];
  const release = (time: number): void => {
    for (const held of sounding) held.voice.release(time);
    sounding = [];
  };
  const scheduler = createScheduler({
    clock,
    timers,
    stepOffset: (step, beat) => stepOffset(step, beat, groove()),
    onStep: (time) => {
      schedule(time);
    },
    onRestart: release, // tones planned on the fallback clock lie in the audio future: let them go
  });

  const schemaChordAhead = (bars: number): number | null =>
    schemaChord(model(), SCHEMATA[schemaId], scheduler.position().bar + bars);
  const currentChord = (): number => schemaChordAhead(0) ?? chordSource();
  // A fractional bar (radio phrases start mid-bar every other time) means the bar that contains it
  const chordForBar = (bar: number): number =>
    schemaChordAhead(Math.max(0, Math.floor(bar) - scheduler.position().bar)) ?? currentChord();

  // Theory tunes a tone together with its chord; a model with a single tone makes any pitch that tone, so the band's
  // bass takes the same path as the melody – adaptive tuning tunes chord tones from the chord root, the rest by the key
  const toneHz = (chord: number, midi: number): number =>
    melodyFrequency({ ...model(), tones: [midi] }, tuning(), chord, 0);

  // L = semitone below the bass root of the next chord (known in a schema, otherwise the current one)
  const bassHz = (chord: number, degree: BassDegree): number => {
    const bassOf = (index: number): number => voicing(chordAt(model(), index)).bass;
    if (degree === 'L') return toneHz(chord, bassOf(schemaChordAhead(1) ?? chord) - 1);
    return toneHz(chord, bassOf(chord) + bassSemitones(chordAt(model(), chord), degree));
  };

  // Start a tone of a lane and release it at `end`; the entry keeps it for the chord change at the next eighth
  const play = (note: ToneNote, chord: number, time: number, end: number): Sounding => {
    const level = groove().tones ?? 1;
    const frequencies = (): ChordFrequencies => chordFrequencies(model(), tuning(), chord);
    let voice: VoiceHandle;
    if (note.lane === 'bass') voice = output.bass(bassHz(chord, note.degree), time, level * LEVEL.bass);
    else if (note.voice === 'S' || note.voice === 's') {
      voice = output.chord(frequencies().chord, time, level * LEVEL[note.lane] * (note.voice === 's' ? LEVEL.soft : 1));
    } else voice = output.melody(arpeggioHz(frequencies(), note.voice), time, level * LEVEL.arp);
    voice.release(end);
    return { note, chord, end, voice };
  };

  const showChord = (chord: number | null): void => {
    if (bandChord === chord) return;
    bandChord = chord;
    onChord?.(chord);
  };

  // All events of the current step at audio time `time` – live and offline the same way
  const schedule = (time: number): void => {
    const current = groove();
    const pattern = PATTERNS[model().style.groove];
    const { step } = scheduler.position();
    const chord = currentChord();
    const beat = 60 / scheduler.tempo();
    if (!scheduler.rendering()) {
      if (step % 4 === 0) scheduler.at(time, () => onBeat?.());
      if (step === 0) {
        const shown = schemaChordAhead(0);
        scheduler.at(time, () => {
          showChord(shown);
        });
      }
    }
    // Forget tones that have ended; at the eighth, held tones (pad, drone, walking quarters) move to the new chord
    sounding = sounding.filter((held) => held.end > time);
    if (step % 2 === 0) {
      sounding = sounding.map((held) => {
        if (held.chord === chord) return held;
        held.voice.release(time);
        return play(held.note, chord, time, held.end);
      });
    }
    for (const hit of pattern.drums) {
      if (hit.step === step) output.drum(hit.kind, time, hit.velocity * (current.drums ?? 1));
    }
    for (const note of pattern.tones) {
      if (note.step !== step) continue;
      const seconds = (stepOffset(step + note.length, beat, current) - stepOffset(step, beat, current)) * GATE;
      sounding.push(play(note, chord, time, time + seconds));
    }
  };

  const stop = (): void => {
    if (!scheduler.running()) return;
    scheduler.stop();
    release(clock.now());
    for (const listener of stopListeners) listener();
    showChord(null);
  };
  const start = (): void => {
    if (scheduler.running()) return;
    options.engine.ensure();
    scheduler.start(clock.now() + START_DELAY);
  };

  return {
    scheduler,
    start,
    stop,
    toggle: () => {
      if (scheduler.running()) stop();
      else start();
    },
    running: () => scheduler.running(),
    tempo: () => scheduler.tempo(),
    setTempo: (bpm) => {
      scheduler.setTempo(bpm);
    },
    tap() {
      const bpm = tapTempo.tap();
      if (bpm !== null) scheduler.setTempo(bpm);
    },
    schema: () => schemaId,
    setSchema(id) {
      schemaId = id;
      if (SCHEMATA[id].bars === null) showChord(null); // following the play highlights nothing
    },
    groove,
    currentChord,
    chordForBar,
    bandChord: () => bandChord,
    output: () => output,
    renderBars(engine, bars, from = 0) {
      output = engine;
      sounding = [];
      try {
        return scheduler.render(bars, from);
      } finally {
        output = options.engine;
        sounding = [];
      }
    },
    onStop(listener) {
      stopListeners.push(listener);
    },
  };
};
