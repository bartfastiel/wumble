import { describe, expect, it } from 'vitest';
import type { Fitness } from '../theory/fitness';
import { keyBySignature } from '../theory/keys';
import { buildModel } from '../theory/model';
import { CENTRE_MIDI, Field, FITNESS_WEIGHT, noise, registerWeight } from './geometry';

const BOX = { left: 0, right: 900, top: 0, bottom: 600 };
const model = buildModel(keyBySignature(0), 'classical');
const perOctave = model.style.scale.length;

const fieldOf = (tones: readonly number[] = model.tones): Field => {
  const field = new Field();
  field.layout(BOX, tones, perOctave);
  return field;
};
const widthAt = (field: Field, i: number, y: number): number => field.edgeAt(i + 1, y) - field.edgeAt(i, y);

describe('noise', () => {
  it('is stable and stays between 0 and 1, so a field looks the same in every session', () => {
    for (const seed of [0, 1, 7, 42, 1000]) {
      expect(noise(seed)).toBe(noise(seed));
      expect(noise(seed)).toBeGreaterThanOrEqual(0);
      expect(noise(seed)).toBeLessThan(1);
    }
    expect(noise(1)).not.toBe(noise(2));
  });
});

describe('registerWeight', () => {
  it('is widest in the middle of the field and never reaches zero at the edges', () => {
    expect(registerWeight(CENTRE_MIDI)).toBeCloseTo(1, 10);
    expect(registerWeight(CENTRE_MIDI - 24)).toBeLessThan(registerWeight(CENTRE_MIDI));
    expect(registerWeight(CENTRE_MIDI + 24)).toBeLessThan(registerWeight(CENTRE_MIDI));
    expect(registerWeight(24)).toBeGreaterThan(0.2);
    expect(registerWeight(120)).toBeGreaterThan(0.2);
    // Symmetrical around the centre: an octave below weighs like an octave above
    expect(registerWeight(CENTRE_MIDI - 12)).toBeCloseTo(registerWeight(CENTRE_MIDI + 12), 10);
  });
});

describe('Field.layout', () => {
  it('gives every tone a stripe and fills the box from left to right', () => {
    const field = fieldOf();
    expect(field.stripes).toHaveLength(model.tones.length);
    expect(field.edges).toHaveLength(model.tones.length + 1);
    expect(field.edges[0]?.x).toBe(BOX.left);
    expect(field.edges.at(-1)?.x).toBe(BOX.right);
    expect(field.stripes.map((stripe) => stripe.midi)).toEqual([...model.tones]);
  });

  it('numbers the scale degree within the octave, so the tonic is always step 0', () => {
    const field = fieldOf();
    expect(field.stripes[0]?.step).toBe(0);
    expect(field.stripes[perOctave]?.step).toBe(0);
    expect(field.stripes[1]?.step).toBe(1);
  });

  it('makes the middle octaves long and the outer ones short, all inside the box', () => {
    const field = fieldOf();
    const length = (i: number): number => (field.stripes[i]?.bottom ?? 0) - (field.stripes[i]?.top ?? 0);
    const middle = Math.floor(field.stripes.length / 2);
    expect(length(middle)).toBeGreaterThan(length(0));
    expect(length(middle)).toBeGreaterThan(length(field.stripes.length - 1));
    for (const stripe of field.stripes) {
      expect(stripe.top).toBeGreaterThanOrEqual(BOX.top);
      expect(stripe.bottom).toBeLessThanOrEqual(BOX.bottom);
      expect(stripe.bottom).toBeGreaterThan(stripe.top);
    }
  });

  it('copes with a single tone and with none at all', () => {
    expect(fieldOf([60]).stripes).toHaveLength(1);
    const empty = fieldOf([]);
    expect(empty.stripes).toEqual([]);
    expect(empty.at(10, 10)).toBeNull();
  });
});

