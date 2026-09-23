// Wire protocol between player, relay and listeners: JSON text with a type field `t`, kept short because it travels
// over a phone connection.
//
// Player → guests: `song` at song start, `pos` for every hit note (with the server time of the press), `end`,
// `free` for free play and there `tone` for every melody press. For the musicians among them: `state` whenever the
// key, style, tuning or the sounds in use change, and `chord` whenever the chord under the field changes.
// Guests → player: `applause` from a singer, `join`, `note` and `leave` from a musician. From the relay: `hello` on
// connect, `present` when the room changes, `pong` with the server time.

// A singer follows the song, a musician plays the melody along on their own device. Both arrive through the same
// QR code and decide on the welcome page.
export type Role = 'player' | 'listener' | 'musician';

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

// What a musician needs to draw the same field as the player: key, style, tuning, note names, and which sounds are
// already taken. Everything else about the player's screen is their own business.
export interface StateMessage {
  readonly t: 'state';
  readonly k: number; // key signature
  readonly st: string; // style id
  readonly tu: string; // tuning id
  readonly g: boolean; // german note names
  readonly hue: number;
  readonly c: number; // the chord the field is measured against
  readonly taken: readonly string[]; // sound ids in use by the player and the musicians
}

// The chord changed – small and frequent, so it travels on its own
export interface ChordMessage {
  readonly t: 'chord';
  readonly c: number;
}

// A musician takes a seat: an id of their own, the sound they picked and whether they sit low (bass)
export interface JoinMessage {
  readonly t: 'join';
  readonly id: string;
  readonly sound: string;
  readonly low: boolean;
}

// A musician presses or releases a tone. The sound is made on their device; this is only so the player can see it.
export interface NoteMessage {
  readonly t: 'note';
  readonly id: string;
  readonly midi: number;
  readonly on: boolean;
}

export interface LeaveMessage {
  readonly t: 'leave';
  readonly id: string;
}
export interface HelloMessage {
  readonly t: 'hello';
  readonly role: Role;
  readonly room: string;
  readonly s: number;
  readonly listeners: number; // singers in the room
  readonly musicians?: number;
}
export interface PresenceMessage {
  readonly t: 'present';
  readonly listeners: number;
  readonly musicians?: number;
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

export type PlayerMessage =
  SongMessage | PositionMessage | EndMessage | FreePlayMessage | ToneMessage | StateMessage | ChordMessage;
export type GuestMessage = ApplauseMessage | JoinMessage | NoteMessage | LeaveMessage;
export type RelayMessage = HelloMessage | PresenceMessage | PongMessage;
export type OutgoingMessage = PlayerMessage | GuestMessage | PingMessage;
// Whatever arrives has at least a type; the relay adds the server time `s` to forwarded messages
export type IncomingMessage = (PlayerMessage | GuestMessage | RelayMessage | PingMessage) & { readonly s?: number };

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
