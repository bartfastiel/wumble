import { describe, expect, it } from 'vitest';
import { CHORD_MAPS, type MapChord, pitchesOf, type RoleId, rootOf } from './chord-maps';
import { fitnessOf } from './fitness';
import { pcOf, type PitchClass } from './pitch';
import { STYLE_IDS, type StyleId, STYLES } from './styles';

const TONIC: PitchClass = 0; // C
const chordOf = (styleId: StyleId, role: RoleId): MapChord => {
  const chord = CHORD_MAPS[styleId].find((candidate) => candidate.role === role);
  if (chord === undefined) throw new Error(`no ${role} in ${styleId}`);
  return chord;
};
const fit = (styleId: StyleId, role: RoleId, midi: number): number =>
  fitnessOf(pcOf(midi), chordOf(styleId, role), TONIC, STYLES[styleId]);

describe('fitnessOf on a major triad', () => {
  const tonic = chordOf('classical', 'tonic'); // C E G

  it('lets root and fifth carry, the third colour', () => {
    expect(fit('classical', 'tonic', 60)).toBe(0); // C
    expect(fit('classical', 'tonic', 67)).toBe(0); // G
    expect(fit('classical', 'tonic', 64)).toBe(1); // E
  });

  it('leaves a tone a whole step away soft, and lets one rubbing from above pull', () => {
    expect(fit('classical', 'tonic', 62)).toBe(2); // D: a step from C and E
    expect(fit('classical', 'tonic', 65)).toBe(3); // F: a semitone above E, and it wants to fall back
    // A leading tone from below does not pull: B under C sounds like an upbeat, not like a mistake
    expect(fit('classical', 'tonic', 71)).toBe(2);
  });

  it('answers for every pitch class', () => {
    for (let pc = 0; pc < 12; pc++) {
      expect([0, 1, 2, 3]).toContain(fitnessOf(pcOf(pc), tonic, TONIC, STYLES.classical));
    }
  });
});

describe('fitnessOf and the seventh', () => {
  it('lets the seventh of a dominant pull, and lets a tonic seventh colour', () => {
    // G7 leads home: its F pulls
    expect(fit('classical', 'dominantSeventh', 65)).toBe(3);
    // C7 in the blues is home itself: its B♭ is the colour of the style, not a pull
    expect(fit('blues', 'tonic', 70)).toBe(1);
  });
});

describe('fitnessOf and the blue note', () => {
  it('lets the blue third stand in for a third the scale does not have', () => {
    // C7 has E, the blues scale has E♭: the E♭ inherits the role of the third
    expect(fit('blues', 'tonic', 63)).toBe(1);
  });

  it('lets no rubbing tone pull in a scale of six tones or fewer – friction is the point there', () => {
    for (const styleId of STYLE_IDS) {
      const style = STYLES[styleId];
      if (style.scale.length > 6) continue;
      for (const chord of CHORD_MAPS[styleId]) {
        const tones = pitchesOf(chord, TONIC);
        for (const semitone of style.scale) {
          const tone = pcOf(TONIC + semitone);
          if (tones.includes(tone)) continue; // a leading seventh may still pull
          expect(fitnessOf(tone, chord, TONIC, style)).toBeLessThan(3);
        }
      }
    }
  });
});

describe('fitnessOf across every style', () => {
  it.each(STYLE_IDS)('%s: a chord tone never pulls unless it is a leading seventh', (styleId) => {
    const style = STYLES[styleId];
    for (const chord of CHORD_MAPS[styleId]) {
      const root = rootOf(chord, TONIC);
      for (const tone of pitchesOf(chord, TONIC)) {
        const fitness = fitnessOf(tone, chord, TONIC, style);
        const above = pcOf(tone - root);
        if (above === 10 || above === 11) continue; // a seventh may pull
        expect(fitness).toBeLessThan(3);
      }
    }
  });

  it.each(STYLE_IDS)('%s: the root of every chord always carries', (styleId) => {
    const style = STYLES[styleId];
    for (const chord of CHORD_MAPS[styleId]) {
      expect(fitnessOf(rootOf(chord, TONIC), chord, TONIC, style)).toBe(0);
    }
  });

  it.each(STYLE_IDS)('%s: most of the scale always carries, whatever chord sounds', (styleId) => {
    const style = STYLES[styleId];
    for (const chord of CHORD_MAPS[styleId]) {
      const pulling = style.scale.filter((s) => fitnessOf(pcOf(TONIC + s), chord, TONIC, style) === 3);
      // A dominant over a minor scale is the busiest case: four of seven tones want to move on
      expect(pulling.length).toBeLessThanOrEqual(4);
      expect(pulling.length).toBeLessThan(style.scale.length - 2);
    }
  });

  it('holds in every key, not only in C', () => {
    for (const tonic of [0, 3, 6, 9] as const) {
      const chord = chordOf('classical', 'tonic');
      expect(fitnessOf(rootOf(chord, tonic), chord, tonic, STYLES.classical)).toBe(0);
    }
  });
});
