import { describe, expect, it } from 'vitest';
import { asciiFromBinary, binaryFromAscii } from './__fixtures__/ascii';
import { removeLedgerLines, removeStaffLines, removeStems } from './cleanup';
import { type Five, type Staff, STRIPS } from './staff-lines';

const level = (y: number): Float32Array => new Float32Array(STRIPS).fill(y);
const staffWithLines = (ys: Five<number>, spacing: number, thickness = 1): Staff => ({
  spacing,
  thickness,
  ys,
  lines: [level(ys[0]), level(ys[1]), level(ys[2]), level(ys[3]), level(ys[4])],
});

describe('removeStaffLines', () => {
  it('clears the line but not the head sitting on it', () => {
    const rows = [
      '..............................',
      '..........#####...............',
      '..........#####...............',
      '##############################',
      '..........#####...............',
      '..........#####...............',
      '..............................',
    ];
    const image = binaryFromAscii(rows);
    removeStaffLines(image, [staffWithLines([3, 13, 23, 33, 43], 10)]);
    expect(asciiFromBinary(image)).toEqual([
      '..............................',
      '..........#####...............',
      '..........#####...............',
      '..........#####...............',
      '..........#####...............',
      '..........#####...............',
      '..............................',
    ]);
  });

  it('follows a line that bends across the strips', () => {
    const width = STRIPS * 4;
    const rows = Array.from({ length: 8 }, () => '.'.repeat(width));
    rows[2] = '#'.repeat(width / 2) + '.'.repeat(width / 2);
    rows[4] = '.'.repeat(width / 2) + '#'.repeat(width / 2);
    const image = binaryFromAscii(rows);
    const points = new Float32Array([2, 2, 2, 2, 4, 4, 4, 4]);
    const far = level(100); // the other four lines lie outside the image
    removeStaffLines(image, [
      { spacing: 10, thickness: 1, ys: [2, 100, 100, 100, 100], lines: [points, far, far, far, far] },
    ]);
    expect(asciiFromBinary(image).every((row) => !row.includes('#'))).toBe(true);
  });
});

describe('removeLedgerLines', () => {
  it('drops long thin runs and keeps short ones and thick objects', () => {
    const image = binaryFromAscii([
      '..............................',
      '....####################......',
      '..............................',
      '....####......................',
      '..............................',
      '..######################......',
      '..######################......',
      '..######################......',
      '..............................',
    ]);
    removeLedgerLines(image, 8, 2);
    expect(asciiFromBinary(image)).toEqual([
      '..............................',
      '..............................',
      '..............................',
      '....####......................',
      '..............................',
      '..######################......',
      '..######################......',
      '..######################......',
      '..............................',
    ]);
  });
});

describe('removeStems', () => {
  it('removes the stem, keeps the filled head and records the stem', () => {
    const image = binaryFromAscii([
      '.......#........',
      '.......#........',
      '.......#........',
      '.......#........',
      '.......#........',
      '.......#........',
      '.......#........',
      '.......#........',
      '.......#........',
      '.......#........',
      '.......#........',
      '.......#........',
      '..######........',
      '..######........',
      '..######........',
      '..######........',
    ]);
    const stems = removeStems(image, 8, 1);
    const ascii = asciiFromBinary(image);
    expect(ascii.slice(0, 12).every((row) => !row.includes('#'))).toBe(true);
    expect(ascii.slice(12)).toEqual(['..######........', '..######........', '..######........', '..######........']);
    expect(stems).toEqual([{ x: 7, y0: 0, y1: 16 }]);
  });

  it('keeps the narrow sides of a hollow head together with its wide rows', () => {
    const image = binaryFromAscii([
      '.........#......',
      '.........#......',
      '.........#......',
      '.........#......',
      '.........#......',
      '.........#......',
      '.........#......',
      '.........#......',
      '.........#......',
      '.........#......',
      '..########......',
      '..#......#......',
      '..#......#......',
      '..#......#......',
      '..########......',
    ]);
    const stems = removeStems(image, 8, 1);
    expect(asciiFromBinary(image).slice(10)).toEqual([
      '..########......',
      '..#......#......',
      '..#......#......',
      '..#......#......',
      '..########......',
    ]);
    expect(stems.map((stem) => stem.x)).toEqual([9]);
  });

  it('leaves short vertical runs alone', () => {
    const image = binaryFromAscii(['....#....', '....#....', '....#....', '.........']);
    expect(removeStems(image, 8, 1)).toEqual([]);
    expect(asciiFromBinary(image)[1]).toBe('....#....');
  });
});
