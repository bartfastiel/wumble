// How the field looks and what it says: the three looks as little portraits of themselves, the labels as the label
// they would write on a stripe, the tunings as how far they bend the twelve semitones away from the even grid.
import { t } from '../../i18n';
import { LABEL_SETTINGS, type LabelSetting, LOOKS, type LookId } from '../../play/settings';
import { keyBySignature } from '../../theory/keys';
import { chordLabel, toneLabel } from '../../theory/labels';
import { buildModel } from '../../theory/model';
import { pcOf } from '../../theory/pitch';
import { centsOff, noteFrequency, TUNING_IDS, type TuningId } from '../../theory/tuning';
import { choice, type Choice, type ChoiceItem, type Describe, shortName } from '../widgets/choice';
import { icon } from '../widgets/icons';
import { pattern } from '../widgets/pattern';

const SVG_NS = 'http://www.w3.org/2000/svg';

// "Gewachsen – wellige Kanten, gefächert" is a name and a description in one line; the tiles want them apart
const named = (text: string): { label: string; hint: string } => {
  const [label, ...rest] = text.split(' – ');
  return { label: label ?? text, hint: rest.join(' – ') };
};
const BARS = [
  { x: 6, w: 8, h: 14 },
  { x: 19, w: 12, h: 20 },
  { x: 36, w: 8, h: 14 },
  { x: 47, w: 5, h: 10 },
];

const svgBox = (className: string): SVGSVGElement => {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 56 24');
  svg.setAttribute('class', className);
  return svg;
};

const wavedBar = (bar: (typeof BARS)[number], lean: number): SVGPathElement => {
  const node = document.createElementNS(SVG_NS, 'path');
  const y0 = 12 - bar.h / 2;
  const y1 = 12 + bar.h / 2;
  const left = bar.x - lean;
  const right = bar.x + bar.w + lean;
  const mid = bar.x + bar.w / 2;
  node.setAttribute(
    'd',
    [
      `M${String(left)} ${String(y0)}`,
      `Q${String(mid)} ${String(y0 - 2.6)} ${String(right)} ${String(y0)}`,
      `L${String(bar.x + bar.w - lean)} ${String(y1)}`,
      `Q${String(mid)} ${String(y1 + 2.6)} ${String(left)} ${String(y1)}Z`,
    ].join(''),
  );
  return node;
};

const straightBar = (bar: (typeof BARS)[number]): SVGRectElement => {
  const node = document.createElementNS(SVG_NS, 'rect');
  node.setAttribute('x', String(bar.x));
  node.setAttribute('y', String(12 - bar.h / 2));
  node.setAttribute('width', String(bar.w));
  node.setAttribute('height', String(bar.h));
  node.setAttribute('rx', '1.5');
  return node;
};

// Four stripes drawn the way that look would draw them
const lookArt = (id: LookId): SVGSVGElement => {
  const svg = svgBox(`look-art ${id}`);
  for (const [i, bar] of BARS.entries()) {
    const node = id === 'organic' ? wavedBar(bar, 2.6 - i * 1.5) : straightBar(bar);
    node.setAttribute('class', `b${String(i)}`);
    svg.append(node);
  }
  return svg;
};

export const lookTiles = (
  current: LookId,
  onPick: (id: LookId) => void,
  describe?: Describe<LookId>,
): Choice<LookId> => {
  const items: ChoiceItem<LookId>[] = LOOKS.map((id) => ({
    value: id,
    ...named(t(`play.look.${id}`)),
    caption: shortName(t(`play.look.${id}`)),
    art: () => lookArt(id),
  }));
  return choice(items, current, onPick, 3, describe);
};

const signs = (className: string, texts: readonly string[]): SVGSVGElement => {
  const svg = svgBox(className);
  const step = 56 / (texts.length + 1);
  for (const [i, text] of texts.entries()) {
    const node = document.createElementNS(SVG_NS, 'text');
    node.setAttribute('x', String(step * (i + 1)));
    node.setAttribute('y', '16');
    node.setAttribute('text-anchor', 'middle');
    node.textContent = text;
    svg.append(node);
  }
  return svg;
};

// What a stripe would say: nothing, notes on a staff, or the same three tones written the way that mode writes them
const labelArt = (setting: LabelSetting, german: boolean): Node => {
  if (setting === 'off') return icon('close');
  if (setting === 'notes') return icon('staff');
  const model = buildModel(keyBySignature(0), 'classical');
  // Functions name chords, not tones – so that tile shows what the map would be labelled with
  if (setting === 'functions')
    return signs(
      'label-art',
      [model.home, model.home + 3, model.home + 4]
        .map((index) => model.chords[index])
        .filter((chord) => chord !== undefined)
        .map((chord) => chordLabel(chord, true, { mode: setting, german })),
    );
  return signs(
    'label-art',
    [0, 4, 7].map((semitone) => toneLabel(model.key, model.style, pcOf(semitone), { mode: setting, german })),
  );
};

export const labelTiles = (
  current: LabelSetting,
  german: boolean,
  onPick: (setting: LabelSetting) => void,
  describe?: Describe<LabelSetting>,
): Choice<LabelSetting> => {
  const items: ChoiceItem<LabelSetting>[] = LABEL_SETTINGS.map((setting) => ({
    value: setting,
    label: t(`play.labels.${setting}`),
    hint: t('settings.labels'),
    caption: shortName(t(`play.labels.${setting}`)),
    art: () => labelArt(setting, german),
  }));
  return choice(items, current, onPick, 3, describe);
};

// How far a tuning bends each of the twelve semitones – a flat row is equal temperament
const tuningArt = (id: TuningId): SVGSVGElement => {
  const model = buildModel(keyBySignature(0), 'classical');
  const values = Array.from({ length: 12 }, (_, semitone) => {
    const midi = 60 + semitone;
    const cents = centsOff(noteFrequency(model, id, midi), midi);
    return Math.max(0.06, Math.min(1, 0.5 + cents / 44));
  });
  return pattern({ values, width: 58, height: 20 });
};

export const tuningTiles = (
  current: TuningId,
  onPick: (id: TuningId) => void,
  describe?: Describe<TuningId>,
): Choice<TuningId> => {
  const items: ChoiceItem<TuningId>[] = TUNING_IDS.map((id) => ({
    value: id,
    label: t(`theory.tuning.${id}.name`),
    hint: t(`theory.tuning.${id}.hint`),
    caption: shortName(t(`theory.tuning.${id}.name`)),
    art: () => tuningArt(id),
  }));
  return choice(items, current, onPick, 3, describe);
};

// B or H: the one letter that differs between the two spellings
export const spellingTiles = (
  german: boolean,
  onPick: (german: boolean) => void,
  describe?: Describe<number>,
): Choice<number> => {
  const items: ChoiceItem<number>[] = [
    { value: 0, label: 'B♭ B', hint: t('theory.international'), art: () => signs('label-art', ['B♭', 'B']) },
    { value: 1, label: 'B H', hint: t('settings.german'), art: () => signs('label-art', ['B', 'H']) },
  ];
  return choice(
    items,
    german ? 1 : 0,
    (value) => {
      onPick(value === 1);
    },
    2,
    describe,
  );
};
