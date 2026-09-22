// Presets: one sound per layer (melody / chord / bass), optionally with its own level instead of the sound's default.
// Names and hints are i18n keys, the settings panel shows them.
import type { MessageKey } from '../i18n';
import { type Sound, type SoundId, SOUNDS } from './sounds';

export const COMBI_IDS = [
  'epiano',
  'bell',
  'organ',
  'piano',
  'strings',
  'church',
  'pop',
  'jazzTrio',
  'guitar',
] as const;
export type CombiId = (typeof COMBI_IDS)[number];
export type Layer = 'melody' | 'chord' | 'bass';
export const LAYERS: readonly Layer[] = ['melody', 'chord', 'bass'];

type LayerSpec = SoundId | readonly [SoundId, number];
export interface Combi {
  readonly name: MessageKey;
  readonly hint: MessageKey;
  readonly melody: LayerSpec;
  readonly chord: LayerSpec;
  readonly bass: LayerSpec;
}

const combi = (id: CombiId, melody: LayerSpec, chord: LayerSpec, bass: LayerSpec): Combi => ({
  name: `audio.combi.${id}.name`,
  hint: `audio.combi.${id}.hint`,
  melody,
  chord,
  bass,
});

export const COMBIS: Readonly<Record<CombiId, Combi>> = {
  epiano: combi('epiano', 'epiano', 'softPad', 'sineBass'),
  bell: combi('bell', 'bell', 'softPad', 'sineBass'),
  organ: combi('organ', 'organ', 'softPad', 'sineBass'),
  piano: combi('piano', 'piano', ['piano', 0.5], ['piano', 1.2]),
  strings: combi('strings', 'violin', 'strings', 'doubleBass'),
  church: combi('church', 'churchOrgan', ['churchOrgan', 0.4], ['churchOrgan', 0.6]),
  pop: combi('pop', 'supersaw', 'pad', 'synthBass'),
  jazzTrio: combi('jazzTrio', 'epiano', ['piano', 0.5], 'doubleBass'),
  guitar: combi('guitar', 'pluck', ['pluck', 0.2], 'doubleBass'),
};

export interface LayerSound {
  readonly sound: Sound;
  readonly gain: number;
}

// Sound and level of one layer of a combi
export const layerOf = (id: CombiId, layer: Layer): LayerSound => {
  const spec = COMBIS[id][layer];
  if (typeof spec === 'string') return { sound: SOUNDS[spec], gain: SOUNDS[spec].gain };
  return { sound: SOUNDS[spec[0]], gain: spec[1] };
};
