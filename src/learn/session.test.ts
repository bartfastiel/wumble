import { describe, expect, it, vi } from 'vitest';
import { keyBySignature } from '../theory/keys';
import { buildModel } from '../theory/model';
import { STYLES } from '../theory/styles';
import { type FieldSpot, learnSpot } from './learn-spot';
import { DOT_MOVE_MS, FLOATER_MS, visibleGroups } from './geometry';
import { LEVELS } from './levels';
import { Records, type RecordStorage } from './records';
import { type Finish, LearnSession } from './session';
import { parseSong, type Song } from './song-notation';
import { SONGS } from './songs';

const songNamed = (title: string): Song => {
  const song = SONGS.find((candidate) => candidate.title === title);
  if (song === undefined) throw new Error(`missing song ${title}`);
  return song;
};
// C D E F G:2 G:2 A A A A G:4 … at 110 bpm: one beat = 545.45 ms
const entchen = songNamed('Alle meine Entchen');
const BEAT = 60000 / entchen.bpm;
const cMajor = buildModel(keyBySignature(0), 'classical');
const home = cMajor.home;
// The spots of the first notes, as learnSpot places them
const spotOf = (midi: number): FieldSpot => {
  const spot = learnSpot(cMajor, { midi, degree: 0, root: 0, beats: 1 });
  if (spot === null) throw new Error(`${String(midi)} is not on the field`);
  return spot;
};
const C = spotOf(60);
const D = spotOf(62);
const E = spotOf(64);
const F = spotOf(65);
const G = spotOf(67);
const elsewhere = { chord: (home + 1) % cMajor.chords.length, tone: C.tone };

const memory = (): RecordStorage => {
  const data = new Map<string, string>();
  return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
};

// Two notes, the first of them off the field (C♯ is not in the major scale)
const offField = parseSong({ title: 'Off', k: 0, bpm: 120, group: 'exercises', notes: 'C#4/I C4/I' });
const twoNotes = parseSong({ title: 'Two', k: 0, bpm: 120, group: 'exercises', notes: 'C4/I D4/I' });

