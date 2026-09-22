// Master chain: a compressor before the destination, two synthetic reverbs feeding it, and one shared output per
// reverb + wet share that the voices connect to.
import { random } from './random';
import type { ReverbId, Sound } from './sounds';

// Convolved decaying noise as impulse response – no file needed. `tone` darkens the noise with a one-pole lowpass.
export const impulse = (context: BaseAudioContext, seconds: number, decay: number, tone = 0): AudioBuffer => {
  const rate = context.sampleRate;
  const length = Math.floor(rate * seconds);
  const buffer = context.createBuffer(2, length, rate);
  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);
    let lowpassed = 0;
    for (let i = 0; i < length; i++) {
      const noise = (random() * 2 - 1) * (1 - i / length) ** decay;
      lowpassed += tone * (noise - lowpassed);
      data[i] = tone > 0 ? lowpassed : noise;
    }
  }
  return buffer;
};

export interface Mixer {
  readonly compressor: DynamicsCompressorNode;
  reverb(id: ReverbId): ConvolverNode;
  output(sound: Sound): GainNode;
}

export const createMixer = (context: BaseAudioContext): Mixer => {
  const compressor = context.createDynamicsCompressor();
  compressor.threshold.value = -14;
  compressor.knee.value = 12;
  compressor.ratio.value = 4;
  compressor.attack.value = 0.004;
  compressor.release.value = 0.2;
  compressor.connect(context.destination);

  const reverbs = new Map<ReverbId, ConvolverNode>();
  // 'room' 1.8 s with return 0.25; 'church' 4 s, darker, with return 0.35
  const reverb = (id: ReverbId): ConvolverNode => {
    const existing = reverbs.get(id);
    if (existing) return existing;
    const convolver = context.createConvolver();
    const ret = context.createGain();
    if (id === 'church') {
      convolver.buffer = impulse(context, 4, 2.5, 0.35);
      ret.gain.value = 0.35;
    } else {
      convolver.buffer = impulse(context, 1.8, 3);
      ret.gain.value = 0.25;
    }
    convolver.connect(ret);
    ret.connect(compressor);
    reverbs.set(id, convolver);
    return convolver;
  };
  reverb('room'); // created at start, like the original

  // Dry (0.9) into the compressor plus the share `wet` into the reverb; at wet = 1 the reverb hangs directly on the
  // output – the original bus. Sounds with the same reverb and share use one output.
  const outputs = new Map<string, GainNode>();
  const output = (sound: Sound): GainNode => {
    const key = `${sound.reverb}:${String(sound.wet)}`;
    const existing = outputs.get(key);
    if (existing) return existing;
    const dry = context.createGain();
    dry.gain.value = 0.9;
    dry.connect(compressor);
    if (sound.wet === 1) dry.connect(reverb(sound.reverb));
    else {
      const send = context.createGain();
      send.gain.value = sound.wet;
      dry.connect(send);
      send.connect(reverb(sound.reverb));
    }
    outputs.set(key, dry);
    return dry;
  };

  return { compressor, reverb, output };
};
