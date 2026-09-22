// Subtitle of a song in the library: style and key. Major styles read like the key list (G major / E minor), minor
// styles as a minor key (G minor), all others with their root (dorian · root D) – the styles build on the tonic.
import { t } from '../i18n';
import { keyLabel } from '../theory/key-labels';
import { type Key, keyBySignature } from '../theory/keys';
import { germanName } from '../theory/pitch';
import { HARMONIC_MINOR, MAJOR, MAJOR_PENTATONIC, MINOR, type Scale } from '../theory/scales';
import { type StyleId, STYLES } from '../theory/styles';
import type { Song } from './song-notation';

export type Tonality = 'major' | 'minor' | 'root';

export interface SongSubtitle {
  readonly style: StyleId;
  readonly key: Key;
  readonly tonality: Tonality;
}

const sameScale = (a: Scale, b: Scale): boolean => a.length === b.length && a.every((pc, i) => pc === b[i]);

const tonalityOf = (scale: Scale): Tonality => {
  if ([MAJOR, MAJOR_PENTATONIC].some((major) => sameScale(scale, major))) return 'major';
  if ([MINOR, HARMONIC_MINOR].some((minor) => sameScale(scale, minor))) return 'minor';
  return 'root';
};

export const songSubtitle = (song: Song): SongSubtitle => ({
  style: song.style,
  key: keyBySignature(song.k),
  tonality: tonalityOf(STYLES[song.style].scale),
});

const keyText = ({ key, tonality }: SongSubtitle, german: boolean): string => {
  if (tonality === 'major') return keyLabel(key, german);
  const name = key.names[key.tonic];
  const tonic = german ? germanName(name) : name;
  return tonality === 'minor' ? t('theory.minor', { tonic: tonic.toLowerCase() }) : t('learn.subtitle.root', { tonic });
};

// "Pentatonik · G-Dur / E-Moll", "Techno · g-Moll", "Dorisch · Grundton D"
export const subtitleText = (subtitle: SongSubtitle, german = false): string => {
  const style = t(`theory.style.${subtitle.style}`);
  return `${style} · ${keyText(subtitle, german)}`;
};
