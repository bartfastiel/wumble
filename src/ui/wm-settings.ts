// The settings panel: groups built from data – labels, key, style, tuning, play mode, band with
// tempo, loop and radio, sound – and the share link. The groups follow the store; the store is the only state.
import { COMBIS } from '../audio/combis';
import { LOOP_BARS } from '../band/looper';
import { t } from '../i18n';
import {
  clampTempo,
  COMBI_IDS,
  LABEL_SETTINGS,
  LOOKS,
  type LoopBars,
  PLAY_MODES,
  SCHEMA_IDS,
  type Settings,
  styleSettings,
} from '../play/settings';
import { keyLabel, signatureLabel } from '../theory/key-labels';
import { hueOf, type Key, KEYS } from '../theory/keys';
import { STYLE_IDS, STYLES, type StyleGroup, type StyleId } from '../theory/styles';
import { TUNING_IDS } from '../theory/tuning';
import { WmPanel } from './wm-panel';
import { checkbox, counted, type Group, hint, type RadioEntry, radioGroup, segment, tempoRow } from './settings-groups';
import { staffSvg } from './staff-svg';

// Colour swatch, staff with key signature and the count of accidentals in front of a key's name
const keyPreview = (key: Key): DocumentFragment => {
  const fragment = document.createDocumentFragment();
  const swatch = document.createElement('span');
  swatch.className = 'swatch';
  swatch.style.background = `hsl(${String(hueOf(key))} 42% 46%)`;
  const accidentals = document.createElement('span');
  accidentals.className = 'acc';
  accidentals.textContent = signatureLabel(key.signature);
  fragment.append(swatch, staffSvg(key.signature), accidentals);
  return fragment;
};

// "Just – pure thirds and fifths relative to the key": a name with its hint
const named = (name: string, hintText: string): string => `${name} – ${hintText}`;

// Styles in their order, with a heading at every group change (stage, school, nature)
const styleEntries = (): RadioEntry<StyleId>[] => {
  const entries: RadioEntry<StyleId>[] = [];
  let group: StyleGroup | null = null;
  for (const id of STYLE_IDS) {
    if (STYLES[id].group !== group) {
      group = STYLES[id].group;
      entries.push({ heading: t(`theory.group.${group}`) });
    }
    entries.push({ value: id, label: t(`theory.style.${id}`) });
  }
  return entries;
};

export class WmSettings extends WmPanel {
  private readonly groups = new Map<keyof Settings, Group<never>>();
  private readonly loopList = document.createElement('div');
  private radio: Group<boolean> | null = null;

  protected override build(): void {
    this.setHeading(t('ui.settings'));
    this.rebuild();
    const app = this.context;
    app.on('settings', (settings, previous) => {
      if (settings.german !== previous.german)
        this.rebuild(); // the key list is named anew
      else this.follow(settings);
    });
    app.on('loop', () => {
      this.listLayers();
    });
  }

  protected override opened(): void {
    this.follow(this.context.store.get());
    this.radio?.set(this.context.radio.on());
    this.listLayers();
  }

  private follow(settings: Settings): void {
    for (const [key, group] of this.groups) group.set(settings[key] as never);
  }

  private group<K extends keyof Settings>(key: K, group: Group<Settings[K]>): readonly Node[] {
    this.groups.set(key, group);
    return group.nodes;
  }

