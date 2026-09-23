// iOS/iPadOS: Web Audio counts as "ambient" and is muted while the silent switch is on – YouTube & Co. are not, because
// they play media. A silent looping <audio> started from a user gesture switches the audio session into playback mode,
// then our sound is audible too. Tiny WAV silence (0.05 s, 8 kHz), handed over as a blob so a strict Content Security
// Policy needs no `data:` in `media-src`.
const SILENCE =
  'UklGRrQBAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YZABAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA';

const silenceUrl = (): string => {
  const bytes = Uint8Array.from(atob(SILENCE), (character) => character.codePointAt(0) ?? 0);
  return URL.createObjectURL(new Blob([bytes], { type: 'audio/wav' }));
};

// One element for the whole session; a refused play (no user gesture) drops it so the next tap tries again
export const createUnlock = (): (() => void) => {
  let element: HTMLAudioElement | null = null;
  return () => {
    if (element) return;
    const audio = new Audio(silenceUrl());
    audio.loop = true;
    audio.setAttribute('playsinline', '');
    audio.volume = 0.01;
    element = audio;
    audio.play().catch(() => {
      element = null;
    });
  };
};
