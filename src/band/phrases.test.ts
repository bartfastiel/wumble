import { describe, expect, it } from 'vitest';
import { keyBySignature } from '../theory/keys';
import { buildModel, chordAt, type Model, toneOf } from '../theory/model';
import { pcOf } from '../theory/pitch';
import { STYLE_IDS } from '../theory/styles';
import { mulberry32 } from './__fixtures__/calls';
import {
  composePhrase,
  NEAR,
  nearWeight,
  type PhraseNote,
  singingRange,
  SINGING_LOW,
  STEPS,
  weightedPick,
} from './phrases';

const classical = buildModel(keyBySignature(0), 'classical');
const isChordTone = (model: Model, chord: number, tone: number): boolean =>
  chordAt(model, chord).pcs.includes(pcOf(toneOf(model, tone)));
const tonicOf = (model: Model): number => model.home;

interface PhraseFacts {
  readonly intervals: number;
  readonly steps: number; // intervals of at most one stripe
  readonly downbeats: number;
  readonly downbeatChordTones: number;
  readonly lastChordTone: boolean;
}
// Checks the hard rules of a two-bar phrase and counts what the statistics need
const inspect = (model: Model, chords: readonly number[], notes: readonly PhraseNote[]): PhraseFacts => {
  const [low, high] = singingRange(model);
  const facts = { intervals: 0, steps: 0, downbeats: 0, downbeatChordTones: 0 };
  for (const [j, note] of notes.entries()) {
    expect(note.tone).toBeGreaterThanOrEqual(low);
    expect(note.tone).toBeLessThanOrEqual(high);
    const previous = notes[j - 1];
    if (previous !== undefined) {
      const leap = Math.abs(note.tone - previous.tone);
      expect(leap).toBeLessThanOrEqual(3);
      facts.intervals++;
      if (leap <= 1) facts.steps++;
    }
    if (note.t % 4 === 0) {
      facts.downbeats++;
      if (isChordTone(model, chords[Math.floor(note.t / 4)] ?? model.home, note.tone)) facts.downbeatChordTones++;
    }
  }
  const last = notes.at(-1);
  expect(last).toMatchObject({ t: 6, dur: 2 });
  return { ...facts, lastChordTone: last !== undefined && isChordTone(model, chords[1] ?? model.home, last.tone) };
};

describe('singingRange', () => {
  it.each(STYLE_IDS)('%s sings two octaves from middle C upwards', (styleId) => {
    const model = buildModel(keyBySignature(0), styleId);
    const [low, high] = singingRange(model);
    expect(toneOf(model, low)).toBeGreaterThanOrEqual(SINGING_LOW);
    expect(toneOf(model, low - 1)).toBeLessThan(SINGING_LOW);
    expect(high - low).toBe(2 * model.style.scale.length);
    expect(toneOf(model, high)).toBeLessThanOrEqual(SINGING_LOW + 25);
  });
});

