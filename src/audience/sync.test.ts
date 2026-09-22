// Player and listener through the fake relay, like two browser tabs: the listener's clock is three seconds off and
// every message takes 200 ms; the player hits the notes with an uneven tempo (600/400/800 ms per beat) and pauses
// 3.5 s in the middle. Per frame the listener's display is compared with the true position.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeRelay } from './__fixtures__/fake-relay';
import { RECORDED } from './__fixtures__/recorded';
import { Applause } from './applause';
import { KaraokeModel } from './karaoke-model';
import { PlayerLink, type PlayerSong } from './player-link';
import { RelayClient } from './relay-client';

const RELAY = 'wss://wumble.example/ws';
const ROOM = 'k7m3x';
const LATENCY = 200;
const CLOCK_OFFSET = 3000;
const GAPS = [600, 400, 800]; // ms per beat, in turn – the tempo wobbles by ±33 %
const PAUSE_AFTER = 11;
const PAUSE = 3500;
const FRAME = 16;

const fixture = RECORDED.lines.find((song) => song.title === 'Alle meine Entchen');
if (fixture === undefined) throw new Error('fixture missing');
const SONG: PlayerSong = {
  title: fixture.title,
  bpm: fixture.bpm,
  signature: fixture.k,
  notes: fixture.midi.map((midi, i) => ({ midi, beats: fixture.beats[i] ?? 1, text: fixture.syllables[i] ?? '' })),
};

interface Frame {
  readonly t: number; // listener's server time
  readonly cur: number;
  readonly idx: number;
  readonly fill: number;
  readonly dotAt: number;
  readonly v: number;
  readonly shown: number;
}

