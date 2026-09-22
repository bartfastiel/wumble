// How well a tone fits the chord that is sounding right now.
import { type MapChord, pitchesOf, rootOf } from './chord-maps';
import { type PitchClass, pcOf } from './pitch';
import type { Style } from './styles';

// 0 carries · 1 colours · 2 soft · 3 pulls
export type Fitness = 0 | 1 | 2 | 3;

const distance = (from: PitchClass, to: PitchClass): number => pcOf(to - from);

// A tone of the chord: the root and the fifth carry it, the third colours it, a seventh pulls only where the chord
// leads home.
const fitnessOfChordTone = (above: number, leading: boolean): Fitness => {
  if (above === 0 || above === 7) return 0;
  if (above === 3 || above === 4) return 1;
  if (above === 10 || above === 11) return leading ? 3 : 1;
  return 2;
};

export const fitnessOf = (tone: PitchClass, chord: MapChord, tonic: PitchClass, style: Style): Fitness => {
  const root = rootOf(chord, tonic);
  const tones = pitchesOf(chord, tonic);
  if (tones.includes(tone)) return fitnessOfChordTone(distance(root, tone), chord.step < 0);

  // Where the chord's third is missing from the scale, its lower neighbour takes over that role:
  // this is what lets a blue note act as the third.
  const scaleTones = style.scale.map((s) => pcOf(tonic + s));
  const third = tones.find((t) => distance(root, t) === 3 || distance(root, t) === 4);
  if (third !== undefined && !scaleTones.includes(third) && distance(tone, third) === 1) return 1;

  // Scales of six tones or fewer are closed systems – friction is intended there, not a mistake.
  const lenient = style.scale.length <= 6;
  const rubs = tones.some((t) => distance(t, tone) === 1);
  if (rubs) return lenient ? 2 : 3;
  return 2;
};
