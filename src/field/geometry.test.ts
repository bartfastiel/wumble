import { describe, expect, it } from 'vitest';
import type { Fitness } from '../theory/fitness';
import { keyBySignature } from '../theory/keys';
import { buildModel } from '../theory/model';
import { Field, FITNESS_WEIGHT, FOCUS_STEPS, focusReach, focusWeight, noise } from './geometry';

const BOX = { left: 0, right: 900, top: 0, bottom: 600 };
const model = buildModel(keyBySignature(0), 'classical');
const perOctave = model.style.scale.length;
const EVEN: Fitness[] = model.tones.map(() => 2);

const fieldOf = (tones: readonly number[] = model.tones, focus?: number): Field => {
  const field = new Field();
  field.layout(BOX, tones, perOctave, focus);
  return field;
};
const widthAt = (field: Field, i: number, y: number): number => field.edgeAt(i + 1, y) - field.edgeAt(i, y);
const settled = (field: Field, fitness: readonly Fitness[] = EVEN): Field => {
  for (let frame = 0; frame < 400 && field.breathe(fitness, 0.016); frame++);
  return field;
};

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

describe('focusWeight', () => {
  it('is widest at the focus and never reaches zero further out', () => {
    expect(focusWeight(0)).toBeCloseTo(1, 10);
    expect(focusWeight(FOCUS_STEPS)).toBeLessThan(focusWeight(0));
    expect(focusWeight(40)).toBeGreaterThan(0.2);
    expect(focusWeight(-40)).toBeGreaterThan(0.2);
    // Symmetrical: the same distance below and above weighs the same
    expect(focusWeight(-7)).toBeCloseTo(focusWeight(7), 10);
  });
});

