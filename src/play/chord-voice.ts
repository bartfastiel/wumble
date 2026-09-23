// The chord that is sounding. One is always chosen – it is what the field measures its tones against – but it does
// not have to be heard: tapping the chosen chord again mutes the accompaniment and leaves the melody alone.
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

export class ChordVoice {
  current = 0; // index into the map; the app sets it to the tonic when a model is built
  accompanying = true; // false: the chord stays chosen, but only the melody is heard
  struck = false; // whether this chord has been played at all – before that, choosing it is not a second tap
  private voices: VoiceHandle[] = [];

  constructor(
    private readonly engine: AudioEngine,
    private readonly context: ChordContext,
  ) {}

  get sounding(): boolean {
    return this.accompanying && this.voices.length > 0;
  }

  // A hand chose this chord: it is heard, whatever the accompaniment did before
  choose(index: number, at: number): void {
    if (index === this.current && this.accompanying && this.struck) return;
    this.stop(at);
    this.current = index;
    this.accompanying = true;
    this.strike(at);
  }

  // The field or the band moved on: the chord changes, but a muted accompaniment stays muted – switching it off is
  // the player's decision, and nothing automatic may take it back
  follow(index: number, at: number): void {
    if (index === this.current && this.struck) return;
    this.stop(at);
    this.current = index;
    this.strike(at);
  }

  // Tapping the chord that is already chosen: the accompaniment steps back, or comes in again
  toggle(at: number): void {
    this.accompanying = !this.accompanying;
    if (this.accompanying) this.strike(at);
    else this.stop(at);
  }

  // The band starts or stops: it takes the chord over, or gives it back
  refresh(at: number): void {
    this.stop(at);
    this.strike(at);
  }

  stop(at: number): void {
    for (const voice of this.voices) voice.release(at);
    this.voices = [];
  }

  private strike(at: number): void {
    if (!this.accompanying) return;
    this.struck = true;
    if (this.context.bandRunning()) return; // the band plays this chord itself
    const { chord, bass } = this.context.frequencies(this.current);
    this.voices = [this.engine.chord(chord, at), this.engine.bass(bass, at)];
  }
}
