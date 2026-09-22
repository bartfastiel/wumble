// @vitest-environment happy-dom
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { setLocale } from '../i18n';
import { FakeEngine } from '../play/__fixtures__/fakes';
import { FakeRelay } from '../audience/__fixtures__/fake-relay';
import { type App, createApp } from './app';
import { WmApp } from './wm-app';
import { WmAudience } from './wm-audience';
import { WmCredits } from './wm-credits';
import { WmDone } from './wm-done';
import { WmField } from './wm-field';
import { WmHeader } from './wm-header';
import { WmHelp } from './wm-help';
import { WmLibrary } from './wm-library';
import { WmListener } from './wm-listener';
import { WmScan } from './wm-scan';
import { WmSettings } from './wm-settings';

const memory = (): Storage => {
  const items = new Map<string, string>();
  return {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => {
      items.set(key, value);
    },
    removeItem: (key) => {
      items.delete(key);
    },
    clear: () => {
      items.clear();
    },
    key: () => null,
    length: 0,
  };
};

const mount = (
  storage = memory(),
): { root: WmApp; app: App; engine: FakeEngine; storage: Storage; relay: FakeRelay } => {
  const engine = new FakeEngine();
  const relay = new FakeRelay();
  const app = createApp({ storage, engine, socket: relay.factory });
  const root = new WmApp();
  root.app = app;
  root.storage = storage;
  root.listener.socket = relay.factory;
  document.body.append(root);
  return { root, app, engine, storage, relay };
};

const click = (selector: string): void => {
  const element = document.querySelector<HTMLElement>(selector);
  if (element === null) throw new Error(`${selector} missing`);
  element.click();
};
const key = (type: 'keydown' | 'keyup', code: string): void => {
  document.dispatchEvent(new KeyboardEvent(type, { code, bubbles: true }));
};

beforeAll(() => {
  customElements.define('wm-header', WmHeader);
  customElements.define('wm-field', WmField);
  customElements.define('wm-library', WmLibrary);
  customElements.define('wm-settings', WmSettings);
  customElements.define('wm-help', WmHelp);
  customElements.define('wm-audience', WmAudience);
  customElements.define('wm-listener', WmListener);
  customElements.define('wm-scan', WmScan);
  customElements.define('wm-done', WmDone);
  customElements.define('wm-credits', WmCredits);
  customElements.define('wm-app', WmApp);
});
beforeEach(() => {
  setLocale('de');
  history.replaceState(null, '', '/');
});
afterEach(() => {
  document.body.replaceChildren();
});

