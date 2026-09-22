// Tunings: the theory computes hertz, audio only plays hertz (see the ADR on tuning).
//
// All non-equal tunings share one path: the reference is the tonic of the key at its equal-tempered pitch
// (MIDI 60 + tonic, C4…B4). For a tone m, d = m − reference, oct = floor(d / 12), s = d mod 12 and
// f = mtof(reference) · 2^oct · ratio(s). Every tone stays within ±50 cents of its equal-tempered note
// (harmonic series: 11/8 = −49, 13/8 = +41 cents).
import { toneKind, type Chord, voicing } from './chords';
import { chordAt, type Model, toneOf } from './model';
import { mtof, pcOf, type PitchClass } from './pitch';
import { CHORD_RATIOS, CHROMA_5, meantoneRatio, PYTHAGOREAN } from './ratios';
import type { Style } from './styles';

export const TUNING_IDS = ['equal', 'just', 'pythagorean', 'meantone', 'adaptive'] as const;
export type TuningId = (typeof TUNING_IDS)[number];

type RatioOf = (semitone: PitchClass, style: Style) => number;
export interface Tuning {
  readonly ratio: RatioOf | null; // null: equal temperament, plain mtof
  readonly chordwise: boolean; // every chord tuned justly from its own root – the field knows the chord
}

// Just: the style's table, otherwise 5-limit chromatic (pure thirds and fifths to the key)
const justRatio: RatioOf = (semitone, style) => style.ratios[semitone] ?? CHROMA_5[semitone];

export const TUNINGS: Readonly<Record<TuningId, Tuning>> = {
  equal: { ratio: null, chordwise: false },
  just: { ratio: justRatio, chordwise: false },
  pythagorean: { ratio: (semitone) => PYTHAGOREAN[semitone], chordwise: false },
  meantone: { ratio: meantoneRatio, chordwise: false },
  adaptive: { ratio: justRatio, chordwise: true },
};

export const justFrequency = (midi: number, tonic: PitchClass, ratio: (semitone: PitchClass) => number): number => {
  const reference = 60 + tonic;
  const distance = midi - reference;
  const octave = Math.floor(distance / 12);
  return mtof(reference) * 2 ** octave * ratio(pcOf(distance));
};

// Tone in Hz after the tuning, without reference to a chord
export const noteFrequency = (model: Model, tuning: TuningId, midi: number): number => {
  const { ratio } = TUNINGS[tuning];
  return ratio === null ? mtof(midi) : justFrequency(midi, model.key.tonic, (semitone) => ratio(semitone, model.style));
};

// Adaptive: the chord root in the bass octave follows the 5-limit chromatic scale on purpose, not the septimal
// style table – otherwise 7/4 · 7/4 = 49/16 would stack up to −62 cents
const chordRootFrequency = (model: Model, chord: Chord): number =>
  justFrequency(36 + chord.root, model.key.tonic, (semitone) => CHROMA_5[semitone]);

// Adaptive: chord tone tuned from the chord root, shifted by whole octaves to within ±600 cents of its
// equal-tempered note; a major triad with a minor seventh gets the natural seventh 7/4
const chordToneFrequency = (midi: number, chord: Chord, rootHz: number): number => {
  const interval = pcOf(midi - chord.root);
  const dominant = chord.pcs.includes(pcOf(chord.root + 4));
  const frequency = rootHz * (interval === 10 && dominant ? 7 / 4 : CHORD_RATIOS[interval]);
  const octaves = Math.round(Math.log2(mtof(midi) / frequency));
  return frequency * 2 ** octaves;
};

// Hz of a tone that belongs to `chord` (bass, voice or melody chord tone)
const chordToneHz = (model: Model, tuning: TuningId, chord: Chord, midi: number): number =>
  TUNINGS[tuning].chordwise
    ? chordToneFrequency(midi, chord, chordRootFrequency(model, chord))
    : noteFrequency(model, tuning, midi);

// Hz of a melody tone – adaptive tuning needs the chord it sounds with; without one (nothing chosen on the map) the
// tone is tuned from the key alone
export const melodyFrequency = (model: Model, tuning: TuningId, chordIndex: number, tone: number): number => {
  const midi = toneOf(model, tone);
  if (chordIndex < 0) return noteFrequency(model, tuning, midi);
  const chord = chordAt(model, chordIndex);
  return toneKind(chord, midi) === 'scale'
    ? noteFrequency(model, tuning, midi)
    : chordToneHz(model, tuning, chord, midi);
};

export interface ChordFrequencies {
  readonly bass: number;
  readonly chord: readonly number[];
}

export const chordFrequencies = (model: Model, tuning: TuningId, index: number): ChordFrequencies => {
  const chord = chordAt(model, index);
  const notes = voicing(chord);
  const hz = (midi: number): number => chordToneHz(model, tuning, chord, midi);
  return { bass: hz(notes.bass), chord: notes.chord.map(hz) };
};

// Deviation from the equal-tempered pitch in cents
export const centsOff = (frequency: number, midi: number): number => 1200 * Math.log2(frequency / mtof(midi));

// Rounded cents per tone – adaptive tuning tunes every chord differently
export const centsGrid = (model: Model, tuning: TuningId): number[][] =>
  model.chords.map((_, index) =>
    model.tones.map((midi, tone) => Math.round(centsOff(melodyFrequency(model, tuning, index, tone), midi))),
  );

export type ReportEntry = readonly [midi: number, hz: number, cents: number];
export interface TuningReport {
  readonly tones: readonly ReportEntry[];
  readonly bass: ReportEntry;
  readonly chord: readonly ReportEntry[];
}

// Self-test: [MIDI, Hz, cents] per tone, plus bass and chord
export const tuningReport = (model: Model, tuning: TuningId, index = model.home): TuningReport => {
  const entry = (midi: number, hz: number): ReportEntry => [
    midi,
    Math.round(hz * 100) / 100,
    Math.round(centsOff(hz, midi) * 10) / 10,
  ];
  const chord = chordAt(model, index);
  const notes = voicing(chord);
  const hz = (midi: number): number => chordToneHz(model, tuning, chord, midi);
  return {
    tones: model.tones.map((midi, tone) => entry(midi, melodyFrequency(model, tuning, index, tone))),
    bass: entry(notes.bass, hz(notes.bass)),
    chord: notes.chord.map((midi) => entry(midi, hz(midi))),
  };
};
