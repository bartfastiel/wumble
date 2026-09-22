// Building blocks per synth type: (sound, frequencies in Hz, start time, the voice's amplifier, level) → the sources
// to stop at release.
import { random } from './random';
import type { FmSound, SupersawSound, SynthSound } from './sounds';

export interface Stoppable {
  stop(when: number): void;
}
type Voice = readonly [freqs: readonly number[], at: number, amp: GainNode, gain: number];

const PARTIALS: readonly (readonly [harmonic: number, level: number])[] = [
  [1, 1],
  [2, 0.5],
  [3, 0.25],
  [4, 0.12],
];
const SUPERSAW_CENTS = [-25, -16.7, -8.3, 0, 8.3, 16.7, 25];
const CHORUS: readonly (readonly [delay: number, rate: number])[] = [
  [0.012, 0.3],
  [0.017, 0.4],
];

// Ramp from 0 to `gain` in `seconds`
export const attack = (amp: GainNode, gain: number, at: number, seconds: number): void => {
  amp.gain.setValueAtTime(0, at);
  amp.gain.linearRampToValueAtTime(gain, at + seconds);
};

export interface Synths {
  fm(sound: FmSound, ...voice: Voice): Stoppable[];
  play(sound: SynthSound, ...voice: Voice): Stoppable[];
}

