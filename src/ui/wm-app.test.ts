// @vitest-environment happy-dom
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { setLocale } from '../i18n';
import { FakeEngine } from '../play/__fixtures__/fakes';
import { FakeRelay } from '../audience/__fixtures__/fake-relay';
import { type App, createApp } from './app';
import { WmApp } from './wm-app';
import { WmAudience } from './wm-audience';
import { WmWelcome } from './wm-welcome';
import { WmDone } from './wm-done';
import { WmField } from './wm-field';
import { WmHeader } from './wm-header';
import { WmHelp } from './wm-help';
import { WmLibrary } from './wm-library';
import { WmJoin } from './wm-join';
import { WmListener } from './wm-listener';
import { WmScan } from './wm-scan';

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
  customElements.define('wm-help', WmHelp);
  customElements.define('wm-audience', WmAudience);
  customElements.define('wm-join', WmJoin);
  customElements.define('wm-listener', WmListener);
  customElements.define('wm-scan', WmScan);
  customElements.define('wm-done', WmDone);
  customElements.define('wm-welcome', WmWelcome);
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
  it('shows header, field, panels, the done modal and the welcome page on every start', () => {
    const { root, storage } = mount();
    expect(root.querySelector('wm-header h1')?.textContent).toBe('Freies Spiel');
    expect(root.querySelector('wm-field canvas')).not.toBeNull();
    expect(root.querySelectorAll('.panel')).toHaveLength(4);
    expect(root.done.hidden).toBe(true);
    expect(root.welcome.hidden).toBe(false);
    expect(root.querySelector('wm-welcome button')?.textContent).toBe('Spielen');
    // it says where the three areas are
    expect(root.querySelectorAll('wm-welcome .where')).toHaveLength(3);
    click('wm-welcome button');
    expect(root.welcome.hidden).toBe(true);
    // and it is there again the next time, because the sound needs a gesture anyway
    expect(mount(storage).root.welcome.hidden).toBe(false);
  });

  it('starts the music on Play: sound fading in, band and radio running', () => {
    const { root, app } = mount();
    expect(app.band.running()).toBe(false); // nothing sounds before the gesture
    click('wm-welcome button');
    expect(app.band.running()).toBe(true);
    expect(app.radio.on()).toBe(true);
    expect(root.welcome.hidden).toBe(true);
  });

  it('opens panels from the header and closes them with the back button and Escape', () => {
    const { root } = mount();
    click('button[data-panel=help]');
    expect(root.openPanel).toBe('help');
    click('wm-help .back');
    expect(root.openPanel).toBeNull();
    click('button[data-panel=help]');
    expect(root.querySelector('wm-help.open p b')?.textContent).toBe('Jeder Streifen ist ein Ton');
    key('keydown', 'Escape');
    expect(root.openPanel).toBeNull();
    click('button[data-panel=library]');
    expect(root.openPanel).toBe('library');
  });

  it('changes settings from the bar and reflects them in title and URL', () => {
    const { root, app } = mount();
    click('button[data-section=view]');
    const tiles = [...document.querySelectorAll<HTMLButtonElement>('.pop .tile')];
    const names = tiles.find((tile) => tile.title.startsWith('Notennamen'));
    names?.click();
    expect(app.store.get().labels).toBe('names');
    expect(root.querySelector('wm-header h1')?.textContent).toBe('Freies Spiel · C-Dur');
    expect(location.hash).toBe('#labels=names');
    click('button[data-section=style]');
    const jazz = [...document.querySelectorAll<HTMLButtonElement>('.pop .tile')].find((tile) => tile.title === 'Jazz');
    jazz?.click();
    expect(app.store.get()).toMatchObject({ style: 'jazz', combi: 'jazzTrio' });
    expect(app.band.tempo()).toBe(app.store.get().tempo);
  });

  it('picks a key on the circle of fifths and shows its sign on the button', () => {
    const { root, app } = mount();
    click('button[data-section=key]');
    const seats = [...document.querySelectorAll<SVGGElement>('.wheel .seat')];
    expect(seats).toHaveLength(13);
    seats[1]?.dispatchEvent(new MouseEvent('click', { bubbles: true })); // one fifth up from C
    expect(app.store.get().signature).toBe(1);
    expect(root.querySelector('button[data-section=key] .sign')?.textContent).toBe('G');
  });

  it('starts a song from the library, scores it and ends in the done modal', () => {
    const { root, app } = mount();
    click('wm-welcome button');
    click('button[data-panel=library]');
    const button = [...document.querySelectorAll<HTMLButtonElement>('wm-library button')].find((candidate) =>
      candidate.textContent.startsWith('Alle meine Entchen'),
    );
    button?.click();
    expect(app.learn.song?.title).toBe('Alle meine Entchen');
    expect(root.openPanel).toBeNull();
    expect(root.querySelector('wm-header h1')?.textContent).toBe('Alle meine Entchen · 1/27');
    expect(location.hash).toBe('#style=classical&sound=piano&song=alle-meine-entchen&band=0&radio=0');
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
    click('wm-welcome button');
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
    // The polished look holds its own cool light; the other looks take the hue of the key
    expect(document.documentElement.style.getPropertyValue('--hue')).toBe('216');
    app.applyLink('#key=A&look=organic');
    expect(document.documentElement.style.getPropertyValue('--hue')).toBe('355');
    location.hash = '#song=alle-meine-entchen';
    window.dispatchEvent(new Event('hashchange'));
    expect(app.learn.song?.title).toBe('Alle meine Entchen');
  });

  it('opens a room from the library, shows code and count, and joins one from a link', async () => {
    const { root, app, relay } = mount();
    click('wm-welcome button');
    click('button[data-panel=library]');
    const audience = [...document.querySelectorAll<HTMLButtonElement>('wm-library button')].find(
      (candidate) => candidate.textContent === 'Publikum',
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
    // A guest is asked first: sing along, or play along?
    expect(root.join.hidden).toBe(false);
    expect(relay.sockets[0]?.url).toBe('ws://127.0.0.1:8765/ws?room=k7m3x&role=musician');
    const sing = [...document.querySelectorAll<HTMLButtonElement>('wm-join .tile')].find((tile) =>
      tile.title.startsWith('Singen'),
    );
    sing?.click();
    document.querySelector<HTMLButtonElement>('wm-join button.play')?.click();
    expect(root.listener.isOpen).toBe(true);
    expect(root.listener.room).toBe('k7m3x');
    expect(document.body.classList.contains('listening')).toBe(true);
    expect(relay.sockets.at(-1)?.url).toBe('ws://127.0.0.1:8765/ws?room=k7m3x&role=listener');
    location.hash = '';
    window.dispatchEvent(new Event('hashchange'));
    expect(root.listener.isOpen).toBe(false);
    expect(document.body.classList.contains('listening')).toBe(false);
  });

  it('tells the audience the tone, with or without a chord under it', () => {
    const { app } = mount();
    // Two hands on the classical map: this is about what the room hears, not about the style of the day
    app.store.update({ mode: 'twoHands', style: 'classical' });
    const told: [string, string][] = [];
    app.room.tone = (name, chord) => told.push([name, chord]);
    Object.defineProperty(app.room, 'isOpen', { get: () => true });
    // Tap the sounding chord until the accompaniment is off – that is what the room must hear in the tone alone
    if (app.player.accompanying) app.player.chooseChord(app.player.chord);
    expect(app.player.accompanying).toBe(false);
    app.player.press(1, app.player.model.tones.indexOf(67));
    app.player.release(1);
    app.player.chooseChord(app.player.model.home);
    app.player.press(2, app.player.model.tones.indexOf(64));
    app.player.release(2);
    expect(told).toEqual([
      ['G', ''], // the accompaniment is muted: the tone stands alone
      ['E', 'C'],
    ]);
  });

  it('joins a room as a musician: the host key, its own sound, and every tone reported', async () => {
    const { root, app, relay } = mount();
    app.applyLink('#room=k7m3x');
    await new Promise((resolve) => setTimeout(resolve, 1)); // the socket accepts
    const socket = relay.sockets[0];
    expect(socket?.url).toContain('role=musician');
    // The host says what it plays in, and which sounds are spoken for
    socket?.deliver(
      JSON.stringify({ t: 'state', k: 3, st: 'classical', tu: 'just', g: true, hue: 355, c: 1, taken: ['organ'] }),
    );
    expect(app.store.get()).toMatchObject({ signature: 3, style: 'classical', tuning: 'just', german: true });
    const organ = [...document.querySelectorAll<HTMLButtonElement>('wm-join .tile')].find(
      (tile) => tile.title === 'Orgel',
    );
    expect(organ?.disabled).toBe(true); // someone else is on it
    document.querySelector<HTMLButtonElement>('wm-join button.play')?.click();
    expect(app.guest).not.toBeNull();
    expect(document.body.classList.contains('guest')).toBe(true);
    const sent = socket?.sent.map((text) => JSON.parse(text) as { t: string }) ?? [];
    expect(sent.some((message) => message.t === 'join')).toBe(true);
    // What it plays travels, what it hears does not change the host
    const tone = app.player.model.tones.indexOf(64);
    app.player.press(1, tone);
    app.player.release(1);
    const notes = (socket?.sent ?? []).map((text) => JSON.parse(text) as { t: string; midi?: number; on?: boolean });
    expect(notes.filter((message) => message.t === 'note')).toEqual([
      expect.objectContaining({ midi: 64, on: true }),
      expect.objectContaining({ midi: 64, on: false }),
    ]);
    expect(root.field.isConnected).toBe(true);
  });

  it('lets applause from the room float over the field', async () => {
    const { root, app, relay } = mount();
    click('wm-welcome button');
    click('button[data-panel=library]');
    [...document.querySelectorAll<HTMLButtonElement>('wm-library button')]
      .find((candidate) => candidate.textContent === 'Publikum')
      ?.click();
    await new Promise((resolve) => setTimeout(resolve, 1));
    const floated: string[] = [];
    root.field.float = (text) => floated.push(text);
    relay.sockets[0]?.deliver(JSON.stringify({ t: 'applause' }));
    expect(floated).toEqual(['clap']);
    expect(app.room.listeners).toBe(0);
  });

  it('toggles the band from the header and shows the loop button', () => {
    const { root, app } = mount();
    click('wm-welcome button'); // Play: band and radio come up by themselves
    expect(app.band.running()).toBe(true);
    expect(app.player.bandRunning).toBe(true);
    expect(root.querySelector<HTMLButtonElement>('wm-header button.loop')?.hidden).toBe(false);
    expect(location.hash).toBe(''); // the default needs no link
    click('wm-header button.band');
    expect(app.band.running()).toBe(false);
    expect(location.hash).toBe('#band=0'); // switching it off is worth carrying
    expect(root.querySelector<HTMLButtonElement>('wm-header button.loop')?.hidden).toBe(true);
    click('wm-header button.band');
    expect(app.band.running()).toBe(true);
    expect(location.hash).toBe('');
  });
});
