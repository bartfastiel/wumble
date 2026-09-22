// The player's side of a room: what goes out on song start, on every hit note, at the end, in free play and for every
// tone – and what comes back: the listener count and applause. A newcomer gets the current state right away (the song
// with its position, or free play), so nobody waits for the next song.
import type { IncomingMessage, OutgoingMessage, PositionMessage, SongMessage } from './messages';

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

export interface PlayerLinkOptions {
  readonly link: Link;
  readonly onApplause?: () => void;
  readonly onListeners?: (count: number) => void;
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
  private song: PlayerSong | null = null;
  private hue = 0;
  private lastPosition: PositionMessage | null = null;

  constructor(private readonly options: PlayerLinkOptions) {}

  get listeners(): number {
    return this.listenerCount;
  }

  // From the relay and the listeners
  receive(message: IncomingMessage): void {
    if (message.t === 'hello' || message.t === 'present') {
      const before = this.listenerCount;
      const count: unknown = message.listeners;
      this.listenerCount = typeof count === 'number' && count > 0 ? Math.trunc(count) : 0;
      this.options.onListeners?.(this.listenerCount);
      if (this.listenerCount > before) this.sendState();
    } else if (message.t === 'applause') {
      this.options.onApplause?.();
    }
  }

  // The connection dropped: the room is empty until the relay says otherwise
  disconnected(): void {
    this.listenerCount = 0;
    this.options.onListeners?.(0);
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
    if (this.song === null) {
      this.options.link.send({ t: 'free', hue: this.hue });
      return;
    }
    this.options.link.send(toSongMessage(this.song, this.hue));
    if (this.lastPosition !== null) this.options.link.send(this.lastPosition);
  }
}
