import { describe, expect, it } from 'vitest';
import { CHORD_MAPS } from './chord-maps';
import { keyBySignature } from './keys';
import { buildModel, chordAt, noteOf, toneOf } from './model';
import { pcOf } from './pitch';
import { STYLE_IDS, STYLES } from './styles';
import { OCTAVES } from './tones';

const model = buildModel(keyBySignature(0), 'classical');

describe('buildModel', () => {
  it('derives the chord map, the tones and the hue from key and style', () => {
    expect(model.chords.map((chord) => chord.label)).toEqual(['G7', 'G', 'b', 'e', 'C', 'a', 'C7', 'F', 'd', 'f']);
    expect(model.tones).toHaveLength(OCTAVES * 7);
    expect(model.hue).toBe(85);
    expect(model.key.signature).toBe(0);
    expect(model.styleId).toBe('classical');
    expect(model.style).toBe(STYLES.classical);
  });

  it('puts the tonic chord where the map says home is', () => {
    const home = model.map[model.home];
    expect(home?.role).toBe('tonic');
    expect(chordAt(model, model.home).label).toBe('C');
  });

  it.each(STYLE_IDS)('%s offers every chord of its map, lowest tone first', (styleId) => {
    const built = buildModel(keyBySignature(0), styleId);
    expect(built.chords).toHaveLength(CHORD_MAPS[styleId].length);
    expect(built.tones).toHaveLength(OCTAVES * STYLES[styleId].scale.length);
    expect([...built.tones]).toEqual([...built.tones].sort((a, b) => a - b));
    expect(pcOf(built.tones[0] ?? 0)).toBe(built.key.tonic);
  });
});

describe('chordAt, toneOf and noteOf', () => {
  it('return the chord and the tone', () => {
    expect(chordAt(model, model.home).label).toBe('C');
    expect(toneOf(model, 0)).toBe(24);
    expect(noteOf(model, model.home, 0)).toEqual({ chord: model.chords[model.home], midi: 24 });
  });

  it('reject what is not on the field', () => {
    expect(() => chordAt(model, model.map.length)).toThrow(RangeError);
    expect(() => toneOf(model, model.tones.length)).toThrow(RangeError);
  });
});
