// Everything the band needs, drawn rather than written: the schema as its own bars, the loop length as the number
// of bars it will record. Near-to-home chords stand tall, far ones low, so a schema has a shape of its own.
import { SCHEMATA, type SchemaId } from '../../band/schemata';
import { t } from '../../i18n';
import { LOOP_BARS, type LoopBars, SCHEMA_IDS } from '../../play/settings';
import { choice, type Choice, type ChoiceItem, type Describe } from '../widgets/choice';
import { icon } from '../widgets/icons';
import { pattern } from '../widgets/pattern';

// Distance from home along the circle of fifths, per semitone offset. The steps are wide apart on purpose:
// a schema has to be recognisable as a shape, and a fifth has to look different from a sixth.
const FIFTHS: readonly number[] = [0, 5, 2, 3, 4, 1, 6, 1, 4, 3, 2, 5];
const height = (offset: number): number => Math.max(0.16, 1 - (FIFTHS[offset] ?? 3) * 0.28);

const schemaArt = (id: SchemaId): Node => {
  const { bars } = SCHEMATA[id];
  if (bars === null) return icon('hands'); // the play itself leads
  return pattern({ values: bars.map(height), width: 62, height: 20 });
};

export const schemaTiles = (
  current: SchemaId,
  onPick: (id: SchemaId) => void,
  describe?: Describe<SchemaId>,
): Choice<SchemaId> => {
  const items: ChoiceItem<SchemaId>[] = SCHEMA_IDS.map((id) => ({
    value: id,
    label: t(`band.schema.${id}.name`),
    hint: t(`band.schema.${id}.hint`),
    art: () => schemaArt(id),
  }));
  return choice(items, current, onPick, 3, describe);
};

export const loopTiles = (
  current: LoopBars,
  onPick: (bars: LoopBars) => void,
  describe?: Describe<LoopBars>,
): Choice<LoopBars> => {
  const items: ChoiceItem<LoopBars>[] = LOOP_BARS.map((bars) => ({
    value: bars,
    label: t('band.loop.bars.other', { n: bars }),
    hint: t('band.loop.title'),
    art: () => pattern({ values: Array.from({ length: bars }, () => 1), width: 44, height: 18, gap: 3 }),
  }));
  return choice(items, current, onPick, 3, describe);
};
