// A tiny observable store for the settings. The model (key × style) is derived and rebuilt only when they change.
import { keyBySignature } from '../theory/keys';
import { buildModel, type Model } from '../theory/model';
import { STYLES } from '../theory/styles';
import { DEFAULTS, type Settings } from './settings';

export type Listener = (settings: Settings, previous: Settings) => void;

export interface Store {
  get(): Settings;
  model(): Model;
  update(patch: Partial<Settings>): void;
  subscribe(listener: Listener): () => void;
}

const differs = (a: Settings, b: Settings): boolean =>
  (Object.keys(a) as (keyof Settings)[]).some((key) => a[key] !== b[key]);

export const createStore = (initial: Settings = DEFAULTS): Store => {
  let settings = initial;
  let model: Model | null = null;
  const listeners = new Set<Listener>();
  return {
    get: () => settings,
    model: () => {
      const style = STYLES[settings.style];
      if (model?.key.signature !== settings.signature || model.style !== style) {
        model = buildModel(keyBySignature(settings.signature), settings.style);
      }
      return model;
    },
    update: (patch) => {
      const next = { ...settings, ...patch };
      if (!differs(next, settings)) return;
      const previous = settings;
      settings = next;
      for (const listener of listeners) listener(settings, previous);
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
};
