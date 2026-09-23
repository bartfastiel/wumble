// The app root: header, field, the panels, the listener view, the done modal and the welcome page. It owns the app
// (the wiring of the modules), opens and closes panels, binds the keyboard and applies deep links and the theme.
import { roomCodeFromHash } from '../audience/room';
import { bindKeyboard } from '../play/keyboard-bindings';
import { type App, createApp, type ExtraPanel } from './app';
import { WmAudience } from './wm-audience';
import type { SettingsStorage } from '../play/settings-storage';
import { WmWelcome } from './wm-welcome';
import { WmDone } from './wm-done';
import { WmField } from './wm-field';
import { WmHeader, PANEL_EVENT, type PanelName } from './wm-header';
import { WmHelp } from './wm-help';
import { WmLibrary, OPEN_EVENT } from './wm-library';
import { GuestSession } from './guest';
import { WmJoin } from './wm-join';
import { WmListener } from './wm-listener';
import { CLOSE_EVENT, type WmPanel } from './wm-panel';
import { WmScan } from './wm-scan';
import { hasWebAudio, silentEngine } from './silent-engine';
import { relayOverride } from './test-hook';
import { applyTheme, pageHue } from './theme';

export type AnyPanel = PanelName | ExtraPanel;

const browserStorage = (): Storage | null => {
  try {
    return localStorage;
  } catch {
    return null; // blocked storage: settings and records live until the page reloads
  }
};

// One id per page load: the host tells guests apart by it, and a reload is a new guest. It travels over the relay,
// so it comes from the platform's random source rather than from Math.random.
const guestId = (): string => {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
};

const memoryStorage = (): SettingsStorage => {
  const items = new Map<string, string>();
  return {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => {
      items.set(key, value);
    },
  };
};

export class WmApp extends HTMLElement {
  app: App | null = null; // created here unless a test injects one
  storage: SettingsStorage | null = null;
  readonly field = new WmField();
  readonly header = new WmHeader();
  readonly done = new WmDone();
  readonly welcome = new WmWelcome();
  readonly listener = new WmListener();
  readonly join = new WmJoin();
  private guest: GuestSession | null = null;
  private readonly panels = new Map<AnyPanel, WmPanel>();
  private readonly cleanups: (() => void)[] = [];

  connectedCallback(): void {
    if (this.childElementCount > 0) return;
    const storage = this.storage ?? browserStorage() ?? memoryStorage();
    this.storage = storage;
    const relay = relayOverride();
    const app = (this.app ??= createApp({
      storage,
      ...(hasWebAudio() ? {} : { engine: silentEngine() }),
      ...(relay === null ? {} : { relayUrl: relay }),
    }));
    this.header.app = app;
    this.field.app = app;
    this.listener.app = app;
    this.welcome.onPlay = () => {
      app.start();
    };
    this.panels.set('library', this.panel(new WmLibrary(), app));
    this.panels.set('help', this.panel(new WmHelp(), app));
    this.panels.set('scan', this.panel(new WmScan(), app));
    this.panels.set('audience', this.panel(new WmAudience(), app));
    this.done.onAgain = () => {
      app.restartSong();
    };
    this.done.onFreePlay = () => {
      app.stopSong();
    };
    this.append(this.header, this.field, ...this.panels.values(), this.listener, this.join, this.done, this.welcome);
    this.listen(app);
    applyTheme(pageHue(app.store.model().hue, app.store.get().look));
    app.applyLink(location.hash);
  }

  disconnectedCallback(): void {
    for (const cleanup of this.cleanups.splice(0)) cleanup();
  }

  get openPanel(): AnyPanel | null {
    for (const [name, panel] of this.panels) if (panel.isOpen) return name;
    return null;
  }

  open(name: AnyPanel): void {
    this.app?.player.releaseAll();
    this.closePanels();
    this.panels.get(name)?.open();
  }

  closePanels(): void {
    for (const panel of this.panels.values()) panel.close();
  }

  // Someone scanned the QR code (#room=…): no song, no band, no room of its own, no panel – and a page that asks
  // whether they came to sing or to play along.
  joinRoom(code: string): void {
    const app = this.app;
    if (app === null) return;
    app.stopSong();
    app.stopEcho();
    app.stopBand();
    app.room.end();
    this.closePanels();
    this.welcome.hidden = true;
    this.guest?.close();
    const guest = new GuestSession({
      store: app.store,
      relayUrl: app.room.relay,
      room: code,
      socket: this.listener.socket,
      id: guestId(),
      onTaken: (taken) => {
        this.join.setTaken(taken);
      },
      onChord: (chord) => {
        app.player.chooseChord(chord, false);
      },
    });
    this.guest = guest;
    this.join.hidden = false;
    this.join.onPlay = (choice) => {
      if (choice.role === 'sing') {
        guest.close();
        this.guest = null;
        app.guest = null;
        this.listener.start(code);
        return;
      }
      // Playing along: this device makes its own sound, in the host's key
      app.guest = guest;
      guest.sit(choice.sound, choice.low);
      document.body.classList.add('guest');
      this.field.openLow(choice.low);
      app.start();
    };
  }

  private panel<P extends WmPanel>(panel: P, app: App): P {
    panel.app = app;
    return panel;
  }

  private listen(app: App): void {
    this.addEventListener(PANEL_EVENT, (event) => {
      this.open((event as CustomEvent<PanelName>).detail);
    });
    this.addEventListener(OPEN_EVENT, (event) => {
      this.open((event as CustomEvent<ExtraPanel>).detail);
    });
    this.addEventListener(CLOSE_EVENT, () => {
      this.closePanels();
    });
    this.cleanups.push(
      app.on('finish', (result) => {
        this.done.show(result);
      }),
      app.on('open', (panel, room) => {
        if (room === undefined) this.open(panel);
        else this.joinRoom(room);
      }),
      app.on('applause', () => {
        this.field.applaud();
      }),
      app.on('settings', () => {
        applyTheme(pageHue(app.store.model().hue, app.store.get().look));
      }),
      bindKeyboard(document, app.player, {
        ignore: () => this.openPanel !== null || !this.done.hidden || !this.welcome.hidden || !this.join.hidden,
        melodyOnly: () => app.guest !== null,
        onEscape: () => {
          this.closePanels();
        },
        onRecord: () => {
          app.recordLoop();
        },
      }),
    );
    const hidden = (): void => {
      if (document.hidden) app.stopBand(); // the fingers are released by the pointer bindings
    };
    // Back from a room link: the listener view goes, the page plays again
    const hashChanged = (): void => {
      if (this.listener.isOpen && roomCodeFromHash(location.hash) === null) this.listener.stop();
      app.applyLink(location.hash);
    };
    document.addEventListener('visibilitychange', hidden);
    window.addEventListener('hashchange', hashChanged);
    this.cleanups.push(
      () => {
        document.removeEventListener('visibilitychange', hidden);
      },
      () => {
        window.removeEventListener('hashchange', hashChanged);
      },
    );
  }
}
