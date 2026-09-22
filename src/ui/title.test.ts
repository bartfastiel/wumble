// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { setLocale } from '../i18n';
import type { Finish } from '../learn/session';
import { SONGS } from '../learn/songs';
import { keyBySignature } from '../theory/keys';
import { creditsSeen, creditsText, rememberCredits, textHash } from './credits';
import { doneText } from './wm-done';
import { points, scoreText, titleText } from './title';

const song = SONGS.find((candidate) => candidate.title === 'Alle meine Entchen');
if (song === undefined) throw new Error('song missing');
const base = { song: null, pos: 0, echoTitle: '', labelsOn: false, key: keyBySignature(3), german: false };

beforeEach(() => {
  setLocale('de');
});

describe('titleText', () => {
  it('names free play, the song with its progress or the echo', () => {
    expect(titleText(base)).toBe('Freies Spiel');
    expect(titleText({ ...base, song, pos: 5 })).toBe('Alle meine Entchen · 6/27');
    expect(titleText({ ...base, song, pos: 27 })).toBe('Alle meine Entchen · 27/27');
    expect(titleText({ ...base, echoTitle: 'Hör zu …' })).toBe('Hör zu …');
  });

  it('adds key and accidentals while the labels are on', () => {
    expect(titleText({ ...base, labelsOn: true })).toBe('Freies Spiel · A-Dur ♯♯♯');
    expect(titleText({ ...base, labelsOn: true, key: keyBySignature(-1) })).toBe('Freies Spiel · F-Dur ♭');
    setLocale('en');
    expect(titleText({ ...base, labelsOn: true, key: keyBySignature(0) })).toBe('Free play · C major');
  });
});

describe('points and scoreText', () => {
  it('formats points in the locale with a proper minus', () => {
    expect(points(1234)).toBe('1.234');
    expect(points(-100)).toBe('−100');
    setLocale('en');
    expect(points(1234)).toBe('1,234');
  });

  it('shows the score badge only for a scored song', () => {
    expect(scoreText(song, true, 430)).toBe('430 P.');
    expect(scoreText(song, false, 430)).toBe('');
    expect(scoreText(null, true, 430)).toBe('');
  });
});

describe('doneText', () => {
  const finish = (patch: Partial<Finish>): Finish => ({
    song,
    scored: true,
    score: 870,
    best: 500,
    newRecord: true,
    ...patch,
  });

  it('names the song alone in easy, with points and record from medium on', () => {
    expect(doneText(finish({ scored: false }))).toBe('Alle meine Entchen');
    expect(doneText(finish({}))).toBe('Alle meine Entchen · 870 Punkte · Neuer Rekord!');
    expect(doneText(finish({ newRecord: false, best: 1200 }))).toBe('Alle meine Entchen · 870 Punkte · Rekord 1.200');
  });
});

describe('credits', () => {
  it('hashes the shown text and remembers it', () => {
    const items = new Map<string, string>();
    const storage = {
      getItem: (key: string) => items.get(key) ?? null,
      setItem: (key: string, value: string) => {
        items.set(key, value);
      },
    };
    const text = creditsText();
    expect(text).toContain('Salamander Grand Piano V3');
    expect(text).toContain('CC0');
    expect(creditsSeen(storage, text)).toBe(false);
    rememberCredits(storage, text);
    expect(creditsSeen(storage, text)).toBe(true);
    expect(creditsSeen(storage, `${text} changed`)).toBe(false);
    expect(textHash('a')).not.toBe(textHash('b'));
    expect(textHash('wumble')).toMatch(/^[0-9a-f]+$/);
  });

  it('survives a blocked storage', () => {
    const blocked = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(creditsSeen(blocked, 'x')).toBe(false);
    expect(() => {
      rememberCredits(blocked, 'x');
    }).not.toThrow();
  });
});
