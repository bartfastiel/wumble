// Sampler: the nearest recording by semitone distance, pitched via playbackRate, looped where the manifest says so.
import { mtof } from '../theory/pitch';
import type { SampleSound } from './sounds';
import { attack, type Stoppable } from './synths';

export type Loop = readonly [start: number, end: number];
export interface PreparedSample {
  readonly root: number; // measured fundamental (MIDI, fractional)
  readonly buffer: AudioBuffer;
  readonly loop: Loop | null;
}

const SILENCE = 0.002; // below this the lead-in counts as silent
const LEAD_MARGIN = 0.002; // seconds kept before the first audible sample
const CROSSFADE = 0.04; // seconds blended at the loop end

// Loop points of the manifest refer to the decoded buffer. MP3 carries encoder delay (Chrome keeps it: ≈ 23 ms of
// silence), and whether a decoder trims it is up to the browser – so two things are baked in here:
// 1. The initial silence is skipped (up to 2 ms before the first audible sample) so the attack comes without delay;
//    the loop points move forward by the same amount.
// 2. The loop: a copy up to the loop end whose last 40 ms are crossfaded with the signal before the loop start. The
//    jump from the end back to the start is then click-free however the points are shifted against the original
//    (the loop length stays, the waveforms match).
export const bake = (
  context: BaseAudioContext,
  decoded: AudioBuffer,
  loop: Loop | null,
): { buffer: AudioBuffer; loop: Loop | null } => {
  const rate = decoded.sampleRate;
  const source = decoded.getChannelData(0);
  const onset = source.findIndex((value) => Math.abs(value) >= SILENCE);
  const lead = Math.max(0, (onset < 0 ? source.length : onset) - Math.round(LEAD_MARGIN * rate));
  const end = loop ? Math.min(source.length, Math.round(loop[1] * rate)) : source.length;
  const buffer = context.createBuffer(1, end - lead, rate);
  const data = buffer.getChannelData(0);
  data.set(source.subarray(lead, end));
  if (!loop) return { buffer, loop: null };
  const start = Math.round(loop[0] * rate) - lead;
  const length = Math.min(Math.round(CROSSFADE * rate), start, data.length - start);
  const tail = data.subarray(data.length - length);
  const beforeStart = data.subarray(start - length, start);
  tail.forEach((late, i) => {
    const weight = (i + 1) / length;
    tail[i] = late * (1 - weight) + (beforeStart[i] ?? 0) * weight;
  });
  return { buffer, loop: [start / rate, data.length / rate] };
};

// The sample whose root is closest to the frequency, by semitone distance
export const nearestSample = (samples: readonly PreparedSample[], frequency: number): PreparedSample | undefined => {
  const midi = 69 + 12 * Math.log2(frequency / 440);
  let best: PreparedSample | undefined;
  for (const sample of samples) {
    if (!best || Math.abs(sample.root - midi) < Math.abs(best.root - midi)) best = sample;
  }
  return best;
};

export const playSamples = (
  context: BaseAudioContext,
  samples: readonly PreparedSample[],
  sound: SampleSound,
  freqs: readonly number[],
  at: number,
  amp: GainNode,
  gain: number,
): Stoppable[] => {
  const sources: Stoppable[] = [];
  for (const f of freqs) {
    const sample = nearestSample(samples, f);
    if (!sample) continue;
    const source = context.createBufferSource();
    source.buffer = sample.buffer;
    source.playbackRate.value = f / mtof(sample.root);
    if (sample.loop) {
      source.loop = true;
      source.loopStart = sample.loop[0];
      source.loopEnd = sample.loop[1];
    }
    source.connect(amp);
    source.start(at);
    sources.push(source);
  }
  attack(amp, gain, at, sound.attack);
  return sources;
};
