// The audio engine: three layers (melody, chord, bass) play the sounds of the current combi, drums for the band.
// Frequencies arrive in hertz; the theory decides the tuning (see the ADR on tuning).
import { type CombiId, LAYERS, type Layer, layerOf } from './combis';
import { createDrums, type DrumKind, type Drums } from './drums';
import { createMixer, type Mixer } from './effects';
import { createSampleStore, type SampleStore } from './sample-store';
import { playSamples } from './sampler';
import { type Sound, SOUNDS } from './sounds';
import { createSynths, type Stoppable, type Synths } from './synths';
import { createUnlock } from './unlock';

export { COMBI_IDS } from './combis';
export type { CombiId } from './combis';
export type { DrumKind } from './drums';

export interface VoiceHandle {
  release(at: number): void;
  // Shaping a held note: brightness 0…1 opens it, vibrato 0…1 makes it waver
  shape?(brightness: number, vibrato: number): void;
}

export interface AudioEngine {
  ensure(): number; // create/resume on a user gesture, returns currentTime
  now(): number;
  melody(freq: number, at: number, gain?: number): VoiceHandle;
  chord(freqs: readonly number[], at: number, gain?: number): VoiceHandle;
  bass(freq: number, at: number, gain?: number): VoiceHandle;
  drum(kind: DrumKind, at: number, velocity?: number): void;
  setCombi(id: CombiId): Promise<void>; // loads samples lazily; synth fallback until decoded
  releaseAll(at?: number): void;
}

interface Wiring {
  readonly context: AudioContext;
  readonly mixer: Mixer;
  readonly synths: Synths;
  readonly drums: Drums;
  readonly store: SampleStore;
}

export function createAudioEngine(context?: AudioContext, sampleBase?: string): AudioEngine {
  let wiring: Wiring | null = null;
  let combi: CombiId = 'epiano';
  const voices = new Set<VoiceHandle>();
  const unlock = createUnlock();

  // Nothing exists before the first gesture: without one there is no running context anyway
  const wire = (): Wiring => {
    if (wiring) return wiring;
    const audioContext = context ?? new AudioContext({ latencyHint: 'interactive' });
    const mixer = createMixer(audioContext);
    wiring = {
      context: audioContext,
      mixer,
      synths: createSynths(audioContext),
      drums: createDrums(audioContext, mixer.compressor),
      store: createSampleStore(audioContext, sampleBase),
    };
    return wiring;
  };

  // Sample sets of the combi; resolves once all are decoded
  const load = (id: CombiId): Promise<void> => {
    const { store } = wire();
    const sets = LAYERS.flatMap((layer) => {
      const { sound } = layerOf(id, layer);
      return sound.type === 'sample' ? [sound.set] : [];
    });
    return Promise.all(sets.map((set) => store.load(set))).then(() => undefined);
  };

  // While a sample set is still decoding, the e-piano bridges – no silent moment
  const sources = (sound: Sound, freqs: readonly number[], at: number, amp: GainNode, gain: number): Stoppable[] => {
    const { context: audioContext, synths, store } = wire();
    if (sound.type !== 'sample') return synths.play(sound, freqs, at, amp, gain);
    const samples = store.samples(sound.set);
    if (samples.length === 0) return synths.fm(SOUNDS.epiano, freqs, at, amp, gain);
    return playSamples(audioContext, samples, sound, freqs, at, amp, gain);
  };

  // One voice: all frequencies of a sound through one amplifier into the sound's output. Release lets it decay, stops
  // the sources and detaches the amplifier once it is silent.
  const voice = (layer: Layer, freqs: readonly number[], at: number, scale: number): VoiceHandle => {
    const { context: audioContext, mixer } = wire();
    const { sound, gain } = layerOf(combi, layer);
    const amp = audioContext.createGain();
    const tone = audioContext.createBiquadFilter();
    const waver = audioContext.createGain();
    tone.type = 'lowpass';
    tone.frequency.value = 18000;
    tone.Q.value = 0.8;
    waver.gain.value = 1;
    amp.connect(tone);
    tone.connect(waver);
    waver.connect(mixer.output(sound));
    let lfo: OscillatorNode | null = null;
    let depth: GainNode | null = null;
    const stoppables = sources(sound, freqs, at, amp, gain * scale);
    const handle: VoiceHandle = {
      shape: (brightness, vibrato) => {
        const now = audioContext.currentTime;
        tone.frequency.setTargetAtTime(400 + brightness * brightness * 17000, now, 0.07);
        if (vibrato > 0.02 && lfo === null) {
          lfo = audioContext.createOscillator();
          depth = audioContext.createGain();
          lfo.frequency.value = 5;
          depth.gain.value = 0;
          lfo.connect(depth);
          depth.connect(waver.gain);
          lfo.start(now);
        }
        lfo?.frequency.setTargetAtTime(1.5 + vibrato * 5, now, 0.15);
        depth?.gain.setTargetAtTime(vibrato * 0.22, now, 0.15);
      },
      release: (releaseAt) => {
        voices.delete(handle);
        lfo?.stop(releaseAt + sound.release + 0.2);
        amp.gain.setTargetAtTime(0, releaseAt, sound.release / 4);
        const end = releaseAt + sound.release + 0.15;
        for (const source of stoppables) source.stop(end);
        setTimeout(
          () => {
            amp.disconnect();
            tone.disconnect();
            waver.disconnect();
          },
          (end - audioContext.currentTime) * 1000 + 100,
        );
      },
    };
    voices.add(handle);
    return handle;
  };

  const now = (): number => wiring?.context.currentTime ?? 0;

  return {
    ensure: () => {
      const { context: audioContext } = wire();
      if (audioContext.state !== 'running') void audioContext.resume();
      unlock();
      void load(combi);
      return audioContext.currentTime;
    },
    now,
    melody: (freq, at, gain = 1) => voice('melody', [freq], at, gain),
    chord: (freqs, at, gain = 1) => voice('chord', freqs, at, gain),
    bass: (freq, at, gain = 1) => voice('bass', [freq], at, gain),
    drum: (kind, at, velocity) => {
      wire().drums.hit(kind, at, velocity);
    },
    setCombi: (id) => {
      combi = id;
      return wiring ? load(id) : Promise.resolve();
    },
    releaseAll: (at = now()) => {
      // release() only ever deletes the handle it was just called with – safe during a Set for...of
      for (const handle of voices) handle.release(at);
    },
  };
}
