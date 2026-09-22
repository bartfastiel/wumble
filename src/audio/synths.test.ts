import { describe, expect, it } from 'vitest';
import {
  FakeAudioContext,
  FakeBiquad,
  FakeBufferSource,
  FakeDelay,
  FakeGain,
  FakeOscillator,
  type ParamEvent,
} from './__tests__/fake-audio-context';
import { SOUNDS } from './sounds';
import { createSynths } from './synths';

const T = 2;
const setup = (): { context: FakeAudioContext; amp: FakeGain; synths: ReturnType<typeof createSynths> } => {
  const context = new FakeAudioContext();
  const amp = context.createGain();
  return { context, amp, synths: createSynths(context.asContext()) };
};
const ampNode = (amp: FakeGain): GainNode => amp as unknown as GainNode;
const attackEvents = (gain: number, seconds: number): ParamEvent[] => [
  { method: 'setValueAtTime', value: 0, time: T },
  { method: 'linearRampToValueAtTime', value: gain, time: T + seconds },
];

describe('fm', () => {
  it('builds carrier and modulator per tone with the recorded envelope', () => {
    const { context, amp, synths } = setup();
    const sources = synths.play(SOUNDS.epiano, [440], T, ampNode(amp), 0.5);
    const [carrier, modulator] = context.all(FakeOscillator);
    expect(sources).toEqual([carrier, modulator]);
    expect(carrier?.frequency.value).toBe(440);
    expect(modulator?.frequency.value).toBe(440 * SOUNDS.epiano.ratio);
    expect(carrier?.startedAt).toBe(T);
    const [depthGain] = context.all(FakeGain).filter((node) => node !== amp);
    expect(modulator?.targets).toEqual([depthGain]);
    expect(depthGain?.targets).toEqual([carrier?.frequency]);
    expect(carrier?.targets).toEqual([amp]);
    expect(depthGain?.gain.events).toEqual([
      { method: 'setValueAtTime', value: 440 * 2.4, time: T },
      { method: 'setTargetAtTime', value: 440 * 2.4 * 0.12, time: T, timeConstant: 0.9 / 3 },
    ]);
    expect(amp.gain.events).toEqual([
      ...attackEvents(0.5, 0.005),
      { method: 'setTargetAtTime', value: 0.5 * 0.3, time: T + 0.005, timeConstant: 0.9 / 3 },
    ]);
  });

  it('uses the bell ratio 3.5 and index 1.1', () => {
    const { context, amp, synths } = setup();
    synths.play(SOUNDS.bell, [220, 330], T, ampNode(amp), 0.35);
    const oscillators = context.all(FakeOscillator);
    expect(oscillators.map((o) => o.frequency.value)).toEqual([220, 770, 330, 1155]);
    expect(amp.gain.events[2]).toEqual({
      method: 'setTargetAtTime',
      value: 0.35 * 0.15,
      time: T + 0.005,
      timeConstant: 1.6 / 3,
    });
  });
});

describe('organ', () => {
  it('stacks four sine partials 1, 0.5, 0.25, 0.12 per tone', () => {
    const { context, amp, synths } = setup();
    const sources = synths.play(SOUNDS.organ, [100], T, ampNode(amp), 0.22);
    const oscillators = context.all(FakeOscillator);
    expect(sources).toEqual(oscillators);
    expect(oscillators.map((o) => [o.type, o.frequency.value])).toEqual([
      ['sine', 100],
      ['sine', 200],
      ['sine', 300],
      ['sine', 400],
    ]);
    const levels = oscillators.map((o) => (o.targets[0] as FakeGain).gain.value);
    expect(levels).toEqual([1, 0.5, 0.25, 0.12]);
    for (const o of oscillators) expect((o.targets[0] as FakeGain).targets).toEqual([amp]);
    expect(amp.gain.events).toEqual(attackEvents(0.22, 0.02));
  });
});

describe('softPad', () => {
  it('runs two sawtooths ±6 cents through a 1500 Hz lowpass with Q 0.5', () => {
    const { context, amp, synths } = setup();
    synths.play(SOUNDS.softPad, [200], T, ampNode(amp), 0.035);
    const filter = context.single(FakeBiquad);
    expect([filter.type, filter.frequency.value, filter.Q.value]).toEqual(['lowpass', 1500, 0.5]);
    expect(filter.targets).toEqual([amp]);
    const saws = context.all(FakeOscillator);
    expect(saws.map((o) => [o.type, o.frequency.value, o.detune.value])).toEqual([
      ['sawtooth', 200, -6],
      ['sawtooth', 200, 6],
    ]);
    for (const saw of saws) expect(saw.targets).toEqual([filter]);
    expect(amp.gain.events).toEqual(attackEvents(0.035, 0.04));
  });
});

describe('sineBass', () => {
  it('mixes a sine with a triangle at 0.4', () => {
    const { context, amp, synths } = setup();
    synths.play(SOUNDS.sineBass, [55], T, ampNode(amp), 0.25);
    const [sine, triangle] = context.all(FakeOscillator);
    expect([sine?.type, triangle?.type]).toEqual(['sine', 'triangle']);
    expect(sine?.targets).toEqual([amp]);
    expect((triangle?.targets[0] as FakeGain).gain.value).toBeCloseTo(0.4, 12);
    expect((triangle?.targets[0] as FakeGain).targets).toEqual([amp]);
    expect(amp.gain.events).toEqual(attackEvents(0.25, 0.01));
  });
});

