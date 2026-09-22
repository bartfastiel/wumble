import { describe, expect, it } from 'vitest';
import { CHORD_MAPS, type RoleId } from './chord-maps';
import { keyBySignature } from './keys';
import { buildModel, type Model } from './model';
import { mtof } from './pitch';
import { STYLE_IDS } from './styles';
import {
  centsGrid,
  centsOff,
  chordFrequencies,
  justFrequency,
  melodyFrequency,
  noteFrequency,
  TUNING_IDS,
  TUNINGS,
  tuningReport,
} from './tuning';

const cMajor = buildModel(keyBySignature(0), 'classical');
const aBlues = buildModel(keyBySignature(3), 'blues');
const ratio = (a: number, b: number): number => a / b;
// The index of the chord playing that role in the style's map
const roleOf = (model: Model, role: RoleId): number => {
  const index = CHORD_MAPS[model.styleId].findIndex((entry) => entry.role === role);
  if (index < 0) throw new Error(`no ${role} in ${model.styleId}`);
  return index;
};

describe('TUNINGS', () => {
  it('lists the five tunings, equal temperament without a ratio, adaptive chordwise', () => {
    expect(Object.keys(TUNINGS)).toEqual([...TUNING_IDS]);
    expect(TUNINGS.equal.ratio).toBeNull();
    expect(TUNING_IDS.filter((id) => TUNINGS[id].chordwise)).toEqual(['adaptive']);
  });
});

describe('justFrequency', () => {
  it('takes the tonic at its equal-tempered pitch and applies the ratio per octave', () => {
    expect(justFrequency(60, 0, () => 1)).toBe(mtof(60));
    expect(justFrequency(72, 0, () => 1)).toBe(2 * mtof(60));
    expect(justFrequency(59, 0, (s) => (s === 11 ? 15 / 8 : 1))).toBeCloseTo((mtof(60) / 2) * (15 / 8), 10);
  });
});

describe('noteFrequency', () => {
  it('is exactly mtof in equal temperament', () => {
    for (const midi of cMajor.tones) expect(noteFrequency(cMajor, 'equal', midi)).toBe(mtof(midi));
  });

  it('tunes E4 justly to 327.03 Hz in C major', () => {
    expect(noteFrequency(cMajor, 'just', 64)).toBeCloseTo(327.03, 2);
    expect(centsOff(noteFrequency(cMajor, 'just', 64), 64)).toBeCloseTo(-13.7, 1);
  });

  it('sharpens the pythagorean third and keeps the meantone third pure', () => {
    expect(centsOff(noteFrequency(cMajor, 'pythagorean', 64), 64)).toBeCloseTo(7.8, 1);
    expect(centsOff(noteFrequency(cMajor, 'meantone', 64), 64)).toBeCloseTo(-13.7, 1);
    expect(centsOff(noteFrequency(cMajor, 'pythagorean', 67), 67)).toBeCloseTo(2, 1);
  });

  it('uses the style table: the blues seventh is 7/4', () => {
    expect(ratio(noteFrequency(aBlues, 'just', 67), noteFrequency(aBlues, 'just', 57))).toBeCloseTo(7 / 4, 12);
  });
});

describe('chordFrequencies', () => {
  it('tunes G7 adaptively as 4:5:6:7 from its root', () => {
    const { bass, chord } = chordFrequencies(cMajor, 'adaptive', roleOf(cMajor, 'dominantSeventh'));
    const partials = chord.map((hz) => 2 * ratio(hz, bass));
    expect(partials.map((partial) => Math.round(partial * 1e9) / 1e9)).toEqual([4, 5, 6, 7]);
  });

  it('keeps the bass an octave below the chord root in every tuning', () => {
    for (const tuning of TUNING_IDS) {
      const { bass, chord } = chordFrequencies(cMajor, tuning, cMajor.home);
      expect(ratio(chord[0] ?? 0, bass)).toBeCloseTo(2, 10);
    }
  });

  it('tunes the just seventh of a minor seventh chord 9/5, not 7/4', () => {
    const jazz = buildModel(keyBySignature(0), 'jazz');
    const { bass, chord } = chordFrequencies(jazz, 'adaptive', roleOf(jazz, 'turnaround')); // Dm7
    expect(ratio(chord[3] ?? 0, bass)).toBeCloseTo(2 * (9 / 5), 12);
  });
});

describe('melodyFrequency', () => {
  it('tunes chord tones from the chord root and passing tones like "just"', () => {
    const g7 = roleOf(cMajor, 'dominantSeventh');
    const f4 = cMajor.tones.indexOf(65);
    const c4 = cMajor.tones.indexOf(60);
    // F is the seventh of G7: the natural seventh above G2
    expect(melodyFrequency(cMajor, 'adaptive', g7, f4)).toBeCloseTo(ratio(7, 4) * noteFrequency(cMajor, 'just', 55), 6);
    // C is no tone of G7, so it keeps the key's own tuning
    expect(melodyFrequency(cMajor, 'adaptive', g7, c4)).toBe(noteFrequency(cMajor, 'just', 60));
  });

  it('tunes from the key alone when no chord sounds', () => {
    const c4 = cMajor.tones.indexOf(60);
    for (const tuning of TUNING_IDS) {
      expect(melodyFrequency(cMajor, tuning, -1, c4)).toBe(noteFrequency(cMajor, tuning, 60));
    }
  });

  it('stays within ±50 cents of equal temperament in every tuning', () => {
    for (const id of STYLE_IDS) {
      const model = buildModel(keyBySignature(0), id);
      for (const tuning of TUNING_IDS) {
        model.chords.forEach((_, index) => {
          model.tones.forEach((midi, tone) => {
            expect(Math.abs(centsOff(melodyFrequency(model, tuning, index, tone), midi))).toBeLessThanOrEqual(50);
          });
        });
      }
    }
  });
});

describe('tuningReport', () => {
  it('reports every tone of the field plus bass and chord, each with its cents', () => {
    const report = tuningReport(cMajor, 'just');
    expect(report.tones).toHaveLength(cMajor.tones.length);
    expect(report.chord.length).toBeGreaterThan(0);
    for (const [midi, hz, cents] of [report.bass, ...report.chord, ...report.tones]) {
      expect(hz).toBeGreaterThan(0);
      expect(Math.abs(cents)).toBeLessThanOrEqual(50);
      // both are rounded for reading: the hertz to two decimals, the cents to one
      expect(Math.abs(centsOff(hz, midi) - cents)).toBeLessThan(0.5);
      expect(Math.round(cents * 10)).toBe(cents * 10);
    }
  });

  it('keeps the root of the chord exact in equal temperament', () => {
    const report = tuningReport(cMajor, 'equal');
    expect(report.bass[2]).toBe(0);
    expect(report.chord.every(([, , cents]) => cents === 0)).toBe(true);
  });

  it('defaults to the chord at home', () => {
    expect(tuningReport(cMajor, 'just')).toEqual(tuningReport(cMajor, 'just', cMajor.home));
  });
});

describe('centsGrid', () => {
  it('gives a rounded deviation for every chord and every tone', () => {
    const grid = centsGrid(cMajor, 'adaptive');
    expect(grid).toHaveLength(cMajor.chords.length);
    for (const line of grid) {
      expect(line).toHaveLength(cMajor.tones.length);
      for (const cents of line) expect(Number.isInteger(cents)).toBe(true);
    }
    expect(
      centsGrid(cMajor, 'equal')
        .flat()
        .every((cents) => cents === 0),
    ).toBe(true);
  });
});
