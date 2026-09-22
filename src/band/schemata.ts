// Chord source of the band: "follow" takes the chord from the play (song, auto-harmony or the chord last chosen
// on the map); the schemata run bar by bar over degree offsets (semitones above the tonic of the key). The chord
// for an offset is looked up in the current style by root – if none matches, the nearest by root, on a tie the one
// closer to home.
import type { Model } from '../theory/model';
import { pcOf, type PitchClass } from '../theory/pitch';

export const SCHEMA_IDS = ['follow', 'blues', 'pop', 'canon', 'andalusian', 'turnaround'] as const;
export type SchemaId = (typeof SCHEMA_IDS)[number];

export interface Schema {
  readonly bars: readonly PitchClass[] | null; // chord root per bar, null: follow the play
}

export const SCHEMATA: Readonly<Record<SchemaId, Schema>> = {
  follow: { bars: null },
  blues: { bars: [0, 0, 0, 0, 5, 5, 0, 0, 7, 5, 0, 7] }, // I I I I · IV IV I I · V IV I V
  pop: { bars: [0, 7, 9, 5] }, // I – V – vi – IV
  canon: { bars: [0, 7, 9, 4, 5, 0, 5, 7] }, // I – V – vi – iii – IV – I – IV – V
  andalusian: { bars: [0, 10, 8, 7] }, // i – ♭VII – ♭VI – V
  turnaround: { bars: [0, 9, 2, 7] }, // I – vi – ii – V
};

// Chord with the same root as the offset, otherwise the nearest by semitone distance; on a tie the one closer to
// the tonic, which is the chord a style falls back to.
export const chordByOffset = (model: Model, offset: number): number => {
  let best = model.home;
  let nearest = Number.POSITIVE_INFINITY;
  model.chords.forEach((chord, index) => {
    const up = pcOf(chord.offset - offset);
    const distance = Math.min(up, 12 - up);
    const closer = Math.abs(index - model.home) < Math.abs(best - model.home);
    if (distance < nearest || (distance === nearest && closer)) {
      best = index;
      nearest = distance;
    }
  });
  return best;
};

// The chord of bar `bar` in a schema, null when the schema follows the play
export const schemaChord = (model: Model, schema: Schema, bar: number): number | null => {
  const { bars } = schema;
  if (bars === null) return null;
  const offset = bars[bar % bars.length];
  if (offset === undefined) throw new RangeError('a schema needs at least one bar');
  return chordByOffset(model, offset);
};
