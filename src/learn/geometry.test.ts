import { describe, expect, it } from 'vitest';
import { keyBySignature } from '../theory/keys';
import { buildModel } from '../theory/model';
import { RECORDED } from './__fixtures__/recorded';
import { ease, learnAlpha, noteRadius, RING_GAP, ringGeometry, visibleGroups } from './geometry';
import { type PlacedNote, placeNotes } from './learn-spot';
import { LEVELS } from './levels';
import type { Song } from './song-notation';
import { SONGS } from './songs';

const { unit } = RECORDED.geometry;

const songNamed = (title: string): Song => {
  const song = SONGS.find((candidate) => candidate.title === title);
  if (song === undefined) throw new Error(`missing song ${title}`);
  return song;
};
const place = (song: Song): PlacedNote[] => placeNotes(buildModel(keyBySignature(song.k), song.style), song.notes);

const entchen = place(songNamed('Alle meine Entchen'));

describe('noteRadius', () => {
  it('grows with the square root of the duration, capped at half the cell', () => {
    for (const [beats, radius] of Object.entries(RECORDED.geometry.radius)) {
      expect(noteRadius(Number(beats), unit)).toBeCloseTo(radius, 10);
    }
    expect(noteRadius(1, 100)).toBe(30);
    expect(noteRadius(9, 100)).toBe(50);
  });
});

describe('ringGeometry', () => {
  it('matches the reference for "Alle meine Entchen" at positions 0, 4 and 6', () => {
    for (const [pos, rings] of Object.entries(RECORDED.geometry.rings)) {
      expect(ringGeometry(entchen, Number(pos), unit)).toEqual(rings);
    }
    expect(RING_GAP).toBe(RECORDED.geometry.gap);
  });

  it.each(RECORDED.geometry.runs.map((run) => [run.title, run] as const))(
    '%s: longest run matches the reference',
    (title, run) => {
      expect(ringGeometry(place(songNamed(title)), run.pos, unit)).toEqual(run.rings);
    },
  );

  it('rings have the area of their note and sit RING_GAP apart', () => {
    const rings = ringGeometry(entchen, 6, unit);
    expect(rings).toHaveLength(4);
    rings.forEach((ring, i) => {
      const previous = rings[i - 1];
      expect(ring.ri).toBe(previous === undefined ? 0 : previous.ro + RING_GAP);
      expect(ring.ro ** 2 - ring.ri ** 2).toBeCloseTo(noteRadius(1, unit) ** 2, 10);
    });
  });

  it('scales a group down so the outermost ring stays within 0.75 of the cell', () => {
    const hejo = place(songNamed('Hejo, spann den Wagen an'));
    const rings = ringGeometry(hejo, 16, unit);
    expect(rings).toHaveLength(11);
    expect(rings.at(-1)?.ro).toBeCloseTo(unit * 0.75, 10);
    // The same factor on every ring: before scaling the ring areas and gaps were the plain ones
    const scale = (rings[0]?.ro ?? 0) / noteRadius(hejo[16]?.note.beats ?? 0, unit);
    expect(scale).toBeLessThan(1);
    rings.forEach((ring, i) => {
      const previous = rings[i - 1];
      expect(ring.ri / scale).toBeCloseTo(previous === undefined ? 0 : previous.ro / scale + RING_GAP, 8);
      expect((ring.ro / scale) ** 2 - (ring.ri / scale) ** 2).toBeCloseTo(
        noteRadius(hejo[16 + i]?.note.beats ?? 0, unit) ** 2,
        6,
      );
    });
  });

  it('is empty beyond the last note', () => {
    expect(ringGeometry(entchen, entchen.length, unit)).toEqual([]);
  });
});

describe('visibleGroups', () => {
  it('easy: the current run completely, then preview until about four tones show', () => {
    // pos 0: C D E F are single notes → four groups of one
    expect(visibleGroups(entchen, 0, LEVELS.easy, unit).map((group) => [group.pos, group.rings.length])).toEqual([
      [0, 1],
      [1, 1],
      [2, 1],
      [3, 1],
    ]);
    // pos 4: G G (run of two), then A A A A (run of four) cut to two – with the sizes of the whole run
    const groups = visibleGroups(entchen, 4, LEVELS.easy, unit);
    expect(groups.map((group) => [group.pos, group.rings.length])).toEqual([
      [4, 2],
      [6, 2],
    ]);
    expect(groups[1]?.rings).toEqual(ringGeometry(entchen, 6, unit).slice(0, 2));
    // pos 6: the run of four alone already shows four tones – the next cell still follows
    expect(visibleGroups(entchen, 6, LEVELS.easy, unit).map((group) => [group.pos, group.rings.length])).toEqual([
      [6, 4],
      [10, 1],
    ]);
  });

  it('medium: only the current run with its rings; hard: only its circle', () => {
    expect(visibleGroups(entchen, 6, LEVELS.medium, unit).map((group) => [group.pos, group.rings.length])).toEqual([
      [6, 4],
    ]);
    expect(visibleGroups(entchen, 6, LEVELS.hard, unit).map((group) => [group.pos, group.rings.length])).toEqual([
      [6, 1],
    ]);
  });

  it('is empty after the last note', () => {
    expect(visibleGroups(entchen, entchen.length, LEVELS.easy, unit)).toEqual([]);
  });
});

describe('learnAlpha and ease', () => {
  it('match the reference curves', () => {
    expect(RECORDED.geometry.alpha.map((_, k) => learnAlpha(k))).toEqual(RECORDED.geometry.alpha);
    expect([0, 0.25, 0.5, 0.75, 1, 1.5].map(ease)).toEqual(RECORDED.geometry.ease);
  });
});
