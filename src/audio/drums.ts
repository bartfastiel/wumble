// The band's drums: synthetic, no samples. One noise buffer (2 s) for every instrument, an own drum bus (0.6) dry into
// the compressor; kick and snare body are sines with a frequency glide, everything else filtered noise with an
// exponentially decaying envelope. `velocity` is the stroke (0…1).
import { random } from './random';

export type DrumKind = 'kick' | 'snare' | 'hatClosed' | 'hatOpen' | 'clap' | 'ride';

export interface Drums {
  hit(kind: DrumKind, at: number, velocity?: number): void;
}

export const createDrums = (context: BaseAudioContext, target: AudioNode): Drums => {
  let ready: { bus: GainNode; noise: AudioBuffer } | null = null;
  const prepare = (): { bus: GainNode; noise: AudioBuffer } => {
    if (ready) return ready;
    const bus = context.createGain();
    bus.gain.value = 0.6;
    bus.connect(target);
    const noise = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = random() * 2 - 1;
    ready = { bus, noise };
    return ready;
  };

  // Noise burst through a filter (type, frequency, Q), level `gain` down to −60 dB in `seconds`; random start in the noise
  const burst = (
    at: number,
    seconds: number,
    type: BiquadFilterType,
    frequency: number,
    q: number,
    gain: number,
  ): void => {
    const { bus, noise } = prepare();
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const envelope = context.createGain();
    source.buffer = noise;
    filter.type = type;
    filter.frequency.value = frequency;
    filter.Q.value = q;
    envelope.gain.setValueAtTime(gain, at);
    envelope.gain.exponentialRampToValueAtTime(0.001, at + seconds);
    source.connect(filter);
    filter.connect(envelope);
    envelope.connect(bus);
    source.start(at, random() * 1.5);
    source.stop(at + seconds + 0.02);
  };
  // Sine with a frequency glide from → to in `glide` s, level down to −60 dB in `seconds`
  const thump = (at: number, seconds: number, from: number, to: number, glide: number, gain: number): void => {
    const { bus } = prepare();
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    oscillator.frequency.setValueAtTime(from, at);
    oscillator.frequency.exponentialRampToValueAtTime(to, at + glide);
    envelope.gain.setValueAtTime(gain, at);
    envelope.gain.exponentialRampToValueAtTime(0.001, at + seconds);
    oscillator.connect(envelope);
    envelope.connect(bus);
    oscillator.start(at);
    oscillator.stop(at + seconds + 0.02);
  };

  const strokes: Readonly<Record<DrumKind, (at: number, v: number) => void>> = {
    kick: (at, v) => {
      thump(at, 0.35, 160, 45, 0.06, v);
    },
    snare: (at, v) => {
      burst(at, 0.18, 'highpass', 1500, 0.7, 0.7 * v);
      thump(at, 0.12, 190, 150, 0.08, 0.45 * v);
    },
    hatClosed: (at, v) => {
      burst(at, 0.04, 'bandpass', 8000, 1, 0.5 * v);
    },
    hatOpen: (at, v) => {
      burst(at, 0.25, 'bandpass', 8000, 1, 0.45 * v);
    },
    clap: (at, v) => {
      burst(at, 0.08, 'bandpass', 1500, 0.8, 0.6 * v);
      burst(at + 0.012, 0.08, 'bandpass', 1500, 0.8, 0.6 * v);
    },
    ride: (at, v) => {
      burst(at, 0.3, 'bandpass', 5000, 2, 0.4 * v);
    },
  };

  return {
    hit: (kind, at, velocity = 1) => {
      strokes[kind](at, Math.max(0.01, velocity));
    },
  };
};
