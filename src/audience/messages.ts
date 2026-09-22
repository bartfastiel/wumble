// Wire protocol between player, relay and listeners: JSON text with a type field `t`, kept short because it travels
// over a phone connection.
//
// Player → listeners: `song` at song start, `pos` for every hit note (with the server time of the press), `end`,
// `free` for free play and there `tone` for every melody press. Listeners → player: `applause`. From the relay:
// `hello` on connect, `present` when the listener count changes, `pong` with the server time.

export type Role = 'player' | 'listener';

export interface SongNote {
  readonly midi: number;
  readonly beats: number;
  readonly text?: string; // syllable; absent for songs without lyrics
}
export interface SongMessage {
  readonly t: 'song';
  readonly title: string;
  readonly bpm: number;
  readonly k: number; // key signature
  readonly hue: number;
  readonly notes: readonly SongNote[];
}
export interface PositionMessage {
  readonly t: 'pos';
  readonly i: number; // index of the note hit
  readonly s: number; // server time of the press
}
export interface EndMessage {
  readonly t: 'end';
}
export interface FreePlayMessage {
  readonly t: 'free';
  readonly hue: number;
}
export interface ToneMessage {
  readonly t: 'tone';
  readonly name: string; // name of the tone
  readonly chord: string; // chord symbol sounding with it
}
export interface ApplauseMessage {
  readonly t: 'applause';
}
export interface HelloMessage {
  readonly t: 'hello';
  readonly role: Role;
  readonly room: string;
  readonly s: number;
  readonly listeners: number; // listeners in the room
}
export interface PresenceMessage {
  readonly t: 'present';
  readonly listeners: number;
}
export interface PingMessage {
  readonly t: 'ping';
  readonly c: number; // client time when sent
}
export interface PongMessage {
  readonly t: 'pong';
  readonly c: number;
  readonly s: number; // server time
}

export type PlayerMessage = SongMessage | PositionMessage | EndMessage | FreePlayMessage | ToneMessage;
export type ListenerMessage = ApplauseMessage;
export type RelayMessage = HelloMessage | PresenceMessage | PongMessage;
export type OutgoingMessage = PlayerMessage | ListenerMessage | PingMessage;
// Whatever arrives has at least a type; the relay adds the server time `s` to forwarded messages
export type IncomingMessage = (PlayerMessage | ListenerMessage | RelayMessage | PingMessage) & { readonly s?: number };

// JSON text from the socket → message, or undefined for anything that is not an object with a type
export const parseMessage = (text: string): IncomingMessage | undefined => {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return undefined;
  }
  if (typeof value !== 'object' || value === null || typeof (value as { t?: unknown }).t !== 'string') return undefined;
  return value as IncomingMessage;
};
