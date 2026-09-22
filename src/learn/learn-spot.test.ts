import { describe, expect, it } from 'vitest';
import { keyBySignature } from '../theory/keys';
import { buildModel } from '../theory/model';
import { pcOf, type PitchClass } from '../theory/pitch';
import type { Degree } from '../theory/scales';
import type { SongNote } from './song-notation';
import { STYLE_IDS } from '../theory/styles';
import { learnSpot, placeNotes, sameSpot } from './learn-spot';
import { SONGS } from './songs';

const classical = buildModel(keyBySignature(0), 'classical');
const note = (midi: number, degree: Degree, root: PitchClass): SongNote => ({ midi, degree, root, beats: 1 });

describe('learnSpot', () => {
  it('finds the chord by its root and the stripe by the tone', () => {
    const spot = learnSpot(classical, note(67, 4, 7));
    expect(spot).not.toBeNull();
    expect(classical.chords[spot?.chord ?? -1]?.root).toBe(7);
    expect(classical.tones[spot?.tone ?? -1]).toBe(67);
  });

  it('falls back to the degree when no chord has that root (♭VII in classical)', () => {
    const spot = learnSpot(classical, note(60, 6, 10));
    expect(classical.chords[spot?.chord ?? -1]?.degree).toBe(6);
  });

  it('falls back to a chord containing the tone, else to home', () => {
    const rock = buildModel(keyBySignature(0), 'rock');
    const spot = learnSpot(rock, note(67, 1, 1));
    expect(rock.chords[spot?.chord ?? -1]?.pcs).toContain(pcOf(67));
    const nature = buildModel(keyBySignature(0), 'harmonicSeries');
    // A♭ is neither a root nor a degree nor a chord tone here, so the note goes home
    expect(learnSpot(nature, note(68, 2, 8))?.chord).toBe(nature.home);
  });

  it('returns null for a tone that is not on the field', () => {
    expect(learnSpot(classical, note(61, 0, 0))).toBeNull(); // C♯ is not in the major scale
    expect(learnSpot(classical, note(7, 0, 0))).toBeNull(); // below the lowest octave
  });

  it.each(SONGS.map((song) => [song.title, song] as const))('%s lands on the field', (_title, song) => {
    const model = buildModel(keyBySignature(song.k), song.style);
    const placed = placeNotes(model, song.notes);
    expect(placed).toHaveLength(song.notes.length);
    for (const { note: songNote, spot } of placed) {
      if (spot === null) {
        expect(model.tones).not.toContain(songNote.midi);
        continue;
      }
      expect(model.tones[spot.tone]).toBe(songNote.midi);
      expect(model.chords[spot.chord]).toBeDefined();
    }
  });

  it.each(STYLE_IDS)('%s places every tone of its own scale', (styleId) => {
    const model = buildModel(keyBySignature(0), styleId);
    for (const midi of model.tones) {
      expect(learnSpot(model, note(midi, 0, 0))).not.toBeNull();
    }
  });
});

describe('sameSpot', () => {
  it('compares chord and stripe, never matching null', () => {
    expect(sameSpot({ chord: 1, tone: 2 }, { chord: 1, tone: 2 })).toBe(true);
    expect(sameSpot({ chord: 1, tone: 2 }, { chord: 1, tone: 3 })).toBe(false);
    expect(sameSpot({ chord: 1, tone: 2 }, { chord: 2, tone: 2 })).toBe(false);
    expect(sameSpot(null, { chord: 1, tone: 2 })).toBe(false);
    expect(sameSpot({ chord: 1, tone: 2 }, null)).toBe(false);
  });
});
