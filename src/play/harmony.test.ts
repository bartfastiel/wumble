import { describe, expect, it } from 'vitest';
import { keyBySignature } from '../theory/keys';
import { buildModel, chordAt, type Model } from '../theory/model';
import { pcOf, type PitchClass } from '../theory/pitch';
import { STYLE_IDS } from '../theory/styles';
import { FakeClock } from './__fixtures__/fakes';
import {
  alternativeChords,
  bestChord,
  chooseChord,
  chordScore,
  fitOf,
  Harmony,
  type HarmonyField,
  harmonizeSong,
  INERTIA,
  PASSING_MS,
  PHRASE_GAP,
  PREFER,
  progression,
  PROGRESSIONS,
} from './harmony';
import type { Pointer } from './pointer';

const cMajor = buildModel(keyBySignature(0), 'classical');
const pc = (value: number): PitchClass => pcOf(value);

// The first chord of the map on that degree offset, with or without a seventh
const of = (model: Model, offset: number, seventh = false): number => {
  const index = model.chords.findIndex((chord) => chord.offset === offset && (chord.seventh !== null) === seventh);
  if (index < 0) throw new Error(`no chord on offset ${String(offset)}`);
  return index;
};

const tonic = cMajor.home;
const dominantSeventh = of(cMajor, 7, true);
const subdominant = of(cMajor, 5);

describe('fitOf', () => {
  it('rates root and fifth 1, the third 0.9, the seventh 0.6, foreign tones 0', () => {
    const g7 = chordAt(cMajor, dominantSeventh);
    expect(fitOf(g7, 7)).toBe(1);
    expect(fitOf(g7, 2)).toBe(1);
    expect(fitOf(g7, 11)).toBeCloseTo(0.9, 12);
    expect(fitOf(g7, 5)).toBeCloseTo(0.6, 12);
    expect(fitOf(g7, 0)).toBe(0);
  });

  it.each(STYLE_IDS)('%s: every chord tone of every chord fits, foreign ones do not', (styleId) => {
    const model = buildModel(keyBySignature(0), styleId);
    for (const chord of model.chords) {
      for (const tone of chord.pcs) expect(fitOf(chord, tone)).toBeGreaterThan(0);
      for (let tone = 0; tone < 12; tone++) {
        const inside = chord.pcs.includes(pc(tone)) || pc(tone) === chord.seventh;
        expect(fitOf(chord, pc(tone)) > 0).toBe(inside);
      }
    }
  });
});

describe('progression and preference', () => {
  it('weigh V→I highest and everything unknown 0.1', () => {
    expect(progression(7, 0)).toBeCloseTo(0.7, 12);
    expect(progression(5, 0)).toBe(PROGRESSIONS['5>7']);
    expect(progression(11, 3)).toBeCloseTo(0.1, 12);
    expect(PREFER[0]).toBeGreaterThan(PREFER[7] ?? 0);
    expect(PHRASE_GAP).toBe(1200);
    expect(PASSING_MS).toBe(120);
    expect(INERTIA).toBeCloseTo(0.8, 12);
  });
});

describe('chordScore', () => {
  it('sums fit, preference, inertia and grammar', () => {
    // C over G7: fit 1 (root of C), preference 0.3 (I), grammar V→I 0.7, no cadence bonus for the sounding chord
    const plain = chordScore(cMajor, tonic, 0, null, 0);
    expect(plain).toBeCloseTo(1 + 0.3, 12);
    expect(chordScore(cMajor, tonic, 0, tonic, INERTIA)).toBeCloseTo(plain + INERTIA + 0.1, 12);
  });

  it('adds the cadence only when the tone leaves the dominant', () => {
    // G over G7 stays: no cadence bonus; C over G7 pulls to C
    expect(chordScore(cMajor, tonic, 7, dominantSeventh, 0)).toBeCloseTo(1 + 0.3 + 0.7, 12);
    expect(chordScore(cMajor, tonic, 0, dominantSeventh, 0)).toBeCloseTo(1 + 0.3 + 0.7 + 0.5, 12);
  });

  it('weighs the fit and rejects a chord the map does not have', () => {
    expect(chordScore(cMajor, tonic, 0, null, 0, 1.5)).toBeCloseTo(1.5 + 0.3, 12);
    expect(() => chordScore(cMajor, cMajor.chords.length, 0, null, 0)).toThrow(RangeError);
  });
});

describe('bestChord', () => {
  it('takes the highest score, on a tie the chord nearer home, otherwise the fallback', () => {
    expect(bestChord([], 4, 3)).toBe(4);
    expect(
      bestChord(
        [
          [0, 1],
          [5, 2],
        ],
        3,
        3,
      ),
    ).toBe(5);
    expect(
      bestChord(
        [
          [0, 1],
          [2, 1 + 1e-12],
          [6, 1],
        ],
        3,
        3,
      ),
    ).toBe(2);
  });
});