describe('focusReach', () => {
  it('opens fully on a wide field and narrows on a phone, so the focused tones stay big enough to hit', () => {
    expect(focusReach(2000)).toBe(FOCUS_STEPS);
    expect(focusReach(900)).toBe(FOCUS_STEPS);
    const narrow = focusReach(250);
    expect(narrow).toBeLessThan(FOCUS_STEPS);
    expect(narrow).toBeGreaterThanOrEqual(4);
    expect(focusReach(40)).toBe(4); // never so tight that only one tone is left
    expect(focusReach(400)).toBeGreaterThan(focusReach(250));
  });

  it('makes the tone in focus take a bigger share when there is less width', () => {
    const share = (width: number): number => {
      const field = new Field();
      field.layout({ ...BOX, right: width }, model.tones, perOctave, 20);
      return settled(field).stripes[20]?.share ?? 0;
    };
    expect(share(250)).toBeGreaterThan(share(900));
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

  it('makes the stripes around the focus long and the outer ones short, all inside the box', () => {
    const field = fieldOf(model.tones, 21);
    const length = (i: number): number => (field.stripes[i]?.bottom ?? 0) - (field.stripes[i]?.top ?? 0);
    expect(length(21)).toBeGreaterThan(length(0));
    expect(length(21)).toBeGreaterThan(length(field.stripes.length - 1));
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

describe('Field: sliding the focus', () => {
  it('opens on the octave that holds a given tone', () => {
    const field = fieldOf();
    const focus = field.octaveOf(60);
    expect(focus % perOctave).toBe(0);
    expect(Math.abs((field.stripes[focus]?.midi ?? 0) - 60)).toBeLessThanOrEqual(6);
  });

  it('follows the finger at once and snaps to an octave when it lifts', () => {
    const field = fieldOf(model.tones, 21);
    field.slide(3.4);
    expect(field.settling).toBeCloseTo(24.4, 10);
    expect(field.focus).toBeCloseTo(24.4, 10); // no lag while the finger drags
    field.release();
    expect(field.settling % perOctave).toBe(0);
    expect(field.settling).toBe(21); // 24.4 is still nearest to the octave it came from
  });

  it('glides to the octave instead of jumping there', () => {
    const field = settled(fieldOf(model.tones, 21));
    field.slide(6);
    field.release();
    const target = field.settling;
    field.breathe(EVEN, 0.016);
    expect(field.focus).not.toBe(target);
    expect(Math.abs(field.focus - target)).toBeLessThan(6);
    settled(field);
    expect(field.focus).toBe(target);
  });

  it('never slides past the ends of the field', () => {
    const field = fieldOf(model.tones, 21);
    field.slide(-500);
    expect(field.settling).toBe(0);
    field.slide(5000);
    expect(field.settling).toBe(model.tones.length - 1);
    field.release();
    expect(field.settling).toBeLessThanOrEqual(model.tones.length - 1);
  });

  it('moves the widest stripes to wherever the focus went', () => {
    const low = settled(fieldOf(model.tones, 7));
    const high = settled(fieldOf(model.tones, 42));
    const widthOf = (field: Field, i: number): number => {
      const stripe = field.stripes[i];
      return stripe === undefined ? 0 : widthAt(field, i, (stripe.top + stripe.bottom) / 2);
    };
    expect(widthOf(low, 7)).toBeGreaterThan(widthOf(high, 7));
    expect(widthOf(high, 42)).toBeGreaterThan(widthOf(low, 42));
  });
});

describe('Field.breathe', () => {
  it('reports movement until it has arrived, so the canvas knows when to draw', () => {
    const field = fieldOf(model.tones, 21);
    expect(field.breathe(EVEN, 0.016)).toBe(true);
    settled(field);
    expect(field.breathe(EVEN, 0.016)).toBe(false);
    field.slide(7);
    field.release();
    expect(field.breathe(EVEN, 0.016)).toBe(true);
  });

  it('moves towards the wanted widths instead of jumping', () => {
    const field = fieldOf();
    const fitness = model.tones.map((_, i): Fitness => (i % 4) as Fitness);
    const before = field.stripes.map((stripe) => stripe.share);
    field.breathe(fitness, 0.016);
    const after = field.stripes.map((stripe) => stripe.share);
    expect(after).not.toEqual(before);
    for (const [i, share] of after.entries()) expect(Math.abs(share - (before[i] ?? 0))).toBeLessThan(0.02);
  });

  it('always shares the whole width out, whatever the fitness says', () => {
    const field = fieldOf();
    for (const value of [0, 1, 2, 3] as const) {
      settled(
        field,
        model.tones.map(() => value),
      );
      const total = field.stripes.reduce((sum, stripe) => sum + stripe.share, 0);
      expect(total).toBeCloseTo(1, 6);
    }
  });

  it('lets a carrying tone grow wider than a pulling one', () => {
    const field = fieldOf(model.tones, 20);
    const fitness = model.tones.map((_, i): Fitness => (i === 20 ? 0 : 3));
    settled(field, fitness);
    const y = (field.stripes[20]?.top ?? 0) + 10;
    expect(widthAt(field, 20, y)).toBeGreaterThan(widthAt(field, 21, y));
    expect(FITNESS_WEIGHT[0]).toBeGreaterThan(FITNESS_WEIGHT[3]);
  });
});

describe('Field.edgeAt', () => {
  it('keeps the edges in order at every height, so no stripe ever overlaps its neighbour', () => {
    const field = fieldOf();
    const fitness = model.tones.map((_, i): Fitness => (i % 4) as Fitness);
    settled(field, fitness);
    for (let y = BOX.top; y <= BOX.bottom; y += 10) {
      for (let i = 0; i < field.edges.length - 1; i++) {
        expect(field.edgeAt(i + 1, y)).toBeGreaterThanOrEqual(field.edgeAt(i, y));
      }
    }
  });

  it('leans the outer edges away from the focus', () => {
    const field = fieldOf(model.tones, 28);
    const lean = (i: number): number => field.edgeAt(i, BOX.bottom) - field.edgeAt(i, BOX.top);
    expect(lean(1)).toBeLessThan(lean(field.edges.length - 2));
  });

  it('ties the tilt to the room beside it: the narrower the stripes, the more upright they stand', () => {
    const drifts = [900, 250].map((right) => {
      const field = new Field();
      field.layout({ ...BOX, right }, model.tones, perOctave, 20);
      settled(field);
      const span = BOX.bottom - BOX.top;
      for (const [j, edge] of field.edges.entries()) {
        const before = edge.x - (field.edges[j - 1]?.x ?? Number.NEGATIVE_INFINITY);
        const after = (field.edges[j + 1]?.x ?? Number.POSITIVE_INFINITY) - edge.x;
        expect(Math.abs(edge.lean) * span).toBeLessThanOrEqual(Math.min(before, after) + 0.001);
      }
      return Math.max(...field.edges.map((edge) => Math.abs(edge.lean))) * span;
    });
    expect(drifts[1] ?? 0).toBeLessThan(drifts[0] ?? 0);
  });

  it('answers outside the field with its left border', () => {
    const field = fieldOf();
    expect(field.edgeAt(-1, 100)).toBe(BOX.left);
    expect(field.edgeAt(field.edges.length, 100)).toBe(BOX.left);
  });
});

describe('Field: the built look', () => {
  it('draws the stripes upright, evenly and without waves', () => {
    const field = new Field();
    field.look = 'precise';
    field.layout(BOX, model.tones, perOctave, 21);
    settled(field);
    for (const [i, stripe] of field.stripes.entries()) {
      expect(field.edgeAt(i, stripe.top)).toBeCloseTo(field.edgeAt(i, stripe.bottom), 9);
    }
    // symmetrical around the focus: the same distance left and right gives the same height
    const height = (i: number): number => (field.stripes[i]?.bottom ?? 0) - (field.stripes[i]?.top ?? 0);
    expect(height(21 - 5)).toBeCloseTo(height(21 + 5), 6);
    const middle = (BOX.top + BOX.bottom) / 2;
    for (const stripe of field.stripes) expect((stripe.top + stripe.bottom) / 2).toBeCloseTo(middle, 6);
  });

  it('still keeps the stripes apart', () => {
    const field = new Field();
    field.look = 'precise';
    field.layout(BOX, model.tones, perOctave, 21);
    settled(field);
    for (let y = BOX.top; y <= BOX.bottom; y += 25) {
      for (let i = 0; i < field.edges.length - 1; i++) {
        expect(field.edgeAt(i + 1, y)).toBeGreaterThanOrEqual(field.edgeAt(i, y));
      }
    }
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
