// A pressed finger or key: it sounds one tone of the field.
import type { VoiceHandle } from '../audio/engine';

export type PointerId = number | string; // pointerId of a pointer event, or 'k' + code of a keyboard key

export interface Pointer {
  chord: number; // the chord sounding with it; in auto-harmony the field's choice
  readonly tone: number; // index into the tones of the model
  readonly voices: VoiceHandle[];
}
