// Styles as their own scale: twelve semitones, the ones the style uses standing tall. Major, blues and pentatonic
// have shapes you learn to recognise after seeing them twice – which is the point of showing them instead of naming them.
import { t } from '../../i18n';
import { STYLE_IDS, STYLES, type StyleId } from '../../theory/styles';
import { choice, type Choice, type ChoiceItem } from '../widgets/choice';
import { pattern } from '../widgets/pattern';

const scaleArt = (id: StyleId): SVGSVGElement => {
  const { scale } = STYLES[id];
  const steps = new Set<number>(scale);
  return pattern({ values: Array.from({ length: 12 }, (_, i) => (steps.has(i) ? 1 : 0.12)), width: 58, height: 20 });
};

export const styleTiles = (current: StyleId, onPick: (id: StyleId) => void): Choice<StyleId> => {
  const items: ChoiceItem<StyleId>[] = STYLE_IDS.map((id) => ({
    value: id,
    label: t(`theory.style.${id}`),
    art: () => scaleArt(id),
  }));
  return choice(items, current, onPick, 3);
};