export const createSynths = (context: BaseAudioContext): Synths => {
  const osc = (type: OscillatorType, frequency: number, at: number): OscillatorNode => {
    const node = context.createOscillator();
    node.type = type;
    node.frequency.value = frequency;
    node.start(at);
    return node;
  };
  const lowpass = (q: number): BiquadFilterNode => {
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = q;
    return filter;
  };

  // 2-operator FM (e-piano, bell)
  const fm = (sound: FmSound, freqs: readonly number[], at: number, amp: GainNode, gain: number): Stoppable[] => {
    const sources: Stoppable[] = [];
    for (const f of freqs) {
      const carrier = osc('sine', f, at);
      const modulator = osc('sine', f * sound.ratio, at);
      const depth = context.createGain();
      modulator.connect(depth);
      depth.connect(carrier.frequency);
      carrier.connect(amp);
      depth.gain.setValueAtTime(f * sound.index, at);
      depth.gain.setTargetAtTime(f * sound.index * 0.12, at, sound.decay / 3);
      sources.push(carrier, modulator);
    }
    attack(amp, gain, at, 0.005);
    amp.gain.setTargetAtTime(gain * sound.sustain, at + 0.005, sound.decay / 3);
    return sources;
  };

  // additive organ: four partials
  const organ = (freqs: readonly number[], at: number, amp: GainNode, gain: number): Stoppable[] => {
    const sources: Stoppable[] = [];
    for (const f of freqs) {
      for (const [harmonic, level] of PARTIALS) {
        const partial = osc('sine', f * harmonic, at);
        const partialGain = context.createGain();
        partialGain.gain.value = level;
        partial.connect(partialGain);
        partialGain.connect(amp);
        sources.push(partial);
      }
    }
    attack(amp, gain, at, 0.02);
    return sources;
  };

  // two detuned sawtooths per tone through a lowpass – the original soft chord pad
  const softPad = (freqs: readonly number[], at: number, amp: GainNode, gain: number): Stoppable[] => {
    const sources: Stoppable[] = [];
    for (const f of freqs) {
      const filter = lowpass(0.5);
      filter.frequency.value = 1500;
      filter.connect(amp);
      for (const cents of [-6, 6]) {
        const saw = osc('sawtooth', f, at);
        saw.detune.value = cents;
        saw.connect(filter);
        sources.push(saw);
      }
    }
    attack(amp, gain, at, 0.04);
    return sources;
  };

  // sine plus a little triangle for contour – the original bass
  const sineBass = (freqs: readonly number[], at: number, amp: GainNode, gain: number): Stoppable[] => {
    const sources: Stoppable[] = [];
    for (const f of freqs) {
      const sine = osc('sine', f, at);
      const triangle = osc('triangle', f, at);
      const triangleGain = context.createGain();
      triangleGain.gain.value = 0.4;
      sine.connect(amp);
      triangle.connect(triangleGain);
      triangleGain.connect(amp);
      sources.push(sine, triangle);
    }
    attack(amp, gain, at, 0.01);
    return sources;
  };

  // Supersaw: seven sawtooths ±25 cents (started slightly staggered so they do not begin in phase) through a lowpass
  // with envelope cutoff[0] → cutoff[1], plus a light chorus of two slowly modulated delays
  const supersaw = (
    sound: SupersawSound,
    freqs: readonly number[],
    at: number,
    amp: GainNode,
    gain: number,
  ): Stoppable[] => {
    const filter = lowpass(0.7);
    filter.connect(amp);
    filter.frequency.setValueAtTime(sound.cutoff[0], at);
    filter.frequency.setTargetAtTime(sound.cutoff[1], at, sound.sweep);
    const sources: Stoppable[] = [];
    for (const [base, rate] of CHORUS) {
      const delay = context.createDelay(0.05);
      const delayGain = context.createGain();
      const lfo = osc('sine', rate, at);
      const lfoGain = context.createGain();
      delay.delayTime.value = base;
      delayGain.gain.value = 0.4;
      lfoGain.gain.value = 0.002;
      lfo.connect(lfoGain);
      lfoGain.connect(delay.delayTime);
      filter.connect(delay);
      delay.connect(delayGain);
      delayGain.connect(amp);
      sources.push(lfo);
    }
    for (const f of freqs) {
      SUPERSAW_CENTS.forEach((cents, i) => {
        const saw = osc('sawtooth', f, at + i * 0.0007);
        saw.detune.value = cents;
        saw.connect(filter);
        sources.push(saw);
      });
    }
    attack(amp, gain, at, sound.attack);
    return sources;
  };

  // Synth bass: sawtooth through a lowpass with envelope, a sine on the root below as sub
  const synthBass = (freqs: readonly number[], at: number, amp: GainNode, gain: number): Stoppable[] => {
    const sources: Stoppable[] = [];
    for (const f of freqs) {
      const filter = lowpass(2);
      filter.connect(amp);
      filter.frequency.setValueAtTime(2000, at);
      filter.frequency.setTargetAtTime(250, at, 0.12);
      const saw = osc('sawtooth', f, at);
      const sub = osc('sine', f, at);
      const subGain = context.createGain();
      subGain.gain.value = 0.7;
      saw.connect(filter);
      sub.connect(subGain);
      subGain.connect(amp);
      sources.push(saw, sub);
    }
    attack(amp, gain, at, 0.008);
    return sources;
  };

  // Plucked string (Karplus-Strong) with delay length N: filtered noise as excitation, then y[n] = g · ½ (y[n−N] +
  // y[n−N−1]) – the average damps the highs, the period is N + ½ samples. g lets the fundamental fall to −34 dB over
  // 1.5 s; the last 100 ms fade out. Buffers are kept per N.
  const plucks = new Map<number, AudioBuffer>();
  const pluckBuffer = (n: number): AudioBuffer => {
    const existing = plucks.get(n);
    if (existing) return existing;
    const rate = context.sampleRate;
    const length = Math.round(rate * 1.5);
    const buffer = context.createBuffer(1, length, rate);
    const data = buffer.getChannelData(0);
    const g = 0.02 ** ((n + 0.5) / length);
    let lowpassed = 0;
    for (let i = 0; i <= n; i++) {
      lowpassed += 0.3 * (random() * 2 - 1 - lowpassed); // dark noise: softer attack
      data[i] = lowpassed;
    }
    let older = data[0] ?? 0; // y[i − N − 1], which was y[i − N] one step earlier
    for (let i = n + 1; i < length; i++) {
      const delayed = data[i - n] ?? 0;
      data[i] = g * 0.5 * (delayed + older);
      older = delayed;
    }
    const tail = data.subarray(length - Math.round(rate * 0.1));
    tail.forEach((value, i) => {
      tail[i] = value * ((tail.length - 1 - i) / tail.length);
    });
    plucks.set(n, buffer);
    return buffer;
  };
  // the string is computed offline per note and played as a buffer
  const pluck = (freqs: readonly number[], at: number, amp: GainNode, gain: number): Stoppable[] => {
    const sources = freqs.map((f) => {
      const n = Math.max(2, Math.round(context.sampleRate / f - 0.5));
      const source = context.createBufferSource();
      source.buffer = pluckBuffer(n);
      source.playbackRate.value = (f * (n + 0.5)) / context.sampleRate; // exact pitch despite the integer delay
      source.connect(amp);
      source.start(at);
      return source;
    });
    attack(amp, gain, at, 0.002);
    return sources;
  };

  const play = (sound: SynthSound, ...voice: Voice): Stoppable[] => {
    switch (sound.type) {
      case 'fm':
        return fm(sound, ...voice);
      case 'organ':
        return organ(...voice);
      case 'softPad':
        return softPad(...voice);
      case 'sineBass':
        return sineBass(...voice);
      case 'supersaw':
        return supersaw(sound, ...voice);
      case 'synthBass':
        return synthBass(...voice);
      case 'pluck':
        return pluck(...voice);
    }
  };

  return { fm, play };
};
