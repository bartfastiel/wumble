import { describe, expect, it } from 'vitest';
import {
  FakeAudioContext,
  FakeBiquad,
  FakeBufferSource,
  FakeGain,
  FakeOscillator,
  type ParamEvent,
} from './__tests__/fake-audio-context';
import { createDrums, type DrumKind } from './drums';

const T = 1;
const setup = (): { context: FakeAudioContext; target: FakeGain; drums: ReturnType<typeof createDrums> } => {
  const context = new FakeAudioContext();
  const target = context.createGain();
  return { context, target, drums: createDrums(context.asContext(), target as unknown as AudioNode) };
};
const decay = (gain: number, seconds: number): ParamEvent[] => [
  { method: 'setValueAtTime', value: gain, time: T },
  { method: 'exponentialRampToValueAtTime', value: 0.001, time: T + seconds },
];
const bus = (context: FakeAudioContext): FakeGain | undefined => context.all(FakeGain)[1];

describe('createDrums', () => {
  it('creates the drum bus (0.6) and one 2 s noise buffer on the first hit only', () => {
    const { context, target, drums } = setup();
    expect(context.all(FakeGain)).toHaveLength(1);
    drums.hit('hatClosed', T);
    drums.hit('hatClosed', T + 0.5);
    const drumBus = bus(context);
    expect(drumBus?.gain.value).toBeCloseTo(0.6, 12);
    expect(drumBus?.targets).toEqual([target]);
    const [first, second] = context.all(FakeBufferSource);
    expect(first?.buffer?.length).toBe(96000);
    expect(second?.buffer).toBe(first?.buffer);
    expect(context.all(FakeGain).filter((node) => node.targets[0] === target)).toHaveLength(1);
  });

  it('kick: sine gliding 160 → 45 Hz in 60 ms, decaying over 350 ms', () => {
    const { context, drums } = setup();
    drums.hit('kick', T);
    const oscillator = context.single(FakeOscillator);
    expect(oscillator.frequency.events).toEqual([
      { method: 'setValueAtTime', value: 160, time: T },
      { method: 'exponentialRampToValueAtTime', value: 45, time: T + 0.06 },
    ]);
    const envelope = oscillator.targets[0] as FakeGain;
    expect(envelope.gain.events).toEqual(decay(1, 0.35));
    expect(envelope.targets).toEqual([bus(context)]);
    expect([oscillator.startedAt, oscillator.stoppedAt]).toEqual([T, T + 0.37]);
  });

  it('snare: highpassed noise 180 ms plus a 190 → 150 Hz body', () => {
    const { context, drums } = setup();
    drums.hit('snare', T, 0.5);
    const source = context.single(FakeBufferSource);
    const filter = context.single(FakeBiquad);
    expect([filter.type, filter.frequency.value, filter.Q.value]).toEqual(['highpass', 1500, 0.7]);
    expect(source.targets).toEqual([filter]);
    expect((filter.targets[0] as FakeGain).gain.events).toEqual(decay(0.7 * 0.5, 0.18));
    expect((filter.targets[0] as FakeGain).targets).toEqual([bus(context)]);
    expect(source.offset).toBeGreaterThanOrEqual(0);
    expect(source.offset).toBeLessThan(1.5);
    expect(source.stoppedAt).toBeCloseTo(T + 0.2, 12);
    const body = context.single(FakeOscillator);
    expect(body.frequency.events[1]).toEqual({ method: 'exponentialRampToValueAtTime', value: 150, time: T + 0.08 });
    expect((body.targets[0] as FakeGain).gain.events).toEqual(decay(0.45 * 0.5, 0.12));
  });

  it.each<[DrumKind, BiquadFilterType, number, number, number, number]>([
    ['hatClosed', 'bandpass', 8000, 1, 0.5, 0.04],
    ['hatOpen', 'bandpass', 8000, 1, 0.45, 0.25],
    ['ride', 'bandpass', 5000, 2, 0.4, 0.3],
  ])('%s: one filtered noise burst', (kind, type, frequency, q, gain, seconds) => {
    const { context, drums } = setup();
    drums.hit(kind, T);
    const filter = context.single(FakeBiquad);
    expect([filter.type, filter.frequency.value, filter.Q.value]).toEqual([type, frequency, q]);
    expect((filter.targets[0] as FakeGain).gain.events).toEqual(decay(gain, seconds));
    expect(context.single(FakeBufferSource).stoppedAt).toBeCloseTo(T + seconds + 0.02, 12);
  });

  it('clap: two bursts 12 ms apart', () => {
    const { context, drums } = setup();
    drums.hit('clap', T, 1);
    const bursts = context.all(FakeBufferSource);
    expect(bursts.map((burst) => burst.startedAt)).toEqual([T, T + 0.012]);
    const filters = context.all(FakeBiquad);
    expect(filters.map((filter) => [filter.type, filter.frequency.value, filter.Q.value])).toEqual([
      ['bandpass', 1500, 0.8],
      ['bandpass', 1500, 0.8],
    ]);
    expect((filters[1]?.targets[0] as FakeGain).gain.events[0]).toEqual({
      method: 'setValueAtTime',
      value: 0.6,
      time: T + 0.012,
    });
  });

  it('never lets the velocity fall below 0.01', () => {
    const { context, drums } = setup();
    drums.hit('kick', T, 0);
    expect((context.single(FakeOscillator).targets[0] as FakeGain).gain.events[0]?.value).toBeCloseTo(0.01, 12);
  });
});
