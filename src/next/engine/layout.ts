// The blocks the page and the synth share. Mirrors the constants at the top of synth/src/lib.rs.
//
// Controls travel page → audio thread, meters audio thread → page. With cross-origin isolation both live in shared
// memory; the controls then carry a sequence number in front (a seqlock), so the audio thread never reads a voice
// half-written – a new note number with the old pitch would be heard for one block.

export const VOICES = 8;
export const VOICE_STRIDE = 6; // gate, note, midi, dynamics, vibrato rate, vibrato depth
export const GLOBALS = VOICES * VOICE_STRIDE; // volume, reverb
export const CONTROL_LEN = GLOBALS + 2;
export const METER_STRIDE = 3; // level, dynamics, active
export const METER_LEN = VOICES * METER_STRIDE + 1; // + output peak

export interface VoiceTarget {
  readonly gate: boolean;
  readonly note: number;
  readonly midi: number;
  readonly dynamics: number;
  readonly vibratoRate: number; // Hz
  readonly vibratoDepth: number; // 0 … 1
}

export interface VoiceMeter {
  readonly level: number;
  readonly dynamics: number;
  readonly active: boolean;
}

export const writeVoice = (controls: Float32Array, voice: number, target: VoiceTarget): void => {
  controls.set(
    [target.gate ? 1 : 0, target.note, target.midi, target.dynamics, target.vibratoRate, target.vibratoDepth],
    voice * VOICE_STRIDE,
  );
};

export const readMeter = (meters: Float32Array, voice: number): VoiceMeter => {
  const at = voice * METER_STRIDE;
  return {
    level: meters[at] ?? 0,
    dynamics: meters[at + 1] ?? 0,
    active: (meters[at + 2] ?? 0) > 0.5,
  };
};

export const peakOf = (meters: Float32Array): number => meters[VOICES * METER_STRIDE] ?? 0;

export const defaultControls = (): Float32Array => {
  const controls = new Float32Array(CONTROL_LEN);
  controls[GLOBALS] = 1; // volume
  controls[GLOBALS + 1] = 0.35; // reverb
  return controls;
};

// ---- seqlock over shared memory --------------------------------------------------------------------------------

export const SHARED_CONTROL_BYTES = 4 + CONTROL_LEN * 4;

export interface SharedControls {
  readonly sequence: Int32Array;
  readonly values: Float32Array;
}

export const sharedControls = (buffer: SharedArrayBuffer | ArrayBuffer): SharedControls => ({
  sequence: new Int32Array(buffer, 0, 1),
  values: new Float32Array(buffer, 4, CONTROL_LEN),
});

// Writer: odd while writing, even when done
export const publish = (shared: SharedControls, controls: Float32Array): void => {
  Atomics.add(shared.sequence, 0, 1);
  shared.values.set(controls);
  Atomics.add(shared.sequence, 0, 1);
};

// Reader: copies only a consistent state; returns false (and leaves `into` alone) while a write is under way
export const snapshot = (shared: SharedControls, into: Float32Array): boolean => {
  const before = Atomics.load(shared.sequence, 0);
  if (before % 2 !== 0) return false;
  into.set(shared.values);
  return Atomics.load(shared.sequence, 0) === before;
};
