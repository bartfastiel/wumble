import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FakeAudioContext,
  FakeBiquad,
  FakeBufferSource,
  FakeCompressor,
  FakeGain,
  FakeOscillator,
} from './__tests__/fake-audio-context';
import { type AudioEngine, createAudioEngine } from './engine';

let audioElements = 0;
class FakeAudio {
  constructor(readonly src: string) {
    audioElements++;
  }
  loop = false;
  volume = 1;
  setAttribute(): void {
    // the unlock element only needs to exist
  }
  play(): Promise<void> {
    return Promise.resolve();
  }
}
const MP3 = new Uint8Array([0xff, 0xfb]);

beforeEach(() => {
  vi.stubGlobal('Audio', FakeAudio);
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(new Response(MP3))),
  );
  audioElements = 0;
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const setup = (): { context: FakeAudioContext; engine: AudioEngine } => {
  const context = new FakeAudioContext();
  return { context, engine: createAudioEngine(context.asContext()) };
};
// the voice's amplifier is the last gain created before its sources
const ampOf = (context: FakeAudioContext, voiceGain: number): FakeGain | undefined =>
  context.all(FakeGain).find((node) => node.gain.events[1]?.value === voiceGain);

describe('ensure', () => {
  it('creates its own context on the first gesture when none is given', () => {
    const created: AudioContextOptions[] = [];
    vi.stubGlobal(
      'AudioContext',
      class extends FakeAudioContext {
        constructor(options: AudioContextOptions) {
          super();
          created.push(options);
        }
      },
    );
    const engine = createAudioEngine();
    expect(engine.now()).toBe(0);
    engine.ensure();
    expect(created).toEqual([{ latencyHint: 'interactive' }]);
  });

  it('wires compressor and room reverb once, resumes, unlocks and returns the current time', () => {
    const { context, engine } = setup();
    context.currentTime = 1.5;
    expect(engine.ensure()).toBe(1.5);
    expect(context.state).toBe('running');
    // compressor → master → speakers
    const compressor = context.single(FakeCompressor);
    const master = compressor.targets[0] as FakeGain;
    expect(master.targets).toEqual([context.destination]);
    expect(audioElements).toBe(1);
    engine.ensure();
    expect(context.resumes).toBe(1);
    expect(context.all(FakeCompressor)).toHaveLength(1);
    expect(engine.now()).toBe(1.5);
  });

  it('fades in from silence, so a loud speaker never startles anyone', () => {
    const { context, engine } = setup();
    context.currentTime = 2;
    engine.ensure();
    const master = context.single(FakeCompressor).targets[0] as FakeGain;
    engine.fadeIn(3);
    expect(master.gain.events).toEqual([
      { method: 'cancelScheduledValues', value: undefined, time: 2 },
      { method: 'setValueAtTime', value: 0, time: 2 },
      { method: 'linearRampToValueAtTime', value: 1, time: 5 },
    ]);
  });
});

