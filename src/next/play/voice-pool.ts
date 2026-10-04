// Which synth voice a finger plays. A released voice still rings for a moment, so a new finger takes the voice that
// has been quiet the longest.
import { VOICES } from '../engine/layout';

export class VoicePool {
  private readonly owners: (number | undefined)[] = Array.from({ length: VOICES }, () => undefined);
  private readonly releasedAt: number[] = Array.from({ length: VOICES }, () => -Infinity);

  acquire(pointer: number): number {
    const own = this.owners.indexOf(pointer);
    if (own >= 0) return own;
    let best = -1;
    for (let v = 0; v < VOICES; v++) {
      if (this.owners[v] !== undefined) continue;
      if (best < 0 || (this.releasedAt[v] ?? 0) < (this.releasedAt[best] ?? 0)) best = v;
    }
    // Every voice held: the oldest finger gives its voice up
    const voice = best >= 0 ? best : 0;
    this.owners[voice] = pointer;
    return voice;
  }

  release(pointer: number, now: number): number | undefined {
    const voice = this.owners.indexOf(pointer);
    if (voice < 0) return undefined;
    this.owners[voice] = undefined;
    this.releasedAt[voice] = now;
    return voice;
  }

  voiceOf(pointer: number): number | undefined {
    const voice = this.owners.indexOf(pointer);
    return voice < 0 ? undefined : voice;
  }
}
