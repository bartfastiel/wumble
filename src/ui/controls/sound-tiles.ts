// Sounds by their shape: how fast each one speaks and how long it rings. The melody voice stands for the set,
// because that is the one under the finger.
import { COMBIS } from '../../audio/combis';
import { type Sound, type SoundId, SOUNDS } from '../../audio/sounds';
import { t } from '../../i18n';
import { COMBI_IDS } from '../../play/settings';
import type { CombiId } from '../../audio/engine';
import { choice, type Choice, type ChoiceItem, type Describe } from '../widgets/choice';
import { envelope } from '../widgets/envelope';
import { icon, type IconName } from '../widgets/icons';

// What the thing is, next to how it sounds: two sets built on the same instrument differ in their shape
const INSTRUMENT: Readonly<Record<CombiId, IconName>> = {
  epiano: 'keys',
  bell: 'bell',
  organ: 'pipes',
  piano: 'keys',
  strings: 'strings',
  church: 'pipes',
  pop: 'trio',
  jazzTrio: 'trio',
  guitar: 'guitar',
};

const soundOf = (id: CombiId): Sound => {
  const spec = COMBIS[id].melody;
  const sound: SoundId = typeof spec === 'string' ? spec : spec[0];
  return SOUNDS[sound];
};

const shapeOf = (id: CombiId): SVGSVGElement => {
  const sound = soundOf(id);
  return envelope({
    attack: 'attack' in sound ? sound.attack : 0.02,
    release: sound.release,
    tail: Math.min(1, sound.wet / 1.6),
  });
};

const soundArt = (id: CombiId): Node => {
  const holder = document.createElement('span');
  holder.className = 'sound-art';
  holder.append(icon(INSTRUMENT[id]), shapeOf(id));
  return holder;
};

export const soundTiles = (
  current: CombiId,
  onPick: (id: CombiId) => void,
  describe?: Describe<CombiId>,
  taken: readonly string[] = [], // sounds someone else is already playing on
  named = false, // with the name under the picture, where a first choice has to be made
): Choice<CombiId> => {
  const items: ChoiceItem<CombiId>[] = COMBI_IDS.map((id) => ({
    value: id,
    label: t(COMBIS[id].name),
    hint: t(COMBIS[id].hint),
    art: () => soundArt(id),
    ...(named ? { caption: t(COMBIS[id].name) } : {}),
    ...(taken.includes(id) ? { disabled: true } : {}),
  }));
  return choice(items, current, onPick, 3, describe);
};
