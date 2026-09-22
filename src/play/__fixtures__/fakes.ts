// Test doubles: an audio engine that records its voices and a clock that advances on demand.
import type { AudioEngine, CombiId, DrumKind, VoiceHandle } from '../../audio/engine';
import type { Clock } from '../clock';

export type VoiceKind = 'melody' | 'chord' | 'bass';
export interface VoiceRecord {
  readonly kind: VoiceKind;
  readonly freqs: readonly number[];
  readonly at: number;
  readonly gain: number | undefined;
  releasedAt: number | null;
}

export class FakeEngine implements AudioEngine {
  time = 0; // audio time in seconds
  ensured = 0;
  readonly voices: VoiceRecord[] = [];
  readonly drums: { kind: DrumKind; at: number; velocity: number | undefined }[] = [];
  combi: CombiId | null = null;

  ensure(): number {
    this.ensured += 1;
    return this.time;
  }
  now(): number {
    return this.time;
  }
  melody(freq: number, at: number, gain?: number): VoiceHandle {
    return this.voice('melody', [freq], at, gain);
  }
  chord(freqs: readonly number[], at: number, gain?: number): VoiceHandle {
    return this.voice('chord', freqs, at, gain);
  }
  bass(freq: number, at: number, gain?: number): VoiceHandle {
    return this.voice('bass', [freq], at, gain);
  }
  drum(kind: DrumKind, at: number, velocity?: number): void {
    this.drums.push({ kind, at, velocity });
  }
  setCombi(id: CombiId): Promise<void> {
    this.combi = id;
    return Promise.resolve();
  }
  releaseAll(at = this.time): void {
    for (const voice of this.active()) voice.releasedAt = at;
  }

  active(kind?: VoiceKind): VoiceRecord[] {
    return this.voices.filter((voice) => voice.releasedAt === null && (kind === undefined || voice.kind === kind));
  }
  ofKind(kind: VoiceKind): VoiceRecord[] {
    return this.voices.filter((voice) => voice.kind === kind);
  }

  private voice(kind: VoiceKind, freqs: readonly number[], at: number, gain: number | undefined): VoiceHandle {
    const record: VoiceRecord = { kind, freqs, at, gain, releasedAt: null };
    this.voices.push(record);
    return {
      release: (when) => {
        record.releasedAt = when;
      },
    };
  }
}

interface Timer {
  readonly due: number;
  readonly callback: () => void;
  active: boolean;
}

export class FakeClock implements Clock {
  time = 0;
  private timers: Timer[] = [];

  now(): number {
    return this.time;
  }
  after(ms: number, callback: () => void): () => void {
    const timer: Timer = { due: this.time + ms, callback, active: true };
    this.timers.push(timer);
    return () => {
      timer.active = false;
    };
  }
  // Moves the clock forward and fires every timer that comes due on the way, in order
  advance(ms: number): void {
    const target = this.time + ms;
    for (;;) {
      const next = this.timers.filter((timer) => timer.active && timer.due <= target).sort((a, b) => a.due - b.due)[0];
      if (next === undefined) break;
      next.active = false;
      this.time = next.due;
      next.callback();
    }
    this.timers = this.timers.filter((timer) => timer.active);
    this.time = target;
  }
  get pending(): number {
    return this.timers.filter((timer) => timer.active).length;
  }
}
