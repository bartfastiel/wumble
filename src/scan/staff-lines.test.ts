import { describe, expect, it } from 'vitest';
import { binaryFromAscii } from './__fixtures__/ascii';
import { findStaves, groupStaves, lineAt, linesFromProfile, refineStaff, STRIPS } from './staff-lines';

const profileWithPeaks = (height: number, peaks: readonly number[], strength = 100): Float32Array => {
  const profile = new Float32Array(height);
  for (const y of peaks) {
    profile[y] = strength;
    profile[y + 1] = strength / 2;
  }
  return profile;
};

describe('linesFromProfile', () => {
  it('merges neighbouring rows to one line with a weighted centre', () => {
    const lines = linesFromProfile(profileWithPeaks(40, [10, 20]), 4);
    expect(lines).toHaveLength(2);
    expect(lines[0]?.y).toBeCloseTo(10 + 1 / 3);
    expect(lines[0]?.thickness).toBe(2);
  });

  it('ignores weak rows and wide bands', () => {
    const profile = profileWithPeaks(40, [10]);
    profile[30] = 30; // below 40 % of the strongest
    for (let y = 20; y < 26; y++) profile[y] = 80; // six rows thick
    expect(linesFromProfile(profile, 4).map((line) => Math.round(line.y))).toEqual([10]);
  });
});

describe('groupStaves', () => {
  const line = (y: number, thickness = 1): { y: number; thickness: number } => ({ y, thickness });
  const staffLines = (top: number, spacing: number): { y: number; thickness: number }[] =>
    [0, 1, 2, 3, 4].map((i) => line(top + i * spacing));

  it('takes five equidistant lines as a staff', () => {
    const staves = groupStaves(staffLines(100, 14));
    expect(staves).toHaveLength(1);
    expect(staves[0]).toEqual({ spacing: 14, thickness: 1, ys: [100, 114, 128, 142, 156] });
  });

  it('finds several staves and skips stray lines', () => {
    const staves = groupStaves([line(20), ...staffLines(100, 14), line(250), ...staffLines(300, 12)]);
    expect(staves.map((staff) => staff.spacing)).toEqual([14, 12]);
  });

  it('rejects uneven gaps and tiny spacings', () => {
    expect(groupStaves([line(100), line(114), line(128), line(150), line(164)])).toEqual([]);
    expect(groupStaves(staffLines(10, 3))).toEqual([]);
  });

  it('tolerates a fifth of the spacing', () => {
    expect(groupStaves([line(100), line(114), line(128), line(140), line(156)])).toHaveLength(1);
  });
});

describe('lineAt', () => {
  const points = new Float32Array([10, 12, 14, 16, 18, 20, 22, 24]);
  const width = 800;

  it('interpolates between the strip centres and holds the ends', () => {
    expect(lineAt(points, 50, width)).toBe(10);
    expect(lineAt(points, 100, width)).toBe(11);
    expect(lineAt(points, 799, width)).toBe(24);
  });
});

describe('refineStaff', () => {
  it('follows the ink per strip and keeps the prediction where no line is', () => {
    const width = STRIPS * 20;
    const rows = Array.from({ length: 30 }, () => '.'.repeat(width));
    // The second strip has its line two rows lower, the last strip has none
    rows[10] = '#'.repeat(20) + '.'.repeat(20) + '#'.repeat(width - 60) + '.'.repeat(20);
    rows[12] = '.'.repeat(20) + '#'.repeat(20) + '.'.repeat(width - 40);
    const image = binaryFromAscii(rows);
    const staff = refineStaff(image, { spacing: 5, thickness: 1, ys: [10, 15, 20, 25, 30] });
    expect([...staff.lines[0]]).toEqual([10, 12, 10, 10, 10, 10, 10, 10]);
    expect(staff.lines).toHaveLength(5);
  });
});

describe('findStaves', () => {
  it('reads staves from a profile and refines them on the image', () => {
    const width = 160;
    const rows = Array.from({ length: 80 }, () => '.'.repeat(width));
    for (const y of [20, 28, 36, 44, 52]) rows[y] = '#'.repeat(width);
    const staves = findStaves(profileWithPeaks(80, [20, 28, 36, 44, 52]), 4, binaryFromAscii(rows));
    expect(staves).toHaveLength(1);
    expect(staves[0]?.spacing).toBe(8);
    expect([...(staves[0]?.lines[4] ?? [])].every((y) => y === 52)).toBe(true);
  });
});
