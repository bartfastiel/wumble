import { once } from 'node:events';
import { request, Server } from 'node:http';
import { connect, type Socket } from 'node:net';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  acceptKey,
  createRelay,
  DEFAULT_PORT,
  frame,
  IDLE_TIMEOUT,
  MAX_CLIENTS,
  MAX_MESSAGE,
  readFrame,
  type Relay,
  runIfMain,
  SWEEP_INTERVAL,
} from './relay';

type Json = Record<string, unknown>;

// Polls a condition for up to half a second – socket close events arrive a tick after the other side saw them
const until = async (condition: () => boolean): Promise<void> => {
  for (let i = 0; i < 50 && !condition(); i++) {
    await new Promise((resolve) => {
      setTimeout(resolve, 10);
    });
  }
};

// A WebSocket client (Node's own) with a queue of parsed messages
class Client {
  readonly socket: WebSocket;
  readonly closed: Promise<void>;
  private readonly queue: Json[] = [];
  private waiting: ((message: Json) => void) | null = null;

  constructor(port: number, room: string, role: string) {
    this.socket = new WebSocket(`ws://127.0.0.1:${String(port)}/ws?room=${room}&role=${role}`);
    this.socket.addEventListener('message', (event) => {
      const message = JSON.parse(String(event.data)) as Json;
      if (this.waiting !== null) {
        const resolve = this.waiting;
        this.waiting = null;
        resolve(message);
      } else this.queue.push(message);
    });
    this.closed = new Promise((resolve) => {
      this.socket.addEventListener('close', () => {
        resolve();
      });
    });
  }

  static async open(port: number, room: string, role = 'listener'): Promise<Client> {
    const client = new Client(port, room, role);
    await once(client.socket, 'open');
    return client;
  }

  next(): Promise<Json> {
    const queued = this.queue.shift();
    if (queued !== undefined) return Promise.resolve(queued);
    return new Promise((resolve) => {
      this.waiting = resolve;
    });
  }

  // Resolves with null when nothing arrives within `ms`
  async maybeNext(ms = 100): Promise<Json | null> {
    return Promise.race([
      this.next(),
      new Promise<null>((resolve) => {
        setTimeout(() => {
          resolve(null);
        }, ms);
      }),
    ]);
  }

  // Forgets what arrived so far (after a short wait for stragglers)
  async drain(): Promise<void> {
    await new Promise((resolve) => {
      setTimeout(resolve, 50);
    });
    this.queue.length = 0;
  }

  send(message: Json): void {
    this.socket.send(JSON.stringify(message));
  }

  close(): Promise<void> {
    this.socket.close();
    return this.closed;
  }
}

// A raw TCP client that speaks the handshake and frames itself, for what a browser WebSocket does not expose
class RawClient {
  readonly received: Buffer[] = [];
  readonly socket: Socket;
  readonly closed: Promise<void>;
  private buffer: Buffer = Buffer.alloc(0);

  constructor(port: number) {
    this.socket = connect(port, '127.0.0.1');
    this.socket.on('data', (chunk: Buffer) => {
      this.buffer = Buffer.concat([this.buffer, chunk]);
      this.drain();
    });
    this.closed = new Promise((resolve) => {
      this.socket.on('close', () => {
        resolve();
      });
    });
  }

  static async open(port: number, room = 'k7m3x', extra: Buffer = Buffer.alloc(0)): Promise<RawClient> {
    const client = new RawClient(port);
    await once(client.socket, 'connect');
    client.socket.write(
      Buffer.concat([
        Buffer.from(
          `GET /ws?room=${room}&role=player HTTP/1.1\r\nHost: relay\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n` +
            'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\nSec-WebSocket-Version: 13\r\n\r\n',
        ),
        extra,
      ]),
    );
    await client.waitFor(1); // the handshake response and hallo arrive together
    return client;
  }

