import { describe, expect, it } from 'vitest';
import { germanName, mtof, noteName, pcOf } from './pitch';

describe('pcOf', () => {
  it('returns the pitch class 0–11', () => {
    expect(pcOf(60)).toBe(0);
    expect(pcOf(69)).toBe(9);
    expect(pcOf(71)).toBe(11);
  });

  it('handles negative numbers', () => {
    expect(pcOf(-1)).toBe(11);
    expect(pcOf(-12)).toBe(0);
  });
});

describe('mtof', () => {
  it('tunes A4 to 440 Hz', () => {
    expect(mtof(69)).toBe(440);
  });

  it('doubles per octave', () => {
    expect(mtof(81)).toBe(880);
    expect(mtof(57)).toBe(220);
  });

  it('computes C4 in equal temperament', () => {
    expect(mtof(60)).toBeCloseTo(261.626, 3);
  });
});

describe('noteName', () => {
  it('uses sharps by default', () => {
    expect(noteName(60)).toBe('C');
    expect(noteName(70)).toBe('A♯');
    expect(noteName(73)).toBe('C♯');
  });

  it('uses flats on request', () => {
    expect(noteName(70, true)).toBe('B♭');
    expect(noteName(73, true)).toBe('D♭');
  });
});

describe('germanName', () => {
  it('writes B as H and B♭ as B', () => {
    expect(germanName('B')).toBe('H');
    expect(germanName('B♭')).toBe('B');
  });

  it('leaves other names unchanged', () => {
    expect(germanName('C')).toBe('C');
    expect(germanName('F♯')).toBe('F♯');
  });
});
