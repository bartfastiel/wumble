// The bar along the top: songs and title on the left, then the things that shape the sound – key, style, sound –
// then the band with its loop, and finally how the field looks, the link and help. Every one of them is a single
// icon that opens one panel of pictures; the words live in the tooltips, not on the screen.
import { t } from '../i18n';
import { LEVELS } from '../learn/levels';
import { clampTempo, type Settings, styleSettings, TEMPO_MAX, TEMPO_MIN } from '../play/settings';
import { keySign } from '../theory/key-labels';
import { keyBySignature } from '../theory/keys';
import type { App } from './app';
import { loopTiles, schemaTiles } from './controls/band-controls';
import { keyWheel } from './controls/key-wheel';
import { soundTiles } from './controls/sound-tiles';
import { styleTiles } from './controls/style-tiles';
import { labelTiles, lookTiles, modeTiles, spellingTiles, tuningTiles } from './controls/view-controls';
import { scoreText, titleText } from './title';
import { iconButton, setIcon } from './widgets/button';
import { dial } from './widgets/dial';
import { icon, type IconName } from './widgets/icons';
import { attachPopover } from './widgets/popover';
import { toggle } from './widgets/toggle';

export const PANEL_EVENT = 'wm-panel';
export type PanelName = 'library' | 'help';

const BEAT_PULSE_MS = 90;
const SHARED_MS = 1200;
const MAX_MARKS = 16;

export class WmHeader extends HTMLElement {
  app: App | null = null;
  private readonly heading = document.createElement('h1');
  private readonly score = document.createElement('span');
  private readonly echoEnd = document.createElement('button');
  private readonly keySign = document.createElement('span');
  private readonly loopList = document.createElement('div');
  private readonly followers: ((settings: Settings) => void)[] = [];
  private band = document.createElement('button');
  private loop = document.createElement('button');

  connectedCallback(): void {
    if (this.app === null) throw new Error('wm-header needs the app');
    if (this.childElementCount > 0) return;
    const app = this.app;
    this.heading.className = 'title';
    this.score.className = 'score';
    this.band = iconButton({
      name: 'band',
      label: t('ui.band'),
      extra: 'band',
      onClick: () => {
        app.toggleBand();
      },
    });
    this.loop = iconButton({
      name: 'record',
      label: t('band.loop.record'),
      extra: 'loop',
      onClick: () => {
        app.recordLoop();
      },
    });
    this.loop.hidden = true;

    const header = document.createElement('header');
    header.append(
      this.panelButton('library', 'songs', t('ui.library')),
      this.heading,
      this.buildEchoEnd(app),
      this.score,
      gap(),
      this.keySection(app),
      this.section('style', t('settings.style'), (panel) => {
        this.buildStyle(app, panel);
      }),
      this.section('sound', t('settings.sound'), (panel) => {
        this.buildSound(app, panel);
      }),
      gap(),
      this.band,
      this.section('tempo', t('band.title'), (panel) => {
        this.buildBandPanel(app, panel);
      }),
      this.loop,
      gap(),
      this.section('view', t('settings.look'), (panel) => {
        this.buildView(app, panel);
      }),
      iconButton({
        name: 'share',
        label: t('settings.share'),
        onClick: (button) => {
          this.share(button);
        },
      }),
      this.panelButton('help', 'help', t('ui.help')),
    );
    this.append(header);
    this.listen(app);
    this.updateTitle();
    this.updateBand();
    this.updateLoop();
  }

  private listen(app: App): void {
    app.on('title', () => {
      this.updateTitle();
    });
    app.on('settings', () => {
      this.updateTitle();
      const settings = app.store.get();
      for (const set of this.followers) set(settings);
    });
    app.on('band', () => {
      this.updateBand();
    });
    app.on('beat', () => {
      this.pulse();
    });
    app.on('loop', () => {
      this.updateLoop();
      this.listLayers();
    });
  }