describe('player and listener in sync through the relay', () => {
  let relay: FakeRelay;
  let playerLink: RelayClient;
  let listenerLink: RelayClient;
  let player: PlayerLink;
  let model: KaraokeModel;
  let applause: number;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
    relay = new FakeRelay();
    applause = 0;
    playerLink = new RelayClient({
      relayUrl: RELAY,
      room: ROOM,
      role: 'player',
      socket: relay.factory,
      onMessage: (message) => {
        player.receive(message);
      },
    });
    player = new PlayerLink({ link: playerLink, onApplause: () => applause++ });
    listenerLink = new RelayClient({
      relayUrl: RELAY,
      room: ROOM,
      role: 'listener',
      socket: relay.factory,
      now: () => Date.now() + CLOCK_OFFSET,
      delay: LATENCY,
      onMessage: (message) => {
        model.receive(message);
      },
    });
    model = new KaraokeModel(() => listenerLink.serverNow());
    vi.advanceTimersByTime(1000);
  });

  afterEach(() => {
    playerLink.close();
    listenerLink.close();
    vi.useRealTimers();
  });

  it('aligns the listener clock despite the offset and the latency', () => {
    expect(playerLink.synced && listenerLink.synced).toBe(true);
    expect(player.listeners).toBe(1);
    expect(listenerLink.rtt).toBe(2 * LATENCY);
    expect(Math.abs(listenerLink.offset + CLOCK_OFFSET - playerLink.offset)).toBeLessThan(60);
    expect(Math.abs(listenerLink.serverNow() - playerLink.serverNow())).toBeLessThan(60);
  });

  it('follows the song within half a syllable, never ahead, with soft corrections', () => {
    player.songStarted(SONG, 85);
    vi.advanceTimersByTime(LATENCY + 100);
    expect(model.currentSong?.title).toBe('Alle meine Entchen');
    expect(model.currentSong?.notes).toHaveLength(27);

    const n = SONG.notes.length;
    const hits: number[] = []; // server time of every press
    const press = (i: number): void => {
      player.notePressed(i);
      hits.push(playerLink.serverNow());
      if (i + 1 >= n) return;
      const gap = i === PAUSE_AFTER ? PAUSE : (SONG.notes[i]?.beats ?? 1) * (GAPS[i % GAPS.length] ?? 600);
      setTimeout(() => {
        press(i + 1);
      }, gap);
    };
    const trace: Frame[] = [];
    press(0);
    while (hits.length < n || Date.now() < (hits.at(-1) ?? 0) + LATENCY + 200) {
      vi.advanceTimersByTime(FRAME);
      const frame = model.frame();
      trace.push({
        t: listenerLink.serverNow(),
        cur: frame.current,
        idx: frame.active,
        fill: frame.fill,
        dotAt: frame.ball?.at ?? -1,
        v: frame.tempo,
        shown: frame.shown,
      });
    }
    expect(hits).toHaveLength(n);

    // True position p(t) = k + (t − sₖ) / (sₖ₊₁ − sₖ) between the presses; the deviation of the display in syllables and
    // in ms over the note's duration. The pause does not count (the ball waits there on purpose).
    let maxSyllables = 0;
    let maxMs = 0;
    let sumMs = 0;
    let count = 0;
    let maxAhead = -Infinity;
    let maxStep = 0;
    let previous: Frame | null = null;
    const tempos = new Set<number>();
    for (const frame of trace) {
      const k = hits.filter((hit) => hit <= frame.t).length - 1; // the last press before this frame
      if (frame.cur < 0 || k < 0 || k >= n - 1) continue; // before the first position arrives, the first syllable waits
      const duration = (hits[k + 1] ?? 0) - (hits[k] ?? 0);
      const truePosition = k + (frame.t - (hits[k] ?? 0)) / duration;
      expect(frame.idx).toBeLessThanOrEqual(frame.cur);
      expect(frame.idx).toBeLessThanOrEqual(Math.floor(truePosition)); // the active syllable is never ahead
      expect(frame.dotAt).toBeLessThanOrEqual(frame.cur + 1);
      maxAhead = Math.max(maxAhead, frame.dotAt - Math.floor(truePosition));
      if (previous?.cur === frame.cur) maxStep = Math.max(maxStep, Math.abs(frame.shown - previous.shown));
      tempos.add(Math.round(frame.v * 1000));
      previous = frame;
      if (k === PAUSE_AFTER) continue;
      const deviation = frame.shown - truePosition;
      maxSyllables = Math.max(maxSyllables, Math.abs(deviation));
      maxMs = Math.max(maxMs, Math.abs(deviation * duration));
      sumMs += Math.abs(deviation * duration);
      count++;
    }
    expect(count).toBeGreaterThan(50);
    expect(maxSyllables).toBeLessThanOrEqual(0.5);
    expect(sumMs / count).toBeLessThanOrEqual(200);
    expect(maxAhead).toBeLessThanOrEqual(1);
    expect(maxStep).toBeLessThanOrEqual(0.2);
    expect(tempos.size).toBeGreaterThanOrEqual(4);

    // During the pause the ball waits on syllable 12 while syllable 11 is full
    const pause = trace.filter(
      (frame) => frame.t > (hits[PAUSE_AFTER] ?? 0) + 2000 && frame.t < (hits[PAUSE_AFTER + 1] ?? 0),
    );
    expect(pause.length).toBeGreaterThan(0);
    expect(pause.every((frame) => frame.dotAt === 12 && frame.cur === 11 && frame.fill === 1)).toBe(true);

    // The end: done for four seconds, applause reaches the player once per half second
    player.songEnded();
    vi.advanceTimersByTime(LATENCY + 50);
    expect(model.frame().mode).toBe('done');
    const clapping = new Applause(listenerLink, () => Date.now());
    expect(clapping.clap()).toBe(true);
    expect(clapping.clap()).toBe(false);
    vi.advanceTimersByTime(LATENCY + 50);
    expect(applause).toBe(1);
    vi.advanceTimersByTime(4000);
    expect(model.frame().mode).toBe('waiting');

    // Free play: the tone with its chord
    player.freePlay(85);
    player.tone('E', 'C');
    vi.advanceTimersByTime(LATENCY + 50);
    expect(model.frame()).toMatchObject({ mode: 'free', hue: 85, tone: { name: 'E', chord: 'C' } });
  });

  it('brings a listener who joins late up to date', () => {
    player.songStarted(SONG, 85);
    vi.advanceTimersByTime(LATENCY + 50);
    player.notePressed(0);
    player.notePressed(1);
    vi.advanceTimersByTime(LATENCY + 50);
    const late = new KaraokeModel(() => Date.now());
    const lateLink = new RelayClient({
      relayUrl: RELAY,
      room: ROOM,
      role: 'listener',
      socket: relay.factory,
      onMessage: (message) => {
        late.receive(message);
      },
    });
    vi.advanceTimersByTime(50);
    expect(player.listeners).toBe(2);
    expect(late.currentSong?.title).toBe('Alle meine Entchen');
    expect(late.frame()).toMatchObject({ mode: 'song', current: 1 });
    lateLink.close();
    vi.advanceTimersByTime(50);
    expect(player.listeners).toBe(1);
  });
});
