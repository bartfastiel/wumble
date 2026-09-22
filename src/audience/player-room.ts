// The player's room: a fresh code, the connection to the relay as player, the link the
// audience opens, and what the listeners get from the learn session and the free play (player-link.ts). It outlives
// the audience panel, which only shows it.
import { type Link, PlayerLink, type PlayerSong } from './player-link';
import { type LinkStatus, RelayClient, type SocketFactory, type Timers } from './relay-client';
import { generateRoomCode, isLocalPage, type PageLocation, relayUrl, roomLink } from './room';

export type RoomStatus = LinkStatus | { readonly kind: 'connecting' } | { readonly kind: 'closed' };

export interface PlayerRoomOptions {
  readonly location: PageLocation;
  readonly publicUrl: () => string; // the setting, empty until configured
  readonly socket: SocketFactory;
  readonly relayUrl?: string; // instead of the relay next to the public page – tests only
  readonly timers?: Timers;
  readonly random?: () => number;
  readonly onChange?: () => void; // code, status or listener count changed
  readonly onApplause?: () => void;
}

const CLOSED: RoomStatus = { kind: 'closed' };

export class PlayerRoom {
  private client: RelayClient | null = null;
  private link: PlayerLink | null = null;
  private roomCode: string | null = null;
  private roomStatus: RoomStatus = CLOSED;

  constructor(private readonly options: PlayerRoomOptions) {}

  get code(): string | null {
    return this.roomCode;
  }

  get status(): RoomStatus {
    return this.roomStatus;
  }

  get listeners(): number {
    return this.link?.listeners ?? 0;
  }

  get isOpen(): boolean {
    return this.client !== null;
  }

  // From a local file or localhost the audience needs the online address of the app
  get isLocal(): boolean {
    return isLocalPage(this.options.location);
  }

  get relay(): string {
    return this.options.relayUrl ?? relayUrl(this.options.location, this.options.publicUrl());
  }

  // What the QR code holds; empty without a room
  get pageLink(): string {
    return this.roomCode === null ? '' : roomLink(this.options.location, this.options.publicUrl(), this.roomCode);
  }

  open(): void {
    if (this.client !== null) return;
    const code = generateRoomCode(this.options.random);
    this.roomCode = code;
    this.roomStatus = { kind: 'connecting' };
    // The link reads the client that is created right after it
    const link: Link = {
      get open() {
        return client.open;
      },
      send: (message) => client.send(message),
      serverNow: () => client.serverNow(),
    };
    const player = new PlayerLink({
      link,
      onApplause: () => {
        this.options.onApplause?.();
      },
      onListeners: () => {
        this.changed();
      },
    });
    const client = new RelayClient({
      relayUrl: this.relay,
      room: code,
      role: 'player',
      socket: this.options.socket,
      ...(this.options.timers === undefined ? {} : { timers: this.options.timers }),
      onStatus: (status) => {
        this.roomStatus = status;
        if (status.kind === 'disconnected') player.disconnected();
        this.changed();
      },
      onMessage: (message) => {
        player.receive(message);
      },
    });
    this.client = client;
    this.link = player;
    this.changed();
  }

  end(): void {
    if (this.client === null) return;
    this.client.close();
    this.client = null;
    this.link = null;
    this.roomCode = null;
    this.roomStatus = CLOSED;
    this.changed();
  }

  // The public address changed: a new room on the relay of that address
  restart(): void {
    this.end();
    this.open();
  }

  // From the learn session and the free play – nothing leaves without a room
  songStarted(song: PlayerSong, hue: number): void {
    this.link?.songStarted(song, hue);
  }

  notePressed(index: number): void {
    this.link?.notePressed(index);
  }

  songEnded(): void {
    this.link?.songEnded();
  }

  freePlay(hue: number): void {
    this.link?.freePlay(hue);
  }

  tone(name: string, chord: string): void {
    this.link?.tone(name, chord);
  }

  private changed(): void {
    this.options.onChange?.();
  }
}