  // A button with a panel of pictures under it, built the first time it opens
  private section(name: IconName, label: string, build: (panel: HTMLDivElement) => void): HTMLDivElement {
    const holder = document.createElement('div');
    holder.className = 'section';
    const button = iconButton({ name, label });
    button.dataset.section = name;
    const { panel } = attachPopover(button, build);
    holder.append(button, panel);
    return holder;
  }

  // The key carries its own sign in the middle of the icon: whatever else happens, C stays C
  private keySection(app: App): HTMLDivElement {
    const holder = this.section('key', t('settings.key'), (panel) => {
      const settings = app.store.get();
      const ring = keyWheel(settings.signature, settings.german, (signature) => {
        app.store.update({ signature });
      });
      panel.append(ring.element);
      this.followers.push((next) => {
        ring.set(next.signature);
      });
    });
    this.keySign.className = 'sign';
    holder.querySelector('button')?.append(this.keySign);
    const show = (settings: Settings): void => {
      this.keySign.textContent = keySign(keyBySignature(settings.signature), settings.german);
    };
    this.followers.push(show);
    show(app.store.get());
    return holder;
  }

  private buildStyle(app: App, panel: HTMLDivElement): void {
    const tiles = styleTiles(app.store.get().style, (style) => {
      app.store.update(styleSettings(style, app.band.running()));
    });
    panel.append(tiles.element);
    this.followers.push((settings) => {
      tiles.set(settings.style);
    });
  }

  private buildSound(app: App, panel: HTMLDivElement): void {
    const sounds = soundTiles(app.store.get().combi, (combi) => {
      app.store.update({ combi });
      app.engine.ensure(); // a gesture: fetch the samples right away
    });
    const tunings = tuningTiles(app.store.get().tuning, (tuning) => {
      app.store.update({ tuning });
    });
    panel.append(sounds.element, rule(), tunings.element);
    this.followers.push((settings) => {
      sounds.set(settings.combi);
      tunings.set(settings.tuning);
    });
  }

  // Schema, tempo, loop length, radio – everything that decides what the band plays
  private buildBandPanel(app: App, panel: HTMLDivElement): void {
    const settings = app.store.get();
    const schemata = schemaTiles(settings.schema, (schema) => {
      app.store.update({ schema });
    });
    const tempo = dial({
      label: t('band.tempo'),
      min: TEMPO_MIN,
      max: TEMPO_MAX,
      value: settings.tempo,
      onChange: (bpm) => {
        app.store.update({ tempo: clampTempo(bpm) });
      },
    });
    const tap = iconButton({
      name: 'tempo',
      label: t('band.tapTempo'),
      onClick: () => {
        app.tapTempo();
      },
    });
    const radio = toggle(t('band.radio'), app.radio.on(), (on) => {
      app.setRadio(on);
    });
    const loops = loopTiles(settings.loopBars, (loopBars) => {
      app.store.update({ loopBars });
    });
    const row = document.createElement('div');
    row.className = 'row';
    const radioRow = document.createElement('div');
    radioRow.className = 'row radio';
    radioRow.append(icon('radio'), radio.element);
    row.append(tempo.element, tap, radioRow);
    this.loopList.className = 'layers';
    panel.append(schemata.element, rule(), row, rule(), loops.element, this.loopList);
    this.listLayers();
    this.followers.push((next) => {
      schemata.set(next.schema);
      tempo.set(next.tempo);
      loops.set(next.loopBars);
      radio.set(app.radio.on());
    });
  }

  private buildView(app: App, panel: HTMLDivElement): void {
    const settings = app.store.get();
    const looks = lookTiles(settings.look, (look) => {
      app.store.update({ look });
    });
    const labels = labelTiles(settings.labels, settings.german, (value) => {
      app.store.update({ labels: value });
    });
    const spelling = spellingTiles(settings.german, (german) => {
      app.store.update({ german });
    });
    const modes = modeTiles(settings.mode, (mode) => {
      app.store.update({ mode });
    });
    panel.append(looks.element, rule(), labels.element, spelling.element, rule(), modes.element);
    this.followers.push((next) => {
      looks.set(next.look);
      labels.set(next.labels);
      spelling.set(next.german ? 1 : 0);
      modes.set(next.mode);
    });
  }

