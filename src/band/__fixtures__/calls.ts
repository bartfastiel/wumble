// Helpers for reading what a band wrote into a recording engine, plus the seeded generator the phrase tests use.
import type { Rng } from '../phrases';

// A recorded call of the engine: a drum hit, a voice (numbered) or the release of a voice
export type DrumCall = readonly ['drum', string, number, number];
export type VoiceCall = readonly ['melody' | 'chord' | 'bass', number, number, readonly number[], number];
export type ReleaseCall = readonly ['release', number, number];
export type Call = DrumCall | VoiceCall | ReleaseCall;

export const isVoice = (call: Call): call is VoiceCall => call[0] !== 'drum' && call[0] !== 'release';

// The calls of one voice kind with their releases, voices renumbered from zero
export const laneCalls = (calls: readonly Call[], kind: 'bass' | 'melody' | 'chord'): Call[] => {
  const ids = new Map<number, number>();
  return calls.flatMap((call): Call[] => {
    if (call[0] === kind) {
      ids.set(call[1], ids.size);
      return [[call[0], ids.size - 1, call[2], call[3], call[4]]];
    }
    const id = call[0] === 'release' ? ids.get(call[1]) : undefined;
    return id === undefined ? [] : [['release', id, call[2]]];
  });
};

// The times of one drum lane
export const drumTimes = (calls: readonly Call[], kind: string): number[] =>
  calls.flatMap((call) => (call[0] === 'drum' && call[1] === kind ? [call[2]] : []));

// mulberry32: a small deterministic generator, so a phrase can be replayed exactly
export const mulberry32 = (seed: number): Rng => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
