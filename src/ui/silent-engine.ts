// Without Web Audio (some WebKit builds) the field still plays – silently: the same clock, no sound.
import type { AudioEngine, VoiceHandle } from '../audio/engine';

const silentVoice: VoiceHandle = {
  release: () => {
    // nothing sounds, nothing to stop
  },
};

export const hasWebAudio = (): boolean => typeof AudioContext !== 'undefined';

export const silentEngine = (): AudioEngine => {
  const now = (): number => performance.now() / 1000;
  return {
    ensure: now,
    fadeIn: () => undefined,
    now,
    melody: () => silentVoice,
    chord: () => silentVoice,
    bass: () => silentVoice,
    drum: () => undefined,
    setCombi: () => Promise.resolve(),
    releaseAll: () => undefined,
  };
};
