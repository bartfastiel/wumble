// The six grooves as data: 16 characters per bar, one per sixteenth.
//   Drums (kick, snare, hatClosed, hatOpen, clap, ride): 'X' loud, 'x' normal, 'o' soft, '.' nothing
//   bass: 1 root, 3 third, 5 fifth (chord tones), 6 sixth, 7 seventh, 8 octave, L chromatic leading tone
//     below the root of the next chord (known in a schema, otherwise below the current one); '-' ties, '.' rest
//   chord: 'S' chord stab (all tones of the chord), 's' soft stab, digits 1 3 5 7 8 single chord tones as an arpeggio
//     (played on the melody layer – pads are too slow for sixteenths); pad: a second, softer chord lane for held pads
//   swing: position of the second eighth within the beat (0.5 straight, 0.6 jazz, 0.66 shuffle); swing16: the same for
//     the second sixteenth within the eighth. Tones end at 92 % of their length so repeated tones stay audible.
//   drums/tones: level of the drums and of all tones of the groove (the combis of the styles differ in loudness)
import type { DrumKind } from '../audio/engine';
import type { GrooveId } from '../theory/styles';

export type { GrooveId };
export type ToneLane = 'bass' | 'chord' | 'pad';
export type Lane = DrumKind | ToneLane;

export const DRUM_LANES: readonly DrumKind[] = ['kick', 'snare', 'hatClosed', 'hatOpen', 'clap', 'ride'];
export const TONE_LANES: readonly ToneLane[] = ['bass', 'chord', 'pad'];

export type Groove = {
  readonly swing?: number;
  readonly swing16?: boolean;
  readonly drums?: number;
  readonly tones?: number;
} & Readonly<Partial<Record<Lane, string>>>;

export const GROOVES: Readonly<Record<GrooveId, Groove>> = {
  // Shuffle: kick on 1 and 3, snare on 2 and 4, boogie bass 1 1 3 3 5 5 6 6, stabs on the "and"
  blues: {
    swing: 0.66,
    drums: 1.4,
    kick: 'x.......x.......',
    snare: '....x.......x...',
    hatClosed: 'x.x.x.x.x.x.x.x.',
    bass: '1-1-3-3-5-5-6-6-',
    chord: '..S...S...S...S.',
  },
  // Eighth hats, root eighths in the bass, power chord on 1 and "3 and"
  rock: {
    drums: 0.6,
    tones: 1.3,
    kick: 'x.....x.x.....x.',
    snare: '....x.......x...',
    hatClosed: 'X.x.X.x.X.x.X.x.',
    bass: '1-1-1-1-1-1-1-1-',
    chord: 'S---------S-----',
  },
  // Kick on every beat, open hat in between, clap on 2 and 4, octave bass, arpeggio 1 5 8 3
  techno: {
    kick: 'x...x...x...x...',
    hatOpen: '..x...x...x...x.',
    clap: '....x.......x...',
    bass: '.181.181.181.181',
    chord: '1583158315831583',
  },
  // Ride pattern, hat on 2 and 4, walking bass 1 3 5 leading tone, comping on "2 and" and 4
  jazz: {
    swing: 0.6,
    drums: 1.8,
    ride: 'x...x.x.x...x.x.',
    hatClosed: '....o.......o...',
    kick: 'o...............',
    bass: '1---3---5---L---',
    chord: '......S.....S---',
  },
  // Gentle: kick on 1 and "3 and", pad across the bar, soft stab on 1
  pop: {
    drums: 1.1,
    kick: 'x.........x.....',
    snare: '....x.......x...',
    hatClosed: 'o.o.o.o.o.o.o.o.',
    bass: '1-1-1-1-1-1-1-1-',
    chord: 's...............',
    pad: 'S---------------',
  },
  // No drums: drone and pad per bar
  calm: { bass: '1---------------', pad: 'S---------------' },
};

export const VELOCITY: Readonly<Record<'X' | 'x' | 'o', number>> = { X: 1, x: 0.7, o: 0.35 };

// Level of the band's tones relative to the layer of the combi: softer than a held chord so the drums carry and the
// melody stays in front (measured on a rendered band: drums 40–70 % of the mix, peak < 1)
export const LEVEL = { bass: 0.5, chord: 0.8, pad: 0.4, soft: 0.5, arp: 0.45 } as const;
