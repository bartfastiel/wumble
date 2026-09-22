// How strongly it pulls from the sounding chord to another one. Rules first, then what this player actually does.
import { type MapChord, pitchesOf, rootOf } from '../theory/chord-maps';
import { pcOf, type PitchClass } from '../theory/pitch';

const key = (chord: MapChord | null): string =>
  chord === null ? '-' : `${String(chord.semitones)}:${chord.shape}:${String(chord.side)}`;

export class Memory {
  private readonly counts = new Map<string, number>();
  private last: MapChord | null = null;
  private length = 0;

  constructor(private readonly span = 40) {}

  remember(chord: MapChord | null): void {
    if (this.last !== null && chord !== null) {
      const edge = `${key(this.last)}>${key(chord)}`;
      this.counts.set(edge, (this.counts.get(edge) ?? 0) + 1);
      this.length++;
      if (this.length > this.span) this.forgetOldest();
    }
    this.last = chord;
  }

  seen(from: MapChord, to: MapChord): number {
    return this.counts.get(`${key(from)}>${key(to)}`) ?? 0;
  }

  private forgetOldest(): void {
    // Fading rather than a queue: every count decays a little, so old habits lose weight over time.
    for (const [edge, count] of this.counts) {
      const faded = count * 0.94;
      if (faded < 0.05) this.counts.delete(edge);
      else this.counts.set(edge, faded);
    }
    this.length = Math.floor(this.span / 2);
  }
}

export interface PullContext {
  readonly from: MapChord | null;
  readonly tonic: PitchClass;
  readonly memory?: Memory;
}

export const pullOf = (to: MapChord, { from, tonic, memory }: PullContext): number => {
  if (from === null) return to.step === 0 && to.side === 0 ? 1 : 0.55;
  if (from === to) return 1;

  const shared = pitchesOf(from, tonic).filter((p) => pitchesOf(to, tonic).includes(p)).length;
  let value = 0.2 + shared * 0.2;
  if (pcOf(rootOf(from, tonic) - rootOf(to, tonic)) === 7) value += 0.4; // a falling fifth
  if (to.step === 0 && to.side === 0) value += 0.16; // the way home
  if (to.step < from.step) value += 0.08; // building tension
  if (Math.abs(to.step - from.step) > 2) value -= 0.12;

  const seen = memory?.seen(from, to) ?? 0;
  value += 0.3 * (1 - Math.exp(-seen / 2.2)); // what has been played often grows, with diminishing returns

  return Math.max(0.14, Math.min(1, value));
};
