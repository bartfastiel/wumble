// An in-memory stand-in for the relay and the browser WebSocket, for tests: rooms, roles, `hallo`, `anwesend`, `pong`
// with the server time and forwarding to the other role – the protocol of relay/relay.ts without a network. Sockets
// open on the next timer tick, so tests drive everything with fake timers.
import { parseMessage } from '../messages';
import type { RelaySocket, SocketFactory, SocketMessage } from '../relay-client';

type Listener = (() => void) | ((event: SocketMessage) => void);
const CONNECTING = 0;
const OPEN = 1;
const CLOSED = 3;

export class FakeSocket implements RelaySocket {
  readyState = CONNECTING;
  readonly sent: string[] = [];
  onSend: ((text: string) => void) | null = null;
  onClose: (() => void) | null = null;
  private readonly listeners: Record<string, Listener[]> = {};

  constructor(readonly url: string) {}

  addEventListener(type: string, listener: Listener): void {
    const listeners = this.listeners[type] ?? [];
    listeners.push(listener);
    this.listeners[type] = listeners;
  }

  send(text: string): void {
    if (this.readyState !== OPEN) throw new Error('socket is not open');
    this.sent.push(text);
    this.onSend?.(text);
  }

  close(): void {
    if (this.readyState === CLOSED) return;
    this.readyState = CLOSED;
    this.onClose?.();
    this.emit('close');
  }

  // Test controls: the server accepts, delivers a message, or the connection breaks
  accept(): void {
    this.readyState = OPEN;
    this.emit('open');
  }

  deliver(data: unknown): void {
    this.emit('message', { data });
  }

  fail(): void {
    this.readyState = CLOSED;
    this.emit('error');
    this.emit('close');
  }

  private emit(type: string, event: SocketMessage = { data: undefined }): void {
    for (const listener of this.listeners[type] ?? []) listener(event);
  }
}

interface Member {
  readonly socket: FakeSocket;
  readonly role: string;
}

export class FakeRelay {
  readonly sockets: FakeSocket[] = [];
  private readonly rooms = new Map<string, Set<Member>>();

  // `serverNow` is the relay's clock, `accepting` lets a test refuse connections
  constructor(
    private readonly serverNow: () => number = Date.now,
    public accepting = true,
  ) {}

  readonly factory: SocketFactory = (url) => {
    const socket = new FakeSocket(url);
    this.sockets.push(socket);
    const query = new URL(url).searchParams;
    const room = query.get('room') ?? '';
    const role = query.get('role') ?? 'listener';
    setTimeout(() => {
      if (!this.accepting) {
        socket.fail();
        return;
      }
      this.join(socket, room, role);
    }, 0);
    return socket;
  };

  listeners(room: string): number {
    return [...(this.rooms.get(room) ?? [])].filter((member) => member.role === 'listener').length;
  }

  private join(socket: FakeSocket, room: string, role: string): void {
    const members = this.rooms.get(room) ?? new Set<Member>();
    const member = { socket, role };
    members.add(member);
    this.rooms.set(room, members);
    socket.onSend = (text) => {
      this.receive(member, room, text);
    };
    socket.onClose = () => {
      members.delete(member);
      this.broadcast(member, room, { t: 'present', listeners: this.listeners(room) }, true);
    };
    socket.accept();
    socket.deliver(
      JSON.stringify({ t: 'hello', role: role, room: room, s: this.serverNow(), listeners: this.listeners(room) }),
    );
    this.broadcast(member, room, { t: 'present', listeners: this.listeners(room) }, true);
  }

  private receive(from: Member, room: string, text: string): void {
    const message = parseMessage(text);
    if (message === undefined) return;
    if (message.t === 'ping') {
      from.socket.deliver(JSON.stringify({ t: 'pong', c: message.c, s: this.serverNow() }));
      return;
    }
    this.broadcast(from, room, message.s === undefined ? { ...message, s: this.serverNow() } : message);
  }

  // To the other role in the room; `all` = to everyone but the sender
  private broadcast(from: Member, room: string, message: object, all = false): void {
    for (const member of this.rooms.get(room) ?? []) {
      if (member !== from && (all || member.role !== from.role)) member.socket.deliver(JSON.stringify(message));
    }
  }
}