  // A masked client frame (payloads below 126 bytes)
  static masked(opcode: number, payload: Buffer, fin = true): Buffer {
    const mask = Buffer.from([1, 2, 3, 4]);
    const masked = Buffer.from(payload.map((byte, i) => byte ^ (mask[i & 3] ?? 0)));
    return Buffer.concat([Buffer.from([(fin ? 0x80 : 0) | opcode, 0x80 | payload.length]), mask, masked]);
  }

  write(data: Buffer): void {
    this.socket.write(data);
  }

  // Frames received so far (opcode and payload as latin1 text), after the handshake response
  frames(): { readonly opcode: number; readonly text: string }[] {
    return this.received.map((data) => {
      const parsed = readFrame(data);
      return parsed === null
        ? { opcode: -1, text: '' }
        : { opcode: parsed.opcode, text: parsed.payload.toString('latin1') };
    });
  }

  waitFor(count: number): Promise<void> {
    return until(() => this.received.length >= count);
  }

  private drain(): void {
    const headerEnd = this.buffer.indexOf('\r\n\r\n');
    if (headerEnd >= 0 && this.buffer.subarray(0, 4).toString() === 'HTTP')
      this.buffer = this.buffer.subarray(headerEnd + 4);
    for (;;) {
      const parsed = readFrame(this.buffer);
      if (parsed === null) return;
      this.received.push(this.buffer.subarray(0, this.buffer.length - parsed.rest.length));
      this.buffer = parsed.rest;
    }
  }
}

const upgradeStatus = (port: number, path: string, key: string | null = 'dGhlIHNhbXBsZSBub25jZQ=='): Promise<number> =>
  new Promise((resolve, reject) => {
    const req = request({
      port,
      host: '127.0.0.1',
      path,
      headers: { Connection: 'Upgrade', Upgrade: 'websocket', ...(key === null ? {} : { 'Sec-WebSocket-Key': key }) },
    });
    req.on('response', (response) => {
      resolve(response.statusCode ?? 0);
      response.resume();
    });
    req.on('upgrade', (_response, socket) => {
      resolve(101);
      socket.destroy();
    });
    req.on('error', reject);
    req.end();
  });

describe('frames', () => {
  it('encodes the three length classes', () => {
    expect([...frame(1, Buffer.from('ab'))]).toEqual([0x81, 2, 97, 98]);
    expect([...frame(1, Buffer.alloc(126)).subarray(0, 4)]).toEqual([0x81, 126, 0, 126]);
    expect([...frame(1, Buffer.alloc(65_535)).subarray(0, 4)]).toEqual([0x81, 126, 255, 255]);
    expect([...frame(9, Buffer.alloc(65_536)).subarray(0, 10)]).toEqual([0x89, 127, 0, 0, 0, 0, 0, 1, 0, 0]);
  });

  it('reads frames back, whatever the length encoding', () => {
    for (const length of [0, 125, 126, MAX_MESSAGE]) {
      const payload = Buffer.alloc(length, 7);
      const decoded = readFrame(Buffer.concat([frame(1, payload), Buffer.from([9])]));
      expect(decoded?.fin).toBe(true);
      expect(decoded?.opcode).toBe(1);
      expect(decoded?.payload.equals(payload)).toBe(true);
      expect(decoded?.rest.equals(Buffer.from([9]))).toBe(true);
    }
    const wide = Buffer.concat([Buffer.from([0x81, 127, 0, 0, 0, 0, 0, 0, 0, 2]), Buffer.from('hi')]);
    expect(readFrame(wide)?.payload.toString()).toBe('hi');
  });

  it('unmasks client frames and waits for missing bytes', () => {
    const masked = RawClient.masked(1, Buffer.from('hello'));
    expect(readFrame(masked)?.payload.toString()).toBe('hello');
    expect(readFrame(masked.subarray(0, 1))).toBeNull();
    expect(readFrame(masked.subarray(0, 8))).toBeNull();
    expect(readFrame(frame(1, Buffer.alloc(200)).subarray(0, 3))).toBeNull();
    expect(readFrame(Buffer.from([0x81, 127, 0, 0, 0, 0, 0, 0, 0]))).toBeNull();
  });

  it('rejects frames beyond the message limit', () => {
    expect(() => readFrame(frame(1, Buffer.alloc(MAX_MESSAGE + 1)).subarray(0, 4))).toThrow(RangeError);
  });

  it('computes the accept key of RFC 6455', () => {
    expect(acceptKey('dGhlIHNhbXBsZSBub25jZQ==')).toBe('s3pPLMBiTxaQ9kYGzzhZRbK+xOo=');
  });
});

