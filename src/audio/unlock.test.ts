import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createUnlock } from './unlock';

let created: FakeAudio[] = [];
let refuse = false;
class FakeAudio {
  loop = false;
  volume = 1;
  readonly attributes = new Map<string, string>();
  constructor(readonly src: string) {
    created.push(this);
  }
  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }
  play(): Promise<void> {
    return refuse ? Promise.reject(new Error('NotAllowedError')) : Promise.resolve();
  }
}

// The blob url the element is given: a real WAV of a few hundred bytes
let blobs: Blob[] = [];

beforeEach(() => {
  vi.stubGlobal('Audio', FakeAudio);
  vi.stubGlobal('URL', {
    createObjectURL: (blob: Blob) => {
      blobs.push(blob);
      return `blob:wumble/${String(blobs.length)}`;
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  created = [];
  blobs = [];
  refuse = false;
});

describe('createUnlock', () => {
  it('starts one silent, looping, inline audio element and keeps it', async () => {
    const unlock = createUnlock();
    unlock();
    unlock();
    await Promise.resolve();
    expect(created).toHaveLength(1);
    const element = created[0];
    // a blob, not a data url: the page's Content Security Policy needs no `data:` in `media-src`
    expect(element?.src.startsWith('blob:')).toBe(true);
    expect(blobs).toHaveLength(1);
    expect(blobs[0]?.type).toBe('audio/wav');
    expect(blobs[0]?.size).toBeGreaterThan(400);
    expect(element?.loop).toBe(true);
    expect(element?.volume).toBeCloseTo(0.01, 12);
    expect(element?.attributes.get('playsinline')).toBe('');
  });

  it('tries again on the next call when playing was refused', async () => {
    refuse = true;
    const unlock = createUnlock();
    unlock();
    await Promise.resolve();
    refuse = false;
    unlock();
    await Promise.resolve();
    unlock();
    expect(created).toHaveLength(2);
  });
});
