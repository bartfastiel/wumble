#!/usr/bin/env node
// Wumble relay: a tiny WebSocket server without dependencies (Node ≥ 22). Rooms: a player sends events, listeners
// receive them (and the other way round, e.g. applause), plus a time answer for the clock sync (ping/pong with the
// server time). No persistence, no content – forwarding only.
//
//   node relay.js             # listens on PORT (default 8765)
//   GET /health               # { ok, rooms, clients }
//   GET /ws?room=<code>&role=player|listener|musician   → WebSocket
//
// Messages are JSON text: { t: 'ping', c } → { t: 'pong', c, s }; everything else is forwarded within the room –
// the player to everyone, everyone else to the player – with { s: server time } added when missing.
import { createHash } from 'node:crypto';
import { createServer, type IncomingMessage, type Server } from 'node:http';
import { Socket } from 'node:net';
import type { Duplex } from 'node:stream';
import { pathToFileURL } from 'node:url';

export const DEFAULT_PORT = 8765;
export const MAX_MESSAGE = 32_768; // bytes per frame
export const MAX_CLIENTS = 60; // per room
export const IDLE_TIMEOUT = 90_000; // ms without a text message before a client counts as gone
export const SWEEP_INTERVAL = 30_000;
const ROOM_PATTERN = /^[a-z0-9]{3,12}$/i;
const WEBSOCKET_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

type Role = 'player' | 'listener' | 'musician';
interface Client {
  readonly socket: Socket;
  readonly room: string;
  readonly members: Set<Client>; // everyone in the room, including this client
  readonly role: Role;
  buffer: Buffer;
  aliveAt: number;
}

// Frames after RFC 6455: client frames are masked; we understand text (1), close (8), ping (9) and pong (10)
const OPCODE_TEXT = 1;
const OPCODE_CLOSE = 8;
const OPCODE_PING = 9;
const OPCODE_PONG = 10;

interface Frame {
  readonly fin: boolean;
  readonly opcode: number;
  readonly payload: Buffer;
  readonly rest: Buffer;
}

// The next frame of the buffer, or null while bytes are missing; a frame beyond MAX_MESSAGE throws
export const readFrame = (buffer: Buffer): Frame | null => {
  if (buffer.length < 2) return null;
  const first = buffer.readUInt8(0);
  const second = buffer.readUInt8(1);
  const masked = (second & 0x80) !== 0;
  let length = second & 0x7f;
  let offset = 2;
  if (length === 126) {
    if (buffer.length < 4) return null;
    length = buffer.readUInt16BE(2);
    offset = 4;
  } else if (length === 127) {
    if (buffer.length < 10) return null;
    length = Number(buffer.readBigUInt64BE(2));
    offset = 10;
  }
  if (length > MAX_MESSAGE) throw new RangeError(`frame of ${String(length)} bytes exceeds ${String(MAX_MESSAGE)}`);
  if (masked) offset += 4;
  if (buffer.length < offset + length) return null;
  const payload = Buffer.from(buffer.subarray(offset, offset + length));
  if (masked) {
    const mask = buffer.subarray(offset - 4, offset);
    for (let i = 0; i < payload.length; i++) payload[i] = payload.readUInt8(i) ^ mask.readUInt8(i & 3);
  }
  return { fin: (first & 0x80) !== 0, opcode: first & 0x0f, payload, rest: buffer.subarray(offset + length) };
};

// A server frame (unmasked) with the shortest length encoding
export const frame = (opcode: number, payload: Buffer): Buffer => {
  const length = payload.length;
  let head: Buffer;
  if (length < 126) head = Buffer.from([0x80 | opcode, length]);
  else if (length < 65_536) {
    head = Buffer.alloc(4);
    head[0] = 0x80 | opcode;
    head[1] = 126;
    head.writeUInt16BE(length, 2);
  } else {
    head = Buffer.alloc(10);
    head[0] = 0x80 | opcode;
    head[1] = 127;
    head.writeBigUInt64BE(BigInt(length), 2);
  }
  return Buffer.concat([head, payload]);
};