describe('supersaw', () => {
  it('starts seven staggered sawtooths through a swept lowpass with a two-voice chorus', () => {
    const { context, amp, synths } = setup();
    const sources = synths.play(SOUNDS.supersaw, [300], T, ampNode(amp), 0.11);
    const filter = context.single(FakeBiquad);
    expect([filter.type, filter.Q.value]).toEqual(['lowpass', 0.7]);
    expect(filter.frequency.events).toEqual([
      { method: 'setValueAtTime', value: 8000, time: T },
      { method: 'setTargetAtTime', value: 2000, time: T, timeConstant: 0.25 },
    ]);
    const delays = context.all(FakeDelay);
    expect(delays.map((d) => [d.maxDelayTime, d.delayTime.value])).toEqual([
      [0.05, 0.012],
      [0.05, 0.017],
    ]);
    const oscillators = context.all(FakeOscillator);
    const lfos = oscillators.filter((o) => o.type === 'sine');
    const saws = oscillators.filter((o) => o.type === 'sawtooth');
    expect(lfos.map((o) => o.frequency.value)).toEqual([0.3, 0.4]);
    lfos.forEach((lfo, i) => {
      const lfoGain = lfo.targets[0] as FakeGain;
      expect(lfoGain.gain.value).toBeCloseTo(0.002, 12);
      expect(lfoGain.targets).toEqual([delays[i]?.delayTime]);
      expect(filter.targets).toContain(delays[i]);
      const delayGain = delays[i]?.targets[0] as FakeGain;
      expect(delayGain.gain.value).toBeCloseTo(0.4, 12);
      expect(delayGain.targets).toEqual([amp]);
    });
    expect(saws.map((o) => o.detune.value)).toEqual([-25, -16.7, -8.3, 0, 8.3, 16.7, 25]);
    expect(saws.map((o) => o.startedAt)).toEqual([0, 1, 2, 3, 4, 5, 6].map((i) => T + i * 0.0007));
    for (const saw of saws) expect(saw.targets).toEqual([filter]);
    expect(filter.targets[0]).toBe(amp);
    expect(sources).toEqual([...lfos, ...saws]);
    expect(amp.gain.events).toEqual(attackEvents(0.11, 0.01));
  });

  it('takes the pad envelope from its sound', () => {
    const { context, amp, synths } = setup();
    synths.play(SOUNDS.pad, [300], T, ampNode(amp), 0.04);
    expect(context.single(FakeBiquad).frequency.events).toEqual([
      { method: 'setValueAtTime', value: 3000, time: T },
      { method: 'setTargetAtTime', value: 1200, time: T, timeConstant: 0.8 },
    ]);
    expect(amp.gain.events).toEqual(attackEvents(0.04, 0.4));
  });
});

describe('synthBass', () => {
  it('sweeps a sawtooth lowpass 2000 → 250 Hz with Q 2 and adds a sub sine at 0.7', () => {
    const { context, amp, synths } = setup();
    synths.play(SOUNDS.synthBass, [55], T, ampNode(amp), 0.22);
    const filter = context.single(FakeBiquad);
    expect(filter.Q.value).toBe(2);
    expect(filter.frequency.events).toEqual([
      { method: 'setValueAtTime', value: 2000, time: T },
      { method: 'setTargetAtTime', value: 250, time: T, timeConstant: 0.12 },
    ]);
    const [saw, sub] = context.all(FakeOscillator);
    expect([saw?.type, sub?.type]).toEqual(['sawtooth', 'sine']);
    expect(saw?.targets).toEqual([filter]);
    expect((sub?.targets[0] as FakeGain).gain.value).toBeCloseTo(0.7, 12);
    expect(amp.gain.events).toEqual(attackEvents(0.22, 0.008));
  });
});

describe('pluck', () => {
  it('plays a Karplus-Strong buffer per note, pitched exactly despite the integer delay', () => {
    const { context, amp, synths } = setup();
    const sources = synths.play(SOUNDS.pluck, [440], T, ampNode(amp), 1);
    const source = context.single(FakeBufferSource);
    expect(sources).toEqual([source]);
    const n = Math.round(48000 / 440 - 0.5); // 109
    expect(n).toBe(109);
    expect(source.playbackRate.value).toBeCloseTo((440 * (n + 0.5)) / 48000, 12);
    expect(source.buffer?.length).toBe(72000);
    expect(source.startedAt).toBe(T);
    expect(source.targets).toEqual([amp]);
    expect(amp.gain.events).toEqual(attackEvents(1, 0.002));
  });

  it('excites with dark noise, decays to −34 dB over 1.5 s and fades the last 100 ms', () => {
    const { context, amp, synths } = setup();
    synths.play(SOUNDS.pluck, [440], T, ampNode(amp), 1);
    const data = context.single(FakeBufferSource).buffer?.getChannelData(0) ?? new Float32Array();
    const n = 109;
    const rms = (from: number, to: number): number =>
      Math.sqrt(data.subarray(from, to).reduce((sum, v) => sum + v * v, 0) / (to - from));
    expect(rms(0, n + 1)).toBeGreaterThan(0);
    const early = rms(n + 1, 3 * n);
    const late = rms(60000, 64000);
    expect(late).toBeLessThan(early * 0.1);
    expect(Math.abs(data[71999] ?? 1)).toBe(0);
    const g = 0.02 ** ((n + 0.5) / 72000);
    expect(data[n + 1]).toBeCloseTo(g * 0.5 * ((data[1] ?? 0) + (data[0] ?? 0)), 6); // float32 storage
  });

  it('keeps one buffer per delay length and clamps the length to two samples', () => {
    const { context, amp, synths } = setup();
    synths.play(SOUNDS.pluck, [440, 440, 100000], T, ampNode(amp), 1);
    const [first, second, third] = context.all(FakeBufferSource);
    expect(second?.buffer).toBe(first?.buffer);
    expect(third?.buffer).not.toBe(first?.buffer);
    expect(third?.playbackRate.value).toBeCloseTo((100000 * 2.5) / 48000, 12);
  });
});
