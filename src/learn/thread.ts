// The melody as a way through the field, not as a row of events: where the finger is now, where it goes next, and
// how far off each step still is. The UI draws a thread from this; how much of it a level lets you see is decided
// here, in one place.
import type { FieldSpot, PlacedNote } from './learn-spot';
import type { Level } from './levels';

export interface ThreadStep {
  readonly spot: FieldSpot | null; // null where a song has a rest
  readonly beats: number; // how long the tone lasts: the length of this leg of the way
  readonly pos: number; // where it sits in the song
}

export const THREAD_LENGTH = 7; // as far ahead as the thread is drawn when a level shows the way

// The steps the thread holds from `pos` on. A level with a delay shows only where you are – the way ahead is the
// help that level takes away.
export const threadFrom = (placed: readonly PlacedNote[], pos: number, level: Level): readonly ThreadStep[] => {
  const count = level.delay === 0 ? THREAD_LENGTH : 1;
  return placed.slice(pos, pos + count).map(({ spot, note }, i) => ({ spot, beats: note.beats, pos: pos + i }));
};

// How far up the thread a step sits: every leg as long as its tone, the roots taken so a whole note is not four
// times the way of a quarter. The first step is where the hand is, at zero.
export const threadRise = (steps: readonly ThreadStep[]): readonly number[] => {
  const rises: number[] = [];
  let sum = 0;
  for (const step of steps) {
    rises.push(sum);
    sum += 0.55 + Math.sqrt(Math.max(0.25, step.beats)) * 0.55;
  }
  return rises;
};
