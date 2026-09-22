// Settings under one localStorage key. Loading is tolerant: an unknown or missing value keeps its default, so a
// stored file from an older version never stops the app from starting.
import type { CombiId } from '../audio/engine';
import { COMBI_IDS } from '../audio/engine';
import { KEYS } from '../theory/keys';
import { STYLE_IDS, type StyleId, STYLES } from '../theory/styles';
import { TUNING_IDS, type TuningId } from '../theory/tuning';
import {
  DEFAULTS,
  DIFFICULTIES,
  type Difficulty,
  isTempo,
  LABEL_SETTINGS,
  type LabelSetting,
  LOOP_BARS,
  PLAY_MODES,
  type PlayMode,
  SCHEMA_IDS,
  type SchemaId,
  type Settings,
} from './settings';

export const STORAGE_KEY = 'wumble';

// The part of localStorage that is used
export interface SettingsStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

type Stored = Readonly<Record<string, unknown>>;
const isRecord = (value: unknown): value is Stored => typeof value === 'object' && value !== null;

// The stored value when it is one of the ids, otherwise undefined
const oneOf = <T extends string>(ids: readonly T[], value: unknown): T | undefined => ids.find((id) => id === value);

const signatureOf = ({ signature }: Stored): number =>
  typeof signature === 'number' && KEYS.some((key) => key.signature === signature) ? signature : DEFAULTS.signature;

// Settings from whatever was stored: unknown or missing values fall back to the defaults
export const settingsFrom = (stored: unknown): Settings => {
  if (!isRecord(stored)) return DEFAULTS;
  const style: StyleId = oneOf(STYLE_IDS, stored.style) ?? DEFAULTS.style;
  const tuning: TuningId = oneOf(TUNING_IDS, stored.tuning) ?? DEFAULTS.tuning;
  const mode: PlayMode = oneOf(PLAY_MODES, stored.mode) ?? DEFAULTS.mode;
  const combi: CombiId = oneOf(COMBI_IDS, stored.combi) ?? DEFAULTS.combi;
  const labels: LabelSetting = oneOf(LABEL_SETTINGS, stored.labels) ?? DEFAULTS.labels;
  const difficulty: Difficulty = oneOf(DIFFICULTIES, stored.difficulty) ?? DEFAULTS.difficulty;
  const schema: SchemaId = oneOf(SCHEMA_IDS, stored.schema) ?? DEFAULTS.schema;
  return {
    signature: signatureOf(stored),
    style,
    tuning,
    mode,
    combi,
    labels,
    german: Boolean(stored.german),
    difficulty,
    tempo: isTempo(stored.tempo) ? Math.round(stored.tempo) : STYLES[style].tempo,
    schema,
    loopBars: LOOP_BARS.find((bars) => bars === stored.loopBars) ?? DEFAULTS.loopBars,
    publicUrl: typeof stored.publicUrl === 'string' ? stored.publicUrl : DEFAULTS.publicUrl,
  };
};

export const loadSettings = (storage: SettingsStorage): Settings => {
  try {
    return settingsFrom(JSON.parse(storage.getItem(STORAGE_KEY) ?? 'null'));
  } catch {
    return DEFAULTS;
  }
};

export const saveSettings = (storage: SettingsStorage, settings: Settings): void => {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Storage may be full or blocked (private mode); playing goes on without persistence
  }
};
