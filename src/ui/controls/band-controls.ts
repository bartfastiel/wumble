// What the band records into: how many bars a loop layer holds.
import { t } from '../../i18n';
import { LOOP_BARS, type LoopBars } from '../../play/settings';
import { choice, type Choice, type ChoiceItem, type Describe } from '../widgets/choice';
import { pattern } from '../widgets/pattern';

export const loopTiles = (
  current: LoopBars,
  onPick: (bars: LoopBars) => void,
  describe?: Describe<LoopBars>,
): Choice<LoopBars> => {
  const items: ChoiceItem<LoopBars>[] = LOOP_BARS.map((bars) => ({
    value: bars,
    label: t('band.loop.bars.other', { n: bars }),
    hint: t('band.loop.title'),
    caption: t('band.loop.bars.other', { n: bars }),
    art: () => pattern({ values: Array.from({ length: bars }, () => 1), width: 44, height: 18, gap: 3 }),
  }));
  return choice(items, current, onPick, 3, describe);
};