describe('Field.breathe', () => {
  const fitnessOf = (value: Fitness): Fitness[] => model.tones.map(() => value);

  it('moves towards the wanted widths instead of jumping', () => {
    const field = fieldOf();
    const fitness = model.tones.map((_, i): Fitness => (i % 4) as Fitness);
    const before = field.stripes.map((stripe) => stripe.share);
    field.breathe(fitness, 0.016);
    const after = field.stripes.map((stripe) => stripe.share);
    expect(after).not.toEqual(before);
    // one frame moves only a fraction of the way
    for (const [i, share] of after.entries()) expect(Math.abs(share - (before[i] ?? 0))).toBeLessThan(0.02);
  });

  it('always shares the whole width out, whatever the fitness says', () => {
    const field = fieldOf();
    for (const value of [0, 1, 2, 3] as const) {
      for (let frame = 0; frame < 60; frame++) field.breathe(fitnessOf(value), 0.016);
      const total = field.stripes.reduce((sum, stripe) => sum + stripe.share, 0);
      expect(total).toBeCloseTo(1, 6);
    }
  });

  it('lets a carrying tone grow wider than a pulling one', () => {
    const field = fieldOf();
    const fitness = model.tones.map((_, i): Fitness => (i === 20 ? 0 : 3));
    for (let frame = 0; frame < 120; frame++) field.breathe(fitness, 0.016);
    const y = (field.stripes[20]?.top ?? 0) + 10;
    expect(widthAt(field, 20, y)).toBeGreaterThan(widthAt(field, 21, y));
    expect(FITNESS_WEIGHT[0]).toBeGreaterThan(FITNESS_WEIGHT[3]);
  });
});

describe('Field.edgeAt', () => {
  it('keeps the edges in order at every height, so no stripe ever overlaps its neighbour', () => {
    const field = fieldOf();
    const fitness = model.tones.map((_, i): Fitness => (i % 4) as Fitness);
    for (let frame = 0; frame < 120; frame++) field.breathe(fitness, 0.016);
    for (let y = BOX.top; y <= BOX.bottom; y += 10) {
      for (let i = 0; i < field.edges.length - 1; i++) {
        expect(field.edgeAt(i + 1, y)).toBeGreaterThanOrEqual(field.edgeAt(i, y));
      }
    }
  });

  it('leans the outer edges away from the middle', () => {
    const field = fieldOf();
    const lean = (i: number): number => field.edgeAt(i, BOX.bottom) - field.edgeAt(i, BOX.top);
    expect(lean(1)).toBeLessThan(lean(field.edges.length - 2));
  });

  it('answers outside the field with its left border', () => {
    const field = fieldOf();
    expect(field.edgeAt(-1, 100)).toBe(BOX.left);
    expect(field.edgeAt(field.edges.length, 100)).toBe(BOX.left);
  });
});

describe('Field.at', () => {
  it('finds the stripe under a point, and nothing beside the field', () => {
    const field = fieldOf();
    for (const i of [0, 10, 27, field.stripes.length - 1]) {
      const stripe = field.stripes[i];
      if (stripe === undefined) continue;
      const y = (stripe.top + stripe.bottom) / 2;
      const middle = (field.edgeAt(i, y) + field.edgeAt(i + 1, y)) / 2;
      expect(field.at(middle, y)).toBe(stripe);
    }
    expect(field.at(BOX.left - 50, 300)).toBeNull();
    expect(field.at(BOX.right + 50, 300)).toBeNull();
  });
});

describe('Field.airAt', () => {
  it('is airy at the top and woody at the bottom, clamped outside', () => {
    const field = fieldOf();
    expect(field.airAt(BOX.top)).toBe(1);
    expect(field.airAt(BOX.bottom)).toBe(0);
    expect(field.airAt((BOX.top + BOX.bottom) / 2)).toBeCloseTo(0.5, 10);
    expect(field.airAt(BOX.top - 100)).toBe(1);
    expect(field.airAt(BOX.bottom + 100)).toBe(0);
  });
});
