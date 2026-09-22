import { describe, expect, it } from 'vitest';
import { CHORD_MAPS, type RoleId, specOf } from './chord-maps';
import { type Chord, chordOf, isTriad, toneKind, voicing } from './chords';
import { keyBySignature } from './keys';
import { STYLE_IDS, STYLES, type StyleId } from './styles';

// Chords are addressed by the role they play in the map, not by a position in it
const chord = (signature: number, styleId: StyleId, role: RoleId, nth = 0): Chord => {
  const found = CHORD_MAPS[styleId].filter((c) => c.role === role)[nth];
  if (found === undefined) throw new Error(`no ${role} in ${styleId}`);
  return chordOf(keyBySignature(signature), specOf(found, STYLES[styleId].scale, STYLES[styleId].sharps ?? []));
};

describe('chordOf', () => {
  it('builds G7 in C major', () => {
    expect(chord(0, 'classical', 'dominantSeventh')).toEqual({
      degree: 4,
      offset: 7,
      sharp: false,
      root: 7,
      pcs: [7, 11, 2],
      seventh: 5,
      quality: '7',
      name: 'G',
      label: 'G7',
    });
  });

  it('spells chords in the key: B♭ major has E♭ and G minor', () => {
    expect(chord(-2, 'classical', 'subdominant').name).toBe('E♭');
    expect(chord(-2, 'classical', 'parallel').label).toBe('g');
  });

  it('spells roots outside the major scale with flats even in sharp keys', () => {
    expect(chord(2, 'blues', 'subdominant').label).toBe('G7'); // IV7 in D
    expect(chord(3, 'rock', 'subtonic').label).toBe('G'); // ♭VII in A
  });

  it('keeps the lydian ♯IV sharp', () => {
    expect(chord(0, 'lydian', 'tritone').name).toBe('F♯');
    expect(chord(-1, 'lydian', 'tritone').name).toBe('B');
  });

  it('labels every quality', () => {
    expect(chord(0, 'jazz', 'tonic').label).toBe('Cmaj7');
    expect(chord(0, 'jazz', 'shortened').label).toBe('Bø7');
    expect(chord(0, 'harmonicMinor', 'augmented').label).toBe('E♭+');
    expect(chord(0, 'wholeTone', 'tritone').label).toBe('C7♭5');
    expect(chord(0, 'classical', 'shortened').label).toBe('b'); // diminished: lower case, the ° is added by the labels
  });

  it.each(STYLE_IDS)('%s: every chord of the map has a name and its own tones', (styleId) => {
    const key = keyBySignature(0);
    const style = STYLES[styleId];
    for (const entry of CHORD_MAPS[styleId]) {
      const built = chordOf(key, specOf(entry, style.scale, style.sharps ?? []));
      expect(built.label.length).toBeGreaterThan(0);
      expect(built.pcs[0]).toBe(built.root);
      expect(new Set(built.pcs).size).toBe(built.pcs.length);
      expect(built.seventh).not.toBe(built.root);
    }
  });
});

describe('isTriad', () => {
  it('knows the three-note qualities from the four-note ones', () => {
    expect(isTriad('major')).toBe(true);
    expect(isTriad('dim')).toBe(true);
    expect(isTriad('m7')).toBe(false);
    expect(isTriad('7')).toBe(false);
  });
});

describe('toneKind', () => {
  it('tells a chord tone from the seventh and from a passing tone', () => {
    const g7 = chord(0, 'classical', 'dominantSeventh');
    expect(toneKind(g7, 67)).toBe('chord'); // G
    expect(toneKind(g7, 65)).toBe('seventh'); // F
    expect(toneKind(g7, 60)).toBe('scale'); // C
  });
});

describe('voicing', () => {
  it('keeps the root the lowest note of the chord', () => {
    const g7 = chord(0, 'classical', 'dominantSeventh');
    const { bass, chord: notes } = voicing(g7);
    expect(notes[0]).toBe(bass + 12);
    expect([...notes]).toEqual([...notes].sort((a, b) => a - b));
    expect(notes).toHaveLength(g7.pcs.length + 1); // the seventh joins the triad
  });

  it.each(STYLE_IDS)('%s: every chord is voiced from its root upwards', (styleId) => {
    const key = keyBySignature(0);
    const style = STYLES[styleId];
    for (const entry of CHORD_MAPS[styleId]) {
      const built = chordOf(key, specOf(entry, style.scale, style.sharps ?? []));
      const { bass, chord: notes } = voicing(built);
      expect(bass % 12).toBe(built.root);
      expect(notes[0]).toBe(bass + 12);
      expect([...notes]).toEqual([...notes].sort((a, b) => a - b));
      expect(notes.at(-1) ?? 0).toBeLessThan(bass + 36); // within two octaves above the bass
    }
  });
});
