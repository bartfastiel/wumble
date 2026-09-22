// Groove patterns parsed into events, and the swing grid: where step s of a bar lies in seconds.
import type { DrumKind } from '../audio/engine';
import { DRUM_LANES, type Groove, type GrooveId, GROOVES, TONE_LANES, type ToneLane, VELOCITY } from './grooves';

export const STEPS_PER_BAR = 16;
export const BEATS_PER_BAR = 4;
export const GATE = 0.92; // tones end at 92 % of their length so repeated tones stay audible

export interface DrumHit {
  readonly kind: DrumKind;
  readonly step: number;
  readonly velocity: number;
}

export type BassDegree = '1' | '3' | '5' | '6' | '7' | '8' | 'L';
export type ArpDegree = '1' | '3' | '5' | '7' | '8';
export type ChordVoice = 'S' | 's' | ArpDegree; // stab, soft stab or one chord tone as an arpeggio
export interface BassNote {
  readonly lane: 'bass';
  readonly step: number;
  readonly length: number; // steps including ties
  readonly degree: BassDegree;
}
export interface ChordNote {
  readonly lane: 'chord' | 'pad';
  readonly step: number;
  readonly length: number;
  readonly voice: ChordVoice;
}
export type ToneNote = BassNote | ChordNote;

export interface Pattern {
  readonly drums: readonly DrumHit[];
  readonly tones: readonly ToneNote[];
}

const BASS_DEGREES = new Set(['1', '3', '5', '6', '7', '8', 'L']);
const CHORD_VOICES = new Set(['S', 's', '1', '3', '5', '7', '8']);
const isVelocity = (char: string): char is keyof typeof VELOCITY => char in VELOCITY;

const invalid = (lane: string, pattern: string, why: string): Error =>
  new Error(`pattern ${lane} "${pattern}": ${why}`);

// Characters with their step; '.' rests and '-' ties are skipped, the tie length is counted for the tone before
const symbols = (lane: string, pattern: string): { step: number; char: string; length: number }[] => {
  if (pattern.length !== STEPS_PER_BAR) throw invalid(lane, pattern, `${String(STEPS_PER_BAR)} characters expected`);
  const out: { step: number; char: string; length: number }[] = [];
  for (let step = 0; step < STEPS_PER_BAR; step++) {
    const char = pattern.charAt(step);
    if (char === '.' || char === '-') continue;
    let length = 1;
    while (step + length < STEPS_PER_BAR && pattern[step + length] === '-') length++;
    out.push({ step, char, length });
  }
  return out;
};

const drumHits = (kind: DrumKind, pattern: string): DrumHit[] =>
  symbols(kind, pattern).map(({ step, char }) => {
    if (!isVelocity(char)) throw invalid(kind, pattern, `unknown drum symbol "${char}"`);
    return { kind, step, velocity: VELOCITY[char] };
  });

const toneNotes = (lane: ToneLane, pattern: string): ToneNote[] =>
  symbols(lane, pattern).map(({ step, char, length }) => {
    if (lane === 'bass') {
      if (!BASS_DEGREES.has(char)) throw invalid(lane, pattern, `unknown bass degree "${char}"`);
      return { lane, step, length, degree: char as BassDegree };
    }
    if (!CHORD_VOICES.has(char)) throw invalid(lane, pattern, `unknown chord symbol "${char}"`);
    return { lane, step, length, voice: char as ChordVoice };
  });

// Events lane by lane in the order the band plays them: drums first, then bass, chord, pad
export const parseGroove = (groove: Groove): Pattern => ({
  drums: DRUM_LANES.flatMap((kind) => {
    const pattern = groove[kind];
    return pattern === undefined ? [] : drumHits(kind, pattern);
  }),
  tones: TONE_LANES.flatMap((lane) => {
    const pattern = groove[lane];
    return pattern === undefined ? [] : toneNotes(lane, pattern);
  }),
});

// Parsed once at load: an invalid pattern fails immediately
export const PATTERNS: Readonly<Record<GrooveId, Pattern>> = {
  blues: parseGroove(GROOVES.blues),
  rock: parseGroove(GROOVES.rock),
  techno: parseGroove(GROOVES.techno),
  jazz: parseGroove(GROOVES.jazz),
  pop: parseGroove(GROOVES.pop),
  calm: parseGroove(GROOVES.calm),
};

// Start of step `step` (also beyond 16, for tone lengths) in seconds from the bar start, with swing: the first eighth
// of a beat lasts swing · beat, the second the rest; a sixteenth halves its eighth
export const stepOffset = (step: number, beat: number, groove: Groove): number => {
  const swing = groove.swing ?? 0.5;
  const quarter = Math.floor(step / 4);
  const rest = step % 4;
  const secondEighth = rest >= 2;
  const secondSixteenth = rest % 2 === 1;
  if (groove.swing16 === true) {
    return quarter * beat + (secondEighth ? beat / 2 : 0) + (secondSixteenth ? (swing * beat) / 2 : 0);
  }
  const first = swing * beat;
  const eighthStart = secondEighth ? first : 0;
  const eighthLength = secondEighth ? beat - first : first;
  return quarter * beat + eighthStart + (secondSixteenth ? eighthLength / 2 : 0);
};
