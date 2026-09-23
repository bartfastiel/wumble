import { describe, expect, it, vi } from 'vitest';
import { STYLES } from '../theory/styles';
import { DEFAULTS } from './settings';
import { createStore } from './store';

describe('createStore', () => {
  it('starts with the defaults and applies patches', () => {
    const store = createStore();
    expect(store.get()).toBe(DEFAULTS);
    store.update({ signature: 2, mode: 'autoHarmony' });
    expect(store.get()).toEqual({ ...DEFAULTS, signature: 2, mode: 'autoHarmony' });
  });

  it('notifies subscribers with the new and the previous settings, until they unsubscribe', () => {
    const store = createStore({ ...DEFAULTS, style: 'blues' });
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    store.update({ tuning: 'just' });
    expect(listener).toHaveBeenCalledWith(
      { ...DEFAULTS, style: 'blues', tuning: 'just' },
      { ...DEFAULTS, style: 'blues' },
    );
    store.update({ tuning: 'just' });
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    store.update({ tuning: 'equal' });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('derives the model from key and style and rebuilds it only when they change', () => {
    const store = createStore();
    const model = store.model();
    expect(model.key.signature).toBe(0);
    expect(model.style).toBe(STYLES.blues); // the app opens on the blues
    expect(store.model()).toBe(model);
    store.update({ tuning: 'just', labels: 'names' });
    expect(store.model()).toBe(model);
    store.update({ style: 'classical' });
    const classical = store.model();
    expect(classical).not.toBe(model);
    expect(classical.style).toBe(STYLES.classical);
    store.update({ signature: 3 });
    expect(store.model().key.signature).toBe(3);
  });
});