describe('composePhrase', () => {
  it('repeats itself for the same seed, and differs for another', () => {
    const first = composePhrase(classical, 2, [tonicOf(classical)], mulberry32(1));
    expect(composePhrase(classical, 2, [tonicOf(classical)], mulberry32(1))).toEqual(first);
    expect(composePhrase(classical, 2, [tonicOf(classical)], mulberry32(2))).not.toEqual(first);
  });

  it('fills the bars with quarters, pairs of eighths and a closing half note', () => {
    const notes = composePhrase(classical, 2, [tonicOf(classical)], mulberry32(1));
    expect(notes.at(-1)).toMatchObject({ t: 6, dur: 2 });
    expect(notes.every((note) => note.dur === 0.5 || note.dur === 1 || note.dur === 2)).toBe(true);
    const beats = notes.reduce((sum, note) => sum + note.dur, 0);
    expect(beats).toBe(8);
  });

  it('starts and ends on a chord tone', () => {
    const chords = [tonicOf(classical), 0];
    const notes = composePhrase(classical, 2, chords, mulberry32(5));
    expect(isChordTone(classical, chords[0] ?? 0, notes[0]?.tone ?? 0)).toBe(true);
    expect(isChordTone(classical, chords[1] ?? 0, notes.at(-1)?.tone ?? 0)).toBe(true);
  });

  it('continues from the tone before, within reach', () => {
    const [low] = singingRange(classical);
    const notes = composePhrase(classical, 1, [tonicOf(classical)], mulberry32(9), low + 3);
    expect(Math.abs((notes[0]?.tone ?? 0) - (low + 3))).toBeLessThanOrEqual(3);
  });

  it('defaults to a free start', () => {
    const chords = [tonicOf(classical)];
    expect(composePhrase(classical, 1, chords, mulberry32(9))).toEqual(
      composePhrase(classical, 1, chords, mulberry32(9), null),
    );
  });

  it('needs at least one chord', () => {
    expect(() => composePhrase(classical, 1, [], mulberry32(1))).toThrow(RangeError);
  });

  it('steps when the chord has no tone within reach', () => {
    // A chord whose tones all lie outside the reach of the previous note still yields a note
    const [low, high] = singingRange(classical);
    const notes = composePhrase(classical, 1, [0], mulberry32(3), low);
    expect(notes[0]?.tone).toBeGreaterThanOrEqual(low);
    expect(notes[0]?.tone).toBeLessThanOrEqual(high);
  });

  it.each(STYLE_IDS)('%s behaves musically: mostly steps, no leap over 3, chord tones on the strong beats', (style) => {
    const rng = mulberry32(2026);
    const model = buildModel(keyBySignature(0), style);
    const stats = { intervals: 0, steps: 0, lastChordTone: 0, phrases: 0, downbeats: 0, downbeatChordTones: 0 };
    for (let i = 0; i < 20; i++) {
      const chords = [model.home, i % model.chords.length];
      const notes = composePhrase(model, 2, chords, rng, i % 3 === 0 ? null : singingRange(model)[0] + (i % 7));
      stats.phrases++;
      const phrase = inspect(model, chords, notes);
      stats.intervals += phrase.intervals;
      stats.steps += phrase.steps;
      stats.downbeats += phrase.downbeats;
      stats.downbeatChordTones += phrase.downbeatChordTones;
      if (phrase.lastChordTone) stats.lastChordTone++;
    }
    expect(stats.steps / stats.intervals).toBeGreaterThanOrEqual(0.4);
    // The phrase closes on a chord tone unless the chord has none within reach – the harmonic series has such chords
    expect(stats.lastChordTone / stats.phrases).toBeGreaterThanOrEqual(0.8);
    expect(stats.downbeatChordTones / stats.downbeats).toBeGreaterThanOrEqual(0.7);
  });
});

describe('nearWeight', () => {
  it('weighs a step highest and refuses a distance it has no weight for', () => {
    expect(NEAR.map((_, distance) => nearWeight(distance))).toEqual([...NEAR]);
    expect(nearWeight(1)).toBeGreaterThan(nearWeight(0));
    expect(nearWeight(1)).toBeGreaterThan(nearWeight(3));
    expect(() => nearWeight(4)).toThrow(RangeError);
  });
});

describe('weightedPick', () => {
  it('picks by weight and falls back to the last entry', () => {
    expect(STEPS.reduce((sum, [, weight]) => sum + weight, 0)).toBeCloseTo(0.94, 10);
    expect(
      weightedPick(
        () => 0,
        ['a', 'b'],
        () => 1,
      ),
    ).toBe('a');
    expect(
      weightedPick(
        () => 0.6,
        ['a', 'b'],
        () => 1,
      ),
    ).toBe('b');
    expect(
      weightedPick(
        () => 0.5,
        ['a', 'b'],
        () => 0,
      ),
    ).toBe('b'); // nothing weighs: the last one
    expect(() =>
      weightedPick(
        () => 0,
        [],
        () => 1,
      ),
    ).toThrow(RangeError);
  });
});
