import { describe, expect, it } from 'vitest';
import { DEFAULTS, type Settings } from './settings';
import { loadSettings, saveSettings, type SettingsStorage, settingsFrom, STORAGE_KEY } from './settings-storage';

const memory = (initial?: string): SettingsStorage & { readonly data: Map<string, string> } => {
  const data = new Map<string, string>();
  if (initial !== undefined) data.set(STORAGE_KEY, initial);
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
  };
};

const stored: Settings = {
  ...DEFAULTS,
  signature: 3,
  style: 'harmonicMinor',
  tuning: 'just',
  mode: 'autoHarmony',
  combi: 'piano',
  labels: 'degrees',
  look: 'precise',
  german: true,
  difficulty: 'hard',
  tempo: 88,
  schema: 'canon',
  loopBars: 4,
  publicUrl: 'https://wumble.test/',
};

describe('loadSettings and saveSettings', () => {
  it('write and read the settings under one key', () => {
    const storage = memory();
    saveSettings(storage, stored);
    expect(storage.data.get(STORAGE_KEY)).toBe(JSON.stringify(stored));
    expect(loadSettings(storage)).toEqual(stored);
  });

  it('fall back to the defaults for an empty or broken store', () => {
    expect(loadSettings(memory())).toEqual(DEFAULTS);
    expect(loadSettings(memory('{not json'))).toEqual(DEFAULTS);
    expect(loadSettings(memory('null'))).toEqual(DEFAULTS);
  });

  it('play on when the storage refuses', () => {
    const broken: SettingsStorage = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(loadSettings(broken)).toEqual(DEFAULTS);
    expect(() => {
      saveSettings(broken, DEFAULTS);
    }).not.toThrow();
  });
});

describe('settingsFrom', () => {
  it('reads back everything it wrote', () => {
    expect(settingsFrom(JSON.parse(JSON.stringify(stored)))).toEqual(stored);
  });

  it('keeps the defaults for unknown or missing values', () => {
    expect(settingsFrom(null)).toEqual(DEFAULTS);
    expect(settingsFrom('x')).toEqual(DEFAULTS);
    expect(settingsFrom({})).toEqual(DEFAULTS);
    expect(
      settingsFrom({
        signature: 7,
        style: 'polka',
        tuning: 3,
        mode: 'x',
        combi: 'harp',
        labels: 'y',
        difficulty: 'z',
        schema: 'w',
        loopBars: 3,
        publicUrl: 5,
      }),
    ).toEqual(DEFAULTS);
  });

  it('accepts every key signature the app offers', () => {
    for (const signature of [-6, -1, 0, 1, 6]) expect(settingsFrom({ signature }).signature).toBe(signature);
    expect(settingsFrom({ signature: 99 }).signature).toBe(DEFAULTS.signature);
  });

  it('takes the style tempo when the stored tempo is missing or out of range', () => {
    expect(settingsFrom({ style: 'blues' }).tempo).toBe(96);
    expect(settingsFrom({ style: 'blues', tempo: 300 }).tempo).toBe(96);
    expect(settingsFrom({ tempo: 120.4 }).tempo).toBe(120);
  });
});
