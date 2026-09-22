// Connection to the relay with clock sync and reconnection. After `hallo` five pings go out (40 ms apart from 40 ms
// on), afterwards one every 10 s; the clock offset is the median of the last five pongs. A dropped connection is
// retried with backoff 1, 2, 4 … 15 s. Sockets and timers are injected: the UI passes the browser WebSocket, tests a fake.
import { ClockSync } from './clock-sync';
import { type IncomingMessage, type OutgoingMessage, parseMessage, type PongMessage, type Role } from './messages';

export interface SocketMessage {
  readonly data: unknown;
}
// The part of the browser WebSocket the client uses
export interface RelaySocket {
  readonly readyState: number;
  send(text: string): void;
  close(): void;
  addEventListener(type: 'open' | 'close' | 'error', listener: () => void): void;
  addEventListener(type: 'message', listener: (event: SocketMessage) => void): void;
}
export type SocketFactory = (url: string) => RelaySocket;
const SOCKET_OPEN = 1;

// Timers return their cancel function, so the client never handles timer handles
export interface Timers {
  schedule(callback: () => void, ms: number): () => void;
  every(callback: () => void, ms: number): () => void;
}
export const realTimers: Timers = {
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
};

export type LinkStatus =
  | { readonly kind: 'connected' }
  | { readonly kind: 'disconnected' }
  | { readonly kind: 'waiting'; readonly wait: number }; // ms until the next attempt

export interface RelayClientOptions {
  readonly relayUrl: string; // ws(s)://host/ws
  readonly room: string;
  readonly role: Role;
  readonly socket: SocketFactory;
  readonly timers?: Timers;
  readonly now?: () => number; // the local clock, Date.now by default
  readonly delay?: number; // simulated latency per direction, tests only
  readonly onStatus?: (status: LinkStatus) => void;
  readonly onMessage?: (message: IncomingMessage) => void;
  readonly onSync?: (offset: number, rtt: number) => void;
}

export const INITIAL_PINGS = 5;
export const PING_INTERVAL = 10_000;
export const MAX_BACKOFF = 15_000;

export class RelayClient {
  readonly clock = new ClockSync();
  private socket: RelaySocket | null = null;
  private isOpen = false;
  private tries = 0;
  private readonly cancels = new Set<() => void>();
  private readonly stopKeepalive: () => void;
  private readonly timers: Timers;
  private readonly now: () => number;
  private readonly delay: number;

  constructor(private readonly options: RelayClientOptions) {
    this.timers = options.timers ?? realTimers;
    this.now = options.now ?? Date.now;
    this.delay = options.delay ?? 0;
    this.stopKeepalive = this.timers.every(() => {
      this.ping();
    }, PING_INTERVAL);
    this.connect();
  }

  get open(): boolean {
    return this.isOpen;
  }

  get synced(): boolean {
    return this.clock.synced;
  }

  get offset(): number {
    return this.clock.offset;
  }

  get rtt(): number {
    return this.clock.rtt;
  }

  serverNow(): number {
    return this.clock.serverNow(this.now());
  }

  // False when not connected; the message is then lost
  send(message: OutgoingMessage): boolean {
    if (!this.isOpen || this.socket === null) return false;
    const socket = this.socket;
    const text = JSON.stringify(message);
    this.afterDelay(() => {
      if (socket.readyState === SOCKET_OPEN) socket.send(text);
    });
    return true;
  }

  // Cancels every timer, so nothing reconnects afterwards; events of the old socket are ignored
  close(): void {
    this.stopKeepalive();
    for (const cancel of this.cancels) cancel();
    this.cancels.clear();
    const socket = this.socket;
    this.socket = null;
    this.isOpen = false;
    socket?.close();
  }

  private later(callback: () => void, ms: number): void {
    const cancel = this.timers.schedule(() => {
      this.cancels.delete(cancel);
      callback();
    }, ms);
    this.cancels.add(cancel);
  }

  // The simulated latency of tests; without it, sending and receiving happen right away
  private afterDelay(callback: () => void): void {
    if (this.delay === 0) callback();
    else this.later(callback, this.delay);
  }

  private connect(): void {
    let socket: RelaySocket;
    try {
      socket = this.options.socket(`${this.options.relayUrl}?room=${this.options.room}&role=${this.options.role}`);
    } catch {
      this.retry();
      return;
    }
    this.socket = socket;
    socket.addEventListener('open', () => {
      if (this.socket !== socket) return;
      this.isOpen = true;
      this.tries = 0;
      this.options.onStatus?.({ kind: 'connected' });
    });
    socket.addEventListener('message', (event) => {
      this.afterDelay(() => {
        if (typeof event.data === 'string') this.receive(event.data);
      });
    });
    socket.addEventListener('close', () => {
      if (this.socket !== socket) return; // an older socket, already replaced
      this.socket = null;
      if (this.isOpen) {
        this.isOpen = false;
        this.options.onStatus?.({ kind: 'disconnected' });
      }
      this.retry();
    });
    socket.addEventListener('error', () => undefined); // a close event always follows
  }

  private retry(): void {
    const wait = Math.min(MAX_BACKOFF, 1000 * 2 ** this.tries);
    this.tries++;
    this.options.onStatus?.({ kind: 'waiting', wait });
    this.later(() => {
      this.connect();
    }, wait);
  }

  private receive(text: string): void {
    const message = parseMessage(text);
    if (message === undefined) return;
    if (message.t === 'pong') {
      this.pong(message);
      return;
    }
    if (message.t === 'hello') {
      this.clock.reset();
      for (let i = 0; i < INITIAL_PINGS; i++) {
        this.later(
          () => {
            this.ping();
          },
          40 + i * 120,
        );
      }
    }
    this.options.onMessage?.(message);
  }

  private ping(): void {
    this.send({ t: 'ping', c: this.now() });
  }

  private pong(message: PongMessage): void {
    this.clock.record(message.c, message.s, this.now());
    this.options.onSync?.(this.clock.offset, this.clock.rtt);
  }
}
