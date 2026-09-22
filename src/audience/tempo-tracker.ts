// Tempo estimate of the player in beats per second from the last onsets: v = Σ beats (from note a to i−1) / (sᵢ − sₐ)
// over up to six onsets, starting from the song's bpm. A pause longer than three seconds is the start of a phrase –
// the history is dropped, the tempo stays. A `pos` going backwards (restart) also starts a fresh history.

export interface Onset {
  readonly index: number;
  readonly serverTime: number;
}

export const HISTORY_LENGTH = 6;
export const PHRASE_PAUSE = 3000;
export const MIN_TEMPO = 0.3;
export const MAX_TEMPO = 12;
const MIN_SPAN = 0.05; // seconds between the first and the last onset for an estimate

export class TempoTracker {
  private history: Onset[] = [];
  private beatsPerSecond: number;

  constructor(bpm: number) {
    this.beatsPerSecond = bpm / 60;
  }

  get tempo(): number {
    return this.beatsPerSecond;
  }

  get onsets(): readonly Onset[] {
    return this.history;
  }

  // Note `index` was hit at `serverTime`; `beatsOf` gives the beats of a note. Returns the new tempo.
  onset(index: number, serverTime: number, beatsOf: (index: number) => number): number {
    const last = this.history.at(-1);
    if (last !== undefined && (serverTime - last.serverTime > PHRASE_PAUSE || index <= last.index)) this.history = [];
    this.history.push({ index, serverTime });
    if (this.history.length > HISTORY_LENGTH) this.history.shift();
    const first = this.history[0];
    if (first === undefined || this.history.length < 2) return this.beatsPerSecond;
    const seconds = (serverTime - first.serverTime) / 1000;
    let beats = 0;
    for (let k = first.index; k < index; k++) beats += beatsOf(k);
    if (seconds > MIN_SPAN && beats > 0) {
      this.beatsPerSecond = Math.max(MIN_TEMPO, Math.min(MAX_TEMPO, beats / seconds));
    }
    return this.beatsPerSecond;
  }
}
