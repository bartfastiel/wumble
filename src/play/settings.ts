// The persistent settings of the playing field and their defaults.
import type { CombiId } from '../audio/engine';
import type { LabelMode } from '../theory/labels';
import { type StyleId, STYLES } from '../theory/styles';
import type { TuningId } from '../theory/tuning';

// Two hands by default: the map holds the chord, the field plays the tone. Auto-harmony lets the field choose
// the chord as well, so one hand is enough.
export const PLAY_MODES = ['twoHands', 'autoHarmony'] as const;
export type PlayMode = (typeof PLAY_MODES)[number];

// "Show me what you do": off, or one of the theory's label modes
export const LABEL_SETTINGS = ['off', 'names', 'notes', 'solfege', 'degrees', 'functions'] as const;
export type LabelSetting = 'off' | LabelMode;

// Levels of the learning mode ("premonition"): from medium on the current dot stays hidden for a while
export const DIFFICULTIES = ['easy', 'medium', 'hard'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

// Chord source of the band: follow the play, or a schema running bar by bar
export const SCHEMA_IDS = ['follow', 'blues', 'pop', 'canon', 'andalusian', 'turnaround'] as const;
export type SchemaId = (typeof SCHEMA_IDS)[number];

export const COMBI_IDS: readonly CombiId[] = [
  'epiano',
  'bell',
  'organ',
  'piano',
  'strings',
  'church',
  'pop',
  'jazzTrio',
  'guitar',
];

export const LOOP_BARS = [1, 2, 4] as const;
export type LoopBars = (typeof LOOP_BARS)[number];

export const TEMPO_MIN = 60;
export const TEMPO_MAX = 160;
export const clampTempo = (bpm: number): number => Math.min(TEMPO_MAX, Math.max(TEMPO_MIN, Math.round(bpm)));
export const isTempo = (value: unknown): value is number =>
  typeof value === 'number' && value >= TEMPO_MIN && value <= TEMPO_MAX;

export interface Settings {
  readonly signature: number; // key signature: sharps positive, flats negative
  readonly style: StyleId;
  readonly tuning: TuningId;
  readonly mode: PlayMode;
  readonly combi: CombiId;
  readonly labels: LabelSetting;
  readonly german: boolean; // H instead of B
  readonly difficulty: Difficulty;
  readonly tempo: number; // bpm of the band
  readonly schema: SchemaId;
  readonly loopBars: LoopBars; // length of a loop layer
  readonly publicUrl: string; // address listeners open; empty until configured
}

export const DEFAULTS: Settings = {
  signature: 0,
  style: 'classical',
  tuning: 'equal',
  mode: 'twoHands',
  combi: 'epiano',
  labels: 'off',
  german: false,
  difficulty: 'easy',
  tempo: STYLES.classical.tempo,
  schema: 'follow',
  loopBars: 2,
  publicUrl: '',
};

// Choosing a style applies its suggestions: the sound always, the tuning when it has one, the tempo unless the band
// is playing and keeps its beat
export const styleSettings = (style: StyleId, bandRunning = false): Partial<Settings> => {
  const { combi, tuning, tempo } = STYLES[style];
  return {
    style,
    combi,
    ...(tuning === undefined ? {} : { tuning }),
    ...(bandRunning ? {} : { tempo }),
  };
};