describe('chooseChord', () => {
  it('takes the tonic for its own root and the dominant for the leading tone', () => {
    const fresh = { current: null, lastNoteAt: 0 };
    expect(chordAt(cMajor, chooseChord(cMajor, 0, fresh, 0)).offset).toBe(0);
    expect(chordAt(cMajor, chooseChord(cMajor, 11, fresh, 0)).offset).toBe(7);
  });

  it('keeps the current chord for a tone nothing contains, home before the first chord', () => {
    expect(chooseChord(cMajor, 1, { current: null, lastNoteAt: 0 }, 0)).toBe(cMajor.home);
    expect(chooseChord(cMajor, 1, { current: subdominant, lastNoteAt: 0 }, 0)).toBe(subdominant);
  });

  it('lets inertia hold the sounding chord within a phrase, and lets go after the gap', () => {
    const inside = { current: subdominant, lastNoteAt: 5000 };
    expect(chooseChord(cMajor, 5, inside, 5100)).toBe(subdominant); // F over F stays
    const after = { current: subdominant, lastNoteAt: 0 };
    expect(chordAt(cMajor, chooseChord(cMajor, 0, after, PHRASE_GAP + 1)).offset).toBe(0);
  });

  it.each(STYLE_IDS)('%s: always answers with a chord that contains the tone, when one exists', (styleId) => {
    const model = buildModel(keyBySignature(0), styleId);
    for (const midi of model.tones.slice(0, model.style.scale.length)) {
      const tone = pc(midi);
      const index = chooseChord(model, tone, { current: null, lastNoteAt: 0 }, 0);
      const fits = model.chords.some((chord) => fitOf(chord, tone) > 0);
      expect(fitOf(chordAt(model, index), tone) > 0).toBe(fits);
    }
  });
});

describe('harmonizeSong', () => {
  const notes = [60, 62, 64, 65, 67, 67, 69, 69, 69, 69, 67].map((midi) => ({ midi, beats: 1 }));

  it('harmonizes a melody with chords that carry its tones', () => {
    const chords = harmonizeSong(cMajor, notes);
    expect(chords).toHaveLength(notes.length);
    // "Alle meine Entchen" starts on the tonic and ends there
    expect(chordAt(cMajor, chords[0] ?? -1).offset).toBe(0);
    expect(chordAt(cMajor, chords.at(-1) ?? -1).offset).toBe(0);
    // Every note either fits its chord or is carried by the one before it
    chords.forEach((index, i) => {
      const tone = pcOf(notes[i]?.midi ?? 0);
      expect(fitOf(chordAt(cMajor, index), tone) > 0 || index === chords[i - 1]).toBe(true);
    });
  });

  it.each(STYLE_IDS)('%s: every answer is a chord of that style', (styleId) => {
    const model = buildModel(keyBySignature(0), styleId);
    const own = model.tones.slice(0, model.style.scale.length).map((midi) => ({ midi, beats: 1 }));
    for (const index of harmonizeSong(model, own)) expect(model.chords[index]).toBeDefined();
  });

  it('keeps a chord across a passing tone instead of changing on the offbeat', () => {
    // C D E: the D on beat two is a passing tone, the chord must not jump for it
    const [first, second, third] = harmonizeSong(cMajor, [
      { midi: 60, beats: 1 },
      { midi: 62, beats: 1 },
      { midi: 64, beats: 1 },
    ]);
    expect(second).toBe(first);
    expect(third).toBe(first);
  });
});

describe('alternativeChords', () => {
  it('lists every chord whose triad contains the tone', () => {
    const others = alternativeChords(cMajor, 0);
    expect(others.length).toBeGreaterThan(1);
    for (const index of others) expect(chordAt(cMajor, index).pcs).toContain(0);
    // the seventh of a dominant seventh chord is no triad tone
    expect(alternativeChords(cMajor, 5)).not.toContain(dominantSeventh);
  });
});

// A minimal field: pointers in a map, the chosen chord counted, melody voices logged
interface TestField {
  readonly harmony: Harmony;
  readonly clock: FakeClock;
  readonly pointers: Map<string, Pointer>;
  readonly held: number[];
  readonly melodies: number[];
  changes: number;
}
const controllerOf = (model = cMajor): TestField => {
  const clock = new FakeClock();
  const pointers = new Map<string, Pointer>();
  const held: number[] = [];
  const melodies: number[] = [];
  const field: HarmonyField = {
    model: () => model,
    pointers: () => pointers.values(),
    hasPointer: (id) => pointers.has(String(id)),
    playMelody: (pointer, chord) => {
      pointer.chord = chord;
      melodies.push(chord);
    },
    holdChord: (chord) => {
      held.push(chord);
    },
    audioNow: () => 0,
    changed: () => {
      test.changes += 1;
    },
  };
  const test: TestField = { harmony: new Harmony(field, clock), clock, pointers, held, melodies, changes: 0 };
  return test;
};
const pointerAt = (tone: number): Pointer => ({ chord: -1, tone, voices: [] });