describe('wm-app', () => {
  it('shows header, field, panels, the done modal and the credits on the first start', () => {
    const { root, storage } = mount();
    expect(root.querySelector('wm-header h1')?.textContent).toBe('Freies Spiel');
    expect(root.querySelector('wm-field canvas')).not.toBeNull();
    expect(root.querySelectorAll('.panel')).toHaveLength(5);
    expect(root.done.hidden).toBe(true);
    expect(root.credits.hidden).toBe(false);
    click('wm-credits button');
    expect(root.credits.hidden).toBe(true);
    // A second start with the same credits shows no splash
    expect(mount(storage).root.credits.hidden).toBe(true);
  });

  it('opens panels from the header and closes them with the back button and Escape', () => {
    const { root } = mount();
    click('button[data-panel=settings]');
    expect(root.openPanel).toBe('settings');
    expect(root.querySelector('wm-settings.open h1')?.textContent).toBe('Einstellungen');
    click('wm-settings .back');
    expect(root.openPanel).toBeNull();
    click('button[data-panel=help]');
    expect(root.querySelector('wm-help.open p b')?.textContent).toBe('Jeder Streifen ist ein Ton');
    key('keydown', 'Escape');
    expect(root.openPanel).toBeNull();
    click('button[data-panel=library]');
    expect(root.openPanel).toBe('library');
  });

  it('changes settings through the panel and reflects them in title and URL', () => {
    const { root, app } = mount();
    click('button[data-panel=settings]');
    const names = document.querySelector<HTMLInputElement>('wm-settings input[value=names]');
    names?.click();
    expect(app.store.get().labels).toBe('names');
    expect(root.querySelector('wm-header h1')?.textContent).toBe('Freies Spiel · C-Dur');
    expect(location.hash).toBe('#labels=names');
    document.querySelector<HTMLInputElement>('wm-settings input[name=Stil][value=blues]')?.click();
    expect(app.store.get()).toMatchObject({ style: 'blues', combi: 'organ', tempo: 96 });
    expect(app.band.tempo()).toBe(96);
  });

  it('starts a song from the library, scores it and ends in the done modal', () => {
    const { root, app } = mount();
    click('wm-credits button');
    click('button[data-panel=library]');
    const button = [...document.querySelectorAll<HTMLButtonElement>('wm-library button')].find((candidate) =>
      candidate.textContent.startsWith('Alle meine Entchen'),
    );
    button?.click();
    expect(app.learn.song?.title).toBe('Alle meine Entchen');
    expect(root.openPanel).toBeNull();
    expect(root.querySelector('wm-header h1')?.textContent).toBe('Alle meine Entchen · 1/27');
    expect(location.hash).toBe('#sound=piano&song=alle-meine-entchen');
    for (const placed of app.learn.placed) {
      if (placed.spot === null) throw new Error('note off the field');
      app.player.press(1, placed.spot.tone);
      app.player.release(1);
    }
    expect(root.done.hidden).toBe(false);
    expect(root.querySelector('wm-done p')?.textContent).toBe('Alle meine Entchen');
    click('wm-done button.secondary');
    expect(root.done.hidden).toBe(true);
    expect(app.learn.song).toBeNull();
    expect(root.querySelector('wm-header h1')?.textContent).toBe('Freies Spiel');
  });

  it('plays the laptop keyboard unless a panel is open', () => {
    const { root, app } = mount();
    click('wm-credits button');
    key('keydown', 'KeyA');
    expect(app.player.pointers.has('kKeyA')).toBe(true);
    key('keyup', 'KeyA');
    expect(app.player.pointers.size).toBe(0);
    root.open('help');
    key('keydown', 'KeyA');
    expect(app.player.pointers.size).toBe(0);
  });

  it('applies a deep link and follows hash changes', () => {
    const { app } = mount();
    app.applyLink('#key=A&labels=names');
    expect(app.store.get()).toMatchObject({ signature: 3, labels: 'names' });
    expect(document.documentElement.style.getPropertyValue('--hue')).toBe('355');
    location.hash = '#song=alle-meine-entchen';
    window.dispatchEvent(new Event('hashchange'));
    expect(app.learn.song?.title).toBe('Alle meine Entchen');
  });

  it('opens a room from the library, shows code and count, and joins one from a link', async () => {
    const { root, app, relay } = mount();
    click('wm-credits button');
    click('button[data-panel=library]');
    const audience = [...document.querySelectorAll<HTMLButtonElement>('wm-library button')].find(
      (candidate) => candidate.textContent === '\u{1F465} Publikum',
    );
    audience?.click();
    expect(root.openPanel).toBe('audience');
    const code = app.room.code ?? '';
    expect(code).toMatch(/^[a-z0-9]{5}$/);
    expect(root.querySelector('wm-audience p.code b')?.textContent).toBe(code);
    expect(root.querySelector('wm-audience p.link')?.textContent).toBe(`http://localhost:3000/#room=${code}`);
    expect(root.querySelector('wm-audience p.status')?.textContent).toBe('Verbinde \u2026');
    await new Promise((resolve) => setTimeout(resolve, 1));
    expect(root.querySelector('wm-audience p.status')?.textContent).toBe('Verbunden \u2013 Raum offen');
    expect(root.querySelector('wm-audience p.count')?.textContent).toBe('0 Zuh\u00f6rer');
    expect(root.querySelector<HTMLInputElement>('wm-audience input[type=url]')?.parentElement?.hidden).toBe(false);
    click('wm-audience .back');
    expect(app.room.isOpen).toBe(true); // the room outlives the panel
    click('button[data-panel=library]');
    audience?.click();
    expect(app.room.code).toBe(code);
    [...document.querySelectorAll<HTMLButtonElement>('wm-audience button')]
      .find((candidate) => candidate.textContent === 'Beenden')
      ?.click();
    expect(app.room.isOpen).toBe(false);
    expect(root.openPanel).toBeNull();
    relay.sockets.length = 0;
    app.applyLink('#room=k7m3x');
    expect(root.listener.isOpen).toBe(true);
    expect(root.listener.room).toBe('k7m3x');
    expect(document.body.classList.contains('listening')).toBe(true);
    expect(relay.sockets[0]?.url).toBe('ws://127.0.0.1:8765/ws?room=k7m3x&role=listener');
    location.hash = '';
    window.dispatchEvent(new Event('hashchange'));
    expect(root.listener.isOpen).toBe(false);
    expect(document.body.classList.contains('listening')).toBe(false);
  });

  it('tells the audience the tone, with or without a chord under it', () => {
    const { app } = mount();
    const told: [string, string][] = [];
    app.room.tone = (name, chord) => told.push([name, chord]);
    Object.defineProperty(app.room, 'isOpen', { get: () => true });
    app.player.press(1, app.player.model.tones.indexOf(67));
    app.player.release(1);
    app.player.chooseChord(app.player.model.home);
    app.player.press(2, app.player.model.tones.indexOf(64));
    app.player.release(2);
    expect(told).toEqual([
      ['G', ''], // nothing chosen on the map: the tone stands alone
      ['E', 'C'],
    ]);
  });

  it('lets applause from the room float over the field', async () => {
    const { root, app, relay } = mount();
    click('wm-credits button');
    click('button[data-panel=library]');
    [...document.querySelectorAll<HTMLButtonElement>('wm-library button')]
      .find((candidate) => candidate.textContent === '\u{1F465} Publikum')
      ?.click();
    await new Promise((resolve) => setTimeout(resolve, 1));
    const floated: string[] = [];
    root.field.float = (text) => floated.push(text);
    relay.sockets[0]?.deliver(JSON.stringify({ t: 'applause' }));
    expect(floated).toEqual(['\u{1F44F}']);
    expect(app.room.listeners).toBe(0);
  });

  it('toggles the band from the header and shows the loop button', () => {
    const { root, app } = mount();
    click('wm-header button.band');
    expect(app.band.running()).toBe(true);
    expect(app.player.bandRunning).toBe(true);
    expect(root.querySelector<HTMLButtonElement>('wm-header button.loop')?.hidden).toBe(false);
    expect(location.hash).toBe('#band=1');
    click('wm-header button.band');
    expect(app.band.running()).toBe(false);
    expect(root.querySelector<HTMLButtonElement>('wm-header button.loop')?.hidden).toBe(true);
  });
});
