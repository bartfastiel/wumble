// The song list: the level at the top, then scan, echo, audience and free play, then the songs
// by group with the record of the level and a subtitle like "Pentatonic · G major / E minor".
import { locale, t } from '../i18n';
import { LEVEL_IDS } from '../learn/levels';
import type { Song } from '../learn/song-notation';
import { songSubtitle, subtitleText } from '../learn/song-subtitle';
import { GROUPS } from '../learn/songs';
import type { ExtraPanel } from './app';
import { CLOSE_EVENT, WmPanel } from './wm-panel';
import { hint, segment } from './settings-groups';
import { icon, type IconName } from './widgets/icons';
import { points } from './title';

export const OPEN_EVENT = 'wm-open'; // detail: the extra panel to open (scan, audience)
const LIBRARY_GROUPS: readonly Song['group'][] = ['scanned', ...GROUPS]; // scans of this session on top

export class WmLibrary extends WmPanel {
  private self: HTMLButtonElement | null = null; // the switch that hands the playing to the app

  protected override build(): void {
    this.setHeading(t('ui.library'));
    this.body.classList.add('list');
    this.list();
    const app = this.context;
    app.on('records', () => {
      this.list();
    });
    app.on('songs', () => {
      this.list();
    });
    app.on('title', () => {
      this.showSelf(); // the app may have taken the playing over, or handed it back
    });
    app.on('settings', (settings, previous) => {
      if (settings.difficulty !== previous.difficulty || settings.german !== previous.german) this.list();
    });
  }

  private requestClose(): void {
    this.dispatchEvent(new Event(CLOSE_EVENT, { bubbles: true }));
  }

  private action(label: string, onClick: () => void, name?: IconName): HTMLButtonElement {
    const button = document.createElement('button');
    if (name !== undefined) button.append(icon(name));
    button.append(document.createTextNode(label));
    button.addEventListener('click', onClick);
    return button;
  }

  private extra(panel: ExtraPanel, label: string, name: IconName): HTMLButtonElement {
    return this.action(
      label,
      () => {
        this.dispatchEvent(new CustomEvent<ExtraPanel>(OPEN_EVENT, { bubbles: true, detail: panel }));
      },
      name,
    );
  }

  private list(): void {
    const app = this.context;
    const { store } = app;
    const levels = segment(
      LEVEL_IDS.map((id) => ({ value: id, label: t(`learn.level.${id}`) })),
      store.get().difficulty,
      (difficulty) => {
        store.update({ difficulty });
      },
    );
    const free = this.action(
      t('learn.freePlay'),
      () => {
        app.stopSong();
        app.stopEcho();
        this.requestClose();
      },
      'play',
    );
    const echo = this.action(
      t('ui.echo'),
      () => {
        this.requestClose();
        app.startEcho();
      },
      'mic',
    );
    // The app plays the song itself: armed here, it holds for every song that follows – at a party the list is
    // opened once and then only songs are picked.
    this.self = this.action(
      t('learn.selfPlay'),
      () => {
        app.setAutoplay(!app.autoplay());
      },
      'autoplay',
    );
    this.showSelf();
    this.body.replaceChildren(
      levels.element,
      hint(t('learn.levelHint')),
      this.self,
      hint(t('learn.selfPlayHint')),
      this.extra('scan', t('ui.scan'), 'camera'),
      echo,
      this.extra('audience', t('ui.audience'), 'people'),
      free,
      ...LIBRARY_GROUPS.flatMap((group) => this.groupNodes(group)),
    );
  }

  private showSelf(): void {
    const on = this.context.autoplay();
    this.self?.classList.toggle('on', on);
    this.self?.setAttribute('aria-pressed', String(on));
  }

  private groupNodes(group: Song['group']): Node[] {
    const songs = this.context.songs
      .filter((song) => song.group === group)
      .sort((a, b) => a.title.localeCompare(b.title, locale()));
    if (songs.length === 0) return [];
    const heading = document.createElement('h2');
    heading.textContent = t(`learn.group.${group}`);
    return [heading, ...songs.map((song) => this.songButton(song))];
  }

  private songButton(song: Song): HTMLButtonElement {
    const app = this.context;
    const { difficulty, german } = app.store.get();
    const button = document.createElement('button');
    const name = document.createElement('span');
    name.textContent = song.title;
    const best = app.records.get(song, difficulty);
    if (best !== null) {
      const record = document.createElement('small');
      record.textContent = t('learn.score', { points: points(best) });
      name.append(record);
    }
    const sub = document.createElement('span');
    sub.className = 'sub';
    sub.textContent = subtitleText(songSubtitle(song), german);
    button.append(name, sub);
    button.addEventListener('click', () => {
      app.startSong(song);
      this.requestClose();
    });
    return button;
  }
}
