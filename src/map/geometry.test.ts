import { describe, expect, it } from 'vitest';
import { CHORD_MAPS, type MapChord } from '../theory/chord-maps';
import { STYLE_IDS } from '../theory/styles';
import { breatheMap, layoutMap, type MapSpot, spotAt } from './geometry';

const BOX = { width: 320, height: 620, top: 56 };
const classical = CHORD_MAPS.classical;
const distance = (a: MapSpot, b: MapSpot): number => Math.hypot(a.x - b.x, a.y - b.y);
const spotOf = (spots: readonly MapSpot[], chord: MapChord): MapSpot => {
  const spot = spots.find((candidate) => candidate.chord === chord);
  if (spot === undefined) throw new Error('chord not on the map');
  return spot;
};

describe('layoutMap', () => {
  it('lays out one spot per chord of the map, and nothing else', () => {
    const spots = layoutMap(classical, BOX);
    expect(spots).toHaveLength(classical.length);
    expect(spots.map((spot) => spot.chord)).toEqual([...classical]);
  });

  it.each(STYLE_IDS)('%s: every spot stays inside the box and clear of its neighbours', (styleId) => {
    const spots = layoutMap(CHORD_MAPS[styleId], BOX);
    for (const spot of spots) {
      expect(spot.x).toBeGreaterThanOrEqual(0);
      expect(spot.x).toBeLessThanOrEqual(BOX.width);
      expect(spot.y).toBeGreaterThanOrEqual(BOX.top);
      expect(spot.y).toBeLessThanOrEqual(BOX.height);
      expect(spot.limit).toBeGreaterThan(0);
      expect(spot.limit).toBeLessThanOrEqual(spot.base);
    }
    // the limits are capped so that two spots at full size still cannot touch
    for (const [i, a] of spots.entries()) {
      for (const b of spots.slice(i + 1)) expect(a.limit + b.limit).toBeLessThanOrEqual(distance(a, b) + 1e-9);
    }
  });

  it('puts pull on the vertical axis: what leads home lies above the tonic', () => {
    const spots = layoutMap(classical, BOX);
    const tonic = classical.find((chord) => chord.step === 0 && chord.side === 0);
    const dominant = classical.find((chord) => chord.role === 'dominant');
    const subdominant = classical.find((chord) => chord.role === 'subdominant');
    if (tonic === undefined || dominant === undefined || subdominant === undefined) throw new Error('no map');
    expect(spotOf(spots, dominant).y).toBeLessThan(spotOf(spots, tonic).y);
    expect(spotOf(spots, subdominant).y).toBeGreaterThan(spotOf(spots, tonic).y);
  });

  it('puts substitutes beside their chord, not on the axis', () => {
    const spots = layoutMap(classical, BOX);
    const axis = spots.filter((spot) => spot.chord.side === 0).map((spot) => spot.x);
    const beside = classical.filter((chord) => chord.side !== 0);
    const middle = axis.reduce((sum, x) => sum + x, 0) / axis.length;
    for (const chord of beside) {
      const spot = spotOf(spots, chord);
      expect(Math.sign(spot.x - middle)).toBe(Math.sign(chord.side));
    }
  });

  it('lays out the same map the same way every time', () => {
    expect(layoutMap(classical, BOX)).toEqual(layoutMap(classical, BOX));
  });

  it('copes with a narrow box', () => {
    const spots = layoutMap(classical, { width: 140, height: 300, top: 20 });
    for (const spot of spots) expect(spot.limit).toBeGreaterThan(0);
  });
});

describe('layoutMap: the built look', () => {
  it('puts the map in three columns, nothing overlapping, nothing outside the box', () => {
    const spots = layoutMap(classical, BOX, 'precise');
    const columns = [...new Set(spots.map((spot) => Math.round(spot.x)))].sort((a, b) => a - b);
    expect(columns).toHaveLength(3); // the far side, the axis, the substitutes
    for (const spot of spots) {
      expect(spot.x - spot.limit).toBeGreaterThanOrEqual(-1);
      expect(spot.x + spot.limit).toBeLessThanOrEqual(BOX.width + 1);
    }
    for (const [i, a] of spots.entries()) {
      for (const b of spots.slice(i + 1)) expect(a.limit + b.limit).toBeLessThanOrEqual(distance(a, b) + 1e-9);
    }
  });

  it('lines the chords of a pull step up at the same height', () => {
    const spots = layoutMap(classical, BOX, 'precise');
    const byStep = new Map<number, number[]>();
    for (const spot of spots) byStep.set(spot.chord.step, [...(byStep.get(spot.chord.step) ?? []), spot.y]);
    for (const heights of byStep.values()) expect(new Set(heights.map((y) => Math.round(y))).size).toBe(1);
  });

  it('reports movement while it breathes, and stops when it has arrived', () => {
    const spots = layoutMap(classical, BOX);
    expect(breatheMap(spots, spots[0] ?? null, () => 0.5, 0.016)).toBe(true);
    for (let frame = 0; frame < 400 && breatheMap(spots, spots[0] ?? null, () => 0.5, 0.016); frame++);
    expect(breatheMap(spots, spots[0] ?? null, () => 0.5, 0.016)).toBe(false);
  });
});

describe('breatheMap', () => {
  it('grows the chosen chord and never past the limit', () => {
    const spots = layoutMap(classical, BOX);
    const chosen = spots[0];
    if (chosen === undefined) throw new Error('empty map');
    for (let frame = 0; frame < 200; frame++) breatheMap(spots, chosen, () => 0, 0.016);
    expect(chosen.radius).toBeGreaterThan(spots[1]?.radius ?? 0);
    // even at full size two spots cannot touch: the radius stays within 1.16 of a capped limit
    for (const spot of spots) expect(spot.radius).toBeLessThanOrEqual(spot.limit * 1.17);
  });

  it('lets a strong pull grow a chord, a weak one shrink it', () => {
    const spots = layoutMap(classical, BOX);
    const strong = spots[1];
    const weak = spots[2];
    if (strong === undefined || weak === undefined) throw new Error('empty map');
    for (let frame = 0; frame < 200; frame++) {
      breatheMap(spots, null, (spot) => (spot === strong ? 1 : 0), 0.016);
    }
    expect(strong.radius / strong.limit).toBeGreaterThan(weak.radius / weak.limit);
  });

  it('moves gently: one frame changes a radius only a little', () => {
    const spots = layoutMap(classical, BOX);
    const before = spots.map((spot) => spot.radius);
    breatheMap(spots, spots[0] ?? null, () => 1, 0.016);
    for (const [i, spot] of spots.entries()) expect(Math.abs(spot.radius - (before[i] ?? 0))).toBeLessThan(5);
  });
});

describe('spotAt', () => {
  it('finds the spot under a point and nothing in the gaps', () => {
    const spots = layoutMap(classical, BOX);
    for (const spot of spots) expect(spotAt(spots, spot.x, spot.y)).toBe(spot);
    expect(spotAt(spots, -100, -100)).toBeNull();
    expect(spotAt(spots, BOX.width + 200, BOX.height + 200)).toBeNull();
  });
});
