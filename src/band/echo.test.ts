import { describe, expect, it } from 'vitest';
import { setLocale } from '../i18n';
import { mulberry32 } from './__fixtures__/calls';
import { createSetup, type Setup } from './__fixtures__/setup';
import { createEcho, type Difficulty, type Echo } from './echo';

// Classical at 60 bpm: bar n starts at 0.05 + 4 n once the band runs
interface EchoSetup {
  readonly setup: Setup;
  readonly echo: Echo;
  readonly titles: string[];
  level: Difficulty;
}
const echoSetup = (seed = 1): EchoSetup => {
  const setup = createSetup('classical', 'pop');
  setup.band.setTempo(60);
  const state = { setup, titles: [] as string[], level: 'easy' as Difficulty };
  const echo: Echo = createEcho({
    band: setup.band,
    player: setup.player,
    model: setup.model,
    rng: mulberry32(seed),
    difficulty: () => state.level,
    onChange: () => state.titles.push(echo.title()),
  });
  return Object.assign(state, { echo }); // the same object: the level set later reaches the difficulty closure
};
const melodies = (setup: Setup): number[] =>
  setup.engine.calls.flatMap((call) => (call[0] === 'melody' ? [call[2]] : []));
// Play the shown phrase back, tone by tone
const playBack = (state: EchoSetup): void => {
  for (const tone of state.echo.status()?.tones ?? []) state.echo.press(tone);
};

describe('Echo', () => {
  it('starts the band, counts in a bar, plays three tones, then hands over', () => {
    setLocale('de');
    const state = echoSetup();
    const { setup, echo } = state;
    expect(echo.active()).toBe(false);
    expect(echo.status()).toBeNull();
    expect(echo.title()).toBe('');
    echo.start();
    echo.start(); // a second start is harmless
    expect(setup.band.running()).toBe(true);
    expect(echo.status()).toMatchObject({ phase: 'listen', n: 3, progress: 0, wrong: 0 });
    expect(echo.status()?.tones).toHaveLength(3);
    expect(echo.title()).toBe('Hör zu …');
    setup.time.advance(4.05 + 0.5); // bar 0 counts in, the phrase starts with bar 1
    expect(melodies(setup)[0]).toBeCloseTo(4.05, 9);
    expect(setup.player.ghosts().length).toBeGreaterThan(0); // easy: every stripe glows
    expect(echo.status()?.phase).toBe('listen');
    setup.time.advance(4);
    expect(echo.status()?.phase).toBe('play');
    expect(echo.title()).toBe('Du bist dran');
    expect(melodies(setup)).toHaveLength(3);
    echo.stop();
    expect(setup.band.running()).toBe(false); // the echo started it, so it stops it
    expect(echo.active()).toBe(false);
    echo.stop(); // a second stop is harmless
  });

  it('grows by one tone once the columns are hit in order, ignoring wrong tones in between', () => {
    const state = echoSetup();
    const { setup, echo } = state;
    echo.start();
    setup.time.advance(13);
    expect(echo.status()?.phase).toBe('play');
    const tones = echo.status()?.tones ?? [];
    echo.press(tones[0] === 14 ? 13 : 14); // wrong: skipped
    expect(echo.status()?.wrong).toBe(1);
    echo.press(tones[0] ?? 0);
    expect(echo.status()).toMatchObject({ progress: 1, wrong: 0 });
    echo.press(tones[1] ?? 0);
    echo.press(tones[2] ?? 0);
    expect(echo.status()).toMatchObject({ phase: 'wait', n: 4, progress: 3 });
    expect(echo.title()).toBe('Echo · 4 Töne');
    expect(echo.status()?.tones.slice(0, 3)).toEqual(tones); // the old part stays
    echo.press(tones[0] ?? 0); // not your turn
    expect(echo.status()?.progress).toBe(3);
    setup.time.advance(4);
    expect(echo.status()?.phase).toBe('listen');
    setup.time.advance(4);
    expect(echo.status()).toMatchObject({ phase: 'play', progress: 0, wrong: 0 });
    echo.stop();
  });

  it('repeats the phrase after three wrong tones in a row', () => {
    const state = echoSetup();
    const { setup, echo } = state;
    echo.start();
    setup.time.advance(13);
    const tones = echo.status()?.tones ?? [];
    const wrong = tones.includes(2) ? 3 : 2;
    echo.press(wrong);
    echo.press(wrong);
    expect(echo.status()?.phase).toBe('play');
    echo.press(wrong);
    expect(echo.status()).toMatchObject({ phase: 'wait', n: 3 });
    const played = melodies(setup).length;
    setup.time.advance(8);
    expect(melodies(setup)).toHaveLength(played + 3);
    expect(echo.status()?.phase).toBe('play');
    echo.stop();
  });

  it('grows the phrase by two bars when the tones run out', () => {
    const state = echoSetup();
    const { setup, echo } = state;
    echo.start();
    for (let round = 0; round < 12; round++) {
      setup.time.advance(16);
      expect(echo.status()?.phase).toBe('play');
      playBack(state);
    }
    expect(echo.status()?.n).toBe(15);
    expect(echo.status()?.tones).toHaveLength(15);
    echo.stop();
  });

  it('ghosts by level: medium the first tone only, hard none', () => {
    const state = echoSetup();
    const { setup, echo } = state;
    state.level = 'medium';
    echo.start();
    setup.time.advance(4.05 + 0.1);
    expect(setup.player.ghosts()).toHaveLength(1);
    echo.stop();
    setup.time.advance(1);
    const hard = echoSetup();
    hard.level = 'hard';
    hard.echo.start();
    hard.setup.time.advance(4.05 + 0.1);
    expect(hard.setup.player.ghosts()).toHaveLength(0);
    hard.echo.stop();
  });

  it('leaves the band running when it was running before, and ends with the band', () => {
    const state = echoSetup();
    const { setup, echo } = state;
    setup.band.start();
    setup.time.advance(1);
    echo.start();
    expect(echo.status()?.phase).toBe('listen');
    echo.stop();
    expect(setup.band.running()).toBe(true);
    echo.start();
    setup.band.stop();
    expect(echo.active()).toBe(false);
    expect(state.titles.at(-1)).toBe('');
  });

  it('names the phases in English too', () => {
    setLocale('en');
    const state = echoSetup();
    state.echo.start();
    expect(state.echo.title()).toBe('Listen …');
    state.echo.stop();
    setLocale('de');
  });
});
