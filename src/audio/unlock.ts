// iOS/iPadOS: Web Audio counts as "ambient" and is muted while the silent switch is on – YouTube & Co. are not, because
// they play media. A silent looping <audio> started from a user gesture switches the audio session into playback mode,
// then our sound is audible too. Tiny WAV silence (0.05 s, 8 kHz) as a data URL.
const SILENCE =
  'data:audio/wav;base64,UklGRrQBAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YZABAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA';

// One element for the whole session; a refused play (no user gesture) drops it so the next tap tries again
export const createUnlock = (): (() => void) => {
  let element: HTMLAudioElement | null = null;
  return () => {
    if (element) return;
    const audio = new Audio(SILENCE);
    audio.loop = true;
    audio.setAttribute('playsinline', '');
    audio.volume = 0.01;
    element = audio;
    audio.play().catch(() => {
      element = null;
    });
  };
};
