import { afterEach, describe, expect, it, vi } from 'vitest';
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

afterEach(() => {
  vi.unstubAllGlobals();
  created = [];
  refuse = false;
});

describe('createUnlock', () => {
  it('starts one silent, looping, inline audio element and keeps it', async () => {
    vi.stubGlobal('Audio', FakeAudio);
    const unlock = createUnlock();
    unlock();
    unlock();
    await Promise.resolve();
    expect(created).toHaveLength(1);
    const element = created[0];
    expect(element?.src.startsWith('data:audio/wav;base64,')).toBe(true);
    expect(element?.loop).toBe(true);
    expect(element?.volume).toBeCloseTo(0.01, 12);
    expect(element?.attributes.get('playsinline')).toBe('');
  });

  it('tries again on the next call when playing was refused', async () => {
    vi.stubGlobal('Audio', FakeAudio);
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