describe('voices', () => {
  it('plays the melody with the combi sound at its level through the sound output', () => {
    const { context, engine } = setup();
    engine.melody(440, 2);
    const [carrier] = context.all(FakeOscillator); // the e-piano: FM, level 0.5
    const amp = ampOf(context, 0.5);
    expect(carrier?.targets).toEqual([amp]);
    expect(amp?.gain.events[1]).toEqual({ method: 'linearRampToValueAtTime', value: 0.5, time: 2.005 });
    // every voice runs through its own tone filter and a waver, then into the sound's output
    const tone = amp?.targets[0] as FakeBiquad;
    expect(tone.type).toBe('lowpass');
    const waver = tone.targets[0] as FakeGain;
    expect(waver.gain.value).toBe(1);
    expect(waver.reaches(context.single(FakeCompressor))).toBe(true);
  });

  it('shapes a held tone: the filter opens with the brightness, a vibrato starts only when asked for', () => {
    const { context, engine } = setup();
    const voice = engine.melody(440, 2);
    const tone = (ampOf(context, 0.5)?.targets[0] as FakeBiquad | undefined)?.frequency;
    const oscillators = context.all(FakeOscillator).length;
    voice.shape?.(0, 0);
    expect(tone?.events.at(-1)).toMatchObject({ method: 'setTargetAtTime', value: 400 });
    expect(context.all(FakeOscillator)).toHaveLength(oscillators); // no vibrato, no extra oscillator
    voice.shape?.(1, 0.5);
    expect(tone?.events.at(-1)?.value).toBeCloseTo(17400, 6);
    expect(context.all(FakeOscillator).length).toBeGreaterThan(oscillators); // now the LFO runs
    voice.release(3);
  });

  it('scales the layer level by the gain argument', () => {
    const { context, engine } = setup();
    engine.chord([261.63, 329.63, 392], 0, 0.8); // soft pad 0.035
    expect(ampOf(context, 0.035 * 0.8)).toBeDefined();
    engine.bass(65.41, 0, 0.5); // sine bass 0.25
    expect(ampOf(context, 0.125)).toBeDefined();
    expect(context.all(FakeOscillator)).toHaveLength(6 + 2);
  });

  it('releases: fades the amplifier, stops the sources and detaches after the tail', () => {
    vi.useFakeTimers();
    const { context, engine } = setup();
    context.currentTime = 1;
    const voice = engine.melody(440, 1);
    voice.release(3);
    const amp = ampOf(context, 0.5);
    expect(amp?.gain.events.at(-1)).toEqual({ method: 'setTargetAtTime', value: 0, time: 3, timeConstant: 0.25 / 4 });
    for (const oscillator of context.all(FakeOscillator)) expect(oscillator.stoppedAt).toBeCloseTo(3 + 0.25 + 0.15, 12);
    vi.advanceTimersByTime((3.4 - 1) * 1000 + 99);
    expect(amp?.disconnected).toBe(false);
    vi.advanceTimersByTime(1);
    expect(amp?.disconnected).toBe(true);
  });

  it('releaseAll releases every sounding voice at the given time, or now', () => {
    const { context, engine } = setup();
    engine.ensure();
    const melody = engine.melody(440, 0);
    const chord = engine.chord([261.63], 0);
    engine.bass(65.41, 0).release(1);
    engine.releaseAll(5);
    const stops = context.all(FakeOscillator).map((oscillator) => oscillator.stoppedAt);
    expect(stops).toEqual([5.4, 5.4, 5.5, 5.5, 1.45, 1.45]);
    context.currentTime = 7;
    engine.releaseAll(); // nothing left – the released ones are not released twice
    expect(context.all(FakeOscillator).map((oscillator) => oscillator.stoppedAt)).toEqual(stops);
    engine.melody(440, 7);
    engine.releaseAll();
    expect(context.all(FakeOscillator).at(-1)?.stoppedAt).toBeCloseTo(7.4, 12);
    expect([melody, chord]).toHaveLength(2);
  });
});

describe('setCombi', () => {
  it('resolves at once before the first gesture and loads the samples on ensure', async () => {
    const { context, engine } = setup();
    await engine.setCombi('strings');
    expect(fetch).not.toHaveBeenCalled();
    engine.ensure();
    expect(fetch).toHaveBeenCalledTimes(8 + 7 + 3); // violin, section, double bass
    await engine.setCombi('strings');
    expect(fetch).toHaveBeenCalledTimes(18);
    engine.melody(440, 0);
    expect(context.all(FakeBufferSource)).toHaveLength(1);
  });

  it('bridges with the e-piano until the samples are decoded', async () => {
    const { context, engine } = setup();
    engine.ensure();
    const loading = engine.setCombi('piano');
    engine.melody(440, 0);
    expect(context.all(FakeOscillator)).toHaveLength(2); // FM carrier and modulator
    expect(context.all(FakeBufferSource)).toHaveLength(0);
    expect(ampOf(context, 1.2)).toBeDefined(); // the piano melody level, not the e-piano's
    await loading;
    engine.chord([261.63, 329.63], 0);
    expect(context.all(FakeBufferSource)).toHaveLength(2);
    expect(context.all(FakeOscillator)).toHaveLength(2);
    expect(ampOf(context, 0.5)).toBeDefined();
  });

  it('keeps synth combis synth', async () => {
    const { context, engine } = setup();
    engine.ensure();
    await engine.setCombi('pop');
    expect(fetch).not.toHaveBeenCalled();
    engine.bass(55, 0);
    expect(context.all(FakeOscillator).map((oscillator) => oscillator.type)).toEqual(['sawtooth', 'sine']);
  });
});

describe('drum', () => {
  it('hits through the drum bus into the compressor', () => {
    const { context, engine } = setup();
    engine.drum('kick', 0.5, 0.8);
    const kick = context.single(FakeOscillator);
    expect((kick.targets[0] as FakeGain).gain.events[0]?.value).toBeCloseTo(0.8, 12);
    expect(kick.reaches(context.single(FakeCompressor))).toBe(true);
    engine.drum('hatClosed', 1);
    expect((context.single(FakeBufferSource).targets[0] as FakeGain).targets[0]).toBeDefined();
  });
});
