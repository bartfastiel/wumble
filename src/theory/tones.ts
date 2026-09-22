// The playable tones of a style: its scale repeated over the whole range of the field, low to high.
import type { Key } from './keys';
import type { Style } from './styles';

export const OCTAVES = 8;
export const LOWEST = 24; // C1

export const tonesOf = (key: Key, style: Style): readonly number[] => {
  const out: number[] = [];
  for (let octave = 0; octave < OCTAVES; octave++)
    for (const step of style.scale) out.push(LOWEST + key.tonic + step + 12 * octave);
  return out;
};

export const toneCountOf = (style: Style): number => OCTAVES * style.scale.length;
