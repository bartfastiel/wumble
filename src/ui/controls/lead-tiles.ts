// Who chooses the chords: the field thinking along, your own hand, or a schema running bar by bar. They are one
// question, not two – a schema that chooses while the field also chooses would be two hands on the same harmony.
import { SCHEMATA, type SchemaId } from '../../band/schemata';
import { t } from '../../i18n';
import { SCHEMA_IDS, type Settings } from '../../play/settings';
import { choice, type Choice, type ChoiceItem, type Describe } from '../widgets/choice';
import { contour } from '../widgets/contour';
import { icon } from '../widgets/icons';

// Where a chord sits on the circle of fifths, counted from home with a sign: the dominant is one step up, the
// subdominant one step down. That is the direction a schema moves in, and the thing a bar chart cannot show.
const FIFTHS: readonly number[] = [0, -5, 2, -3, 4, -1, 6, 1, -4, 3, -2, 5];
const level = (offset: number): number => FIFTHS[offset] ?? 0;

// 'auto': the field thinks along · 'hands': you choose on the map · anything else: that schema
export type Lead = 'auto' | 'hands' | SchemaId;

export const leadOf = (settings: Settings): Lead => {
  if (settings.schema !== 'follow') return settings.schema;
  return settings.mode === 'autoHarmony' ? 'auto' : 'hands';
};

// What choosing a lead means for the settings: only one of them may be in charge
export const leadSettings = (lead: Lead): Partial<Settings> => {
  if (lead === 'auto') return { mode: 'autoHarmony', schema: 'follow' };
  if (lead === 'hands') return { mode: 'twoHands', schema: 'follow' };
  return { mode: 'twoHands', schema: lead };
};

const schemaArt = (id: SchemaId): Node => {
  const { bars } = SCHEMATA[id];
  if (bars === null) return icon('hands');
  return contour({ values: bars.map(level), reach: 2, width: 62, height: 22 });
};

const SCHEMATA_WITH_BARS = SCHEMA_IDS.filter((id) => SCHEMATA[id].bars !== null);

// The two that are not schemata come first, set apart by a rule; the schemata follow as their own shapes
export const leadTiles = (
  current: Lead,
  onPick: (lead: Lead) => void,
  describe?: Describe<Lead>,
): { readonly leaders: Choice<Lead>; readonly schemata: Choice<Lead>; set(lead: Lead): void } => {
  const leaders = choice<Lead>(
    [
      {
        value: 'auto',
        label: t('band.lead.auto.name'),
        hint: t('band.lead.auto.text'),
        caption: t('band.lead.auto.name'),
        art: () => icon('onehand'),
      },
      {
        value: 'hands',
        label: t('band.lead.hands.name'),
        hint: t('band.lead.hands.text'),
        caption: t('band.lead.hands.name'),
        art: () => icon('hands'),
      },
    ],
    current,
    onPick,
    2,
    describe,
  );
  const items: ChoiceItem<Lead>[] = SCHEMATA_WITH_BARS.map((id) => ({
    value: id,
    label: t(`band.schema.${id}.name`),
    hint: t(`band.schema.${id}.hint`),
    caption: t(`band.schema.${id}.name`),
    art: () => schemaArt(id),
  }));
  const schemata = choice<Lead>(items, current, onPick, 3, describe);
  return {
    leaders,
    schemata,
    set: (lead) => {
      leaders.set(lead);
      schemata.set(lead);
    },
  };
};
