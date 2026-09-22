import { describe, expect, it } from 'vitest';
import { FakeAudioContext, FakeCompressor, FakeConvolver, FakeGain } from './__tests__/fake-audio-context';
import { createMixer, impulse } from './effects';
import { SOUNDS } from './sounds';

describe('impulse', () => {
  it('is stereo noise that decays to silence with the given power', () => {
    const context = new FakeAudioContext(1000);
    const buffer = impulse(context.asContext(), 2, 3);
    expect(buffer.numberOfChannels).toBe(2);
    expect(buffer).toHaveLength(2000);
    const left = buffer.getChannelData(0);
    const right = buffer.getChannelData(1);
    left.forEach((value, i) => {
      expect(Math.abs(value)).toBeLessThanOrEqual((1 - i / 2000) ** 3);
    });
    expect(Math.abs(left[1999] ?? 1)).toBeLessThan(1e-9);
    expect(left.some((value, i) => value !== right[i])).toBe(true);
  });

  it('darkens the noise with a one-pole lowpass when a tone is given', () => {
    const context = new FakeAudioContext(1000);
    const roughness = (data: Float32Array): number =>
      data.reduce((sum, value, i) => sum + Math.abs(value - (i > 0 ? (data[i - 1] ?? 0) : 0)), 0);
    const white = impulse(context.asContext(), 1, 1).getChannelData(0);
    const dark = impulse(context.asContext(), 1, 1, 0.35).getChannelData(0);
    expect(roughness(dark)).toBeLessThan(roughness(white) / 2);
  });
});

describe('createMixer', () => {
  it('puts a compressor with the recorded settings before the destination', () => {
    const context = new FakeAudioContext();
    createMixer(context.asContext());
    const compressor = context.single(FakeCompressor);
    expect([
      compressor.threshold.value,
      compressor.knee.value,
      compressor.ratio.value,
      compressor.attack.value,
      compressor.release.value,
    ]).toEqual([-14, 12, 4, 0.004, 0.2]);
    expect(compressor.targets).toEqual([context.destination]);
  });

  it('creates the room reverb at start: 1.8 s impulse, return 0.25 into the compressor', () => {
    const context = new FakeAudioContext();
    const mixer = createMixer(context.asContext());
    const room = context.single(FakeConvolver);
    expect(room.buffer?.length).toBe(Math.floor(48000 * 1.8));
    const ret = room.targets[0];
    expect(ret).toBeInstanceOf(FakeGain);
    expect((ret as FakeGain).gain.value).toBe(0.25);
    expect((ret as FakeGain).targets).toEqual([mixer.compressor]);
    expect(mixer.reverb('room')).toBe(room);
  });

  it('creates the church reverb on demand: 4 s impulse, return 0.35, cached', () => {
    const context = new FakeAudioContext();
    const mixer = createMixer(context.asContext());
    const church = mixer.reverb('church') as unknown as FakeConvolver;
    expect(church.buffer?.length).toBe(48000 * 4);
    expect((church.targets[0] as FakeGain).gain.value).toBeCloseTo(0.35, 12);
    expect(mixer.reverb('church')).toBe(church);
    expect(context.all(FakeConvolver)).toHaveLength(2);
  });

  it('feeds a sound with wet 1 dry (0.9) into the compressor and straight into its reverb', () => {
    const context = new FakeAudioContext();
    const mixer = createMixer(context.asContext());
    const dry = mixer.output(SOUNDS.epiano) as unknown as FakeGain;
    expect(dry.gain.value).toBeCloseTo(0.9, 12);
    expect(dry.targets).toEqual([mixer.compressor, mixer.reverb('room')]);
  });

  it('sends a sound with another wet share through a send gain and shares outputs per reverb and share', () => {
    const context = new FakeAudioContext();
    const mixer = createMixer(context.asContext());
    const dry = mixer.output(SOUNDS.piano) as unknown as FakeGain;
    const [toCompressor, send] = dry.targets;
    expect(toCompressor).toBe(mixer.compressor);
    expect((send as FakeGain).gain.value).toBeCloseTo(0.8, 12);
    expect((send as FakeGain).targets).toEqual([mixer.reverb('room')]);
    expect(mixer.output(SOUNDS.supersaw)).toBe(dry); // also room at 0.8
    expect(mixer.output(SOUNDS.violin)).not.toBe(dry); // room at 1.3
    expect(mixer.output(SOUNDS.churchOrgan)).not.toBe(mixer.output(SOUNDS.epiano)); // church at 1
    expect((mixer.output(SOUNDS.churchOrgan) as unknown as FakeGain).targets[1]).toBe(mixer.reverb('church'));
  });
});
