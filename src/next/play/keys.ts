// The keys of the right hand: one octave of the blues scale and the octave above, tuned justly against the tonic.
//
// A key is a vertical stripe. Its width says how well its tone carries over the tonic's seventh chord – the same
// rule as in the first generation (`theory/fitness`): a wide key is easier to hit, so the hand lands on what fits.
import { fitnessOf, type Fitness } from '../../theory/fitness';
import { tonicChordOf } from '../../theory/chord-maps';
import { mtof, pcOf, type PitchClass } from '../../theory/pitch';
import { STYLES } from '../../theory/styles';

export interface Key {
  readonly midi: number; // the equal-tempered key, for names
  readonly tone: number; // the sounding pitch as a fractional MIDI number
  readonly fitness: Fitness;
  readonly left: number; // 0…1 of the playing width
  readonly right: number;
}

const WIDTH_OF: Readonly<Record<Fitness, number>> = { 0: 1.45, 1: 1.2, 2: 1, 3: 0.8 };
export const GAP = 0.012; // between two keys, as a share of the playing width

const ratioOf = (semitone: PitchClass): number => STYLES.blues.ratios[semitone] ?? 2 ** (semitone / 12);

// Fractional MIDI number of a just interval above the equal-tempered tonic
export const justTone = (tonicMidi: number, semitones: number): number => {
  const octaves = Math.floor(semitones / 12);
  const ratio = ratioOf(pcOf(semitones)) * 2 ** octaves;
  return 69 + 12 * Math.log2((mtof(tonicMidi) * ratio) / 440);
};

export const bluesKeys = (tonicMidi = 60): readonly Key[] => {
  const tonic = pcOf(tonicMidi);
  const chord = tonicChordOf('blues');
  const steps = [...STYLES.blues.scale, 12];
  const weights = steps.map((s) => WIDTH_OF[fitnessOf(pcOf(tonic + s), chord, tonic, STYLES.blues)]);
  const total = weights.reduce((a, b) => a + b, 0);
  const usable = 1 - GAP * (steps.length + 1);
  let x = GAP;
  return steps.map((s, i) => {
    const width = ((weights[i] ?? 1) / total) * usable;
    const key: Key = {
      midi: tonicMidi + s,
      tone: justTone(tonicMidi, s),
      fitness: fitnessOf(pcOf(tonic + s), chord, tonic, STYLES.blues),
      left: x,
      right: x + width,
    };
    x += width + GAP;
    return key;
  });
};

// The key under a horizontal position; a finger in a gap belongs to the nearer neighbour
export const keyAt = (keys: readonly Key[], x: number): number => {
  let best = 0;
  let distance = Infinity;
  keys.forEach((key, i) => {
    const d = x < key.left ? key.left - x : Math.max(0, x - key.right);
    if (d < distance) {
      distance = d;
      best = i;
    }
  });
  return best;
};

// Changing keys while a finger slides needs it to be clearly inside the neighbour, not on its edge
export const keyWithHysteresis = (keys: readonly Key[], x: number, current: number): number => {
  const next = keyAt(keys, x);
  const key = keys[next];
  if (next === current || key === undefined) return current;
  const margin = (key.right - key.left) * 0.18;
  return x > key.left + margin && x < key.right - margin ? next : current;
};
