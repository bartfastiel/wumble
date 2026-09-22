// The header: songs, title with progress and key, "end echo", score, band toggle with beat pulse, loop record, help
// and settings. Panel buttons ask the app root to open a panel (`wm-panel` event with the panel's name).
import { t } from '../i18n';
import { LEVELS } from '../learn/levels';
import type { App } from './app';
import { counted } from './settings-groups';
import { scoreText, titleText } from './title';

export const PANEL_EVENT = 'wm-panel';
export type PanelName = 'library' | 'settings' | 'help';

const BEAT_PULSE_MS = 90;

export class WmHeader extends HTMLElement {
  app: App | null = null;
  private readonly heading = document.createElement('h1');
  private readonly score = document.createElement('span');
  private readonly echoEnd = document.createElement('button');
  private readonly band = document.createElement('button');
  private readonly loop = document.createElement('button');

  connectedCallback(): void {
    if (this.app === null) throw new Error('wm-header needs the app');
    if (this.childElementCount > 0) return;
    const app = this.app;
    const header = document.createElement('header');
    this.score.className = 'score';
    this.echoEnd.className = 'end';
    this.echoEnd.hidden = true;
    const echoLabel = document.createElement('span');
    echoLabel.textContent = t('band.echo.end');
    this.echoEnd.append(document.createTextNode('✕ '), echoLabel);
    this.echoEnd.addEventListener('click', () => {
      app.stopEcho();
    });
    this.band.className = 'icon band';
    this.band.title = t('ui.band');
    this.band.textContent = '🥁';
    this.band.addEventListener('click', () => {
      app.toggleBand();
    });
    this.loop.className = 'icon loop';
    this.loop.hidden = true;
    this.loop.addEventListener('click', () => {
      app.recordLoop();
    });
    header.append(
      this.panelButton('library', '♫', t('ui.library')),
      this.heading,
      this.echoEnd,
      this.score,
      this.band,
      this.loop,
      this.panelButton('help', '?', t('ui.help')),
      this.panelButton('settings', '⚙', t('ui.settings')),
    );
    this.append(header);
    app.on('title', () => {
      this.updateTitle();
    });
    app.on('settings', () => {
      this.updateTitle();
    });
    app.on('band', () => {
      this.updateBand();
    });
    app.on('beat', () => {
      this.pulse();
    });
    app.on('loop', () => {
      this.updateLoop();
    });
    this.updateTitle();
    this.updateBand();
    this.updateLoop();
  }

  private panelButton(panel: PanelName, icon: string, label: string): HTMLButtonElement {
    const button = document.createElement('button');
    button.className = 'icon';
    button.dataset.panel = panel;
    button.title = label;
    button.textContent = icon;
    button.addEventListener('click', () => {
      this.dispatchEvent(new CustomEvent<PanelName>(PANEL_EVENT, { bubbles: true, detail: panel }));
    });
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

  // Every beat a short pulse, set by the scheduler at audio time
  private pulse(): void {
    this.band.classList.add('beat');
    setTimeout(() => {
      this.band.classList.remove('beat');
    }, BEAT_PULSE_MS);
  }

  // ● with the count of layers; armed = pulses until the bar start, recording = red background
  private updateLoop(): void {
    const app = this.app;
    if (app === null) return;
    const layers = app.looper.layers().length;
    const phase = app.looper.phase();
    this.loop.textContent = `●${layers === 0 ? '' : String(layers)}`;
    this.loop.classList.toggle('armed', phase === 'armed');
    this.loop.classList.toggle('rec', phase === 'recording');
    this.loop.title =
      layers === 0 ? t('band.loop.record') : t('band.loop.next', { layers: counted('band.loop.layers', layers) });
  }
}
