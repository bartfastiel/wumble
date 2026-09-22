// The listener view (#room=…): no grid, no audio – the music comes from the room. Full screen
// in the key's dark hue: the status, the title, the lines of the song with the previous and the next one small, sung
// syllables yellow, the current one filling from the left (a text gradient), the ball hopping to the next syllable;
// in free play the tone huge with the chord below; the applause button at the bottom. karaoke-model.ts predicts the
// position, this draws one frame per animation frame.
import { Applause } from '../audience/applause';
import { random } from '../audio/random';
import {
  type Ball,
  isWordEnd,
  type KaraokeFrame,
  KaraokeModel,
  type KaraokeSong,
  syllableText,
} from '../audience/karaoke-model';
import { RelayClient, type SocketFactory } from '../audience/relay-client';
import { t } from '../i18n';
import type { App } from './app';
import { applyTheme } from './theme';

export const LISTENING_CLASS = 'listening'; // on the body: dark page, the app hidden
const CLAP_MS = 1200; // a clap floats for this long
const CLAPS = ['👏', '🎉', '👏', '✨'];
const BOB_PX = 4;
const BALL_HALF = 9;

// The three shown lines: the previous, the current (large) and the next
type LineSlot = 'prev' | 'cur' | 'next';
const SLOTS: readonly LineSlot[] = ['prev', 'cur', 'next'];

const div = (className: string): HTMLDivElement => {
  const node = document.createElement('div');
  node.className = className;
  return node;
};

// Where the ball sits: above the middle of the syllable, on an arc while it hops, bobbing while it waits
export const ballPosition = (
  ball: Ball,
  rect: (syllable: number) => { left: number; top: number; width: number; height: number } | null,
): { x: number; y: number } | null => {
  const at = rect(ball.at);
  if (at === null) return null;
  const from = ball.from === null ? null : rect(ball.from);
  const mid = (r: { left: number; width: number }): number => r.left + r.width / 2;
  const top = (r: { top: number }): number => r.top - BALL_HALF - 1;
  if (from === null) return { x: mid(at), y: top(at) - ball.bob * BOB_PX };
  const u = ball.progress;
  return {
    x: mid(from) + (mid(at) - mid(from)) * u,
    y: top(from) + (top(at) - top(from)) * u - Math.sin(u * Math.PI) * 0.6 * at.height,
  };
};

export class WmListener extends HTMLElement {
  app: App | null = null;
  socket: SocketFactory = (url) => new WebSocket(url);
  private readonly status = div('status');
  private readonly heading = div('title');
  private readonly lines = div('lines');
  private readonly slots: Record<LineSlot, HTMLDivElement> = {
    prev: div('line prev'),
    cur: div('line cur'),
    next: div('line next'),
  };
  private readonly ball = div('ball');
  private readonly free = div('free');
  private readonly tone = div('tone');
  private readonly chord = div('chord');
  private readonly waiting = div('note');
  private readonly done = div('big');
  private readonly applause = document.createElement('button');
  private code: string | null = null;
  private client: RelayClient | null = null;
  private model: KaraokeModel | null = null;
  private claps: Applause | null = null;
  private wake: WakeLockSentinel | null = null;
  private frameHandle = 0;
  private spans = new Map<number, HTMLSpanElement>(); // syllable → its span in the shown lines
  private shownSong: KaraokeSong | null = null;
  private shownLine = -1;
  private shownActive = -1;
  private shownToneAt = 0;
  private readonly visibility = (): void => {
    if (this.code !== null && !document.hidden) void this.wakeLock();
  };

  connectedCallback(): void {
    if (this.childElementCount > 0) return;
    const middle = div('middle');
    this.lines.append(this.slots.prev, this.slots.cur, this.slots.next);
    this.free.append(this.tone, this.chord);
    this.waiting.textContent = t('audience.listener.waiting');
    this.done.textContent = t('audience.listener.done');
    middle.append(this.lines, this.ball, this.free, this.waiting, this.done);
    this.applause.className = 'applause';
    this.applause.title = t('audience.listener.applause');
    this.applause.textContent = '👏';
    this.applause.addEventListener('click', () => {
      this.clap();
    });
    this.append(this.status, this.heading, middle, this.applause);
    document.addEventListener('visibilitychange', this.visibility);
  }

  disconnectedCallback(): void {
    this.stop();
    document.removeEventListener('visibilitychange', this.visibility);
  }

  get isOpen(): boolean {
    return this.code !== null;
  }

  get room(): string | null {
    return this.code;
  }

  start(code: string): void {
    if (this.app === null) throw new Error('wm-listener needs the app');
    this.stop();
    this.code = code;
    document.body.classList.add(LISTENING_CLASS);
    document.title = t('audience.listener.title', { code });
    this.status.textContent = t('audience.connecting');
    const client = new RelayClient({
      relayUrl: this.app.room.relay,
      room: code,
      role: 'listener',
      socket: this.socket,
      onStatus: (status) => {
        if (status.kind === 'connected') this.status.textContent = t('audience.listener.connected', { code });
        else if (status.kind === 'disconnected') this.status.textContent = t('audience.listener.lost', { code });
        else {
          const seconds = Math.round(status.wait / 1000);
          this.status.textContent = t('audience.listener.unreachable', { code, seconds });
        }
      },
      onMessage: (message) => {
        this.model?.receive(message);
      },
    });
    this.client = client;
    this.model = new KaraokeModel(() => client.serverNow());
    this.claps = new Applause(client, () => performance.now());
    this.shownSong = null;
    this.shownLine = -1;
    this.shownActive = -1;
    this.tone.textContent = '';
    this.chord.textContent = '';
    void this.wakeLock();
    this.frameHandle = requestAnimationFrame(() => {
      this.frame();
    });
  }

