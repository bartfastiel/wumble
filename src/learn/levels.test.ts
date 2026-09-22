import { describe, expect, it } from 'vitest';
import { RECORDED } from './__fixtures__/recorded';
import { awardPoints, LEVEL_IDS, LEVELS, learnVisibility, WRONG_PENALTY, WRONG_THROTTLE_MS } from './levels';

describe('LEVELS', () => {
  it('carry their delays, fades, factors and ring flags', () => {
    expect(LEVEL_IDS).toEqual(['easy', 'medium', 'hard']);
    for (const id of LEVEL_IDS) {
      const level = RECORDED.levels[id];
      const ours = LEVELS[id];
      expect(ours.delay).toBe(level?.delay ?? 0);
      expect(ours.fade).toBe(level?.fade ?? 0);
      expect(ours.factor).toBe(level?.factor ?? 0);
      expect(ours.rings).toBe(level?.rings ?? true);
    }
    expect(WRONG_PENALTY).toBe(-100);
    expect(WRONG_THROTTLE_MS).toBe(300);
  });
});

describe('learnVisibility', () => {
  it('fades as recorded for a tone that started at 0 ms', () => {
    const { times } = RECORDED.visibility;
    for (const id of LEVEL_IDS) {
      expect(times.map((now) => learnVisibility(LEVELS[id], 0, now))).toEqual(RECORDED.visibility[id]);
    }
  });

  it('counts from the start of the tone', () => {
    expect(learnVisibility(LEVELS.medium, 5000, 5400)).toBe(0);
    expect(learnVisibility(LEVELS.medium, 5000, 6000)).toBe(0.5);
    expect(learnVisibility(LEVELS.hard, 5000, 7200)).toBe(1);
  });
});

describe('awardPoints', () => {
  it('pays 10 for a visible dot, up to 100 for an invisible one, doubled in hard', () => {
    expect(awardPoints(LEVELS.easy, 0)).toBe(0);
    expect(awardPoints(LEVELS.medium, 1)).toBe(10);
    expect(awardPoints(LEVELS.medium, 0)).toBe(100);
    expect(awardPoints(LEVELS.medium, 0.5)).toBe(55);
    expect(awardPoints(LEVELS.medium, 0.25)).toBe(78);
    expect(awardPoints(LEVELS.hard, 0)).toBe(200);
    expect(awardPoints(LEVELS.hard, 1)).toBe(20);
  });
});
