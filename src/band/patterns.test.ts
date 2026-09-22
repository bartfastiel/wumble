import { describe, expect, it } from 'vitest';
import { GROOVES } from './grooves';
import { GATE, parseGroove, PATTERNS, STEPS_PER_BAR, stepOffset } from './patterns';

describe('parseGroove', () => {
  it('reads drum hits with their velocities', () => {
    const { drums } = parseGroove({ kick: 'X.x.o...........', ride: '...............x' });
    expect(drums).toEqual([
      { kind: 'kick', step: 0, velocity: 1 },
      { kind: 'kick', step: 2, velocity: 0.7 },
      { kind: 'kick', step: 4, velocity: 0.35 },
      { kind: 'ride', step: 15, velocity: 0.7 },
    ]);
  });

  it('reads bass degrees and chord voices with tie lengths', () => {
    const { tones } = parseGroove({ bass: '1---3-5.L......8', chord: 'S---s.1583......', pad: '-S--------------' });
    expect(tones).toEqual([
      { lane: 'bass', step: 0, length: 4, degree: '1' },
      { lane: 'bass', step: 4, length: 2, degree: '3' },
      { lane: 'bass', step: 6, length: 1, degree: '5' },
      { lane: 'bass', step: 8, length: 1, degree: 'L' },
      { lane: 'bass', step: 15, length: 1, degree: '8' },
      { lane: 'chord', step: 0, length: 4, voice: 'S' },
      { lane: 'chord', step: 4, length: 1, voice: 's' },
      { lane: 'chord', step: 6, length: 1, voice: '1' },
      { lane: 'chord', step: 7, length: 1, voice: '5' },
      { lane: 'chord', step: 8, length: 1, voice: '8' },
      { lane: 'chord', step: 9, length: 1, voice: '3' },
      { lane: 'pad', step: 1, length: 15, voice: 'S' },
    ]);
  });

  it('keeps ties within the bar', () => {
    const { tones } = parseGroove({ bass: '.............1--' });
    expect(tones).toEqual([{ lane: 'bass', step: 13, length: 3, degree: '1' }]);
  });

  it('rejects wrong lengths and unknown symbols', () => {
    expect(() => parseGroove({ kick: 'x...' })).toThrow('16 characters');
    expect(() => parseGroove({ snare: 'y...............' })).toThrow('unknown drum symbol "y"');
    expect(() => parseGroove({ bass: '2...............' })).toThrow('unknown bass degree "2"');
    expect(() => parseGroove({ chord: 'L...............' })).toThrow('unknown chord symbol "L"');
    expect(() => parseGroove({ pad: '6...............' })).toThrow('unknown chord symbol "6"');
  });

  it('parses every groove into PATTERNS', () => {
    for (const [id, groove] of Object.entries(GROOVES)) {
      expect(PATTERNS[id as keyof typeof PATTERNS]).toEqual(parseGroove(groove));
    }
    expect(PATTERNS.calm.drums).toEqual([]);
    expect(PATTERNS.techno.tones.filter((note) => note.lane === 'chord')).toHaveLength(16);
  });
});

describe('stepOffset', () => {
  const beat = 0.5;

  it('divides a straight beat into four equal sixteenths', () => {
    const offsets = Array.from({ length: 8 }, (_, step) => stepOffset(step, beat, {}));
    expect(offsets).toEqual([0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875]);
  });

  it('places the second eighth at swing · beat and halves each eighth for the sixteenths', () => {
    const swing = { swing: 0.66 };
    expect(stepOffset(0, beat, swing)).toBe(0);
    expect(stepOffset(1, beat, swing)).toBeCloseTo(0.165, 12);
    expect(stepOffset(2, beat, swing)).toBeCloseTo(0.33, 12);
    expect(stepOffset(3, beat, swing)).toBeCloseTo(0.33 + 0.085, 12);
    expect(stepOffset(4, beat, swing)).toBe(0.5);
    expect(stepOffset(STEPS_PER_BAR, beat, swing)).toBe(2);
  });

  it('swings the sixteenths within straight eighths with swing16', () => {
    const swing16 = { swing: 0.6, swing16: true };
    expect(stepOffset(1, beat, swing16)).toBeCloseTo(0.15, 12);
    expect(stepOffset(2, beat, swing16)).toBe(0.25);
    expect(stepOffset(3, beat, swing16)).toBeCloseTo(0.4, 12);
    expect(stepOffset(4, beat, swing16)).toBe(0.5);
  });

  it('gates tones at 92 %', () => {
    expect(GATE).toBeCloseTo(0.92, 12);
  });
});
