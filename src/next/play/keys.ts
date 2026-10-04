// The keys of the right hand: every tone of the scale across the violin's range, tuned justly against the tonic.
//
// A key is a vertical stripe. The key of the music decides how wide and how bright it is – the same rule as in the
// first generation (`theory/fitness`): what carries over the tonic's chord is wide and white, what pulls is narrow and
// falls into slate. A wide key is easier to hit, so the hand lands on what fits.
import { fitnessOf, type Fitness } from '../../theory/fitness';
import { tonicChordOf } from '../../theory/chord-maps';
import { mtof, pcOf, type PitchClass } from '../../theory/pitch';
import { STYLES } from '../../theory/styles';

export interface Key {
  readonly midi: number; // the equal-tempered key, for names
  readonly tone: number; // the sounding pitch as a fractional MIDI number – the only pitch this key ever sounds
  readonly fitness: Fitness;
  readonly tonic: boolean;
  readonly left: number; // 0…1 of the playing width
  readonly right: number;
}

export interface Range {
  readonly tonic: number; // MIDI number of a tonic, any octave
  readonly low: number; // lowest MIDI number that may sound
  readonly high: number; // highest
}

// The violin from its open G string up to three octaves above middle C
export const VIOLIN: Range = { tonic: 60, low: 55, high: 96 };

const WIDTH_OF: Readonly<Record<Fitness, number>> = { 0: 1.5, 1: 1.2, 2: 1, 3: 0.75 };
export const GAP = 0.006; // between two keys, as a share of the playing width

const ratioOf = (semitone: PitchClass): number => STYLES.blues.ratios[semitone] ?? 2 ** (semitone / 12);

// Fractional MIDI number of a just interval above (or below) the equal-tempered tonic
export const justTone = (tonicMidi: number, semitones: number): number => {
  const octaves = Math.floor(semitones / 12);
  const ratio = ratioOf(pcOf(semitones)) * 2 ** octaves;
  return 69 + 12 * Math.log2((mtof(tonicMidi) * ratio) / 440);
};

export const bluesKeys = (range: Range = VIOLIN): readonly Key[] => {
  const tonic = pcOf(range.tonic);
  const chord = tonicChordOf('blues');
  const inScale = new Set(STYLES.blues.scale.map((s) => pcOf(tonic + s)));
  const tones: number[] = [];
  for (let midi = range.low; midi <= range.high; midi++) if (inScale.has(pcOf(midi))) tones.push(midi);

  const fitness = tones.map((midi) => fitnessOf(pcOf(midi), chord, tonic, STYLES.blues));
  const weights = fitness.map((f) => WIDTH_OF[f]);
  const total = weights.reduce((a, b) => a + b, 0);
  const usable = 1 - GAP * (tones.length + 1);
  let x = GAP;
  return tones.map((midi, i) => {
    const width = ((weights[i] ?? 1) / total) * usable;
    const key: Key = {
      midi,
      tone: justTone(range.tonic, midi - range.tonic),
      fitness: fitness[i] ?? 2,
      tonic: pcOf(midi) === tonic,
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
