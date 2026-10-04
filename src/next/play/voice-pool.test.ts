import { describe, expect, it } from 'vitest';
import { VOICES } from '../engine/layout';
import { VoicePool } from './voice-pool';

describe('VoicePool', () => {
  it('gives each finger its own voice and keeps it', () => {
    const pool = new VoicePool();
    const a = pool.acquire(1);
    const b = pool.acquire(2);
    expect(a).not.toBe(b);
    expect(pool.acquire(1)).toBe(a);
    expect(pool.voiceOf(2)).toBe(b);
  });

  it('hands out the voice that has been quiet the longest', () => {
    const pool = new VoicePool();
    for (let p = 0; p < VOICES; p++) pool.acquire(p);
    pool.release(3, 100);
    pool.release(5, 50);
    expect(pool.acquire(42)).toBe(5);
    expect(pool.acquire(43)).toBe(3);
  });

  it('forgets a released finger', () => {
    const pool = new VoicePool();
    pool.acquire(7);
    expect(pool.release(7, 1)).toBe(0);
    expect(pool.release(7, 2)).toBeUndefined();
    expect(pool.voiceOf(7)).toBeUndefined();
  });

  it('takes a voice from a held finger when all are busy', () => {
    const pool = new VoicePool();
    for (let p = 0; p < VOICES; p++) pool.acquire(p);
    expect(pool.acquire(99)).toBe(0);
    expect(pool.voiceOf(99)).toBe(0);
  });
});
