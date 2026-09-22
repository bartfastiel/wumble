// Tap tempo: the mean of the last four taps, from the second tap on; a pause over two seconds starts over.
import type { Clock } from './clock';

const TAPS = 4;
const RESTART_AFTER = 2; // seconds

export interface TapTempo {
  tap(): number | null; // bpm, null until a second tap gives an interval
}

export const createTapTempo = (clock: Clock): TapTempo => {
  const taps: number[] = [];
  return {
    tap() {
      const now = clock.now();
      const last = taps.at(-1);
      if (last !== undefined && now - last > RESTART_AFTER) taps.length = 0;
      taps.push(now);
      if (taps.length > TAPS) taps.shift();
      const span = now - Math.min(...taps);
      return taps.length < 2 || span <= 0 ? null : (60 * (taps.length - 1)) / span;
    },
  };
};
