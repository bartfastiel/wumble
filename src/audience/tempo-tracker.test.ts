import { describe, expect, it } from 'vitest';
import { HISTORY_LENGTH, MAX_TEMPO, MIN_TEMPO, PHRASE_PAUSE, TempoTracker } from './tempo-tracker';

const oneBeat = (): number => 1;

describe('TempoTracker', () => {
  it('starts from the bpm of the song', () => {
    expect(new TempoTracker(120).tempo).toBe(2);
    expect(new TempoTracker(90).onset(0, 0, oneBeat)).toBe(1.5);
  });

  it('estimates beats per second from the first to the last onset', () => {
    const tracker = new TempoTracker(120);
    tracker.onset(0, 1000, oneBeat);
    expect(tracker.onset(1, 1500, oneBeat)).toBe(2);
    expect(tracker.onset(2, 2500, oneBeat)).toBeCloseTo(2 / 1.5, 6);
    const beats = [1, 2, 1];
    const halves = new TempoTracker(100);
    halves.onset(0, 0, (i) => beats[i] ?? 1);
    expect(halves.onset(2, 3000, (i) => beats[i] ?? 1)).toBe(1); // three beats in three seconds
  });

  it('keeps the last six onsets', () => {
    const tracker = new TempoTracker(60);
    for (let i = 0; i < 10; i++) tracker.onset(i, i * 500, oneBeat);
    expect(tracker.onsets).toHaveLength(HISTORY_LENGTH);
    expect(tracker.onsets[0]).toEqual({ index: 4, serverTime: 2000 });
    expect(tracker.tempo).toBe(2);
  });

  it('drops the history after a phrase pause but keeps the tempo', () => {
    const tracker = new TempoTracker(60);
    tracker.onset(0, 0, oneBeat);
    tracker.onset(1, 500, oneBeat);
    tracker.onset(2, 500 + PHRASE_PAUSE + 1, oneBeat);
    expect(tracker.onsets).toEqual([{ index: 2, serverTime: 3501 }]);
    expect(tracker.tempo).toBe(2);
    expect(tracker.onset(3, 4001, oneBeat)).toBe(2);
  });

  it('starts over when the position goes backwards', () => {
    const tracker = new TempoTracker(60);
    tracker.onset(5, 0, oneBeat);
    tracker.onset(6, 400, oneBeat);
    tracker.onset(2, 800, oneBeat);
    expect(tracker.onsets).toEqual([{ index: 2, serverTime: 800 }]);
    expect(tracker.tempo).toBe(2.5);
  });

  it('clamps the estimate to 0.3 … 12 beats per second', () => {
    const slow = new TempoTracker(60);
    slow.onset(0, 0, oneBeat);
    expect(slow.onset(1, 2900, () => 0.5)).toBe(MIN_TEMPO); // half a beat in 2.9 s, still within the phrase
    const fast = new TempoTracker(60);
    fast.onset(0, 0, oneBeat);
    expect(fast.onset(1, 60, oneBeat)).toBe(MAX_TEMPO);
  });

  it('ignores spans that are too short or carry no beats', () => {
    const tracker = new TempoTracker(60);
    tracker.onset(0, 0, oneBeat);
    expect(tracker.onset(1, 40, oneBeat)).toBe(1);
    expect(tracker.onset(2, 1000, () => 0)).toBe(1);
  });
});
