import { describe, expect, it } from 'vitest';
import { setLocale } from '../i18n';
import { keyBySignature } from '../theory/keys';
import { buildModel } from '../theory/model';
import type { ScannedNote } from './sheet-scanner';
import { type PlainNote, songFromScan, styleForScan } from './song-from-scan';

const C = keyBySignature(0);
const note = (midi: number, beats: 1 | 2 | 4 = 1): ScannedNote => ({ midi, beats, x: 0, y: 0 });
const MELODY = [note(60), note(62), note(64), note(65), note(67, 2), note(67, 2)];

// A stub harmoniser: the dominant under a G, the tonic under anything else
const cMajor = buildModel(keyBySignature(0), 'classical');
const dominant = cMajor.chords.findIndex((chord) => chord.offset === 7 && chord.seventh !== null);
const harmonize = (notes: readonly PlainNote[]): number[] =>
  notes.map((n) => (n.midi % 12 === 7 ? dominant : cMajor.home));

describe('styleForScan', () => {
  it('keeps a functional style whose scale holds every tone', () => {
    expect(styleForScan(MELODY, C, 'classical')).toBe('classical');
    expect(styleForScan(MELODY, C, 'jazz')).toBe('jazz');
  });

  it('falls back to classical for styles without major thirds or with missing tones', () => {
    expect(styleForScan(MELODY, C, 'blues')).toBe('classical');
    expect(styleForScan(MELODY, C, 'techno')).toBe('classical');
    expect(styleForScan(MELODY, C, 'pentatonic')).toBe('classical'); // F is no pentatonic tone
    expect(styleForScan([note(60), note(64), note(67)], C, 'pentatonic')).toBe('pentatonic');
    expect(styleForScan([note(61)], C, 'classical')).toBe('classical');
  });
});

describe('songFromScan', () => {
  const now = new Date(2026, 8, 20, 9, 5);

  it('assembles a song with the chords from the harmoniser', () => {
    setLocale('de');
    const song = songFromScan(MELODY, { key: C, style: 'classical', harmonize, now });
    const model = buildModel(C, 'classical');
    expect(song).toMatchObject({ title: 'Gescannt: 09:05', k: 0, bpm: 100, style: 'classical', group: 'scanned' });
    expect(song.notes.map((n) => n.midi)).toEqual([60, 62, 64, 65, 67, 67]);
    expect(song.notes.map((n) => n.beats)).toEqual([1, 1, 1, 1, 2, 2]);
    const tonic = model.chords[model.home];
    expect(song.notes[0]).toMatchObject({ degree: tonic?.degree, root: tonic?.offset });
    expect(song.notes[4]).toMatchObject({ degree: 4, root: 7 });
  });

  it('folds tones outside the field back into it, by octaves', () => {
    const model = buildModel(C, 'classical');
    const lowest = model.tones[0] ?? 0;
    const highest = model.tones.at(-1) ?? 0;
    const song = songFromScan([note(lowest - 12), note(highest + 13), note(60)], {
      key: C,
      style: 'classical',
      harmonize,
      now,
    });
    for (const { midi } of song.notes) {
      expect(midi).toBeGreaterThanOrEqual(lowest);
      expect(midi).toBeLessThanOrEqual(highest);
    }
    expect(song.notes[2]?.midi).toBe(60); // what already fits stays where it is
  });

  it('names the song in the current locale', () => {
    setLocale('en');
    const song = songFromScan(MELODY, { key: C, style: 'classical', harmonize, now });
    expect(song.title).toMatch(/^Scanned: /);
    setLocale('de');
  });

  it('carries the key and the decided style', () => {
    const G = keyBySignature(1);
    const song = songFromScan([note(67), note(71), note(74)], { key: G, style: 'jazz', harmonize, now });
    expect(song.k).toBe(1);
    expect(song.style).toBe('jazz');
  });

  it('refuses a harmoniser that skips notes', () => {
    expect(() => songFromScan(MELODY, { key: C, style: 'classical', harmonize: () => [3], now })).toThrow(RangeError);
  });

  it('defaults to the current time', () => {
    const song = songFromScan(MELODY, { key: C, style: 'classical', harmonize });
    expect(song.title).toMatch(/\d\d:\d\d/);
  });
});