describe('relay', () => {
  let relay: Relay;
  let port: number;
  let now: number;
  const clients: Client[] = [];
  const open = async (room: string, role = 'listener'): Promise<Client> => {
    const client = await Client.open(port, room, role);
    clients.push(client);
    return client;
  };

  beforeEach(async () => {
    now = 1_000_000;
    relay = createRelay({ port: 0, host: '127.0.0.1', now: () => now, log: () => undefined });
    await once(relay.server, 'listening');
    port = relay.port();
  });

  afterEach(async () => {
    await Promise.all(clients.splice(0).map((client) => client.close()));
    await relay.close();
  });

  it('answers /health with the room and client counts and 404 otherwise', async () => {
    const empty = await fetch(`http://127.0.0.1:${String(port)}/health`);
    expect(await empty.json()).toEqual({ ok: true, rooms: 0, clients: 0 });
    await open('k7m3x', 'player');
    await open('k7m3x');
    await open('other');
    const busy = await fetch(`http://127.0.0.1:${String(port)}/health`);
    expect(await busy.json()).toEqual({ ok: true, rooms: 2, clients: 3 });
    expect(relay.stats()).toEqual({ rooms: 2, clients: 3 });
    const other = await fetch(`http://127.0.0.1:${String(port)}/other`);
    expect(other.status).toBe(404);
  });

  it('greets with hallo, tells the room about listeners and about who leaves', async () => {
    const player = await open('K7M3X', 'player');
    expect(await player.next()).toEqual({ t: 'hello', role: 'player', room: 'k7m3x', s: now, listeners: 0 });
    const listener = await open('k7m3x', 'listener');
    expect(await listener.next()).toEqual({ t: 'hello', role: 'listener', room: 'k7m3x', s: now, listeners: 1 });
    expect(await player.next()).toEqual({ t: 'present', listeners: 1 });
    const second = await open('k7m3x', 'whatever'); // unknown roles listen
    expect(await second.next()).toMatchObject({ t: 'hello', role: 'listener', listeners: 2 });
    expect(await player.next()).toEqual({ t: 'present', listeners: 2 });
    expect(await listener.next()).toEqual({ t: 'present', listeners: 2 });
    await second.close();
    expect(await player.next()).toEqual({ t: 'present', listeners: 1 });
    expect(await listener.next()).toEqual({ t: 'present', listeners: 1 });
    await listener.close();
    await player.close();
    await until(() => relay.stats().rooms === 0);
    expect(relay.stats()).toEqual({ rooms: 0, clients: 0 }); // the empty room is gone
  });

  it('answers pings with the server time', async () => {
    const player = await open('k7m3x', 'player');
    await player.next();
    now = 2_000_000;
    player.send({ t: 'ping', c: 123 });
    expect(await player.next()).toEqual({ t: 'pong', c: 123, s: 2_000_000 });
  });

  it('forwards messages to the other role only, within the room, adding the server time', async () => {
    const player = await open('k7m3x', 'player');
    const secondPlayer = await open('k7m3x', 'player');
    const listener = await open('k7m3x');
    const other = await open('other');
    for (const client of [player, secondPlayer, listener, other]) await client.drain(); // hallo, anwesend
    player.send({ t: 'pos', i: 3 });
    expect(await listener.next()).toEqual({ t: 'pos', i: 3, s: now });
    expect(await secondPlayer.maybeNext()).toBeNull();
    expect(await other.maybeNext()).toBeNull();
    listener.send({ t: 'applause', s: 42 });
    expect(await player.next()).toEqual({ t: 'applause', s: 42 });
    expect(await secondPlayer.next()).toEqual({ t: 'applause', s: 42 });
    expect(await listener.maybeNext()).toBeNull();
  });

  it('ignores text that is not a JSON object', async () => {
    const player = await open('k7m3x', 'player');
    const listener = await open('k7m3x');
    await player.drain();
    await listener.drain();
    player.socket.send('{broken');
    player.socket.send('[1,2]');
    player.socket.send('null');
    player.socket.send('"text"');
    player.send({ t: 'end' });
    expect(await listener.next()).toEqual({ t: 'end', s: now });
  });

  it('refuses bad rooms, other paths and a missing key with 400', async () => {
    expect(await upgradeStatus(port, '/ws?room=ab')).toBe(400);
    expect(await upgradeStatus(port, '/ws?room=abcdefghijklm')).toBe(400);
    expect(await upgradeStatus(port, '/ws?room=k7-3x')).toBe(400);
    expect(await upgradeStatus(port, '/ws')).toBe(400);
    expect(await upgradeStatus(port, '/other?room=k7m3x')).toBe(400);
    expect(await upgradeStatus(port, '/ws?room=k7m3x', null)).toBe(400);
    expect(await upgradeStatus(port, '/ws?room=k7m3x')).toBe(101);
  });

  it('refuses the 61st client of a room with 503', async () => {
    for (let i = 0; i < MAX_CLIENTS; i++) await open('full');
    expect(relay.stats()).toEqual({ rooms: 1, clients: MAX_CLIENTS });
    expect(await upgradeStatus(port, '/ws?room=full')).toBe(503);
    expect(await upgradeStatus(port, '/ws?room=other')).toBe(101);
  });

  it('drops a client that sends more than the message limit', async () => {
    const player = await open('k7m3x', 'player');
    const listener = await open('k7m3x');
    await player.drain();
    await listener.drain();
    player.send({ t: 'x', pad: 'x'.repeat(MAX_MESSAGE - 30) });
    expect(await listener.next()).toMatchObject({ t: 'x' });
    player.socket.send('x'.repeat(MAX_MESSAGE + 1));
    await player.closed;
    expect(await listener.next()).toEqual({ t: 'present', listeners: 1 });
  });

  it('answers ping frames, ignores fragments and binary, and closes on a close frame', async () => {
    const raw = await RawClient.open(port);
    expect(raw.frames()).toEqual([
      { opcode: 1, text: JSON.stringify({ t: 'hello', role: 'player', room: 'k7m3x', s: now, listeners: 0 }) },
    ]);
    raw.write(RawClient.masked(9, Buffer.from('hi')));
    await raw.waitFor(2);
    expect(raw.frames()[1]).toEqual({ opcode: 10, text: 'hi' });
    raw.write(RawClient.masked(1, Buffer.from('{"t":"ping","c":1}'), false)); // a fragment
    raw.write(RawClient.masked(2, Buffer.from('{"t":"ping","c":2}'))); // binary
    raw.write(RawClient.masked(1, Buffer.from('{"t":"ping","c":3}')));
    await raw.waitFor(3);
    expect(raw.frames()[2]).toEqual({ opcode: 1, text: JSON.stringify({ t: 'pong', c: 3, s: now }) });
    raw.write(RawClient.masked(8, Buffer.from([3, 232])));
    await raw.closed;
    expect(raw.frames()[3]).toEqual({ opcode: 8, text: '\u0003è' });
    await until(() => relay.stats().rooms === 0);
    expect(relay.stats()).toEqual({ rooms: 0, clients: 0 });
  });

  it('reads frames that arrive in pieces or right behind the handshake', async () => {
    const early = RawClient.masked(1, Buffer.from('{"t":"ping","c":"early"}'));
    const raw = await RawClient.open(port, 'k7m3x', early);
    await raw.waitFor(2);
    expect(raw.frames()[1]).toEqual({ opcode: 1, text: JSON.stringify({ t: 'pong', c: 'early', s: now }) });
    const split = RawClient.masked(1, Buffer.from('{"t":"ping","c":"split"}'));
    raw.write(split.subarray(0, 1));
    await new Promise((r) => setTimeout(r, 20));
    raw.write(split.subarray(1, 7));
    await new Promise((r) => setTimeout(r, 20));
    raw.write(split.subarray(7));
    await raw.waitFor(3);
    expect(raw.frames()[2]).toEqual({ opcode: 1, text: JSON.stringify({ t: 'pong', c: 'split', s: now }) });
  });

  it('pings everyone on a sweep and drops clients that went quiet', async () => {
    const raw = await RawClient.open(port);
    const listener = await open('k7m3x');
    await listener.next();
    await raw.waitFor(2);
    relay.sweep();
    await raw.waitFor(3);
    expect(raw.frames()[2]).toEqual({ opcode: 9, text: '' });
    expect(listener.socket.readyState).toBe(WebSocket.OPEN);
    now += IDLE_TIMEOUT + 1;
    listener.send({ t: 'ping', c: 0 }); // the listener is alive, the raw client is not
    await listener.next();
    relay.sweep();
    await raw.closed;
    expect(listener.socket.readyState).toBe(WebSocket.OPEN);
    relay.sweep(); // a destroyed socket that has not closed yet is skipped
    expect(await listener.next()).toEqual({ t: 'present', listeners: 1 });
  });
});

