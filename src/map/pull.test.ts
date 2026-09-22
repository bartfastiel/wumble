import { describe, expect, it } from 'vitest';
import { CHORD_MAPS, type MapChord, type RoleId } from '../theory/chord-maps';
import { STYLE_IDS } from '../theory/styles';
import { Memory, pullOf } from './pull';

const TONIC = 0;
const classical = CHORD_MAPS.classical;
const byRole = (role: RoleId): MapChord => {
  const chord = classical.find((candidate) => candidate.role === role);
  if (chord === undefined) throw new Error(`no ${role}`);
  return chord;
};
const tonic = byRole('tonic');
const dominant = byRole('dominant');
const subdominant = byRole('subdominant');
const parallel = classical.find((chord) => chord.role === 'parallel') ?? tonic;

describe('pullOf', () => {
  it('starts on the tonic when nothing has sounded yet', () => {
    expect(pullOf(tonic, { from: null, tonic: TONIC })).toBe(1);
    expect(pullOf(dominant, { from: null, tonic: TONIC })).toBeLessThan(1);
  });

  it('pulls hardest to itself', () => {
    expect(pullOf(tonic, { from: tonic, tonic: TONIC })).toBe(1);
  });

  it('follows the circle of fifths: V pulls to I more than to IV', () => {
    expect(pullOf(tonic, { from: dominant, tonic: TONIC })).toBeGreaterThan(
      pullOf(subdominant, { from: dominant, tonic: TONIC }),
    );
  });

  it('pulls home from anywhere', () => {
    for (const chord of classical) {
      if (chord === tonic) continue;
      expect(pullOf(tonic, { from: chord, tonic: TONIC })).toBeGreaterThan(0.3);
    }
  });

  it('prefers a near chord to a far one', () => {
    const far = classical.reduce((a, b) =>
      Math.abs(b.step - dominant.step) > Math.abs(a.step - dominant.step) ? b : a,
    );
    if (far === tonic) return;
    expect(pullOf(far, { from: dominant, tonic: TONIC })).toBeLessThan(1);
  });

  it.each(STYLE_IDS)('%s: every pull stays between 0.14 and 1', (styleId) => {
    const map = CHORD_MAPS[styleId];
    for (const from of map) {
      for (const to of map) {
        const value = pullOf(to, { from, tonic: TONIC });
        expect(value).toBeGreaterThanOrEqual(0.14);
        expect(value).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe('Memory', () => {
  it('counts what was played and lets it grow the pull', () => {
    const memory = new Memory();
    const plain = pullOf(parallel, { from: dominant, tonic: TONIC });
    for (let i = 0; i < 6; i++) {
      memory.remember(dominant);
      memory.remember(parallel);
    }
    expect(memory.seen(dominant, parallel)).toBeGreaterThan(0);
    expect(pullOf(parallel, { from: dominant, tonic: TONIC, memory })).toBeGreaterThan(plain);
  });

  it('forgets nothing that never happened', () => {
    const memory = new Memory();
    memory.remember(tonic);
    memory.remember(dominant);
    expect(memory.seen(dominant, tonic)).toBe(0);
    expect(memory.seen(tonic, dominant)).toBe(1);
  });

  it('breaks the chain at silence, so a pause is no transition', () => {
    const memory = new Memory();
    memory.remember(tonic);
    memory.remember(null);
    memory.remember(dominant);
    expect(memory.seen(tonic, dominant)).toBe(0);
  });

  it('fades old habits instead of keeping them forever', () => {
    const memory = new Memory(6);
    for (let i = 0; i < 4; i++) {
      memory.remember(tonic);
      memory.remember(dominant);
    }
    const early = memory.seen(tonic, dominant);
    for (let i = 0; i < 40; i++) {
      memory.remember(subdominant);
      memory.remember(parallel);
    }
    expect(memory.seen(tonic, dominant)).toBeLessThan(early);
    expect(memory.seen(subdominant, parallel)).toBeGreaterThan(0);
  });

  it('grows with diminishing returns, never past the cap', () => {
    const memory = new Memory(10_000);
    let previous = 0;
    for (let round = 0; round < 40; round++) {
      memory.remember(dominant);
      memory.remember(subdominant);
      const value = pullOf(subdominant, { from: dominant, tonic: TONIC, memory });
      expect(value).toBeGreaterThanOrEqual(previous - 1e-9);
      expect(value).toBeLessThanOrEqual(1);
      previous = value;
    }
  });
});
