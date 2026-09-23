import { describe, expect, it } from 'vitest';
import { LEVELS } from './levels';
import type { PlacedNote } from './learn-spot';
import { THREAD_LENGTH, threadFrom, threadRise } from './thread';

const placed = (count: number): PlacedNote[] =>
  Array.from({ length: count }, (_, i) => ({
    spot: { chord: 0, tone: i },
    note: { midi: 60 + i, beats: 1 },
  })) as PlacedNote[];

describe('threadFrom', () => {
  it('shows the way ahead where the level allows it', () => {
    const steps = threadFrom(placed(20), 3, LEVELS.easy);
    expect(steps).toHaveLength(THREAD_LENGTH);
    expect(steps[0]?.pos).toBe(3);
    expect(steps.at(-1)?.pos).toBe(3 + THREAD_LENGTH - 1);
  });

  it('shows only where the hand is when a level holds the way back', () => {
    expect(threadFrom(placed(20), 3, LEVELS.medium)).toHaveLength(1);
    expect(threadFrom(placed(20), 3, LEVELS.hard)).toHaveLength(1);
  });

  it('stops at the end of the song', () => {
    expect(threadFrom(placed(5), 3, LEVELS.easy)).toHaveLength(2);
    expect(threadFrom(placed(5), 5, LEVELS.easy)).toEqual([]);
  });
});

describe('threadRise', () => {
  it('starts at the hand and climbs by the length of every tone', () => {
    const steps = threadFrom(placed(4), 0, LEVELS.easy);
    const rises = threadRise(steps);
    expect(rises[0]).toBe(0);
    for (let i = 1; i < rises.length; i++) expect(rises[i]).toBeGreaterThan(rises[i - 1] ?? 0);
  });

  it('gives a long tone a longer leg than a short one, but not four times as long', () => {
    const one = threadRise([
      { spot: { chord: 0, tone: 0 }, beats: 1, pos: 0 },
      { spot: { chord: 0, tone: 1 }, beats: 1, pos: 1 },
    ]);
    const four = threadRise([
      { spot: { chord: 0, tone: 0 }, beats: 4, pos: 0 },
      { spot: { chord: 0, tone: 1 }, beats: 1, pos: 1 },
    ]);
    const short = one[1] ?? 0;
    const long = four[1] ?? 0;
    expect(long).toBeGreaterThan(short);
    expect(long).toBeLessThan(short * 4);
  });
});