describe('relay timers and startup', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('sweeps every 30 seconds', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    let now = 1_000_000;
    const relay = createRelay({ port: 0, host: '127.0.0.1', now: () => now, log: () => undefined });
    await once(relay.server, 'listening');
    const client = await Client.open(relay.port(), 'k7m3x', 'player');
    await client.next();
    now += IDLE_TIMEOUT + 1;
    vi.advanceTimersByTime(SWEEP_INTERVAL);
    await client.closed;
    expect(client.socket.readyState).toBe(WebSocket.CLOSED);
    await relay.close();
  });

  it('logs the port with console.log by default', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const relay = createRelay({ port: 0, host: '127.0.0.1' });
    await once(relay.server, 'listening');
    expect(log).toHaveBeenCalledWith(`Wumble relay on port ${String(relay.port())}`);
    await relay.close();
  });

  it('starts from the command line on PORT, and only then', async () => {
    const entry = fileURLToPath(new URL('./relay.ts', import.meta.url));
    expect(runIfMain(['node', '/somewhere/else.js'], { PORT: '0' })).toBeNull();
    expect(runIfMain(['node'], { PORT: '0' })).toBeNull();
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const relay = runIfMain(['node', entry], { PORT: '0' });
    expect(relay).not.toBeNull();
    if (relay === null) return;
    await once(relay.server, 'listening');
    expect(relay.port()).toBeGreaterThan(0);
    expect(log).toHaveBeenCalledOnce();
    await relay.close();
  });

  it('falls back to port 8765 without PORT', async () => {
    const entry = fileURLToPath(new URL('./relay.ts', import.meta.url));
    const listen = vi.spyOn(Server.prototype, 'listen').mockImplementation(function (this: Server) {
      return this;
    });
    for (const env of [{}, { PORT: '' }]) {
      const relay = runIfMain(['node', entry], env);
      expect(relay).not.toBeNull();
      expect(relay?.port()).toBe(0); // not listening
      await relay?.close();
    }
    const bare = createRelay();
    await bare.close();
    expect(listen).toHaveBeenCalledTimes(3);
    expect(listen).toHaveBeenLastCalledWith(DEFAULT_PORT, undefined, expect.any(Function));
  });
});