// RFC 6455 mandates SHA-1 for the handshake; it proves the peer speaks WebSocket, it protects nothing
export const acceptKey = (key: string): string =>
  // eslint-disable-next-line sonarjs/hashing -- the handshake of RFC 6455 is defined with SHA-1
  createHash('sha1') // NOSONAR
    .update(key + WEBSOCKET_GUID)
    .digest('base64');

export interface RelayOptions {
  readonly port?: number; // 0 picks a free port
  readonly host?: string;
  readonly now?: () => number;
  readonly idleTimeout?: number;
  readonly sweepInterval?: number;
  readonly log?: (line: string) => void;
}
export interface RelayStats {
  readonly rooms: number;
  readonly clients: number;
}
export interface Relay {
  readonly server: Server;
  port(): number;
  stats(): RelayStats;
  sweep(): void; // ping every client, drop the ones that went quiet
  close(): Promise<void>;
}

const roleOf = (value: string | null): Role => {
  if (value === 'player') return 'player';
  return value === 'musician' ? 'musician' : 'listener';
};

export const createRelay = (options: RelayOptions = {}): Relay => {
  const now = options.now ?? Date.now;
  const idleTimeout = options.idleTimeout ?? IDLE_TIMEOUT;
  const rooms = new Map<string, Set<Client>>();

  const stats = (): RelayStats => {
    let clients = 0;
    for (const room of rooms.values()) clients += room.size;
    return { rooms: rooms.size, clients };
  };
  const count = (room: Set<Client>, role: Role): number => [...room].filter((client) => client.role === role).length;
  const present = (room: Set<Client>): { listeners: number; musicians: number } => ({
    listeners: count(room, 'listener'),
    musicians: count(room, 'musician'),
  });

  const send = (client: Client, message: object): void => {
    if (!client.socket.destroyed) client.socket.write(frame(OPCODE_TEXT, Buffer.from(JSON.stringify(message))));
  };
  // The player speaks to the whole room, everyone else speaks to the player; `all` = to everyone but the sender.
  // That keeps a musician's notes from reaching the singers, who have no use for them.
  const broadcast = (from: Client, message: object, all = false): void => {
    const toPlayer = from.role !== 'player';
    for (const client of from.members) {
      if (client === from) continue;
      if (all || (toPlayer ? client.role === 'player' : client.role !== 'player')) send(client, message);
    }
  };

  // Close and error both lead here; the second time there is nothing left to do
  const leave = (client: Client): void => {
    if (!client.members.delete(client)) return;
    if (client.members.size === 0) rooms.delete(client.room);
    else broadcast(client, { t: 'present', ...present(client.members) }, true);
  };

  const onText = (client: Client, payload: Buffer): void => {
    client.aliveAt = now();
    let message: unknown;
    try {
      message = JSON.parse(payload.toString('utf8'));
    } catch {
      return;
    }
    if (typeof message !== 'object' || message === null || Array.isArray(message)) return;
    const record = message as Record<string, unknown>;
    if (record.t === 'ping') {
      send(client, { t: 'pong', c: record.c, s: now() });
      return;
    }
    broadcast(client, record.s === undefined || record.s === null ? { ...record, s: now() } : record);
  };

  // Returns false once the socket is gone
  const onFrame = (client: Client, { fin, opcode, payload }: Frame): boolean => {
    if (!fin) return true; // fragmented messages are ignored (browsers do not fragment small texts)
    switch (opcode) {
      case OPCODE_CLOSE:
        client.socket.end(frame(OPCODE_CLOSE, payload.subarray(0, 2)));
        return false;
      case OPCODE_PING:
        client.socket.write(frame(OPCODE_PONG, payload));
        return true;
      case OPCODE_TEXT:
        onText(client, payload);
        return true;
      default:
        return true;
    }
  };

  const onData = (client: Client, chunk: Buffer): void => {
    client.buffer = Buffer.concat([client.buffer, chunk]);
    for (;;) {
      let next: Frame | null;
      try {
        next = readFrame(client.buffer);
      } catch {
        client.socket.destroy();
        return;
      }
      if (next === null) return;
      client.buffer = next.rest;
      if (!onFrame(client, next)) return;
    }
  };

  const refuse = (socket: Duplex, status: string): void => {
    socket.write(`HTTP/1.1 ${status}\r\n\r\n`);
    socket.destroy();
  };

  const upgrade = (request: IncomingMessage, socket: Duplex, head: Buffer): void => {
    const url = new URL(request.url ?? '', 'https://relay'); // the base only makes the path parseable
    const key = request.headers['sec-websocket-key'];
    const roomCode = (url.searchParams.get('room') ?? '').toLowerCase();
    if (
      url.pathname !== '/ws' ||
      typeof key !== 'string' ||
      !ROOM_PATTERN.test(roomCode) ||
      !(socket instanceof Socket)
    ) {
      refuse(socket, '400 Bad Request');
      return;
    }
    const room = rooms.get(roomCode) ?? new Set<Client>();
    if (room.size >= MAX_CLIENTS) {
      refuse(socket, '503 Room Full');
      return;
    }
    socket.write(
      'HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n' +
        `Sec-WebSocket-Accept: ${acceptKey(key)}\r\n\r\n`,
    );
    const client: Client = {
      socket,
      room: roomCode,
      members: room,
      role: roleOf(url.searchParams.get('role')),
      buffer: Buffer.alloc(0),
      aliveAt: now(),
    };
    room.add(client);
    rooms.set(roomCode, room);
    socket.setNoDelay(true);
    socket.on('data', (chunk: Buffer) => {
      onData(client, chunk);
    });
    socket.on('close', () => {
      leave(client);
    });
    socket.on('error', () => {
      leave(client);
    });
    send(client, { t: 'hello', role: client.role, room: roomCode, s: now(), ...present(room) });
    broadcast(client, { t: 'present', ...present(room) }, true);
    if (head.length > 0) onData(client, head);
  };

  const server = createServer((request, response) => {
    if (request.url === '/health') {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ ok: true, ...stats() }));
      return;
    }
    response.writeHead(404);
    response.end();
  });
  server.on('upgrade', upgrade);

  // Dead connections (browsers that vanished without a close) are dropped; everyone else gets a ping
  const sweep = (): void => {
    for (const room of rooms.values()) {
      for (const client of room) {
        if (client.socket.destroyed) continue;
        if (now() - client.aliveAt > idleTimeout) client.socket.destroy();
        else client.socket.write(frame(OPCODE_PING, Buffer.alloc(0)));
      }
    }
  };
  const sweeper = setInterval(sweep, options.sweepInterval ?? SWEEP_INTERVAL);

  const port = (): number => {
    const address = server.address();
    return typeof address === 'object' && address !== null ? address.port : 0;
  };
  server.listen(options.port ?? DEFAULT_PORT, options.host, () => {
    (options.log ?? console.log)(`Wumble relay on port ${String(port())}`);
  });

  const close = (): Promise<void> => {
    clearInterval(sweeper);
    for (const room of rooms.values()) for (const client of room) client.socket.destroy();
    server.closeAllConnections();
    return new Promise((resolve) => {
      server.close(() => {
        resolve();
      });
    });
  };
  return { server, port, stats, sweep, close };
};

// Started directly (not imported): the port comes from the environment
export const runIfMain = (argv: readonly string[], env: NodeJS.ProcessEnv): Relay | null => {
  const entry = argv[1];
  if (entry === undefined || pathToFileURL(entry).href !== import.meta.url) return null;
  const port = env.PORT === undefined || env.PORT === '' ? DEFAULT_PORT : Number(env.PORT);
  return createRelay({ port });
};
runIfMain(process.argv, process.env);
