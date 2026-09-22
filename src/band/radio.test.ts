import { describe, expect, it } from 'vitest';
import { createRecordingEngine } from './__fixtures__/fakes';
import { laneCalls, mulberry32 } from './__fixtures__/calls';
import { RECORDED } from './__fixtures__/recorded';
import { createSetup, type Setup } from './__fixtures__/setup';
import { createRadio, type Radio } from './radio';

const melodies = (setup: Setup): number[] =>
  setup.engine.calls.flatMap((call) => (call[0] === 'melody' ? [call[2]] : []));

const radioSetup = (seed = 1): { setup: Setup; radio: Radio; muted: { value: boolean } } => {
  const setup = createSetup('classical', 'pop');
  setup.band.setTempo(60);
  const muted = { value: false };
  const radio = createRadio({
    band: setup.band,
    player: setup.player,
    model: setup.model,
    rng: mulberry32(seed),
    muted: () => muted.value,
  });
  return { setup, radio, muted };
};

describe('Radio', () => {
  it('plays the recorded phrases over four rendered bars', () => {
    const recorded = RECORDED.radio;
    const setup = createSetup(recorded.style as 'blues', recorded.schema as 'blues');
    const radio = createRadio({
      band: setup.band,
      player: setup.player,
      model: setup.model,
      rng: mulberry32(recorded.seed),
      muted: () => false,
    });
    radio.setOn(true);
    const engine = createRecordingEngine();
    setup.band.renderBars(engine, recorded.bars, recorded.t0);
    expect(laneCalls(engine.calls, 'melody')).toEqual(recorded.calls);
    expect(radio.status().playing).toBe(false); // the render ends with a reset
  });

  it('is off by default and plays two-bar phrases with half a bar of rest from the next bar start', () => {
    const { setup, radio } = radioSetup();
    expect(radio.on()).toBe(false);
    setup.band.start();
    setup.time.advance(1);
    expect(melodies(setup)).toEqual([]);
    radio.setOn(true);
    expect(radio.on()).toBe(true);
    expect(radio.status()).toEqual({ next: 4, playing: false });
    setup.time.advance(3.2);
    expect(radio.status()).toEqual({ next: 14, playing: true });
    setup.time.advance(6);
    expect(melodies(setup)[0]).toBeCloseTo(4.05, 9);
    const first = melodies(setup);
    expect(first.every((time) => time < 4.05 + 8)).toBe(true);
    setup.time.advance(5);
    expect(melodies(setup).length).toBeGreaterThan(first.length);
    expect(melodies(setup).at(first.length)).toBeCloseTo(14.05, 9);
    setup.band.stop();
  });

  it('breaks off and rests two bars when the human plays, and ignores the pause while off', () => {
    const { setup, radio } = radioSetup();
    radio.pause(); // off and not running: nothing
    radio.setOn(true);
    expect(radio.status().next).toBe(0);
    radio.pause(); // not running: nothing
    setup.band.start();
    setup.time.advance(1.5);
    expect(radio.status().playing).toBe(true);
    const played = melodies(setup).length;
    radio.pause();
    expect(radio.status()).toEqual({ next: 12, playing: false }); // beat 1.45 + 8 → bar 3
    setup.time.advance(10);
    expect(melodies(setup)).toHaveLength(played); // nothing until bar 3
    setup.time.advance(2);
    expect(melodies(setup).length).toBeGreaterThan(played);
    expect(melodies(setup).at(played)).toBeCloseTo(12.05, 9);
    setup.band.stop();
  });

  it('is silent while muted (the echo runs) and joins in at the next bar start afterwards', () => {
    const { setup, radio, muted } = radioSetup();
    radio.setOn(true);
    setup.band.start();
    setup.time.advance(1);
    const played = melodies(setup).length;
    muted.value = true;
    setup.time.advance(9);
    expect(melodies(setup)).toHaveLength(played);
    expect(radio.status().playing).toBe(false);
    muted.value = false;
    setup.time.advance(3);
    expect(melodies(setup).at(played)).toBeCloseTo(12.05, 9);
    setup.band.stop();
  });

  it('breaks off when switched off and stops with the band', () => {
    const { setup, radio } = radioSetup();
    radio.setOn(true);
    setup.band.start();
    setup.time.advance(1);
    expect(radio.status().playing).toBe(true);
    radio.setOn(false);
    expect(radio.status().playing).toBe(false);
    radio.hush(); // nothing left to hush
    const played = melodies(setup).length;
    setup.time.advance(10);
    expect(melodies(setup)).toHaveLength(played);
    radio.setOn(true); // running: from the next bar start after half a beat
    expect(radio.status().next).toBe(12);
    setup.band.stop();
    setup.time.advance(1);
    expect(radio.status().playing).toBe(false);
  });

  it('keeps going phrase after phrase, every ten beats', () => {
    const { setup, radio } = radioSetup(7);
    radio.setOn(true);
    setup.band.start();
    setup.time.advance(30.5);
    const starts = [0.05, 10.05, 20.05, 30.05];
    for (const start of starts) expect(melodies(setup)).toContain(start);
    expect(radio.status().next).toBe(40);
    setup.band.stop();
  });
});
