import { describe, expect, it } from 'vitest';
import { keyBySignature } from '../../theory/keys';
import { buildModel } from '../../theory/model';
import { pcOf } from '../../theory/pitch';
import { RECORDED } from '../__fixtures__/recorded';
import { learnSpot } from '../learn-spot';
import { slug } from '../song-notation';
import { GROUPS, SONGS } from './index';

describe('SONGS', () => {
  it('holds the 27 songs of the reference and the 9 for singing together, in five groups', () => {
    expect(SONGS).toHaveLength(36);
    expect(SONGS.filter((song) => song.notes.some((note) => note.text !== undefined))).toHaveLength(22);
    expect(GROUPS).toEqual(['feasts', 'children', 'world', 'bluesRockJazz', 'exercises']);
    for (const group of GROUPS) expect(SONGS.some((song) => song.group === group)).toBe(true);
    expect(new Set(SONGS.map((song) => slug(song.title))).size).toBe(36);
  });

  it('carries title, key, tempo, style and group of the reference in the same order', () => {
    const library = SONGS.filter((song) => song.group !== 'feasts');
    expect(library.map(({ title, k, bpm, style, group }) => ({ title, k, bpm, style, group }))).toEqual(
      RECORDED.songs.map((song) => ({
        title: song.title,
        k: song.k,
        bpm: song.bpm,
        style: song.style,
        group: song.group,
      })),
    );
  });

  // Every feast song is sung from beginning to end: a lead-in without words, then each verse with the chorus
  // after it. A syllable per note, and no note of a sung part left without one.
  it('sings every feast song whole, with a lead-in that carries no words', () => {
    const feasts = SONGS.filter((song) => song.group === 'feasts');
    expect(feasts).toHaveLength(9);
    for (const song of feasts) {
      const lead = song.notes.findIndex((note) => note.text !== undefined);
      expect(lead).toBeGreaterThan(0); // there is a lead-in, and it ends
      expect(song.notes.slice(0, lead).every((note) => note.text === undefined)).toBe(true);
      expect(song.notes.slice(lead).every((note) => note.text !== undefined)).toBe(true);
    }
  });

  it.each(SONGS.map((song) => [song.title, song] as const))(
    '%s: every note is in the scale and on the grid',
    (_, song) => {
      const model = buildModel(keyBySignature(song.k), song.style);
      for (const note of song.notes) {
        expect(model.style.scale).toContain(pcOf(note.midi - model.key.tonic));
        expect(learnSpot(model, note)).not.toBeNull();
        expect(note.beats).toBeGreaterThan(0);
      }
    },
  );
});
