// The player's side of a room: what goes out on song start, on every hit note, at the end, in free play and for every
// tone – and what comes back: applause from the singers, and from the musicians their seat and the tones under their
// fingers. A newcomer gets the current state right away (the song with its position, or free play, and for a
// musician the key, style and tuning to play in), so nobody waits for the next song.
import { Guests } from './guests';
import type { IncomingMessage, OutgoingMessage, PositionMessage, SongMessage, StateMessage } from './messages';

// What the link needs from relay-client.ts
export interface Link {
  readonly open: boolean;
  send(message: OutgoingMessage): boolean;
  serverNow(): number;
}

export interface PlayerNote {
  readonly midi: number;
  readonly beats: number;
  readonly text?: string;
}
export interface PlayerSong {
  readonly title: string;
  readonly bpm: number;
  readonly signature: number; // key signature, sharps positive
  readonly notes: readonly PlayerNote[];
}

// Everything a musician needs to draw the same field as the player
export interface SharedState {
  readonly signature: number;
  readonly style: string;
  readonly tuning: string;
  readonly german: boolean;
  readonly hue: number;
  readonly chord: number;
  readonly sound: string; // what the player is playing on, so nobody picks it twice
}

export interface PlayerLinkOptions {
  readonly link: Link;
  readonly onApplause?: () => void;
  readonly onListeners?: (count: number) => void;
  readonly onGuests?: () => void; // someone joined, left or pressed a tone
}

const toSongMessage = (song: PlayerSong, hue: number): SongMessage => ({
  t: 'song',
  title: song.title,
  bpm: song.bpm,
  k: song.signature,
  hue,
  notes: song.notes.map((note) => (note.text === undefined ? { midi: note.midi, beats: note.beats } : { ...note })),
});

export class PlayerLink {
  private listenerCount = 0;
  private musicianCount = 0;
  private song: PlayerSong | null = null;
  private hue = 0;
  private lastPosition: PositionMessage | null = null;
  private shared: SharedState | null = null;
  readonly guests = new Guests();

  constructor(private readonly options: PlayerLinkOptions) {}

  get listeners(): number {
    return this.listenerCount;
  }

  get musicians(): number {
    return this.musicianCount;
  }

  // From the relay, the singers and the musicians
  receive(message: IncomingMessage): void {
    if (message.t === 'hello' || message.t === 'present') {
      this.present(message.listeners, message.musicians);
    } else if (message.t === 'applause') {
      this.options.onApplause?.();
    } else if (message.t === 'join') {
      this.guests.join(message);
      this.shareState(); // the list of taken sounds has changed
      this.options.onGuests?.();
    } else if (message.t === 'note') {
      if (this.guests.note(message)) this.options.onGuests?.();
    } else if (message.t === 'leave') {
      if (this.guests.leave(message)) {
        this.shareState();
        this.options.onGuests?.();
      }
    }
  }

  private present(listeners: unknown, musicians: unknown): void {
    const before = this.listenerCount + this.musicianCount;
    const whole = (value: unknown): number => (typeof value === 'number' && value > 0 ? Math.trunc(value) : 0);
    this.listenerCount = whole(listeners);
    this.musicianCount = whole(musicians);
    this.options.onListeners?.(this.listenerCount);
    if (this.listenerCount + this.musicianCount > before) this.sendState();
    if (this.musicianCount === 0) this.guests.clear();
  }

  // Key, style, tuning and the sounds in use – sent whenever one of them changes, and to every newcomer
  setState(state: SharedState): void {
    const before = this.shared;
    this.shared = state;
    if (before === null || JSON.stringify(before) !== JSON.stringify(state)) this.shareState();
  }

  // The chord alone: it changes bar by bar under a schema, so it travels small
  setChord(chord: number): void {
    if (this.shared === null || this.shared.chord === chord) return;
    this.shared = { ...this.shared, chord };
    this.options.link.send({ t: 'chord', c: chord });
  }

  private shareState(): void {
    const state = this.shared;
    if (state === null || !this.options.link.open) return;
    this.options.link.send(this.stateMessage(state));
  }

  private stateMessage(state: SharedState): StateMessage {
    return {
      t: 'state',
      k: state.signature,
      st: state.style,
      tu: state.tuning,
      g: state.german,
      hue: state.hue,
      c: state.chord,
      taken: [...new Set([state.sound, ...this.guests.taken()])].filter((sound) => sound !== ''),
    };
  }

  // The connection dropped: the room is empty until the relay says otherwise
  disconnected(): void {
    this.listenerCount = 0;
    this.musicianCount = 0;
    this.guests.clear();
    this.options.onListeners?.(0);
    this.options.onGuests?.();
  }

  // From the learning mode: song start, note `index` hit (server time of the press), song end, back to free play
  songStarted(song: PlayerSong, hue: number): void {
    this.song = song;
    this.hue = hue;
    this.lastPosition = null;
    this.options.link.send(toSongMessage(song, hue));
  }

  notePressed(index: number): void {
    this.lastPosition = { t: 'pos', i: index, s: this.options.link.serverNow() };
    this.options.link.send(this.lastPosition);
  }

  songEnded(): void {
    this.lastPosition = null;
    this.options.link.send({ t: 'end' });
  }

  freePlay(hue: number): void {
    this.song = null;
    this.hue = hue;
    this.lastPosition = null;
    this.options.link.send({ t: 'free', hue });
  }

  // Free play: the name of the tone and the chord symbol sounding with it, only while connected
  tone(name: string, chord: string): void {
    if (!this.options.link.open) return;
    this.options.link.send({ t: 'tone', name, chord });
  }

  private sendState(): void {
    this.shareState();
    if (this.song === null) {
      this.options.link.send({ t: 'free', hue: this.hue });
      return;
    }
    this.options.link.send(toSongMessage(this.song, this.hue));
    if (this.lastPosition !== null) this.options.link.send(this.lastPosition);
  }
}
