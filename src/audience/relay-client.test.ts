import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeRelay, FakeSocket } from './__fixtures__/fake-relay';
import type { IncomingMessage } from './messages';
import {
  INITIAL_PINGS,
  type LinkStatus,
  MAX_BACKOFF,
  PING_INTERVAL,
  RelayClient,
  type RelayClientOptions,
  type SocketFactory,
} from './relay-client';

const RELAY = 'wss://wumble.example/ws';
// Advance the fake clock, then one more millisecond for what the fake relay scheduled at the very end (its accept on
// the next tick, which fake timers place one millisecond later)
const tick = (ms: number): void => {
  vi.advanceTimersByTime(ms);
  vi.advanceTimersByTime(1);
};
const sentTypes = (socket: FakeSocket | undefined): string[] =>
  (socket?.sent ?? []).map((text) => (JSON.parse(text) as { t: string }).t);

describe('RelayClient', () => {
  let relay: FakeRelay;
  let statuses: LinkStatus[];
  let messages: IncomingMessage[];
  let syncs: [number, number][];
  const client = (options: Partial<RelayClientOptions> = {}): RelayClient =>
    new RelayClient({
      relayUrl: RELAY,
      room: 'k7m3x',
      role: 'listener',
      socket: relay.factory,
      onStatus: (status) => statuses.push(status),
      onMessage: (message) => messages.push(message),
      onSync: (offset, rtt) => syncs.push([offset, rtt]),
      ...options,
    });

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(100_000);
    relay = new FakeRelay(() => Date.now() + 3000); // the server clock runs three seconds ahead
    statuses = [];
    messages = [];
    syncs = [];
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('accepts the browser WebSocket as its socket factory', () => {
    const browserFactory: SocketFactory = (url) => new WebSocket(url);
    expect(typeof browserFactory).toBe('function');
  });

  it('connects to the room with the wire name of its role', () => {
    const listener = client();
    expect(relay.sockets[0]?.url).toBe(`${RELAY}?room=k7m3x&role=listener`);
    listener.close();
    client({ role: 'player' }).close();
    expect(relay.sockets[1]?.url).toBe(`${RELAY}?room=k7m3x&role=player`);
  });

  it('reports the connection, pings five times after hallo and syncs the clock by the median', () => {
    const listener = client();
    expect(listener.open).toBe(false);
    expect(listener.send({ t: 'applause' })).toBe(false);
    vi.advanceTimersByTime(0);
    expect(listener.open).toBe(true);
    expect(statuses).toEqual([{ kind: 'connected' }]);
    expect(messages.map((m) => m.t)).toEqual(['hello']);
    vi.advanceTimersByTime(40 + 4 * 120);
    expect(sentTypes(relay.sockets[0])).toEqual(new Array<string>(INITIAL_PINGS).fill('ping'));
    expect(syncs).toHaveLength(INITIAL_PINGS);
    expect(listener.synced).toBe(true);
    expect(listener.offset).toBe(3000);
    expect(listener.rtt).toBe(0);
    expect(listener.serverNow()).toBe(Date.now() + 3000);
    expect(messages.map((m) => m.t)).toEqual(['hello']); // pongs stay inside the client
    listener.close();
  });

  it('keeps pinging every ten seconds', () => {
    const listener = client();
    vi.advanceTimersByTime(1000);
    const before = sentTypes(relay.sockets[0]).length;
    vi.advanceTimersByTime(PING_INTERVAL);
    expect(sentTypes(relay.sockets[0])).toHaveLength(before + 1);
    listener.close();
    vi.advanceTimersByTime(PING_INTERVAL);
    expect(sentTypes(relay.sockets[0])).toHaveLength(before + 1);
  });

  it('delays sending and receiving by the simulated latency', () => {
    const listener = client({ delay: 200 });
    vi.advanceTimersByTime(0);
    expect(messages).toHaveLength(0);
    vi.advanceTimersByTime(200);
    expect(messages.map((m) => m.t)).toEqual(['hello']);
    expect(listener.send({ t: 'applause' })).toBe(true);
    vi.advanceTimersByTime(199);
    expect(sentTypes(relay.sockets[0])).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(sentTypes(relay.sockets[0])).toEqual(['applause']);
    vi.advanceTimersByTime(40 + 400);
    expect(listener.rtt).toBe(400);
    expect(listener.offset).toBe(3000); // symmetric latency cancels out
    listener.close();
  });

  it('does not send on a socket that closed in the meantime', () => {
    const listener = client({ delay: 100 });
    vi.advanceTimersByTime(0);
    expect(listener.send({ t: 'applause' })).toBe(true);
    relay.sockets[0]?.fail();
    vi.advanceTimersByTime(100);
    expect(relay.sockets[0]?.sent).toEqual([]);
    listener.close();
  });

  it('reconnects with backoff 1, 2, 4 … 15 s and starts over after a success', () => {
    const listener = client();
    vi.advanceTimersByTime(0);
    relay.accepting = false;
    relay.sockets[0]?.fail();
    expect(listener.open).toBe(false);
    expect(statuses).toEqual([{ kind: 'connected' }, { kind: 'disconnected' }, { kind: 'waiting', wait: 1000 }]);
    const waits: number[] = [];
    for (let i = 0; i < 6; i++) {
      const last = statuses.at(-1);
      const wait = last?.kind === 'waiting' ? last.wait : 0;
      waits.push(wait);
      tick(wait);
    }
    expect(waits).toEqual([1000, 2000, 4000, 8000, 15_000, 15_000]);
    expect(Math.max(...waits)).toBe(MAX_BACKOFF);
    relay.accepting = true;
    tick(MAX_BACKOFF);
    expect(listener.open).toBe(true);
    expect(relay.sockets).toHaveLength(8);
    relay.sockets.at(-1)?.fail();
    expect(statuses.at(-1)).toEqual({ kind: 'waiting', wait: 1000 });
    listener.close();
  });

  it('retries when the socket cannot even be created', () => {
    const listener = client({
      socket: () => {
        throw new Error('bad url');
      },
    });
    expect(statuses).toEqual([{ kind: 'waiting', wait: 1000 }]);
    vi.advanceTimersByTime(1000);
    expect(statuses).toEqual([
      { kind: 'waiting', wait: 1000 },
      { kind: 'waiting', wait: 2000 },
    ]);
    listener.close();
    vi.advanceTimersByTime(60_000);
    expect(statuses).toHaveLength(2);
  });

  it('closes the socket and never reconnects after close()', () => {
    const listener = client();
    vi.advanceTimersByTime(0);
    const socket = relay.sockets[0];
    listener.close();
    expect(socket?.readyState).toBe(3);
    expect(listener.open).toBe(false);
    vi.advanceTimersByTime(60_000);
    expect(relay.sockets).toHaveLength(1);
    expect(statuses).toEqual([{ kind: 'connected' }]);
    listener.close(); // idempotent
  });

  it('ignores events of a socket it has already given up', () => {
    const listener = client();
    const stale = relay.sockets[0];
    listener.close();
    stale?.accept();
    stale?.deliver('{"t":"hello","listeners":1}');
    stale?.fail();
    expect(listener.open).toBe(false);
    expect(statuses).toEqual([]);
  });

  it('ignores binary data and broken messages', () => {
    const listener = client();
    vi.advanceTimersByTime(0);
    relay.sockets[0]?.deliver(new ArrayBuffer(4));
    relay.sockets[0]?.deliver('{"broken');
    relay.sockets[0]?.deliver('[]');
    vi.advanceTimersByTime(0);
    expect(messages.map((m) => m.t)).toEqual(['hello']);
    listener.close();
  });

  it('uses the injected clock for pings and server time', () => {
    const start = Date.now();
    const listener = client({ now: () => Date.now() - start + 5000, delay: 50 }); // a clock with its own epoch
    vi.advanceTimersByTime(50 + 40 + 100);
    expect(JSON.parse(relay.sockets[0]?.sent[0] ?? '{}')).toEqual({ t: 'ping', c: 5090 });
    expect(listener.rtt).toBe(100);
    expect(listener.offset).toBe(start - 2000);
    expect(listener.serverNow()).toBe(Date.now() + 3000);
    listener.close();
  });
});
