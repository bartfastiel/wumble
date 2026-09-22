// The chord that is sounding. It keeps sounding until another one is chosen; releasing a finger changes nothing.
// When the band plays it takes over chord and bass, and the choice only counts as state.
import type { AudioEngine, VoiceHandle } from '../audio/engine';
import type { Chord } from '../theory/chords';
import type { ChordFrequencies } from '../theory/tuning';

export interface ChordContext {
  chord(index: number): Chord;
  frequencies(index: number): ChordFrequencies;
  bandRunning(): boolean;
  light(midi: number): void;
}

export const SILENT = -1; // the field of silence: melody without accompaniment

export class ChordVoice {
  current: number = SILENT;
  private voices: VoiceHandle[] = [];

  constructor(
    private readonly engine: AudioEngine,
    private readonly context: ChordContext,
  ) {}

  get sounding(): boolean {
    return this.current !== SILENT;
  }

  choose(index: number, at: number): void {
    if (index === this.current) return;
    this.stop(at);
    this.current = index;
    if (index === SILENT) return;

    if (this.context.bandRunning()) return;
    const { chord, bass } = this.context.frequencies(index);
    this.voices = [this.engine.chord(chord, at), this.engine.bass(bass, at)];
  }

  // The band starts or stops: it takes the chord over, or gives it back
  refresh(at: number): void {
    const index = this.current;
    this.current = SILENT;
    this.stop(at);
    this.choose(index, at);
  }

  stop(at: number): void {
    for (const voice of this.voices) voice.release(at);
    this.voices = [];
  }
}