describe('LearnSession', () => {
  it('starts a song with its own key and style, placed on the field', () => {
    const session = new LearnSession(new Records(null));
    session.start(songNamed('Hava Nagila'), 'easy', 1000);
    expect(session.song?.title).toBe('Hava Nagila');
    expect(session.levelId).toBe('easy');
    expect(session.model?.key.signature).toBe(1);
    expect(session.model?.style).toBe(STYLES.harmonicMinor);
    expect(session.placed).toHaveLength(songNamed('Hava Nagila').notes.length);
    expect(session.pos).toBe(0);
    expect(session.score).toBe(0);
    expect(session.hold).toBeNull();
    expect(session.toneStartedAt).toBe(1000);
    expect(session.done).toBe(false);
    expect(session.groups(60)).toEqual(visibleGroups(session.placed, 0, LEVELS.easy, 60));
  });

  it('is idle without a song: defaults, no reactions', () => {
    const session = new LearnSession(new Records(null));
    expect(session.song).toBeNull();
    expect(session.levelId).toBeNull();
    expect(session.model).toBeNull();
    expect(session.placed).toEqual([]);
    expect(session.pos).toBe(0);
    expect(session.score).toBe(0);
    expect(session.hold).toBeNull();
    expect(session.anim).toBeNull();
    expect(session.ringAnim).toBeNull();
    expect(session.toneStartedAt).toBe(0);
    expect(session.floaters).toEqual([]);
    expect(session.done).toBe(false);
    expect(session.visibility(500)).toBe(1);
    expect(session.groups(60)).toEqual([]);
    expect(session.animating(500)).toBe(false);
    expect(session.press(1, C, 500)).toBeNull();
    session.release(1, 600);
    session.tick(700);
    expect(session.pos).toBe(0);
  });

  it('advances when the dot has run down while the finger still rests', () => {
    const onHit = vi.fn();
    const onAdvance = vi.fn();
    const session = new LearnSession(new Records(null), { onHit, onAdvance });
    session.start(entchen, 'easy', 0);
    expect(session.press(1, C, 100)).toBeNull();
    expect(session.hold).toEqual({ id: 1, spot: C, t0: 100, dur: BEAT });
    expect(onHit).toHaveBeenCalledWith(0);
    expect(session.animating(100)).toBe(true);
    session.tick(100 + BEAT - 1);
    expect(session.pos).toBe(0);
    session.tick(100 + BEAT);
    expect(session.pos).toBe(1);
    expect(session.hold).toBeNull();
    expect(session.anim).toEqual({ from: C, t0: 100 + BEAT });
    expect(session.ringAnim).toBeNull();
    expect(session.toneStartedAt).toBe(100 + BEAT);
    expect(onAdvance).toHaveBeenCalledWith(1);
    // The resting finger does not play the next tone; a new press does
    session.tick(100 + 5 * BEAT);
    expect(session.pos).toBe(1);
    session.press(1, D, 100 + 5 * BEAT);
    expect(session.hold?.spot).toEqual(D);
  });

  it('advances on an early release and clears the animations after DOT_MOVE_MS', () => {
    const session = new LearnSession(new Records(null));
    session.start(entchen, 'easy', 0);
    session.press(7, C, 1000);
    session.release(8, 1050); // another finger
    expect(session.pos).toBe(0);
    session.release(7, 1100);
    expect(session.pos).toBe(1);
    expect(session.anim).toEqual({ from: C, t0: 1100 });
    session.release(7, 1200); // nothing held
    session.tick(1100 + DOT_MOVE_MS - 1);
    expect(session.anim).not.toBeNull();
    session.tick(1100 + DOT_MOVE_MS);
    expect(session.anim).toBeNull();
    expect(session.animating(1100 + DOT_MOVE_MS)).toBe(false);
  });

  it('moves the rings inwards when the same tone follows', () => {
    const session = new LearnSession(new Records(null));
    session.start(entchen, 'easy', 0);
    for (const [i, spot] of [C, D, E, F].entries()) {
      session.press(1, spot, i * 1000);
      session.release(1, i * 1000 + 100);
    }
    expect(session.pos).toBe(4);
    session.press(1, G, 5000);
    session.release(1, 5100);
    expect(session.pos).toBe(5);
    expect(session.ringAnim).toEqual({ fromPos: 4, t0: 5100 });
    session.tick(5100 + DOT_MOVE_MS);
    expect(session.ringAnim).toBeNull();
  });

  it('ignores wrong spots in easy, honours the tone alone with toneOnly', () => {
    const session = new LearnSession(new Records(null));
    session.start(entchen, 'easy', 0);
    expect(session.press(1, D, 100)).toBeNull();
    expect(session.press(1, elsewhere, 100)).toBeNull();
    expect(session.hold).toBeNull();
    expect(session.score).toBe(0);
    // The chord under the tone is the other hand's free choice: with toneOnly the right tone is enough,
    // and the hold counts for the note that was due
    expect(session.press(1, elsewhere, 200, true)).toBeNull();
    expect(session.hold?.spot).toEqual(C);
  });

  it('ignores a second finger during a hold', () => {
    const session = new LearnSession(new Records(null));
    session.start(entchen, 'easy', 0);
    session.press(1, C, 100);
    expect(session.press(2, C, 150)).toBeNull();
    expect(session.hold?.id).toBe(1);
    session.release(2, 200);
    expect(session.pos).toBe(0);
    session.release(1, 250);
    expect(session.pos).toBe(1);
  });

  it('scores by invisibility in medium, doubled in hard, with floating numbers', () => {
    const session = new LearnSession(new Records(null));
    session.start(entchen, 'medium', 0);
    expect(session.visibility(100)).toBe(0);
    expect(session.animating(100)).toBe(true);
    expect(session.press(1, C, 100)).toEqual({ delta: 100, spot: C });
    expect(session.floaters).toEqual([{ spot: C, text: '+100', t0: 100, up: true }]);
    session.release(1, 200);
    // Half visible 1000 ms after the tone began: 10 + 45
    expect(session.press(1, D, 1200)).toEqual({ delta: 55, spot: D });
    expect(session.score).toBe(155);
    session.tick(100 + FLOATER_MS - 1);
    expect(session.floaters).toHaveLength(2);
    session.tick(100 + FLOATER_MS);
    expect(session.floaters.map((floater) => floater.text)).toEqual(['+55']);

    session.start(entchen, 'hard', 0);
    expect(session.press(1, C, 100)).toEqual({ delta: 200, spot: C });
    expect(session.score).toBe(200);
  });

  it('charges a wrong tone 100 points at most once per 300 ms', () => {
    const session = new LearnSession(new Records(null));
    session.start(entchen, 'medium', 0);
    expect(session.press(1, D, 1000)).toEqual({ delta: -100, spot: D });
    expect(session.floaters).toEqual([{ spot: D, text: '−100', t0: 1000, up: false }]);
    expect(session.press(1, G, 1300)).toBeNull();
    expect(session.press(1, G, 1301)).toEqual({ delta: -100, spot: G });
    expect(session.score).toBe(-200);
    expect(session.hold).toBeNull();
    // A wrong second finger during a hold still costs
    session.press(1, C, 3000);
    expect(session.press(2, D, 3100)).toEqual({ delta: -100, spot: D });
    expect(session.hold?.id).toBe(1);
  });

  it('finishes without points in easy and cannot be pressed afterwards', () => {
    const onFinish = vi.fn<(result: Finish) => void>();
    const session = new LearnSession(new Records(null), { onFinish });
    session.start(twoNotes, 'easy', 0);
    session.press(1, C, 100);
    session.release(1, 200);
    expect(session.done).toBe(false);
    session.press(1, D, 300);
    session.release(1, 400);
    expect(session.done).toBe(true);
    expect(session.pos).toBe(2);
    expect(onFinish).toHaveBeenCalledWith({ song: twoNotes, scored: false, score: 0, best: null, newRecord: false });
    expect(session.press(1, C, 500)).toBeNull();
    expect(session.groups(60)).toEqual([]);
  });

  it('keeps records from medium on: the first run sets one, a weaker run reports the record', () => {
    const results: Finish[] = [];
    const records = new Records(memory());
    const session = new LearnSession(records, { onFinish: (result) => results.push(result) });
    const play = (level: 'medium' | 'hard', delay: number): void => {
      session.start(twoNotes, level, 0);
      session.press(1, C, delay);
      session.release(1, delay + 10);
      session.press(1, D, delay + 10 + delay);
      session.release(1, delay + 20 + delay);
    };
    play('medium', 100); // invisible both times: 200 points
    play('medium', 1700); // fully visible: 20 points
    play('hard', 100);
    expect(results).toEqual([
      { song: twoNotes, scored: true, score: 200, best: null, newRecord: true },
      { song: twoNotes, scored: true, score: 20, best: 200, newRecord: false },
      { song: twoNotes, scored: true, score: 400, best: null, newRecord: true },
    ]);
    expect(records.get(twoNotes, 'medium')).toBe(200);
    expect(records.get(twoNotes, 'hard')).toBe(400);
  });

  it('cannot play a note that lies off the field', () => {
    const session = new LearnSession(new Records(null));
    session.start(offField, 'medium', 0);
    expect(session.placed[0]?.spot).toBeNull();
    expect(session.press(1, C, 100)).toBeNull();
    expect(session.hold).toBeNull();
    expect(session.score).toBe(0);
  });

  it('stops and forgets the song', () => {
    const session = new LearnSession(new Records(null));
    session.start(entchen, 'medium', 0);
    session.press(1, C, 100);
    session.stop();
    expect(session.song).toBeNull();
    expect(session.hold).toBeNull();
    expect(session.score).toBe(0);
    expect(session.floaters).toEqual([]);
  });

  it('uses the browser records by default', () => {
    const session = new LearnSession();
    session.start(twoNotes, 'medium', 0);
    session.press(1, C, 100);
    session.release(1, 200);
    session.press(1, D, 300);
    session.release(1, 400);
    expect(session.done).toBe(true);
    expect(session.score).toBe(200);
  });
});
