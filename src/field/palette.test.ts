import { describe, expect, it } from 'vitest';
import type { Fitness } from '../theory/fitness';
import { pcOf } from '../theory/pitch';
import { CENTRE_MIDI, cssOf, type Oklch, registerTilt, shade, toneColour } from './palette';

const FITNESSES: readonly Fitness[] = [0, 1, 2, 3];
const rgb = (colour: Oklch): [number, number, number] => {
  const match = /rgb\((\d+),(\d+),(\d+)\)/.exec(cssOf(colour));
  if (match === null) throw new Error(`not a colour: ${cssOf(colour)}`);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
};

describe('cssOf', () => {
  it('writes an rgb colour inside the byte range', () => {
    for (const l of [0, 0.3, 0.6, 0.9, 1]) {
      for (const c of [0, 0.05, 0.15]) {
        for (const h of [0, 90, 180, 270, 359]) {
          const [r, g, b] = rgb({ l, c, h });
          for (const value of [r, g, b]) {
            expect(Number.isInteger(value)).toBe(true);
            expect(value).toBeGreaterThanOrEqual(0);
            expect(value).toBeLessThanOrEqual(255);
          }
        }
      }
    }
  });

  it('turns grey without chroma, black at zero and white at one', () => {
    const grey = rgb({ l: 0.5, c: 0, h: 120 });
    expect(new Set(grey).size).toBe(1);
    expect(rgb({ l: 0, c: 0, h: 0 })).toEqual([0, 0, 0]);
    expect(rgb({ l: 1, c: 0, h: 0 })).toEqual([255, 255, 255]);
  });

  it('is brighter the higher the lightness', () => {
    const sum = (colour: Oklch): number => rgb(colour).reduce((a, b) => a + b, 0);
    expect(sum({ l: 0.7, c: 0.05, h: 100 })).toBeGreaterThan(sum({ l: 0.4, c: 0.05, h: 100 }));
  });
});

describe('registerTilt', () => {
  it('is level in the middle and clamped at the ends', () => {
    expect(registerTilt(CENTRE_MIDI)).toBe(0);
    expect(registerTilt(CENTRE_MIDI + 12)).toBeCloseTo(0.5, 10);
    expect(registerTilt(CENTRE_MIDI - 12)).toBeCloseTo(-0.5, 10);
    expect(registerTilt(200)).toBeCloseTo(1.2, 12);
    expect(registerTilt(-200)).toBeCloseTo(-1.2, 12);
  });
});

describe('toneColour', () => {
  it('walks the hue from warm to cool as a tone pulls more', () => {
    const hues = FITNESSES.map((fitness) => toneColour(fitness, 0, 60).h);
    expect([...hues]).toEqual([...hues].sort((a, b) => a - b));
    expect((hues.at(-1) ?? 0) - (hues[0] ?? 0)).toBeGreaterThan(100); // carrying and pulling are clearly apart
  });

  it('is most colourful where a tone carries and almost grey where it pulls', () => {
    const chromas = FITNESSES.map((fitness) => toneColour(fitness, 0, 60).c);
    expect([...chromas]).toEqual([...chromas].sort((a, b) => b - a));
    expect(chromas.at(-1) ?? 1).toBeLessThan(0.05);
  });

  it('lightens with the register, so high tones look lighter than low ones', () => {
    expect(toneColour(0, 0, 84).l).toBeGreaterThan(toneColour(0, 0, 48).l);
  });

  it('holds back a tone that is neither the tonic nor pressed', () => {
    const plain = toneColour(1, 0, 60);
    const held = toneColour(1, 0, 60, { held: true });
    const base = toneColour(1, 0, 60, { base: true });
    expect(held.l).toBeGreaterThan(plain.l);
    expect(held.c).toBeGreaterThan(plain.c);
    expect(base.l).toBe(held.l);
    expect(toneColour(1, 0, 60, { held: true, lift: 0.1 }).l).toBeCloseTo(held.l + 0.1, 10);
  });

  it('nudges the hue by pitch class, enough to tell two stripes apart', () => {
    const hues = Array.from({ length: 12 }, (_, pc) => toneColour(2, pcOf(pc), 60).h);
    expect(new Set(hues).size).toBe(12);
    const spread = Math.max(...hues) - Math.min(...hues);
    expect(spread).toBeLessThan(20); // a nudge, not a rainbow
  });

  it('stays inside the visible range for every tone of every fitness', () => {
    for (const fitness of FITNESSES) {
      for (let midi = 24; midi <= 120; midi++) {
        const colour = toneColour(fitness, pcOf(midi), midi, { held: true, lift: 0.15 });
        expect(colour.l).toBeGreaterThan(0);
        expect(colour.l).toBeLessThan(1);
        expect(() => rgb(colour)).not.toThrow();
      }
    }
  });
});

describe('toneColour in the polished look', () => {
  it('says fitness with brightness alone: what carries is bright, what pulls is deep', () => {
    const light = FITNESSES.map((fitness) => toneColour(fitness, pcOf(60), 60, { look: 'polished' }));
    for (let i = 1; i < light.length; i++) expect(light[i]?.l).toBeLessThan(light[i - 1]?.l ?? 0);
    expect(light[0]?.l).toBeGreaterThan(0.9); // white lacquer
  });

  it('keeps one cool hue and almost no colour, whatever the tone', () => {
    for (const midi of [36, 60, 84, 108]) {
      for (const fitness of FITNESSES) {
        const colour = toneColour(fitness, pcOf(midi), midi, { look: 'polished' });
        expect(colour.h).toBe(toneColour(0, pcOf(60), 60, { look: 'polished' }).h);
        expect(colour.c).toBeLessThan(0.06);
        expect(() => rgb(colour)).not.toThrow();
      }
    }
  });

  it('brightens a held tone instead of colouring it', () => {
    const calm = toneColour(0, pcOf(65), 65, { look: 'polished' });
    const held = toneColour(0, pcOf(65), 65, { look: 'polished', held: true, lift: 0.02 });
    expect(held.l).toBeGreaterThan(calm.l);
    expect(held.h).toBe(calm.h);
  });
});

describe('shade', () => {
  it('lightens, darkens and turns the hue, never leaving the range', () => {
    const colour = { l: 0.5, c: 0.1, h: 100 };
    expect(shade(colour, 0.2)).toEqual({ l: 0.7, c: 0.1, h: 100 });
    expect(shade(colour, -0.2, 0.5, 10)).toEqual({ l: 0.3, c: 0.05, h: 110 });
    expect(shade(colour, 5).l).toBeCloseTo(0.94, 12);
    expect(shade(colour, -5).l).toBeCloseTo(0.06, 12);
    expect(shade(colour, 0, -1).c).toBe(0);
  });
});
