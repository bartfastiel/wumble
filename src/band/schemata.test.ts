import { describe, expect, it } from 'vitest';
import { setLocale, t } from '../i18n';
import { keyBySignature } from '../theory/keys';
import { buildModel } from '../theory/model';
import { STYLE_IDS } from '../theory/styles';
import { pcOf } from '../theory/pitch';
import { RECORDED } from './__fixtures__/recorded';
import { chordByOffset, SCHEMA_IDS, SCHEMATA, schemaChord } from './schemata';

describe('SCHEMATA', () => {
  it('are six, each a chain of degree offsets', () => {
    expect(Object.keys(RECORDED.tables.SCHEMATA)).toEqual([...SCHEMA_IDS]);
    for (const id of SCHEMA_IDS) expect(SCHEMATA[id].bars).toEqual(RECORDED.tables.SCHEMATA[id]);
  });

  it('have a name and a hint in every locale', () => {
    for (const locale of ['de', 'en'] as const) {
      setLocale(locale);
      for (const id of SCHEMA_IDS) {
        expect(t(`band.schema.${id}.name`)).not.toBe(`band.schema.${id}.name`);
        expect(t(`band.schema.${id}.hint`)).not.toBe(`band.schema.${id}.hint`);
      }
    }
  });
});

describe('chordByOffset', () => {
  it.each(STYLE_IDS)('%s picks the chord on the offset where the map has one', (styleId) => {
    const model = buildModel(keyBySignature(0), styleId);
    for (const [row, chord] of model.chords.entries()) {
      const found = chordByOffset(model, chord.offset);
      expect(model.chords[found]?.offset).toBe(chord.offset);
      expect(row).toBeGreaterThanOrEqual(0);
    }
  });

  it.each(STYLE_IDS)('%s falls back to the nearest root for an offset it has not got', (styleId) => {
    const model = buildModel(keyBySignature(0), styleId);
    const roots = new Set<number>(model.chords.map((chord) => chord.offset));
    for (let offset = 0; offset < 12; offset++) {
      const found = model.chords[chordByOffset(model, offset)];
      expect(found).toBeDefined();
      if (roots.has(offset)) continue;
      const distance = (a: number, b: number): number => {
        const up = pcOf(a - b);
        return Math.min(up, 12 - up);
      };
      const best = Math.min(...[...roots].map((root) => distance(root, offset)));
      expect(distance(found?.offset ?? 0, offset)).toBe(best);
    }
  });

  it('stays on the tonic when nothing is nearer', () => {
    const model = buildModel(keyBySignature(0), 'wholeTone');
    expect(chordByOffset(model, 0)).toBe(model.home);
  });
});

describe('schemaChord', () => {
  it('follows the play when the schema has no bars', () => {
    const model = buildModel(keyBySignature(0), 'classical');
    expect(schemaChord(model, SCHEMATA.follow, 0)).toBeNull();
  });

  it.each(SCHEMA_IDS.filter((id) => SCHEMATA[id].bars !== null))('%s walks its bars in a circle', (id) => {
    const model = buildModel(keyBySignature(0), 'classical');
    const bars = SCHEMATA[id].bars ?? [];
    for (const [bar, offset] of bars.entries()) {
      expect(schemaChord(model, SCHEMATA[id], bar)).toBe(chordByOffset(model, offset));
      expect(schemaChord(model, SCHEMATA[id], bar + bars.length)).toBe(schemaChord(model, SCHEMATA[id], bar));
    }
  });

  it.each(STYLE_IDS)('%s answers every bar of every schema with a chord it has', (styleId) => {
    const model = buildModel(keyBySignature(0), styleId);
    for (const id of SCHEMA_IDS) {
      const bars = SCHEMATA[id].bars;
      if (bars === null) continue;
      for (let bar = 0; bar < bars.length; bar++) {
        const row = schemaChord(model, SCHEMATA[id], bar);
        expect(row === null || model.chords[row] !== undefined).toBe(true);
      }
    }
  });
});
