// Loop: record the melody and repeat it in time with the band. Only with the band – it gives
// the beat and the clock. Arming starts the recording at the next bar start; it lasts `loopBars` bars and ends by itself,
// then the layer keeps playing as a loop and the next arming lays the next layer over it (overdub). Recorded are the
// melody events from press/release as { t, dur, chord, tone } in beats; the chord is the one the tone sounded with. No
// quantisation – the human timing stays. All layers refer to the band's bar counter (position in the round = bar
// counter mod length), so the layers fit each other and the schema, also after stop and start. A tone reaching past
// the recording end is cut there. A layer without events is dropped.
import { BEATS_PER_BAR } from './patterns';
import type { Layer, NoteEvent, Player } from './player';
import type { Scheduler } from './scheduler';

export const LOOP_BARS = [1, 2, 4] as const;
export type LoopBars = (typeof LOOP_BARS)[number];
export const LOOP_BARS_DEFAULT: LoopBars = 2;
const MIN_DURATION = 0.125; // a thirty-second note

export type PointerId = number | string; // a finger, or a keyboard key of the play module

export type LoopPhase = 'idle' | 'armed' | 'recording';
export interface Recording {
  readonly startPos: number;
  readonly endPos: number;
  readonly done: boolean; // the layer is in the loop already, late key presses still land in it
}

export interface LooperOptions {
  readonly player: Player;
  readonly scheduler: Scheduler;
  readonly onChange?: () => void; // arming, recording start and end, layers added or removed
}

export interface Looper {
  loopBars(): LoopBars;
  setLoopBars(bars: LoopBars): void;
  record(): void; // arm; before the start it disarms again, during a recording it does nothing
  down(id: PointerId, chord: number, tone: number, time: number): void; // melody key pressed at audio time
  up(id: PointerId, time: number): void; // released
  layers(): readonly Layer[];
  remove(index: number): void;
  clear(): void;
  recording(): Recording | null;
  phase(): LoopPhase;
}

interface Open {
  readonly event: NoteEvent;
  readonly position: number; // beats
}
interface Session {
  readonly startPos: number;
  readonly endPos: number;
  readonly layer: Layer;
  readonly open: Map<PointerId, Open>;
  done: boolean;
}

export const createLooper = (options: LooperOptions): Looper => {
  const { player, scheduler, onChange } = options;
  let loopBars: LoopBars = LOOP_BARS_DEFAULT;
  let session: Session | null = null;

  const changed = (): void => onChange?.();
  const now = (): number => scheduler.beatAt(scheduler.now());

  // From the player with the end of a planning window: when the lookahead reaches the recording end the layer is
  // taken over and plays on; only when the present is past it too the recording closes
  const tick = (to: number): void => {
    if (session === null) return;
    if (!session.done && to >= session.endPos) {
      session.done = true;
      player.addLayer(session.layer);
      changed();
    }
    if (session.done && now() >= session.endPos) {
      if (session.layer.events.length === 0) player.removeLayer(player.layers().indexOf(session.layer));
      session = null;
      changed();
    }
  };
  player.listen({
    reset: () => {
      // The timeline restarted (band stopped): a running recording is void, the layers stay
      session = null;
      changed();
    },
    window: (_, to) => {
      tick(to);
    },
  });

  return {
    loopBars: () => loopBars,
    setLoopBars(bars) {
      loopBars = bars;
    },
    record() {
      if (!scheduler.running()) return;
      const position = now();
      if (session !== null) {
        if (position < session.startPos) session = null;
        changed();
        return;
      }
      const startPos = (Math.floor(position / BEATS_PER_BAR) + 1) * BEATS_PER_BAR;
      session = {
        startPos,
        endPos: startPos + loopBars * BEATS_PER_BAR,
        layer: { bars: loopBars, events: [] },
        open: new Map(),
        done: false,
      };
      scheduler.at(scheduler.timeAt(startPos), changed);
      changed();
    },
    down(id, chord, tone, time) {
      if (session === null) return;
      const position = scheduler.beatAt(time);
      if (position < session.startPos || position >= session.endPos) return;
      // the duration reaches to the recording end for now, in case the finger stays
      const event: NoteEvent = {
        t: position % (session.layer.bars * BEATS_PER_BAR),
        dur: session.endPos - position,
        chord,
        tone,
      };
      session.layer.events.push(event);
      session.open.set(id, { event, position });
    },
    // Released: the duration up to here, at most to the recording end, at least a thirty-second
    up(id, time) {
      const open = session?.open.get(id);
      if (session === null || open === undefined) return;
      session.open.delete(id);
      open.event.dur = Math.max(MIN_DURATION, Math.min(scheduler.beatAt(time), session.endPos) - open.position);
    },
    layers: () => player.layers(),
    remove(index) {
      player.removeLayer(index);
      changed();
    },
    clear() {
      player.clearLayers();
      changed();
    },
    recording: () =>
      session === null ? null : { startPos: session.startPos, endPos: session.endPos, done: session.done },
    phase() {
      if (session === null) return 'idle';
      const position = now();
      if (position < session.startPos) return 'armed';
      return position < session.endPos ? 'recording' : 'idle';
    },
  };
};
