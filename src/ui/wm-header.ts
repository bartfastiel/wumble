// The bar along the top: songs and title on the left, then the things that shape the sound – key, style, sound –
// then the band with its loop, and finally how the field looks, the link and help. Every one of them is a single
// icon that opens one panel of pictures; the words live in the tooltips, not on the screen.
import { t } from '../i18n';
import { LEVELS } from '../learn/levels';
import { clampTempo, type Settings, styleSettings, TEMPO_MAX, TEMPO_MIN } from '../play/settings';
import { keySign } from '../theory/key-labels';
import { keyBySignature } from '../theory/keys';
import type { App } from './app';
import { loopTiles } from './controls/band-controls';
import { leadOf, leadSettings, leadTiles } from './controls/lead-tiles';
import { keyWheel } from './controls/key-wheel';
import { soundTiles } from './controls/sound-tiles';
import { styleTiles } from './controls/style-tiles';
import { labelTiles, lookTiles, spellingTiles, tuningTiles } from './controls/view-controls';
import type { Describe } from './widgets/choice';
import { scoreText, titleText } from './title';
import { iconButton, setIcon } from './widgets/button';
import { dial } from './widgets/dial';
import { icon, type IconName } from './widgets/icons';
import { attachPopover } from './widgets/popover';

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
  private auto = document.createElement('button');
  private readonly keySign = document.createElement('span');
  private readonly loopList = document.createElement('div');
  private readonly followers: ((settings: Settings) => void)[] = [];
  private readonly says = new Map<BarKey, { says: HTMLParagraphElement; idle: string }>();
  private band = document.createElement('button');
  private radio = document.createElement('button');
  private loop = document.createElement('button');

  connectedCallback(): void {
    if (this.app === null) throw new Error('wm-header needs the app');
    if (this.childElementCount > 0) return;
    const app = this.app;
    this.heading.className = 'title';
    this.score.className = 'score';
    this.band = iconButton({
      name: 'band',
      label: describedBy('band'),
      extra: 'band',
      onClick: () => {
        app.toggleBand();
      },
    });
    this.radio = iconButton({
      name: 'radio',
      label: describedBy('radio'),
      extra: 'radio',
      onClick: () => {
        app.setRadio(!app.radio.on());
      },
    });
    this.loop = iconButton({
      name: 'record',
      label: describedBy('record'),
      extra: 'loop',
      onClick: () => {
        app.recordLoop();
      },
    });
    this.loop.hidden = true;

    // Over the map: everything that decides which chords there are and who plays them
    const chords = zone('chords');
    chords.append(
      this.keySection(app),
      this.section('style', 'style', (panel) => {
        this.buildStyle(app, panel);
      }),
      gap(),
      this.band,
      this.section('tempo', 'tempo', (panel) => {
        this.buildBandPanel(app, panel);
      }),
    );
    // Over the field: the melody hand. The radio plays melody phrases, the loop records what this hand just did –
    // both belong here, not with the chords.
    const melody = zone('melody');
    melody.append(
      this.radio,
      this.loop,
      this.section('loop', 'loop', (panel) => {
        this.buildLoopPanel(app, panel);
      }),
      gap(),
      this.section('sound', 'sound', (panel) => {
        this.buildSound(app, panel);
      }),
      this.section('view', 'view', (panel) => {
        this.buildView(app, panel);
      }),
    );
    const header = document.createElement('header');
    header.append(
      this.panelButton('library', 'songs', 'songs'),
      chords,
      this.heading,
      this.buildAutoplay(app),
      this.buildEchoEnd(app),
      this.score,
      melody,
      this.shareButton(),
      this.panelButton('help', 'help', 'help'),
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
      this.updateBand(); // the radio may have been switched from a link
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

  // A button with a panel of pictures under it, built the first time it opens. The panel says what it is for,
  // and while a finger is over a tile it says what that tile does – so nothing needs writing on the pictures.
  private section(name: IconName, key: BarKey, build: (panel: HTMLDivElement) => void): HTMLDivElement {
    const holder = document.createElement('div');
    holder.className = 'section';
    const button = iconButton({ name, label: describedBy(key) });
    button.dataset.section = name;
    const { panel } = attachPopover(button, (body) => {
      const title = document.createElement('h2');
      title.textContent = t(`bar.${key}.name`);
      const says = document.createElement('p');
      says.className = 'says';
      const idle = t(`bar.${key}.text`);
      says.textContent = idle;
      this.says.set(key, { says, idle });
      const content = document.createElement('div');
      content.className = 'pop-body';
      body.append(title, content, says);
      build(content);
    });
    holder.append(button, panel);
    return holder;
  }

  // Puts words to whatever the finger is over, and falls back to what the panel is for
  private describer<V>(key: BarKey): Describe<V> {
    return (item) => {
      const line = this.says.get(key);
      if (line === undefined) return;
      line.says.textContent =
        item === null
          ? line.idle
          : [item.label, item.hint].filter((part) => part !== undefined && part !== '').join(' – ');
    };
  }

  // The key carries its own sign in the middle of the icon: whatever else happens, C stays C
  private keySection(app: App): HTMLDivElement {
    const holder = this.section('key', 'key', (panel) => {
      const settings = app.store.get();
      const ring = keyWheel(settings.signature, settings.german, (signature) => {
        app.store.update({ signature });
      });
      panel.append(ring.element);
      this.describer('key')(null);
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
    const tiles = styleTiles(
      app.store.get().style,
      (style) => {
        app.store.update(styleSettings(style, app.band.running()));
      },
      this.describer('style'),
    );
    panel.append(tiles.element);
    this.followers.push((settings) => {
      tiles.set(settings.style);
    });
  }

  private buildSound(app: App, panel: HTMLDivElement): void {
    const sounds = soundTiles(
      app.store.get().combi,
      (combi) => {
        app.store.update({ combi });
        app.engine.ensure(); // a gesture: fetch the samples right away
      },
      this.describer('sound'),
    );
    const tunings = tuningTiles(
      app.store.get().tuning,
      (tuning) => {
        app.store.update({ tuning });
      },
      this.describer('sound'),
    );
    panel.append(sounds.element, rule(), tunings.element);
    this.followers.push((settings) => {
      sounds.set(settings.combi);
      tunings.set(settings.tuning);
    });
  }

  // Schema, tempo, loop length, radio – everything that decides what the band plays
  private buildBandPanel(app: App, panel: HTMLDivElement): void {
    const settings = app.store.get();
    const lead = leadTiles(
      leadOf(settings),
      (value) => {
        app.store.update(leadSettings(value));
      },
      this.describer('tempo'),
    );
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
    const row = document.createElement('div');
    row.className = 'row';
    row.append(tempo.element, tap);
    panel.append(lead.leaders.element, rule(), lead.schemata.element, rule(), row);
    this.followers.push((next) => {
      lead.set(leadOf(next));
      tempo.set(next.tempo);
    });
  }

  // How long a loop records, and what it holds right now
  private buildLoopPanel(app: App, panel: HTMLDivElement): void {
    const loops = loopTiles(
      app.store.get().loopBars,
      (loopBars) => {
        app.store.update({ loopBars });
      },
      this.describer('loop'),
    );
    this.loopList.className = 'layers';
    panel.append(loops.element, this.loopList);
    this.listLayers();
    this.followers.push((next) => {
      loops.set(next.loopBars);
    });
  }

  private buildView(app: App, panel: HTMLDivElement): void {
    const settings = app.store.get();
    const looks = lookTiles(
      settings.look,
      (look) => {
        app.store.update({ look });
      },
      this.describer('view'),
    );
    const labels = labelTiles(
      settings.labels,
      settings.german,
      (value) => {
        app.store.update({ labels: value });
      },
      this.describer('view'),
    );
    const spelling = spellingTiles(
      settings.german,
      (german) => {
        app.store.update({ german });
      },
      this.describer('view'),
    );
    panel.append(looks.element, rule(), labels.element, spelling.element);
    this.followers.push((next) => {
      looks.set(next.look);
      labels.set(next.labels);
      spelling.set(next.german ? 1 : 0);
    });
  }

  // While a song runs, the playing can be handed to the app and taken back again – mid-song, without stopping it
  private buildAutoplay(app: App): HTMLButtonElement {
    this.auto = iconButton({
      name: 'autoplay',
      label: describedBy('autoplay'),
      extra: 'auto',
      onClick: () => {
        app.setAutoplay(!app.autoplay());
      },
    });
    this.auto.hidden = true;
    return this.auto;
  }

  private buildEchoEnd(app: App): HTMLButtonElement {
    this.echoEnd.type = 'button';
    this.echoEnd.className = 'ibtn filled end';
    this.echoEnd.hidden = true;
    this.echoEnd.title = describedBy('echo');
    this.echoEnd.setAttribute('aria-label', t('bar.echo.name'));
    this.echoEnd.append(icon('stop'));
    this.echoEnd.addEventListener('click', () => {
      app.stopEcho();
    });
    return this.echoEnd;
  }

  private shareButton(): HTMLButtonElement {
    const button = iconButton({
      name: 'share',
      label: describedBy('share'),
      onClick: (made) => {
        this.share(made);
      },
    });
    button.dataset.action = 'share';
    return button;
  }

  private panelButton(panel: PanelName, name: IconName, key: BarKey): HTMLButtonElement {
    const button = iconButton({
      name,
      label: describedBy(key),
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
    this.auto.hidden = learn.song === null;
    this.auto.classList.toggle('on', app.autoplay());
    this.auto.setAttribute('aria-pressed', String(app.autoplay()));
  }

  private updateBand(): void {
    const running = this.app?.band.running() === true;
    this.band.classList.toggle('on', running);
    if (!running) this.band.classList.remove('beat');
    this.loop.hidden = !running; // a loop runs in the band's time; without it there is nothing to record into
    this.radio.classList.toggle('on', this.app?.radio.on() === true);
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

// The subjects of the bar, each with a name and a line about what it is for
type BarKey =
  | 'songs'
  | 'key'
  | 'style'
  | 'sound'
  | 'band'
  | 'tempo'
  | 'record'
  | 'loop'
  | 'radio'
  | 'view'
  | 'share'
  | 'help'
  | 'echo'
  | 'autoplay';

const describedBy = (key: BarKey): string => {
  const name = t(`bar.${key}.name`);
  const text = t(`bar.${key}.text`);
  return `${name} – ${text}`;
};

const zone = (kind: 'chords' | 'melody'): HTMLDivElement => {
  const holder = document.createElement('div');
  holder.className = `zone ${kind}`;
  return holder;
};

const gap = (): HTMLSpanElement => {
  const span = document.createElement('span');
  span.className = 'gap';
  return span;
};

const rule = (): HTMLHRElement => document.createElement('hr');
