// Single sounds: synthesizers or the sampler with the recordings of the manifest. `gain` is the
// level of one voice, `release` the decay after letting go, `reverb` the impulse response ('room' 1.8 s or 'church' 4 s)
// and `wet` the reverb share relative to the reverb return (1 = straight into the reverb, like the original bus).
import type { SampleSetId } from './sample-manifest';

export type ReverbId = 'room' | 'church';

interface SoundBase {
  readonly gain: number;
  readonly release: number;
  readonly wet: number;
  readonly reverb: ReverbId;
}
// 2-operator FM (e-piano, bell)
export interface FmSound extends SoundBase {
  readonly type: 'fm';
  readonly ratio: number;
  readonly index: number;
  readonly decay: number;
  readonly sustain: number;
}
// additive organ with four partials
export interface OrganSound extends SoundBase {
  readonly type: 'organ';
}
// two detuned sawtooths per tone through a lowpass – the original chord pad
export interface SoftPadSound extends SoundBase {
  readonly type: 'softPad';
}
// sine plus a little triangle for contour – the original bass
export interface SineBassSound extends SoundBase {
  readonly type: 'sineBass';
}
// seven sawtooths ±25 cents through a lowpass with an envelope cutoff[0] → cutoff[1] in `sweep`, plus a light chorus
export interface SupersawSound extends SoundBase {
  readonly type: 'supersaw';
  readonly attack: number;
  readonly cutoff: readonly [number, number];
  readonly sweep: number;
}
// sawtooth through a lowpass envelope, a sine on the root below as sub
export interface SynthBassSound extends SoundBase {
  readonly type: 'synthBass';
}
// plucked string (Karplus-Strong), computed per note
export interface PluckSound extends SoundBase {
  readonly type: 'pluck';
}
// sampler: nearest recording of the set, pitched via playbackRate; attack 3–8 ms
export interface SampleSound extends SoundBase {
  readonly type: 'sample';
  readonly set: SampleSetId;
  readonly attack: number;
}
export type SynthSound =
  FmSound | OrganSound | SoftPadSound | SineBassSound | SupersawSound | SynthBassSound | PluckSound;
export type Sound = SynthSound | SampleSound;

export const SOUNDS = {
  epiano: {
    type: 'fm',
    ratio: 1,
    index: 2.4,
    gain: 0.5,
    decay: 0.9,
    sustain: 0.3,
    release: 0.25,
    wet: 1,
    reverb: 'room',
  },
  bell: {
    type: 'fm',
    ratio: 3.5,
    index: 1.1,
    gain: 0.35,
    decay: 1.6,
    sustain: 0.15,
    release: 0.6,
    wet: 1,
    reverb: 'room',
  },
  organ: { type: 'organ', gain: 0.22, release: 0.08, wet: 1, reverb: 'room' },
  softPad: { type: 'softPad', gain: 0.035, release: 0.35, wet: 1, reverb: 'room' },
  sineBass: { type: 'sineBass', gain: 0.25, release: 0.3, wet: 1, reverb: 'room' },
  piano: { type: 'sample', set: 'piano', gain: 1.2, attack: 0.003, release: 0.35, wet: 0.8, reverb: 'room' },
  violin: { type: 'sample', set: 'violin', gain: 1, attack: 0.008, release: 0.3, wet: 1.3, reverb: 'room' },
  strings: { type: 'sample', set: 'strings', gain: 0.45, attack: 0.008, release: 0.3, wet: 1.5, reverb: 'room' },
  doubleBass: { type: 'sample', set: 'doubleBass', gain: 0.9, attack: 0.008, release: 0.3, wet: 0.6, reverb: 'room' },
  churchOrgan: { type: 'sample', set: 'organ', gain: 1.2, attack: 0.005, release: 0.15, wet: 1, reverb: 'church' },
  supersaw: {
    type: 'supersaw',
    gain: 0.11,
    attack: 0.01,
    cutoff: [8000, 2000],
    sweep: 0.25,
    release: 0.25,
    wet: 0.8,
    reverb: 'room',
  },
  pad: {
    type: 'supersaw',
    gain: 0.04,
    attack: 0.4,
    cutoff: [3000, 1200],
    sweep: 0.8,
    release: 0.6,
    wet: 1.4,
    reverb: 'room',
  },
  synthBass: { type: 'synthBass', gain: 0.22, release: 0.2, wet: 0.3, reverb: 'room' },
  pluck: { type: 'pluck', gain: 1, release: 0.15, wet: 1, reverb: 'room' },
} as const satisfies Record<string, Sound>;
export type SoundId = keyof typeof SOUNDS;