  stop(): void {
    if (this.code === null) return;
    cancelAnimationFrame(this.frameHandle);
    this.client?.close();
    this.client = null;
    this.model = null;
    this.claps = null;
    this.code = null;
    document.body.classList.remove(LISTENING_CLASS);
    document.title = 'Wumble';
    void this.wake?.release().catch(() => undefined);
    this.wake = null;
  }

  // The screen stays on while the view is visible – where the browser allows it
  private async wakeLock(): Promise<void> {
    const lock: WakeLock | undefined = (navigator as Partial<Navigator>).wakeLock;
    if (lock === undefined || document.hidden) return;
    try {
      this.wake = await lock.request('screen');
    } catch {
      this.wake = null; // refused: the screen may go dark
    }
  }

  private frame(): void {
    this.frameHandle = requestAnimationFrame(() => {
      this.frame();
    });
    const model = this.model;
    if (model === null) return;
    this.draw(model.frame(), model.currentSong);
  }

  private draw(frame: KaraokeFrame, song: KaraokeSong | null): void {
    if (frame.hue !== null) applyTheme(frame.hue);
    const { mode } = frame;
    this.lines.hidden = mode !== 'song';
    this.free.hidden = mode !== 'free';
    this.waiting.hidden = mode !== 'waiting';
    this.done.hidden = mode !== 'done';
    if (mode === 'free') {
      this.heading.textContent = t('audience.listener.freePlay');
      if (this.tone.textContent === '') this.tone.textContent = '♪';
      this.showTone(frame);
    } else if (mode === 'waiting') this.heading.textContent = '';
    if (mode !== 'song' || song === null) {
      this.ball.hidden = true;
      return;
    }
    this.heading.textContent = song.title;
    if (song !== this.shownSong || frame.line !== this.shownLine) this.render(song, frame.line);
    if (frame.active !== this.shownActive) {
      for (const [i, span] of this.spans) {
        span.classList.toggle('done', i < frame.active);
        span.classList.toggle('cur', i === frame.active);
      }
      this.shownActive = frame.active;
    }
    this.spans.get(frame.active)?.style.setProperty('--p', frame.fill.toFixed(3));
    this.placeBall(frame.ball);
  }

  // Line `line` large in the middle, the previous and the next small; one span per syllable, words stay together
  private render(song: KaraokeSong, line: number): void {
    this.shownSong = song;
    this.shownLine = line;
    this.shownActive = -1;
    this.spans = new Map();
    SLOTS.forEach((slot, k) => {
      const slotNode = this.slots[slot];
      slotNode.replaceChildren();
      const syllables = song.lines[line + k - 1];
      if (syllables === undefined) return;
      let word: HTMLSpanElement | null = null;
      for (const i of syllables) {
        if (word === null) {
          word = document.createElement('span');
          word.className = 'word';
          slotNode.append(word);
        }
        const span = document.createElement('span');
        span.className = 's';
        span.textContent = syllableText(song.syllables[i] ?? '');
        word.append(span);
        this.spans.set(i, span);
        if (isWordEnd(song.syllables, i)) word = null;
      }
    });
  }

  private placeBall(ball: Ball | null): void {
    const position =
      ball === null
        ? null
        : ballPosition(ball, (i) => {
            const span = this.spans.get(i);
            return span === undefined
              ? null
              : { left: span.offsetLeft, top: span.offsetTop, width: span.offsetWidth, height: span.offsetHeight };
          });
    this.ball.hidden = position === null;
    if (position === null) return;
    this.ball.style.left = `${String(position.x)}px`;
    this.ball.style.top = `${String(position.y)}px`;
  }

  // Free play: tone and chord, a short flash for every new press
  private showTone(frame: KaraokeFrame): void {
    const { tone } = frame;
    if (tone === null || tone.at === this.shownToneAt) return;
    this.shownToneAt = tone.at;
    this.tone.textContent = tone.name;
    this.chord.textContent = tone.chord;
    this.free.classList.remove('flash');
    this.free.getBoundingClientRect(); // a layout in between restarts the animation
    this.free.classList.add('flash');
  }

  // Applause: at most twice a second to the player, every tap a floating clap above the button
  private clap(): void {
    this.claps?.clap();
    const rect = this.applause.getBoundingClientRect();
    const clap = document.createElement('span');
    clap.className = 'clap';
    clap.textContent = CLAPS[Math.floor(random() * CLAPS.length)] ?? '👏';
    clap.style.left = `${String(rect.left + rect.width * (0.2 + 0.6 * random()) - 20)}px`;
    clap.style.top = `${String(rect.top - 30)}px`;
    document.body.append(clap);
    setTimeout(() => {
      clap.remove();
    }, CLAP_MS);
  }
}
