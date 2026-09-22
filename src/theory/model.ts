// The playing field derived from key and style: the chord map, the tones of the scale, the key's hue.
import { type MapChord, mapOf, specsOfMap, tonicChordOf } from './chord-maps';
import { type Chord, chordOf } from './chords';
import { hueOf, type Key } from './keys';
import { STYLES, type Style, type StyleId } from './styles';
import { tonesOf } from './tones';

export interface Model {
  readonly key: Key;
  readonly styleId: StyleId;
  readonly style: Style;
  readonly map: readonly MapChord[];
  readonly chords: readonly Chord[]; // the map's chords, in the map's order
  readonly tones: readonly number[];
  readonly home: number; // index of the tonic chord
  readonly hue: number;
}

export const buildModel = (key: Key, styleId: StyleId): Model => {
  const style = STYLES[styleId];
  const map = mapOf(styleId);
  return {
    key,
    styleId,
    style,
    map,
    chords: specsOfMap(styleId, style.scale, style.sharps ?? []).map((spec) => chordOf(key, spec)),
    tones: tonesOf(key, style),
    home: map.indexOf(tonicChordOf(styleId)),
    hue: hueOf(key),
  };
};

export const chordAt = (model: Model, index: number): Chord => {
  const chord = model.chords[index];
  if (chord === undefined) throw new RangeError(`no chord ${String(index)}`);
  return chord;
};

export const toneOf = (model: Model, index: number): number => {
  const midi = model.tones[index];
  if (midi === undefined) throw new RangeError(`no tone ${String(index)}`);
  return midi;
};

export interface Note {
  readonly chord: Chord;
  readonly midi: number;
}

// A chord of the map together with one tone – what a sounding note consists of
export const noteOf = (model: Model, chord: number, tone: number): Note => ({
  chord: chordAt(model, chord),
  midi: toneOf(model, tone),
});
