// Phrase generator: `bars` bars over the chords `chords` (one per bar) → notes in beats;
// `from` is the column of the previous tone (continuation), otherwise free around the middle. Rhythm: per beat a
// quarter or (40 %) a pair of eighths, the last two beats a half note. Tones: the first, the last and those on beats 1
// and 3 (90 %) are chord tones of the bar's chord – near the predecessor, weighted by distance (NEAR); otherwise
// stepwise motion with the weights second ±1 0.3 each, repeat 0.1, third ±2 0.08 each, leap ±3 0.04 each (STEPS);
// after a leap (> 2 stripes) it steps back 70 % of the time. The phrase sings in the two octaves above middle C
// (mirrored at the edge), no tone further than 3 stripes from its predecessor – with no chord tone that near, even a
// strong tone becomes a step.
import { chordAt, type Model } from '../theory/model';
import { pcOf } from '../theory/pitch';

export type Rng = () => number; // like Math.random: [0, 1)

export interface PhraseNote {
  readonly t: number; // beats
  readonly dur: number;
  readonly tone: number;
}

export const STEPS: readonly (readonly [step: number, weight: number])[] = [
  [-1, 0.3],
  [1, 0.3],
  [0, 0.1],
  [-2, 0.08],
  [2, 0.08],
  [-3, 0.04],
  [3, 0.04],
];
export const NEAR: readonly number[] = [0.12, 0.45, 0.28, 0.15]; // weight of a chord tone by distance 0…3 stripes
export const SINGING_LOW = 60; // middle C: low enough to carry, high enough to be heard over the band
export const SINGING_OCTAVES = 2;
const REACH = 3;

// The stripes a phrase may use: two octaves from the first tone at middle C or above
export const singingRange = (model: Model): readonly [low: number, high: number] => {
  const low = Math.max(
    0,
    model.tones.findIndex((midi) => midi >= SINGING_LOW),
  );
  const high = Math.min(model.tones.length - 1, low + SINGING_OCTAVES * model.style.scale.length);
  return [low, high];
};
const middleOf = (model: Model): number => {
  const [low, high] = singingRange(model);
  return Math.round((low + high) / 2);
};
const EIGHTHS = 0.4;
const STRONG = 0.9;
const STEP_BACK = 0.7;

// Weighted random choice from `list` with weight(x) > 0
export const weightedPick = <T>(rng: Rng, list: readonly T[], weight: (x: T) => number): T => {
  let rest = rng() * list.reduce((sum, x) => sum + weight(x), 0);
  let chosen: T | undefined;
  for (const x of list) {
    chosen = x;
    rest -= weight(x);
    if (rest < 0) break;
  }
  if (chosen === undefined) throw new RangeError('nothing to pick from');
  return chosen;
};

export const nearWeight = (distance: number): number => {
  const weight = NEAR[distance];
  if (weight === undefined) throw new RangeError(`no weight for distance ${String(distance)}`);
  return weight;
};

const rhythm = (bars: number, rng: Rng): { t: number; dur: number }[] => {
  const length = bars * 4;
  const notes: { t: number; dur: number }[] = [];
  for (let t = 0; t < length - 2; t++) {
    if (rng() < EIGHTHS) notes.push({ t, dur: 0.5 }, { t: t + 0.5, dur: 0.5 });
    else notes.push({ t, dur: 1 });
  }
  notes.push({ t: length - 2, dur: 2 });
  return notes;
};

// Stripes within the singing range whose tone belongs to the chord
const chordStripes = (model: Model, index: number): number[] => {
  const chord = chordAt(model, index);
  const [low, high] = singingRange(model);
  return model.tones.flatMap((midi, tone) =>
    tone >= low && tone <= high && chord.pcs.includes(pcOf(midi)) ? [tone] : [],
  );
};

// A chord tone near the previous tone, weighted by distance; the first tone free around the middle
const chordTone = (rng: Rng, model: Model, near: readonly number[], previous: number | null): number =>
  weightedPick(rng, near, (tone) =>
    previous === null ? 1 / (1 + Math.abs(tone - middleOf(model))) : nearWeight(Math.abs(tone - previous)),
  );

// A step from the previous tone; after a leap it steps back, at the edge of the range it mirrors
const stepTone = (rng: Rng, model: Model, previous: number | null, lastStep: number): number => {
  const [low, high] = singingRange(model);
  let step = previous === null ? 0 : weightedPick(rng, STEPS, ([, weight]) => weight)[0];
  if (Math.abs(lastStep) > 2 && rng() < STEP_BACK) step = lastStep > 0 ? -1 : 1;
  const base = previous ?? middleOf(model);
  const tone = base + step;
  return tone < low || tone > high ? base - step : tone;
};

export const composePhrase = (
  model: Model,
  bars: number,
  chords: readonly number[],
  rng: Rng,
  from: number | null = null,
): PhraseNote[] => {
  const notes = rhythm(bars, rng);
  let previous = from;
  let lastStep = 0;
  return notes.map((note, i) => {
    const chord = chords[Math.floor(note.t / 4) % chords.length];
    if (chord === undefined) throw new RangeError('a phrase needs at least one chord');
    const strong = previous === null || i === notes.length - 1 || (note.t % 2 === 0 && rng() < STRONG);
    const before = previous;
    const candidates = chordStripes(model, chord);
    const near = before === null ? candidates : candidates.filter((tone) => Math.abs(tone - before) <= REACH);
    const tone =
      strong && near.length > 0 ? chordTone(rng, model, near, before) : stepTone(rng, model, before, lastStep);
    lastStep = before === null ? 0 : tone - before;
    previous = tone;
    return { ...note, tone };
  });
};
