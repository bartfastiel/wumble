// A scan becomes a song of the library's "scanned" group (this session only): tones folded into the field's range,
// chords from the injected harmoniser, the current style when it stacks major thirds and holds every tone,
// otherwise classical.
import { locale, t } from '../i18n';
import type { Song, SongNote } from '../learn/song-notation';
import type { Key } from '../theory/keys';
import { buildModel, chordAt } from '../theory/model';
import { pcOf } from '../theory/pitch';
import { isFunctional } from '../theory/roman';
import { type StyleId, STYLES } from '../theory/styles';
import { foldIntoRange } from './pitch-from-staff';
import { numberAt } from './raster';
import type { ScannedNote } from './sheet-scanner';

export interface PlainNote {
  readonly midi: number;
  readonly beats: number;
}

export type Harmonizer = (notes: readonly PlainNote[]) => readonly number[]; // chord index per note
export const SCAN_BPM = 100;

export interface SongFromScanOptions {
  readonly key: Key;
  readonly style: StyleId; // the style currently played
  readonly harmonize: Harmonizer;
  readonly now?: Date;
}

const inScale = (notes: readonly PlainNote[], key: Key, style: StyleId): boolean =>
  notes.every((note) => STYLES[style].scale.includes(pcOf(note.midi - key.tonic)));

export const styleForScan = (notes: readonly PlainNote[], key: Key, current: StyleId): StyleId => {
  const style = isFunctional(current) ? current : 'classical';
  return inScale(notes, key, style) ? style : 'classical';
};

const timeLabel = (now: Date): string => now.toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' });

export const songFromScan = (
  notes: readonly ScannedNote[],
  { key, style: current, harmonize, now = new Date() }: SongFromScanOptions,
): Song => {
  const style = styleForScan(notes, key, current);
  const model = buildModel(key, style);
  const lowest = numberAt(model.tones, 0);
  const highest = numberAt(model.tones, model.tones.length - 1);
  const plain = notes.map((note) => ({ midi: foldIntoRange(note.midi, lowest, highest), beats: note.beats }));
  const harmonies = harmonize(plain);
  return {
    title: t('scan.songTitle', { time: timeLabel(now) }),
    k: key.signature,
    bpm: SCAN_BPM,
    style,
    group: 'scanned',
    notes: plain.map((note, i): SongNote => {
      const index = harmonies[i];
      const chord = index === undefined ? null : chordAt(model, index);
      // A functional style has a scale degree on every chord; a missing one is a broken harmoniser
      if (chord === null || chord.degree === -1) throw new RangeError(`no chord for note ${String(i)}`);
      return { ...note, degree: chord.degree, root: chord.offset };
    }),
  };
};