  private buildEchoEnd(app: App): HTMLButtonElement {
    this.echoEnd.type = 'button';
    this.echoEnd.className = 'ibtn filled end';
    this.echoEnd.hidden = true;
    this.echoEnd.title = t('band.echo.end');
    this.echoEnd.setAttribute('aria-label', t('band.echo.end'));
    this.echoEnd.append(icon('stop'));
    this.echoEnd.addEventListener('click', () => {
      app.stopEcho();
    });
    return this.echoEnd;
  }

  private panelButton(panel: PanelName, name: IconName, label: string): HTMLButtonElement {
    const button = iconButton({
      name,
      label,
      onClick: () => {
        this.dispatchEvent(new CustomEvent<PanelName>(PANEL_EVENT, { bubbles: true, detail: panel }));
      },
    });
    button.dataset.panel = panel;
    return button;
  }

  private updateTitle(): void {
    const app = this.app;
    if (app === null) return;
    const { learn, echo, store } = app;
    const settings = store.get();
    this.heading.textContent = titleText({
      song: learn.song,
      pos: learn.pos,
      echoTitle: echo.title(),
      labelsOn: settings.labels !== 'off',
      key: store.model().key,
      german: settings.german,
    });
    const scored = learn.levelId !== null && LEVELS[learn.levelId].factor > 0;
    this.score.textContent = scoreText(learn.song, scored, learn.score);
    this.echoEnd.hidden = !echo.active();
  }

  private updateBand(): void {
    const running = this.app?.band.running() === true;
    this.band.classList.toggle('on', running);
    if (!running) this.band.classList.remove('beat');
    this.loop.hidden = !running;
  }

  private pulse(): void {
    this.band.classList.add('beat');
    setTimeout(() => {
      this.band.classList.remove('beat');
    }, BEAT_PULSE_MS);
  }

  // The dot counts the layers; armed it pulses until the bar starts, recording it turns into a stop square
  private updateLoop(): void {
    const app = this.app;
    if (app === null) return;
    const layers = app.looper.layers().length;
    const phase = app.looper.phase();
    setIcon(this.loop, phase === 'recording' ? 'stop' : 'record');
    this.loop.dataset.layers = layers === 0 ? '' : String(layers);
    this.loop.classList.toggle('armed', phase === 'armed');
    this.loop.classList.toggle('rec', phase === 'recording');
  }

  // One row per layer: the tones it holds as a row of marks, and the cross that drops it
  private listLayers(): void {
    const app = this.app;
    if (app === null) return;
    this.loopList.replaceChildren(
      ...app.looper.layers().map((layer, i) => {
        const row = document.createElement('div');
        row.className = 'layer';
        const marks = document.createElement('span');
        marks.className = 'marks';
        for (let k = 0; k < Math.min(MAX_MARKS, layer.events.length); k++) marks.append(document.createElement('i'));
        row.append(
          marks,
          iconButton({
            name: 'close',
            label: t('band.loop.remove'),
            onClick: () => {
              app.looper.remove(i);
            },
          }),
        );
        return row;
      }),
    );
  }

  // The URL carries every deviation from the defaults; the button confirms with a tick, not with a sentence
  private share(button: HTMLButtonElement): void {
    const app = this.app;
    if (app === null) return;
    app.updateUrl();
    void navigator.clipboard.writeText(location.href).then(() => {
      setIcon(button, 'check');
      button.classList.add('done');
      setTimeout(() => {
        setIcon(button, 'share');
        button.classList.remove('done');
      }, SHARED_MS);
    });
  }
}

const gap = (): HTMLSpanElement => {
  const span = document.createElement('span');
  span.className = 'gap';
  return span;
};

const rule = (): HTMLHRElement => document.createElement('hr');
