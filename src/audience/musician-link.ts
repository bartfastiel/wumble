// A musician's side of a room: it listens for the player's key, style and tuning and reports the tones under its
// own fingers. Nothing it sends can change the player's music – it has no chords, no band and no say in the key.
import type { IncomingMessage, OutgoingMessage } from './messages';

export interface MusicianState {
  readonly signature: number;
  readonly style: string;
  readonly tuning: string;
  readonly german: boolean;
  readonly hue: number;
  readonly chord: number;
  readonly taken: readonly string[]; // sounds the player and the other musicians are using
}

export interface MusicianLinkOptions {
  readonly link: { readonly open: boolean; send(message: OutgoingMessage): boolean };
  readonly id: string; // this device, for as long as the page is open
  readonly onState?: (state: MusicianState) => void;
  readonly onChord?: (chord: number) => void;
  readonly onSinging?: (possible: boolean) => void; // a song with words is running, or it is not
}

export class MusicianLink {
  private last: MusicianState | null = null;
  private words = false;
  private seat: { sound: string; low: boolean } | null = null;
  private readonly held = new Set<number>();

  constructor(private readonly options: MusicianLinkOptions) {}

  // What the player last said, or nothing yet
  get state(): MusicianState | null {
    return this.last;
  }

  get seated(): boolean {
    return this.seat !== null;
  }

  // Whether the host is playing a song that has words: without one there is nothing to sing along to
  get singing(): boolean {
    return this.words;
  }

  receive(message: IncomingMessage): void {
    if (message.t === 'song') {
      this.sing(message.notes.some((note) => note.text !== undefined && note.text !== ''));
    } else if (message.t === 'free' || message.t === 'end') {
      this.sing(false);
    } else if (message.t === 'state') {
      const taken = Array.isArray(message.taken) ? message.taken.filter((name) => typeof name === 'string') : [];
      this.last = {
        signature: message.k,
        style: message.st,
        tuning: message.tu,
        german: message.g,
        hue: message.hue,
        chord: message.c,
        taken,
      };
      this.options.onState?.(this.last);
    } else if (message.t === 'chord' && this.last !== null) {
      this.last = { ...this.last, chord: message.c };
      this.options.onChord?.(message.c);
    }
  }

  private sing(possible: boolean): void {
    if (possible === this.words) return;
    this.words = possible;
    this.options.onSinging?.(possible);
  }

  // Taking a seat, or moving to another one
  join(sound: string, low: boolean): void {
    this.seat = { sound, low };
    this.options.link.send({ t: 'join', id: this.options.id, sound, low });
  }

  // A tone under the finger. The sound is made here; this only lets the player see it.
  note(midi: number, on: boolean): void {
    if (this.seat === null) return;
    if (on === this.held.has(midi)) return; // nothing changed: say nothing
    if (on) this.held.add(midi);
    else this.held.delete(midi);
    this.options.link.send({ t: 'note', id: this.options.id, midi, on });
  }

  // Everything goes quiet – the page was hidden, or the connection dropped
  release(): void {
    for (const midi of [...this.held]) this.note(midi, false);
  }

  leave(): void {
    this.release();
    if (this.seat === null) return;
    this.seat = null;
    this.options.link.send({ t: 'leave', id: this.options.id });
  }

  // After a reconnect the player knows nothing about this device any more
  reconnected(): void {
    const seat = this.seat;
    this.held.clear();
    if (seat !== null) this.options.link.send({ t: 'join', id: this.options.id, ...seat });
  }
}
