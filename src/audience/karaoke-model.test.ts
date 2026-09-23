import { beforeEach, describe, expect, it } from 'vitest';
import { type LinesFixture, RECORDED } from './__fixtures__/recorded';
import {
  ARC_MS,
  breakLines,
  CORRECTION_MS,
  DONE_MS,
  isWordEnd,
  KaraokeModel,
  MAX_LINE,
  songFromMessage,
  syllableText,
} from './karaoke-model';
import type { SongMessage } from './messages';

const songMessage = (fixture: LinesFixture): SongMessage => ({
  t: 'song',
  title: fixture.title,
  bpm: fixture.bpm,
  k: fixture.k,
  hue: 85,
  notes: fixture.midi.map((midi, i) => ({
    midi,
    beats: fixture.beats[i] ?? 1,
    ...(fixture.hasText ? { text: fixture.syllables[i] ?? '' } : {}),
  })),
});
const entchen = RECORDED.lines.find((song) => song.title === 'Alle meine Entchen');
if (entchen === undefined) throw new Error('fixture missing');
const ENTCHEN = songMessage(entchen);

describe('breakLines', () => {
  it('matches the recorded lines for all 27 songs', () => {
    expect(RECORDED.lines).toHaveLength(27);
    for (const song of RECORDED.lines) expect(breakLines(song.syllables), song.title).toEqual(song.lines);
  });

  it('keeps words together and breaks after punctuation from six syllables on', () => {
    expect(breakLines(['a', 'b', 'c', 'd', 'e', 'f,', 'g', 'h'])).toEqual([
      [0, 1, 2, 3, 4, 5],
      [6, 7],
    ]);
    expect(breakLines(['a', 'b', 'c', 'd', 'e', 'f-', 'g,', 'h'])).toEqual([[0, 1, 2, 3, 4, 5, 6], [7]]);
    expect(breakLines(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i-', 'j', 'k'])).toEqual([
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
      [10],
    ]);
  });

  it('breaks inside a word after twelve syllables at the latest', () => {
    const word = Array.from({ length: 15 }, (_, i) => (i < 14 ? 'la-' : 'la'));
    expect(breakLines(word)).toEqual([Array.from({ length: MAX_LINE }, (_, i) => i), [12, 13, 14]]);
    expect(breakLines(['one'])).toEqual([[0]]);
    expect(breakLines([])).toEqual([[]]);
  });
});

describe('isWordEnd and syllableText', () => {
  it('sees a word end without a trailing hyphen and before anything but a melisma', () => {
    const syllables = ['Al-', 'le', 'schon', '_', 'da'];
    expect(syllables.map((_, i) => isWordEnd(syllables, i))).toEqual([false, true, false, true, true]);
    expect(isWordEnd(['Ent-', '_', 'chen'], 1)).toBe(false);
  });

  it('shows the syllable without its hyphen', () => {
    expect(syllableText('Al-')).toBe('Al');
    expect(syllableText('See,')).toBe('See,');
    expect(syllableText('_')).toBe('_');
  });
});

describe('songFromMessage', () => {
  it('takes the lyrics, or the note names of the key for songs without', () => {
    for (const fixture of RECORDED.lines) {
      const song = songFromMessage(songMessage(fixture));
      expect(song?.syllables, fixture.title).toEqual(fixture.syllables);
      expect(song?.lines).toEqual(fixture.lines);
      expect(song?.title).toBe(fixture.title);
      expect(song?.bpm).toBe(fixture.bpm);
    }
  });

  it('rejects a message without notes', () => {
    expect(songFromMessage({ ...ENTCHEN, notes: [] })).toBeNull();
    expect(songFromMessage({ ...ENTCHEN, notes: 'none' as unknown as SongMessage['notes'] })).toBeNull();
  });

  it('fills in defaults for odd fields', () => {
    const odd = {
      t: 'song',
      title: 7,
      bpm: -5,
      k: 99,
      hue: 'x',
      notes: [{ midi: 61.7, beats: 0, text: 3 }, 'not a note', { midi: Number.NaN, beats: 0.5, text: 'x' }],
    } as unknown as SongMessage;
    expect(songFromMessage(odd)).toEqual({
      title: '',
      bpm: 100,
      notes: [
        { midi: 61, beats: 1, text: null },
        { midi: 0, beats: 1, text: null },
        { midi: 0, beats: 0.5, text: 'x' },
      ],
      // One note carries a word, so the two without one are the lead-in: their own line, and no note names
      syllables: ['♪', '♪', 'x'],
      lines: [[0, 1], [2]],
    });
  });
});

