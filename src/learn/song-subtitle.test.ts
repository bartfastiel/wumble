import { afterEach, describe, expect, it } from 'vitest';
import { setLocale } from '../i18n';
import { RECORDED } from './__fixtures__/recorded';
import { songSubtitle, subtitleText } from './song-subtitle';
import { SONGS } from './songs';

const songNamed = (title: string) => {
  const song = SONGS.find((candidate) => candidate.title === title);
  if (song === undefined) throw new Error(`missing song ${title}`);
  return song;
};

afterEach(() => {
  setLocale('en');
});

describe('songSubtitle', () => {
  it('classifies major, minor and modal styles', () => {
    const grace = songSubtitle(songNamed('Amazing Grace'));
    expect(grace.style).toBe('pentatonic');
    expect(grace.key.signature).toBe(1);
    expect(grace.tonality).toBe('major');
    expect(songSubtitle(songNamed('Hava Nagila')).tonality).toBe('minor');
    expect(songSubtitle(songNamed('Bella Ciao')).tonality).toBe('minor');
    expect(songSubtitle(songNamed('Scarborough Fair')).tonality).toBe('root');
    expect(songSubtitle(songNamed('12-Takt-Blues')).tonality).toBe('root');
  });
});

describe('subtitleText', () => {
  it('matches the reference for every song in German', () => {
    setLocale('de');
    for (const recorded of RECORDED.songs)
      expect(subtitleText(songSubtitle(songNamed(recorded.title)))).toBe(recorded.subtitle);
  });

  it('reads in English and spells German note names on request', () => {
    expect(subtitleText(songSubtitle(songNamed('Amazing Grace')))).toBe('Pentatonic · G major / E minor');
    expect(subtitleText(songSubtitle(songNamed('Hejo, spann den Wagen an')))).toBe('Techno · g minor');
    expect(subtitleText(songSubtitle(songNamed('Old Joe Clark (Refrain)')))).toBe('Mixolydian · root A');
    setLocale('de');
    expect(subtitleText(songSubtitle(songNamed('Alle Vögel sind schon da')), true)).toBe('Klassisch · D-Dur / H-Moll');
    expect(subtitleText(songSubtitle(songNamed('Korobeiniki')), true)).toBe('Techno · a-Moll');
    expect(subtitleText(songSubtitle(songNamed('Scarborough Fair')), true)).toBe('Dorisch · Grundton D');
  });
});