  private rebuild(): void {
    const app = this.context;
    const { store } = app;
    const settings = store.get();
    const update =
      <K extends keyof Settings>(key: K) =>
      (value: Settings[K]) => {
        store.update({ [key]: value });
      };
    this.groups.clear();
    this.radio = checkbox(t('band.radio'), app.radio.on(), (on) => {
      app.setRadio(on);
    });
    const share = document.createElement('button');
    share.className = 'share';
    share.textContent = t('settings.share');
    share.addEventListener('click', () => {
      this.share(share);
    });
    this.body.replaceChildren(
      ...this.group(
        'labels',
        radioGroup(
          t('settings.labels'),
          LABEL_SETTINGS.map((id) => ({ value: id, label: t(`play.labels.${id}`) })),
          settings.labels,
          update('labels'),
        ),
      ),
      ...this.group('german', checkbox(t('settings.german'), settings.german, update('german'))),
      ...this.group(
        'look',
        radioGroup(
          t('settings.look'),
          LOOKS.map((id) => ({ value: id, label: t(`play.look.${id}`) })),
          settings.look,
          update('look'),
        ),
      ),
      ...this.group(
        'signature',
        radioGroup(
          t('settings.key'),
          [
            { hint: t('settings.keyHint') },
            ...KEYS.map((key) => ({
              value: key.signature,
              label: keyLabel(key, settings.german),
              before: keyPreview(key),
            })),
          ],
          settings.signature,
          update('signature'),
        ),
      ),
      ...this.group(
        'style',
        radioGroup(t('settings.style'), styleEntries(), settings.style, (style) => {
          store.update(styleSettings(style, app.band.running()));
        }),
      ),
      ...this.group(
        'tuning',
        radioGroup(
          t('settings.tuning'),
          TUNING_IDS.map((id) => ({
            value: id,
            label: named(t(`theory.tuning.${id}.name`), t(`theory.tuning.${id}.hint`)),
          })),
          settings.tuning,
          update('tuning'),
        ),
      ),
      ...this.group(
        'mode',
        radioGroup(
          t('settings.mode'),
          PLAY_MODES.map((id) => ({ value: id, label: t(`play.mode.${id}`) })),
          settings.mode,
          update('mode'),
        ),
      ),
      ...this.group(
        'schema',
        radioGroup(
          t('band.title'),
          [
            { hint: t('band.hint') },
            ...SCHEMA_IDS.map((id) => ({
              value: id,
              label: named(t(`band.schema.${id}.name`), t(`band.schema.${id}.hint`)),
            })),
          ],
          settings.schema,
          update('schema'),
        ),
      ),
      ...this.group(
        'tempo',
        tempoRow(
          settings.tempo,
          (bpm) => {
            store.update({ tempo: clampTempo(bpm) });
          },
          () => {
            app.tapTempo();
          },
        ),
      ),
      this.loopRow(settings.loopBars),
      this.loopList,
      ...this.radio.nodes,
      ...this.group(
        'combi',
        radioGroup(
          t('settings.sound'),
          COMBI_IDS.map((id) => ({ value: id, label: named(t(COMBIS[id].name), t(COMBIS[id].hint)) })),
          settings.combi,
          (combi) => {
            store.update({ combi });
            app.engine.ensure(); // a user gesture: load the samples right away
          },
        ),
      ),
      share,
    );
    this.listLayers();
  }

  // Loop: the length as a segment (1 · 2 · 4 bars) in a tempo row; the layers are listed below it
  private loopRow(loopBars: LoopBars): HTMLDivElement {
    const row = document.createElement('div');
    row.className = 'tempo';
    const name = document.createElement('span');
    name.textContent = t('band.loop.title');
    const bars = segment(
      LOOP_BARS.map((n) => ({ value: n, label: counted('band.loop.bars', n) })),
      loopBars,
      (value) => {
        this.context.store.update({ loopBars: value });
      },
    );
    this.groups.set('loopBars', bars);
    row.append(name, bars.element);
    this.loopList.className = 'loops';
    return row;
  }

  // "Layer 1 · 7 tones · 2 bars ✕" per layer, below it "clear all"
  private listLayers(): void {
    const { looper } = this.context;
    const layers = looper.layers();
    if (layers.length === 0) {
      this.loopList.replaceChildren(hint(t('band.loop.empty')));
      return;
    }
    const rows = layers.map((layer, i) => {
      const row = document.createElement('div');
      const name = document.createElement('span');
      name.textContent = t('band.loop.layer', {
        i: i + 1,
        tones: counted('band.loop.tones', layer.events.length),
        bars: counted('band.loop.bars', layer.bars),
      });
      const remove = document.createElement('button');
      remove.textContent = '✕';
      remove.title = t('band.loop.remove');
      remove.addEventListener('click', () => {
        looper.remove(i);
      });
      row.append(name, remove);
      return row;
    });
    const clear = document.createElement('button');
    clear.textContent = t('band.loop.clear');
    clear.addEventListener('click', () => {
      looper.clear();
    });
    this.loopList.replaceChildren(...rows, clear);
  }

  // Sharing: the URL carries every deviation from the defaults as a fragment (#style=blues&key=A …)
  private share(button: HTMLButtonElement): void {
    const app = this.context;
    app.updateUrl();
    const link = location.hash === '' ? t('settings.standard') : location.hash;
    void navigator.clipboard.writeText(location.href).then(() => {
      button.textContent = t('settings.copied', { link });
    });
  }
}
