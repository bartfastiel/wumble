// The end-to-end tests look into the violin through window.__wumbleNext – only outside production builds.
import type { Engine } from './audio';

export interface NextTestHook {
  readonly engine: () => Engine | undefined;
  readonly keyCentre: (index: number) => { x: number; y: number } | null; // relative to the canvas, in CSS pixels
}

declare global {
  interface Window {
    __wumbleNext: NextTestHook;
  }
}

export const exposeForTests = (hook: NextTestHook): void => {
  if (import.meta.env.MODE === 'production') return;
  window.__wumbleNext = hook;
};
