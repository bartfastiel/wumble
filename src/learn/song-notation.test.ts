import { describe, expect, it } from 'vitest';
import { RECORDED } from './__fixtures__/recorded';
import { parseSong, slug, type SongDefinition } from './song-notation';
import { SONGS } from './songs';

const define = (notes: string, text?: string): SongDefinition =>
  text === undefined
    ? { title: 'Test', k: 0, bpm: 100, group: 'exercises', notes }
    : { title: 'Test', k: 0, bpm: 100, group: 'exercises', notes, text };

describe('parseSong', () => {
  it('reads note, octave, accidental, degree, flat degree and beats', () => {
    const { notes } = parseSong(define('C4/I  F#4/V:.5 Bb3/bVII:1.5 A4/vi:2 G4/IV'));
    expect(notes).toEqual([
      { midi: 60, degree: 0, root: 0, beats: 1 },
      { midi: 66, degree: 4, root: 7, beats: 0.5 },
      { midi: 58, degree: 6, root: 10, beats: 1.5 },
      { midi: 69, degree: 5, root: 9, beats: 2 },
      { midi: 67, degree: 3, root: 5, beats: 1 },
    ]);
  });

  it('accepts unicode accidentals and lower case for major degrees', () => {
    const { notes } = parseSong(define('E♭4/i D♯4/♭iii'));
    expect(notes).toEqual([
      { midi: 63, degree: 0, root: 0, beats: 1 },
      { midi: 63, degree: 2, root: 3, beats: 1 },
    ]);
  });

  it('defaults to the classical style and keeps the header', () => {
    const song = parseSong(define('C4/I'));
    expect(song).toEqual({
      title: 'Test',
      k: 0,
      bpm: 100,
      style: 'classical',
      group: 'exercises',
      notes: [{ midi: 60, degree: 0, root: 0, beats: 1 }],
    });
    expect(parseSong({ ...define('C4/I'), style: 'blues' }).style).toBe('blues');
  });

  it('attaches one syllable per note', () => {
    const { notes } = parseSong(define('C4/I D4/I E4/I', '\n  Al- le _  '));
    expect(notes.map((note) => note.text)).toEqual(['Al-', 'le', '_']);
  });

  it('rejects malformed tokens, unknown degrees and shifted lyrics', () => {
    expect(() => parseSong(define('H4/I'))).toThrow('invalid note: H4/I');
    expect(() => parseSong(define('C4/I:x'))).toThrow('invalid note: C4/I:x');
    expect(() => parseSong(define('C4/VIII'))).toThrow('invalid degree: C4/VIII');
    expect(() => parseSong(define('C4/I D4/I', 'one'))).toThrow('"Test" has 2 notes but 1 syllables');
  });

  it.each(RECORDED.songs.map((song) => [song.title, song] as const))(
    '%s matches the reference note by note',
    (_, recorded) => {
      const song = SONGS.find((candidate) => candidate.title === recorded.title);
      expect(song).toBeDefined();
      const notes = song?.notes.map(({ midi, degree, root, beats, text }) => ({
        midi,
        degree,
        root,
        beats,
        text: text ?? null,
      }));
      expect(notes).toEqual(recorded.notes);
    },
  );
});

describe('slug', () => {
  it('lower-cases, splits accents and trims dashes', () => {
    expect(slug('Alle meine Entchen')).toBe('alle-meine-entchen');
    expect(slug('Hänschen klein')).toBe('ha-nschen-klein');
    expect(slug('Kuckuck, Kuckuck, ruft’s aus dem Wald')).toBe('kuckuck-kuckuck-ruft-s-aus-dem-wald');
    expect(slug('12-Takt-Blues')).toBe('12-takt-blues');
    expect(slug('Oh! Susanna')).toBe('oh-susanna');
  });

  it('matches the reference for every song title', () => {
    for (const song of RECORDED.songs) expect(slug(song.title)).toBe(song.slug);
  });
});
