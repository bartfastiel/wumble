// Text of the header: song with progress, the echo's state or "free play" – with key and accidentals while the label
// switch is on. From medium on the score stands next to it as its own badge.
import { locale, t } from '../i18n';
import type { Song } from '../learn/song-notation';
import { keyTitle } from '../theory/key-labels';
import type { Key } from '../theory/keys';

export interface TitleState {
  readonly song: Song | null;
  readonly pos: number;
  readonly echoTitle: string; // empty while no echo runs
  readonly labelsOn: boolean;
  readonly key: Key;
  readonly german: boolean;
}

export const points = (n: number): string => n.toLocaleString(locale() === 'de' ? 'de-DE' : 'en-US').replace('-', '−');

export const titleText = ({ song, pos, echoTitle, labelsOn, key, german }: TitleState): string => {
  let base = t('learn.freePlay');
  if (song !== null)
    base = `${song.title} · ${String(Math.min(pos + 1, song.notes.length))}/${String(song.notes.length)}`;
  else if (echoTitle !== '') base = echoTitle;
  return labelsOn ? `${base} · ${keyTitle(key, german)}` : base;
};

export const scoreText = (song: Song | null, scored: boolean, score: number): string =>
  song !== null && scored ? t('learn.score', { points: points(score) }) : '';
