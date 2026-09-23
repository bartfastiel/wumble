// The guest side of the app: a device that joined a room to play the melody along. It mirrors the host's key, style
// and tuning into the local store, reports what it plays, and makes its own sound – nothing it does reaches the
// host's music.
import { MusicianLink, type MusicianState } from '../audience/musician-link';
import { RelayClient, type SocketFactory } from '../audience/relay-client';
import type { CombiId } from '../audio/engine';
import type { Settings } from '../play/settings';
import { STYLE_IDS, type StyleId } from '../theory/styles';
import type { Store } from '../play/store';
import { TUNING_IDS, type TuningId } from '../theory/tuning';

export interface GuestOptions {
  readonly store: Store;
  readonly relayUrl: string;
  readonly room: string;
  readonly socket: SocketFactory;
  readonly id: string;
  readonly onChord?: (chord: number) => void; // the host moved on
  readonly onTaken?: (taken: readonly string[]) => void; // which sounds are spoken for
  readonly onStatus?: (connected: boolean) => void;
}

const isStyle = (value: string): value is StyleId => (STYLE_IDS as readonly string[]).includes(value);
const isTuning = (value: string): value is TuningId => (TUNING_IDS as readonly string[]).includes(value);

export class GuestSession {
  private readonly client: RelayClient;
  private readonly musician: MusicianLink;
  private wasOpen = false;

  constructor(private readonly options: GuestOptions) {
    this.musician = new MusicianLink({
      link: {
        get open() {
          return client.open;
        },
        send: (message) => client.send(message),
      },
      id: options.id,
      onState: (state) => {
        this.follow(state);
      },
      onChord: (chord) => {
        options.onChord?.(chord);
      },
    });
    const client = new RelayClient({
      relayUrl: options.relayUrl,
      room: options.room,
      role: 'musician',
      socket: options.socket,
      onStatus: (status) => {
        const open = status.kind === 'connected';
        if (open && this.wasOpen) this.musician.reconnected();
        this.wasOpen = open;
        options.onStatus?.(open);
      },
      onMessage: (message) => {
        this.musician.receive(message);
      },
    });
    this.client = client;
  }

  get state(): MusicianState | null {
    return this.musician.state;
  }

  get seated(): boolean {
    return this.musician.seated;
  }

  // Take a seat: the sound is this device's own, the low end is where the field opens
  sit(sound: CombiId, low: boolean): void {
    this.options.store.update({ combi: sound });
    this.musician.join(sound, low);
  }

  note(midi: number, on: boolean): void {
    this.musician.note(midi, on);
  }

  release(): void {
    this.musician.release();
  }

  close(): void {
    this.musician.leave();
    this.client.close();
  }

  // What the host plays in: key, style, tuning and note names travel, the look stays this device's own taste
  private follow(state: MusicianState): void {
    const patch: Partial<Settings> = {
      signature: state.signature,
      german: state.german,
      ...(isStyle(state.style) ? { style: state.style } : {}),
      ...(isTuning(state.tuning) ? { tuning: state.tuning } : {}),
    };
    this.options.store.update(patch);
    this.options.onTaken?.(state.taken);
    this.options.onChord?.(state.chord);
  }
}