describe('Harmony', () => {
  it('decides at once for the first tone and lets fitting tones lie', () => {
    const { harmony, pointers, held, melodies } = controllerOf();
    const e = pointerAt(2);
    harmony.melody('a', e, 4, 0); // E
    pointers.set('a', e);
    expect(chordAt(cMajor, harmony.current ?? -1).offset).toBe(0);
    const first = harmony.current;
    const g = pointerAt(4);
    harmony.melody('b', g, 7, 0); // G fits the tonic: it stays
    pointers.set('b', g);
    expect(harmony.current).toBe(first);
    expect(melodies).toEqual([first, first]);
    expect(new Set(held)).toEqual(new Set([first])); // never another chord
  });

  it('defers a foreign tone and changes the chord when the finger still lies', () => {
    const test = controllerOf();
    const { harmony, pointers, clock, melodies } = test;
    const e = pointerAt(2);
    harmony.melody('a', e, 4, 0);
    pointers.set('a', e);
    const sounding = harmony.current;
    const f = pointerAt(3);
    harmony.melody('b', f, 5, 0); // F is foreign to C major
    pointers.set('b', f);
    expect(harmony.pendingId).toBe('b');
    expect(melodies.at(-1)).toBe(sounding); // tuned to the sounding chord meanwhile
    clock.advance(PASSING_MS);
    expect(harmony.pendingId).toBeNull();
    expect(chordAt(cMajor, harmony.current ?? -1).pcs).toContain(5);
    expect(test.changes).toBe(1);
  });

  it('treats a released pending tone as a passing tone', () => {
    const { harmony, pointers, clock } = controllerOf();
    const e = pointerAt(2);
    harmony.melody('a', e, 4, 0);
    pointers.set('a', e);
    const sounding = harmony.current;
    harmony.melody('b', pointerAt(3), 5, 0);
    harmony.cancel('other'); // not pending: nothing happens
    expect(harmony.pendingId).toBe('b');
    harmony.cancel('b');
    expect(harmony.pendingId).toBeNull();
    clock.advance(PASSING_MS);
    expect(harmony.current).toBe(sounding);
    expect(clock.pending).toBe(0);
  });

  it('does not decide for a pointer that vanished without cancel', () => {
    const test = controllerOf();
    const { harmony, pointers, clock } = test;
    const e = pointerAt(2);
    harmony.melody('a', e, 4, 0);
    pointers.set('a', e);
    const sounding = harmony.current;
    harmony.melody('b', pointerAt(3), 5, 0);
    clock.advance(PASSING_MS);
    expect(harmony.current).toBe(sounding);
    expect(test.changes).toBe(0);
  });

  it('replaces a pending decision by the next foreign tone', () => {
    const { harmony, pointers, clock } = controllerOf();
    const e = pointerAt(2);
    harmony.melody('a', e, 4, 0);
    pointers.set('a', e);
    const d = pointerAt(1);
    harmony.melody('b', d, 2, 0);
    pointers.set('b', d);
    clock.advance(40);
    const f = pointerAt(3);
    harmony.melody('c', f, 5, 0);
    pointers.set('c', f);
    expect(harmony.pendingId).toBe('c');
    clock.advance(PASSING_MS);
    expect(chordAt(cMajor, harmony.current ?? -1).pcs).toContain(5);
  });

  it('starts a new phrase after the gap, and the map always leads', () => {
    const { harmony, pointers, clock } = controllerOf();
    const g = pointerAt(4);
    harmony.melody('a', g, 7, 0);
    pointers.set('a', g);
    pointers.delete('a');
    clock.advance(PHRASE_GAP + 1);
    const b = pointerAt(6);
    harmony.melody('b', b, 11, 0); // B after a gap: the dominant wins
    pointers.set('b', b);
    expect(chordAt(cMajor, harmony.current ?? -1).offset).toBe(7);
    harmony.lead(subdominant);
    expect(harmony.current).toBe(subdominant);
    const e = pointerAt(2);
    harmony.melody('c', e, 4, 0); // E does not fit F: the field waits instead of overruling the hand
    expect(harmony.pendingId).toBe('c');
    expect(harmony.current).toBe(subdominant);
  });

  it('resets: cancels the pending decision and forgets the chord', () => {
    const { harmony, pointers, clock } = controllerOf();
    const e = pointerAt(2);
    harmony.melody('a', e, 4, 0);
    pointers.set('a', e);
    harmony.melody('b', pointerAt(3), 5, 0);
    harmony.reset();
    expect(harmony.current).toBeNull();
    expect(harmony.pendingId).toBeNull();
    expect(clock.pending).toBe(0);
    harmony.reset();
  });
});
