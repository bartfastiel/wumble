// The end-to-end tests drive the app through window.__wumble – only outside production builds (`vite build
// --mode e2e`); the production bundle does not contain it.
import type { App } from './app';
import type { WmApp } from './wm-app';

export interface TestHook {
  readonly app: App;
  readonly root: WmApp;
  stripeCentre(tone: number): { x: number; y: number } | null; // relative to the canvas
  spotCentre(chord: number): { x: number; y: number } | null; // a chord of the map, relative to the canvas
  layout(): { width: number; height: number; stripes: number };
}

declare global {
  interface Window {
    __wumble: TestHook;
  }
}

// The e2e tests bring their own relay: `?relay=ws://127.0.0.1:<port>/ws` – never in production
export const relayOverride = (): string | null =>
  import.meta.env.MODE === 'production' ? null : new URLSearchParams(location.search).get('relay');

export const exposeForTests = (root: WmApp): void => {
  if (import.meta.env.MODE === 'production' || root.app === null) return;
  const app = root.app;
  window.__wumble = {
    app,
    root,
    stripeCentre: (tone) => root.field.stripeCentre(tone),
    spotCentre: (chord) => root.field.spotCentre(chord),
    layout: () => root.field.layout(),
  };
};