describe('KaraokeModel', () => {
  let now: number;
  let model: KaraokeModel;
  const beat = (): number => 60_000 / entchen.bpm; // ms of one beat at the song's bpm
  const pos = (i: number, s = now): void => {
    model.receive({ t: 'pos', i, s });
  };

  beforeEach(() => {
    now = 10_000;
    model = new KaraokeModel(() => now);
  });

  it('waits at first', () => {
    expect(model.frame()).toEqual({
      mode: 'waiting',
      hue: null,
      line: -1,
      active: -1,
      fill: 0,
      shown: 0,
      current: -1,
      tempo: 100 / 60,
      ball: null,
      tone: null,
    });
    expect(model.currentSong).toBeNull();
  });

  it('shows a new song from its first syllable, which waits for the first note', () => {
    model.receive(ENTCHEN);
    expect(model.currentSong?.title).toBe('Alle meine Entchen');
    const frame = model.frame();
    expect(frame.mode).toBe('song');
    expect(frame.hue).toBe(85);
    expect(frame.line).toBe(0);
    expect(frame.active).toBe(0);
    expect(frame.fill).toBe(0);
    expect(frame.ball).toBeNull();
    expect(frame.tempo).toBeCloseTo(110 / 60, 6);
    model.receive({ ...ENTCHEN, notes: [] });
    expect(model.currentSong?.title).toBe('Alle meine Entchen'); // an empty song changes nothing
  });

  it('fills the syllable over its expected duration and hops the ball to the next one', () => {
    model.receive(ENTCHEN);
    pos(0);
    expect(model.frame()).toMatchObject({ active: 0, fill: 0, current: 0, ball: { at: 0, from: null, progress: 1 } });
    now += beat() / 2;
    let frame = model.frame();
    expect(frame).toMatchObject({ active: 0, ball: { at: 0 } });
    expect(frame.fill).toBeCloseTo(0.5, 6);
    expect(frame.shown).toBeCloseTo(0.5, 6);
    now += beat() / 2;
    frame = model.frame();
    expect(frame).toMatchObject({ active: 0, ball: { at: 1, from: 0, progress: 0, bob: 0 } });
    expect(frame.fill).toBeCloseTo(1, 6);
    now += ARC_MS / 2;
    frame = model.frame();
    expect(frame.ball).toMatchObject({ at: 1, from: 0, progress: 0.5 });
    now += ARC_MS / 2;
    frame = model.frame();
    expect(frame.ball).toMatchObject({ at: 1, from: null, progress: 1 });
    expect(frame.ball?.bob).toBeGreaterThanOrEqual(0);
    now += 10_000; // the player pauses – the ball waits on the next syllable, the fill stays full
    expect(model.frame()).toMatchObject({ active: 0, fill: 1, ball: { at: 1 } });
  });

  it('corrects softly when the next position arrives late, without a jump', () => {
    model.receive(ENTCHEN);
    pos(0);
    now += beat() + 200; // the press of note 1 was 200 ms ago, its message only arrives now
    model.frame();
    pos(1, now - 200);
    const shownBefore = model.frame().shown;
    expect(shownBefore).toBeCloseTo(1, 3); // no jump: the display starts where it was
    const steps: number[] = [];
    let last = shownBefore;
    const frames = Math.ceil(CORRECTION_MS / 16) + 1;
    for (let k = 0; k < frames; k++) {
      now += 16;
      const { shown } = model.frame();
      steps.push(shown - last);
      last = shown;
    }
    expect(Math.max(...steps)).toBeLessThan(0.2);
    expect(Math.min(...steps)).toBeGreaterThan(0);
    const { shown, active, fill } = model.frame();
    expect(shown).toBeCloseTo(1 + (200 + frames * 16) / beat(), 6); // the correction has decayed
    expect(active).toBe(1);
    expect(fill).toBeCloseTo(shown - 1, 6);
  });

  it('jumps when the position is more than a syllable away', () => {
    model.receive(ENTCHEN);
    pos(0);
    pos(5);
    expect(model.frame()).toMatchObject({ active: 5, fill: 0, shown: 5, ball: { at: 5, from: null } });
    pos(1); // a restart
    expect(model.frame()).toMatchObject({ active: 1, shown: 1, ball: { at: 1, from: null } });
  });

  it('clamps the note index and takes the current time for a position without one', () => {
    model.receive(ENTCHEN);
    pos(99);
    expect(model.frame().active).toBe(26);
    pos(-4);
    expect(model.frame().active).toBe(0);
    model.receive({ t: 'pos', i: 2, s: 'soon' as unknown as number });
    expect(model.frame()).toMatchObject({ active: 2, fill: 0 });
  });

  it('never runs more than one syllable ahead and never past the last one', () => {
    model.receive(ENTCHEN);
    pos(26);
    now += 5 * beat();
    expect(model.frame()).toMatchObject({ active: 26, fill: 1, ball: { at: 26 } });
  });

  it('cuts a running hop short when the active line changes', () => {
    model.receive(ENTCHEN); // lines: 9, 7, 6, 5 syllables
    pos(8);
    model.frame();
    now += beat();
    expect(model.frame()).toMatchObject({ line: 0, ball: { at: 9, from: 8 } });
    now += 10;
    pos(9);
    expect(model.frame()).toMatchObject({ line: 1, active: 9, ball: { at: 9, from: null, progress: 1 } });
  });

  it('shows done for four seconds after the end, then waits again', () => {
    model.receive(ENTCHEN);
    pos(0);
    model.receive({ t: 'end' });
    expect(model.frame().mode).toBe('done');
    pos(1); // positions no longer matter
    now += DONE_MS - 1;
    expect(model.frame()).toMatchObject({ mode: 'done', current: 0 });
    now += 1;
    expect(model.frame()).toMatchObject({ mode: 'waiting', active: -1 });
    expect(model.currentSong).toBeNull();
    model.receive({ t: 'end' }); // outside a song it is ignored
    expect(model.frame().mode).toBe('waiting');
  });

  it('switches to free play with the hue, and shows tones with a fallback name', () => {
    model.receive({ t: 'free', hue: 115 });
    expect(model.frame()).toMatchObject({ mode: 'free', hue: 115, tone: null });
    model.receive({ t: 'free', hue: 'x' as unknown as number });
    expect(model.frame().hue).toBe(115);
    model.receive({ t: 'tone', name: 'E', chord: 'C' });
    expect(model.frame().tone).toEqual({ name: 'E', chord: 'C', at: now });
    model.receive(ENTCHEN);
    model.receive({ t: 'tone', name: '', chord: 7 as unknown as string });
    expect(model.frame()).toMatchObject({ mode: 'free', tone: { name: '♪', chord: '' } });
    model.receive({ t: 'pos', i: 3, s: now }); // not in a song
    expect(model.frame().active).toBe(-1);
    model.receive({ t: 'present', listeners: 1 }); // not the listener's business
    expect(model.frame().mode).toBe('free');
  });

  it('keeps the hue of a song that does not carry one', () => {
    model.receive({ t: 'free', hue: 115 });
    model.receive({ ...ENTCHEN, hue: undefined as unknown as number });
    expect(model.frame().hue).toBe(115);
  });
});
