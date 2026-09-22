// @vitest-environment happy-dom
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { FakeRelay } from '../audience/__fixtures__/fake-relay';
import type { IncomingMessage, OutgoingMessage } from '../audience/messages';
import { RelayClient } from '../audience/relay-client';
import { setLocale } from '../i18n';
import { FakeEngine } from '../play/__fixtures__/fakes';
import { createApp } from './app';
import { ballPosition, WmListener, LISTENING_CLASS } from './wm-listener';

const ROOM = 'k7m3x';
const SONG: OutgoingMessage = {
  t: 'song',
  title: 'Alle meine Entchen',
  bpm: 110,
  k: 0,
  hue: 85,
  notes: [
    { midi: 60, beats: 1, text: 'Al-' },
    { midi: 62, beats: 1, text: 'le' },
    { midi: 64, beats: 1, text: 'mei-' },
    { midi: 65, beats: 1, text: 'ne' },
    { midi: 67, beats: 2, text: 'Ent-' },
    { midi: 67, beats: 2, text: 'chen' },
  ],
};

const memory = (): Storage => {
  const items = new Map<string, string>();
  return {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => {
      items.set(key, value);
    },
    removeItem: (key) => {
      items.delete(key);
    },
    clear: () => {
      items.clear();
    },
    key: () => null,
    length: 0,
  };
};

const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 1));
const frames = (n = 2): Promise<void> =>
  new Promise((resolve) => {
    const step = (left: number): void => {
      if (left === 0) resolve();
      else
        requestAnimationFrame(() => {
          step(left - 1);
        });
    };
    step(n);
  });

describe('ballPosition', () => {
  const rect = (i: number): { left: number; top: number; width: number; height: number } | null =>
    i < 2 ? { left: 100 * i, top: 50, width: 40, height: 30 } : null;

  it('sits above the middle of the syllable and bobs while waiting', () => {
    expect(ballPosition({ at: 0, from: null, progress: 1, bob: 0 }, rect)).toEqual({ x: 20, y: 40 });
    expect(ballPosition({ at: 0, from: null, progress: 1, bob: 1 }, rect)).toEqual({ x: 20, y: 36 });
    expect(ballPosition({ at: 2, from: null, progress: 1, bob: 0 }, rect)).toBeNull();
  });

  it('hops in an arc from the previous syllable', () => {
    const half = ballPosition({ at: 1, from: 0, progress: 0.5, bob: 0 }, rect);
    expect(half?.x).toBe(70);
    expect(half?.y).toBeCloseTo(40 - 18, 9);
    expect(ballPosition({ at: 1, from: 0, progress: 1, bob: 0 }, rect)).toEqual({ x: 120, y: 40 });
  });
});

describe('wm-listener', () => {
  let relay: FakeRelay;
  let listener: WmListener;
  let received: IncomingMessage[];
  let player: RelayClient;

  beforeAll(() => {
    customElements.define('wm-listener', WmListener);
  });
  beforeEach(async () => {
    setLocale('de');
    relay = new FakeRelay();
    received = [];
    listener = new WmListener();
    listener.app = createApp({ storage: memory(), engine: new FakeEngine(), socket: relay.factory });
    listener.socket = relay.factory;
    document.body.append(listener);
    player = new RelayClient({
      relayUrl: 'wss://wumble.example/ws',
      room: ROOM,
      role: 'player',
      socket: relay.factory,
      onMessage: (message) => received.push(message),
    });
    await tick();
  });
  afterEach(() => {
    listener.stop();
    player.close();
    document.body.replaceChildren();
    document.body.classList.remove(LISTENING_CLASS);
  });

  it('joins the room dark and full screen, waiting for a song', async () => {
    listener.start(ROOM);
    expect(listener.isOpen).toBe(true);
    expect(listener.room).toBe(ROOM);
    expect(document.body.classList.contains(LISTENING_CLASS)).toBe(true);
    expect(document.title).toBe('Wumble · Raum k7m3x');
    expect(listener.querySelector('.status')?.textContent).toBe('Verbinde …');
    await tick();
    expect(listener.querySelector('.status')?.textContent).toBe('Raum k7m3x · verbunden');
    await frames();
    expect(listener.querySelector<HTMLElement>('.note')?.hidden).toBe(false);
    expect(listener.querySelector<HTMLElement>('.lines')?.hidden).toBe(true);
    listener.stop();
    expect(document.body.classList.contains(LISTENING_CLASS)).toBe(false);
    expect(document.title).toBe('Wumble');
    expect(listener.isOpen).toBe(false);
  });

  it('shows the song as lines of syllables, fills the sung ones and ends with a cheer', async () => {
    listener.start(ROOM);
    await tick();
    player.send(SONG);
    await frames();
    expect(listener.querySelector('.title')?.textContent).toBe('Alle meine Entchen');
    expect(document.documentElement.style.getPropertyValue('--hue')).toBe('85');
    const current = listener.querySelector('.line.cur');
    expect(current?.querySelectorAll('.word')).toHaveLength(3);
    expect([...(current?.querySelectorAll('.s') ?? [])].map((span) => span.textContent)).toEqual([
      'Al',
      'le',
      'mei',
      'ne',
      'Ent',
      'chen',
    ]);
    expect(current?.querySelector('.s')?.classList.contains('cur')).toBe(true);
    player.send({ t: 'pos', i: 1, s: player.serverNow() - 300 });
    await new Promise((resolve) => setTimeout(resolve, 120)); // the display eases towards the position
    await frames();
    const spans = [...(current?.querySelectorAll<HTMLElement>('.s') ?? [])];
    expect(spans[0]?.classList.contains('done')).toBe(true);
    expect(spans[1]?.classList.contains('cur')).toBe(true);
    expect(Number(spans[1]?.style.getPropertyValue('--p'))).toBeGreaterThan(0);
    expect(listener.querySelector<HTMLElement>('.ball')?.hidden).toBe(false);
    player.send({ t: 'end' });
    await frames();
    expect(listener.querySelector<HTMLElement>('.big')?.hidden).toBe(false);
    expect(listener.querySelector<HTMLElement>('.lines')?.hidden).toBe(true);
  });

  it('shows tone and chord in free play and sends applause at most twice a second', async () => {
    listener.start(ROOM);
    await tick();
    player.send({ t: 'free', hue: 355 });
    await frames();
    expect(listener.querySelector('.title')?.textContent).toBe('Freies Spiel');
    expect(listener.querySelector('.tone')?.textContent).toBe('♪');
    player.send({ t: 'tone', name: 'E', chord: 'Am' });
    await frames();
    expect(listener.querySelector('.tone')?.textContent).toBe('E');
    expect(listener.querySelector('.chord')?.textContent).toBe('Am');
    expect(listener.querySelector('.free')?.classList.contains('flash')).toBe(true);
    const applause = listener.querySelector<HTMLButtonElement>('button.applause');
    applause?.click();
    applause?.click();
    await tick();
    expect(received.filter((message) => message.t === 'applause')).toHaveLength(1);
    expect(document.querySelectorAll('.clap')).toHaveLength(2);
  });
});
