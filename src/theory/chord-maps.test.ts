import { describe, expect, it } from 'vitest';
import {
  CHORD_MAPS,
  mapOf,
  pitchesOf,
  ROLE_IDS,
  rootOf,
  SHAPE_INTERVALS,
  specOf,
  specsOfMap,
  tonicChordOf,
} from './chord-maps';
import { setLocale, t } from '../i18n';
import { pcOf } from './pitch';
import { STYLE_IDS, STYLES } from './styles';

describe('SHAPE_INTERVALS', () => {
  it('stacks every shape from its root upwards, without repeating a tone', () => {
    for (const [shape, intervals] of Object.entries(SHAPE_INTERVALS)) {
      expect(intervals[0], shape).toBe(0);
      expect([...intervals], shape).toEqual([...intervals].sort((a, b) => a - b));
      expect(new Set(intervals).size, shape).toBe(intervals.length);
      expect(intervals.length, shape).toBeGreaterThanOrEqual(2);
      expect(intervals.length, shape).toBeLessThanOrEqual(4);
    }
  });
});

describe('CHORD_MAPS', () => {
  it.each(STYLE_IDS)('%s has exactly one tonic on the axis, and nothing twice', (styleId) => {
    const map = CHORD_MAPS[styleId];
    expect(map.filter((chord) => chord.step === 0 && chord.side === 0)).toHaveLength(1);
    const places = map.map((chord) => `${String(chord.step)}/${String(chord.side)}`);
    expect(new Set(places).size).toBe(places.length); // no two chords share a place
    const chords = map.map((chord) => `${String(pcOf(chord.semitones))}:${chord.shape}`);
    expect(new Set(chords).size).toBe(chords.length); // and no chord appears twice
  });

  it.each(STYLE_IDS)('%s names a known role for every chord', (styleId) => {
    for (const chord of CHORD_MAPS[styleId]) expect(ROLE_IDS).toContain(chord.role);
  });

  it.each(STYLE_IDS)('%s keeps the pull readable: the axis is filled from top to bottom', (styleId) => {
    const steps = [...new Set(CHORD_MAPS[styleId].filter((c) => c.side === 0).map((c) => c.step))].sort(
      (a, b) => a - b,
    );
    for (let i = 1; i < steps.length; i++) expect((steps[i] ?? 0) - (steps[i - 1] ?? 0)).toBeLessThanOrEqual(2);
  });

  it('names every role in both locales', () => {
    const used = new Set(STYLE_IDS.flatMap((id) => CHORD_MAPS[id].map((chord) => chord.role)));
    for (const locale of ['de', 'en'] as const) {
      setLocale(locale);
      for (const role of used) expect(t(`theory.role.${role}`)).not.toBe(`theory.role.${role}`);
    }
  });
});

describe('rootOf and pitchesOf', () => {
  it('put a chord on the tonic of the key', () => {
    const tonic = tonicChordOf('classical');
    expect(rootOf(tonic, 0)).toBe(0); // C major
    expect(rootOf(tonic, 7)).toBe(7); // G major
    expect(pitchesOf(tonic, 0)).toEqual([0, 4, 7]);
    expect(pitchesOf(tonic, 7)).toEqual([7, 11, 2]);
  });

  it.each(STYLE_IDS)('%s: every chord keeps its shape in every key', (styleId) => {
    for (const chord of CHORD_MAPS[styleId]) {
      for (const tonic of [0, 5, 11] as const) {
        const tones = pitchesOf(chord, tonic);
        expect(tones).toHaveLength(SHAPE_INTERVALS[chord.shape].length);
        expect(tones[0]).toBe(rootOf(chord, tonic));
        expect(new Set(tones).size).toBe(tones.length);
      }
    }
  });
});

describe('tonicChordOf and mapOf', () => {
  it('finds the chord at home and hands out the map unchanged', () => {
    for (const styleId of STYLE_IDS) {
      const home = tonicChordOf(styleId);
      expect(home.step).toBe(0);
      expect(home.side).toBe(0);
      expect(mapOf(styleId)).toBe(CHORD_MAPS[styleId]);
      expect(mapOf(styleId)).toContain(home);
    }
  });
});

describe('specOf and specsOfMap', () => {
  it('turns a map entry into a chord spec the rest of the theory can read', () => {
    const style = STYLES.classical;
    const dominant = CHORD_MAPS.classical.find((chord) => chord.role === 'dominantSeventh');
    if (dominant === undefined) throw new Error('no dominant seventh');
    expect(specOf(dominant, style.scale)).toEqual({
      degree: 4,
      root: 7,
      intervals: [0, 4, 7],
      seventh: 10,
      quality: '7',
      sharp: false,
    });
  });

  it.each(STYLE_IDS)('%s: one spec per chord, sevenths apart from the triad', (styleId) => {
    const style = STYLES[styleId];
    const specs = specsOfMap(styleId, style.scale, style.sharps ?? []);
    expect(specs).toHaveLength(CHORD_MAPS[styleId].length);
    for (const [i, spec] of specs.entries()) {
      const chord = CHORD_MAPS[styleId][i];
      expect(spec.root).toBe(pcOf(chord?.semitones ?? 0));
      expect(spec.intervals[0]).toBe(0);
      expect(spec.intervals.every((interval) => interval < 9)).toBe(true);
      if (spec.seventh !== null) expect(spec.seventh).toBeGreaterThanOrEqual(9);
      expect(spec.degree === -1 || style.scale[spec.degree] === spec.root).toBe(true);
    }
  });

  it('marks a root the style lists as sharp', () => {
    const lydian = CHORD_MAPS.lydian.find((chord) => chord.role === 'tritone');
    if (lydian === undefined) throw new Error('no tritone');
    expect(specOf(lydian, STYLES.lydian.scale, STYLES.lydian.sharps ?? []).sharp).toBe(true);
    expect(specOf(lydian, STYLES.lydian.scale).sharp).toBe(false);
  });
});
