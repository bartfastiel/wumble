// Who is playing along, and on what. The player's device keeps this list: it decides which sounds are still free,
// and it knows which tones are under someone else's finger right now so the field can show them.
import type { JoinMessage, LeaveMessage, NoteMessage } from './messages';

export interface Guest {
  readonly id: string;
  readonly sound: string;
  readonly low: boolean; // sits at the bass end of the field
  readonly playing: ReadonlySet<number>; // midi notes held right now
}

interface Seat {
  readonly id: string;
  sound: string;
  low: boolean;
  readonly playing: Set<number>;
}

const MAX_GUESTS = 8; // a family, not a festival: beyond this the list stops growing
const MAX_HELD = 10; // ten fingers

export class Guests {
  private readonly seats = new Map<string, Seat>();

  get list(): readonly Guest[] {
    return [...this.seats.values()].map((seat) => ({ ...seat, playing: seat.playing }));
  }

  get count(): number {
    return this.seats.size;
  }

  // The sounds that are spoken for – the player's own is added by whoever asks
  taken(): readonly string[] {
    return [...new Set([...this.seats.values()].map((seat) => seat.sound))];
  }

  // Every midi note someone is holding, once
  sounding(): readonly number[] {
    const notes = new Set<number>();
    for (const seat of this.seats.values()) for (const midi of seat.playing) notes.add(midi);
    return [...notes];
  }

  join(message: JoinMessage): boolean {
    const seat = this.seats.get(message.id);
    if (seat !== undefined) {
      seat.sound = message.sound;
      seat.low = message.low;
      return true;
    }
    if (this.seats.size >= MAX_GUESTS) return false;
    this.seats.set(message.id, { id: message.id, sound: message.sound, low: message.low, playing: new Set() });
    return true;
  }

  // A note under a guest's finger. An unknown guest takes a seat on the spot: a reconnect must not go silent.
  note(message: NoteMessage): boolean {
    const seat = this.seats.get(message.id) ?? this.seatFor(message.id);
    if (seat === null) return false;
    if (!message.on) return seat.playing.delete(message.midi);
    if (seat.playing.size >= MAX_HELD) return false;
    seat.playing.add(message.midi);
    return true;
  }

  leave(message: LeaveMessage): boolean {
    return this.seats.delete(message.id);
  }

  // Everyone is gone: the connection dropped, or the room was closed
  clear(): void {
    this.seats.clear();
  }

  private seatFor(id: string): Seat | null {
    if (this.seats.size >= MAX_GUESTS) return null;
    const seat: Seat = { id, sound: '', low: false, playing: new Set() };
    this.seats.set(id, seat);
    return seat;
  }
}
