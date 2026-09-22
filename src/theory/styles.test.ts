import { describe, expect, it } from 'vitest';
import { setLocale, t } from '../i18n';
import { CHORD_MAPS } from './chord-maps';
import { pcOf } from './pitch';
import { isFunctional } from './roman';
import { STYLE_IDS, STYLES } from './styles';
import { TUNING_IDS } from './tuning';

describe('STYLES', () => {
  it('are thirteen, and every id has a style', () => {
    expect(STYLE_IDS).toHaveLength(13);
    expect(Object.keys(STYLES)).toEqual([...STYLE_IDS]);
  });

  it.each(STYLE_IDS)('%s is a complete data set', (id) => {
    const style = STYLES[id];
    expect(style.scale.length).toBeGreaterThanOrEqual(5);
    expect(style.scale[0]).toBe(0); // every scale starts on the root
    expect([...style.scale]).toEqual([...style.scale].sort((a, b) => a - b));
    expect(new Set(style.scale).size).toBe(style.scale.length);
    expect(style.tempo).toBeGreaterThanOrEqual(60);
    expect(style.tempo).toBeLessThanOrEqual(180);
    if (style.tuning !== undefined) expect(TUNING_IDS).toContain(style.tuning);
    for (const semitone of style.sharps ?? []) expect(style.scale).toContain(semitone);
    // A ratio for every tone of the scale, so just intonation has something to work with
    for (const semitone of style.scale) expect(style.ratios[semitone]).toBeGreaterThan(0);
  });

  it('each carry a chord map with a tonic on the axis', () => {
    for (const id of STYLE_IDS) {
      const map = CHORD_MAPS[id];
      expect(map.length).toBeGreaterThanOrEqual(3);
      expect(map.filter((chord) => chord.step === 0 && chord.side === 0)).toHaveLength(1);
      expect(map.some((chord) => chord.role === 'tonic')).toBe(true);
    }
  });

  it.each(STYLE_IDS)('%s: every chord of the map is rooted on a tone the scale or the key knows', (id) => {
    for (const chord of CHORD_MAPS[id]) {
      expect(pcOf(chord.semitones)).toBe(chord.semitones % 12);
      expect(chord.side).toBeGreaterThanOrEqual(-1);
      expect(chord.side).toBeLessThanOrEqual(1);
    }
  });

  it('read as functions where the map has a major tonic with dominant and subdominant', () => {
    expect(STYLE_IDS.filter((id) => isFunctional(id))).toEqual(['classical', 'jazz', 'pentatonic', 'harmonicSeries']);
  });

  it('are grouped stage → school → nature', () => {
    const groups = STYLE_IDS.map((id) => STYLES[id].group);
    expect([...new Set(groups)]).toEqual(['stage', 'school', 'nature']);
  });

  it('have a name and a group name in every locale', () => {
    for (const locale of ['de', 'en'] as const) {
      setLocale(locale);
      for (const id of STYLE_IDS) expect(t(`theory.style.${id}`)).not.toBe(`theory.style.${id}`);
      for (const group of ['stage', 'school', 'nature'] as const) {
        expect(t(`theory.group.${group}`)).not.toBe(`theory.group.${group}`);
      }
    }
  });

  it('spell the lydian fourth and the eleventh partial with a sharp', () => {
    expect(STYLES.lydian.sharps).toEqual([6]);
    expect(STYLES.harmonicSeries.sharps).toEqual([6]);
    expect(STYLES.blues.sharps).toBeUndefined(); // the blue note is flat
  });
});
