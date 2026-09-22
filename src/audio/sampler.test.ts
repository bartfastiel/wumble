import { describe, expect, it } from 'vitest';
import { keyBySignature } from '../theory/keys';
import { buildModel } from '../theory/model';
import { mtof } from '../theory/pitch';
import { noteFrequency } from '../theory/tuning';
import { FakeAudioContext, FakeBuffer, FakeBufferSource, FakeGain } from './__tests__/fake-audio-context';
import { SAMPLE_MANIFEST } from './sample-manifest';
import { bake, nearestSample, playSamples, type PreparedSample } from './sampler';
import { SOUNDS } from './sounds';

const RATE = 1000; // small numbers: 1 sample = 1 ms

// 1 s: silence for `silent` samples, then a ramp 0.1, 0.2, … (values identify their original index)
const recording = (context: FakeAudioContext, silent: number): FakeBuffer => {
  const buffer = context.createBuffer(1, RATE, RATE);
  const data = buffer.getChannelData(0);
  for (let i = silent; i < RATE; i++) data[i] = 0.1 + ((i - silent) % 9) * 0.1;
  return buffer;
};

describe('bake', () => {
  it('skips the lead-in up to 2 ms before the first audible sample', () => {
    const context = new FakeAudioContext(RATE);
    const { buffer, loop } = bake(context.asContext(), recording(context, 100).asBuffer(), null);
    expect(loop).toBeNull();
    expect(buffer).toHaveLength(RATE - 98);
    const data = buffer.getChannelData(0);
    expect(Array.from(data.subarray(0, 3))).toEqual([0, 0, 0.1].map((v) => Math.fround(v)));
  });

  it('keeps a recording that starts audibly; a silent one shrinks to the 2 ms margin', () => {
    const context = new FakeAudioContext(RATE);
    expect(bake(context.asContext(), recording(context, 0).asBuffer(), null).buffer).toHaveLength(RATE);
    expect(bake(context.asContext(), recording(context, RATE).asBuffer(), null).buffer).toHaveLength(2);
  });

  it('cuts at the loop end, moves the loop points by the lead-in and crossfades the last 40 ms', () => {
    const context = new FakeAudioContext(RATE);
    const original = recording(context, 100);
    const source = Float32Array.from(original.getChannelData(0));
    const { buffer, loop } = bake(context.asContext(), original.asBuffer(), [0.5, 0.9]);
    expect(buffer).toHaveLength(900 - 98);
    expect(loop).toEqual([402 / RATE, 802 / RATE]);
    const data = buffer.getChannelData(0);
    // untouched before the crossfade: sample k of the copy is sample k + 98 of the original
    expect(data[761]).toBe(source[761 + 98]);
    // crossfade: weight (i + 1) / 40 from the copy towards the signal before the loop start
    const blended = (i: number): number => {
      const w = (i + 1) / 40;
      return (source[762 + i + 98] ?? 0) * (1 - w) + (source[362 + i + 98] ?? 0) * w;
    };
    expect(data[762]).toBeCloseTo(blended(0), 6);
    expect(data[781]).toBeCloseTo(blended(19), 6);
    expect(data[801]).toBe(source[401 + 98]); // fully the sample before the loop start
  });

  it('shortens the crossfade when the loop starts early or is short', () => {
    const context = new FakeAudioContext(RATE);
    const { buffer, loop } = bake(context.asContext(), recording(context, 0).asBuffer(), [0.02, 0.05]);
    expect(buffer).toHaveLength(50);
    expect(loop).toEqual([0.02, 0.05]);
    const data = buffer.getChannelData(0);
    const source = recording(context, 0).getChannelData(0);
    expect(data[29]).toBe(source[29]); // the crossfade covers only the last 20 samples
    expect(data[49]).toBe(source[19]);
  });
});

const prepared = (root: number, loop: PreparedSample['loop'] = null): PreparedSample => ({
  root,
  loop,
  buffer: new FakeBuffer(1, 10, 48000).asBuffer(),
});
const pianoLike = SAMPLE_MANIFEST.piano.map((info) => prepared(info.root, info.loop));

describe('nearestSample', () => {
  it('picks the sample whose root is closest in semitones', () => {
    const rootNear = (frequency: number): number | undefined => nearestSample(pianoLike, frequency)?.root;
    expect([rootNear(440), rootNear(mtof(64.5)), rootNear(mtof(64.6))]).toEqual([69.07, 63.06, 66.01]);
    expect([rootNear(20), rootNear(8000)]).toEqual([36.04, 84.11]); // beyond the ends: the outermost samples
    expect(nearestSample([], 440)).toBeUndefined();
  });
});

describe('playSamples', () => {
  const cMajor = buildModel(keyBySignature(0), 'classical');

  it('plays E4 just (327.03 Hz) on the D#4 sample at playbackRate 1.0475', () => {
    const context = new FakeAudioContext();
    const amp = context.createGain();
    const e4 = noteFrequency(cMajor, 'just', 64);
    const sources = playSamples(context.asContext(), pianoLike, SOUNDS.piano, [e4], 1, amp as unknown as GainNode, 1.2);
    const source = context.single(FakeBufferSource);
    expect(sources).toEqual([source]);
    expect(source.buffer).toBe(pianoLike[9]?.buffer);
    expect(source.playbackRate.value).toBeCloseTo(1.0475, 4);
    expect(source.playbackRate.value).toBe(e4 / mtof(63.06));
    expect(source.loop).toBe(false);
    expect(source.startedAt).toBe(1);
    expect(source.targets).toEqual([amp]);
    expect(amp.gain.events).toEqual([
      { method: 'setValueAtTime', value: 0, time: 1 },
      { method: 'linearRampToValueAtTime', value: 1.2, time: 1.003 },
    ]);
  });

  it('loops sustained samples between the baked points', () => {
    const context = new FakeAudioContext();
    const amp = context.createGain();
    const violin = [prepared(60, [0.5, 1.0]), prepared(72, [0.6, 1.1])];
    playSamples(context.asContext(), violin, SOUNDS.violin, [mtof(60), mtof(72)], 0, amp as unknown as GainNode, 1);
    const [low, high] = context.all(FakeBufferSource);
    expect([low?.loop, low?.loopStart, low?.loopEnd]).toEqual([true, 0.5, 1.0]);
    expect([high?.loop, high?.loopStart, high?.loopEnd]).toEqual([true, 0.6, 1.1]);
    expect(high?.playbackRate.value).toBe(1);
    expect(amp.gain.events[1]).toEqual({ method: 'linearRampToValueAtTime', value: 1, time: 0.008 });
  });

  it('plays nothing but still ramps the amplifier when the set is empty', () => {
    const context = new FakeAudioContext();
    const amp = context.createGain();
    expect(playSamples(context.asContext(), [], SOUNDS.piano, [440], 0, amp as unknown as GainNode, 1)).toEqual([]);
    expect(context.all(FakeGain)).toEqual([amp]);
  });
});
