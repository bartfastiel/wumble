import { describe, expect, it } from 'vitest';
import { keyBySignature } from '../../theory/keys';
import { buildModel } from '../../theory/model';
import { pcOf } from '../../theory/pitch';
import { RECORDED } from '../__fixtures__/recorded';
import { learnSpot } from '../learn-spot';
import { slug } from '../song-notation';
import { GROUPS, SONGS } from './index';

describe('SONGS', () => {
  it('holds the 27 songs of the reference, 13 of them with lyrics, in four groups', () => {
    expect(SONGS).toHaveLength(27);
    expect(SONGS.filter((song) => song.notes.every((note) => note.text !== undefined))).toHaveLength(13);
    expect(GROUPS).toEqual(['children', 'world', 'bluesRockJazz', 'exercises']);
    for (const group of GROUPS) expect(SONGS.some((song) => song.group === group)).toBe(true);
    expect(new Set(SONGS.map((song) => slug(song.title))).size).toBe(27);
  });

  it('carries title, key, tempo, style and group of the reference in the same order', () => {
    expect(SONGS.map(({ title, k, bpm, style, group }) => ({ title, k, bpm, style, group }))).toEqual(
      RECORDED.songs.map((song) => ({
        title: song.title,
        k: song.k,
        bpm: song.bpm,
        style: song.style,
        group: song.group,
      })),
    );
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
