import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeRelay } from './__fixtures__/fake-relay';
import { PlayerRoom } from './player-room';
import { RelayClient } from './relay-client';
import { LOCAL_RELAY_URL } from './room';

const ONLINE = {
  protocol: 'https:',
  hostname: 'wumble.example',
  origin: 'https://wumble.example',
  pathname: '/app/',
  href: 'https://wumble.example/app/#blues',
};
const LOCAL = { ...ONLINE, protocol: 'file:', hostname: '', origin: 'null', href: 'file:///C:/wumble.html' };
const SONG = { title: 'Alle meine Entchen', bpm: 110, signature: 0, notes: [{ midi: 60, beats: 1, text: 'Al-' }] };

describe('PlayerRoom', () => {
  let relay: FakeRelay;
  let changes: number;
  let applause: number;
  let publicUrl: string;

  const room = (location = ONLINE): PlayerRoom =>
    new PlayerRoom({
      location,
      publicUrl: () => publicUrl,
      socket: relay.factory,
      random: () => 0.5,
      onChange: () => changes++,
      onApplause: () => applause++,
    });
  // A listener in the same room, to see what the player sends
  const listen = (code: string): string[] => {
    const received: string[] = [];
    const listener = new RelayClient({
      relayUrl: 'wss://wumble.example/ws',
      room: code,
      role: 'listener',
      socket: relay.factory,
      onMessage: (message) => received.push(message.t),
    });
    vi.advanceTimersByTime(1);
    expect(listener.open).toBe(true);
    return received;
  };

  beforeEach(() => {
    vi.useFakeTimers();
    relay = new FakeRelay();
    changes = 0;
    applause = 0;
    publicUrl = '';
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('is closed until opened, then has a code, a link and a connection on the page relay', () => {
    const player = room();
    expect(player).toMatchObject({ code: null, status: { kind: 'closed' }, listeners: 0, isOpen: false });
    expect(player.pageLink).toBe('');
    expect(player.isLocal).toBe(false);
    expect(player.relay).toBe('wss://wumble.example/ws');
    player.open();
    expect(player.code).toBe('sssss'); // random 0.5 picks the middle of the alphabet
    expect(player).toMatchObject({ status: { kind: 'connecting' }, isOpen: true });
    expect(player.pageLink).toBe('https://wumble.example/app/#room=sssss');
    expect(relay.sockets[0]?.url).toBe('wss://wumble.example/ws?room=sssss&role=player');
    vi.advanceTimersByTime(1);
    expect(player.status).toEqual({ kind: 'connected' });
    expect(changes).toBe(3); // opened, connected, hello with the count
    player.open(); // a second open keeps the room
    expect(relay.sockets).toHaveLength(1);
  });

  it('counts the listeners, passes applause on and forgets the room on end', () => {
    const player = room();
    player.open();
    vi.advanceTimersByTime(1);
    const code = player.code ?? '';
    listen(code);
    expect(player.listeners).toBe(1);
    relay.sockets[1]?.send(JSON.stringify({ t: 'applause' }));
    expect(applause).toBe(1);
    player.end();
    expect(player).toMatchObject({ code: null, status: { kind: 'closed' }, listeners: 0, isOpen: false });
    expect(relay.sockets[0]?.readyState).toBe(3);
    player.end(); // nothing to end twice
  });

  it('sends song, positions, end, free play and tones only while a room is open', () => {
    const player = room();
    player.songStarted(SONG, 85); // no room: nothing happens
    player.open();
    vi.advanceTimersByTime(1);
    const received = listen(player.code ?? '');
    player.songStarted(SONG, 85);
    player.notePressed(0);
    player.songEnded();
    player.freePlay(85);
    player.tone('C', 'C');
    vi.advanceTimersByTime(1);
    expect(received).toEqual(['hello', 'free', 'song', 'pos', 'end', 'free', 'tone']); // the newcomer gets the state
  });

  it('uses the local relay from a file and the configured address once set', () => {
    const player = room(LOCAL);
    expect(player.isLocal).toBe(true);
    expect(player.relay).toBe(LOCAL_RELAY_URL);
    player.open();
    expect(player.pageLink).toBe('file:///C:/wumble.html#room=sssss');
    publicUrl = 'https://wumble.example/app/index.html';
    player.restart();
    expect(player.relay).toBe('wss://wumble.example/ws');
    expect(player.pageLink).toBe('https://wumble.example/app/index.html#room=sssss');
    expect(relay.sockets).toHaveLength(2);
    expect(relay.sockets[1]?.url).toBe('wss://wumble.example/ws?room=sssss&role=player');
  });

  it('reports a lost connection with an empty room and the wait before the next try', () => {
    const player = new PlayerRoom({
      location: ONLINE,
      publicUrl: () => '',
      socket: relay.factory,
      relayUrl: 'ws://127.0.0.1:9999/ws',
      timers: {
        schedule: (callback, ms) => {
          const handle = setTimeout(callback, ms);
          return () => {
            clearTimeout(handle);
          };
        },
        every: (callback, ms) => {
          const handle = setInterval(callback, ms);
          return () => {
            clearInterval(handle);
          };
        },
      },
    });
    player.open();
    expect(relay.sockets[0]?.url).toBe(`ws://127.0.0.1:9999/ws?room=${player.code ?? ''}&role=player`);
    vi.advanceTimersByTime(1);
    listen(player.code ?? '');
    expect(player.listeners).toBe(1);
    relay.sockets[0]?.fail();
    expect(player.status).toEqual({ kind: 'waiting', wait: 1000 });
    expect(player.listeners).toBe(0);
  });
});
