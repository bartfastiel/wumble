import { describe, expect, it, vi } from 'vitest';
import { RECORD_STORAGE_KEY, recordKey, Records, type RecordStorage } from './records';
import { SONGS } from './songs';

const entchen = SONGS[0];
if (entchen === undefined) throw new Error('no songs');

const memory = (initial: Record<string, string> = {}): RecordStorage & { readonly data: Record<string, string> } => {
  const data = { ...initial };
  return {
    data,
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => {
      data[key] = value;
    },
  };
};

describe('recordKey', () => {
  it('joins the slug of the title and the level', () => {
    expect(recordKey(entchen, 'hard')).toBe('alle-meine-entchen/hard');
  });
});

describe('Records', () => {
  it('starts empty and keeps only scores that beat the record', () => {
    const storage = memory();
    const records = new Records(storage);
    expect(records.get(entchen, 'medium')).toBeNull();
    expect(records.submit(entchen, 'medium', 120)).toBe(true);
    expect(records.submit(entchen, 'medium', 120)).toBe(false);
    expect(records.submit(entchen, 'medium', 80)).toBe(false);
    expect(records.submit(entchen, 'medium', 200)).toBe(true);
    expect(records.get(entchen, 'medium')).toBe(200);
    expect(records.get(entchen, 'hard')).toBeNull();
    expect(JSON.parse(storage.data[RECORD_STORAGE_KEY] ?? '')).toEqual({ 'alle-meine-entchen/medium': 200 });
  });

  it('reads records of the reference, whose levels were named in German', () => {
    const storage = memory({
      [RECORD_STORAGE_KEY]: JSON.stringify({
        'alle-meine-entchen/schwer': 500,
        'alle-meine-entchen/mittel': 'x',
        other: 1,
      }),
    });
    const records = new Records(storage);
    expect(records.get(entchen, 'hard')).toBe(500);
    expect(records.get(entchen, 'medium')).toBeNull();
    expect(records.submit(entchen, 'hard', 600)).toBe(true);
    expect(JSON.parse(storage.data[RECORD_STORAGE_KEY] ?? '')).toEqual({ 'alle-meine-entchen/hard': 600, other: 1 });
  });

  it('survives unreadable or blocked storage and works without any', () => {
    expect(new Records(memory({ [RECORD_STORAGE_KEY]: '{not json' })).get(entchen, 'easy')).toBeNull();
    expect(new Records(memory({ [RECORD_STORAGE_KEY]: '42' })).get(entchen, 'easy')).toBeNull();
    const blocked: RecordStorage = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    const records = new Records(blocked);
    expect(records.submit(entchen, 'hard', 10)).toBe(true);
    expect(records.get(entchen, 'hard')).toBe(10);
    const none = new Records(null);
    expect(none.submit(entchen, 'hard', 10)).toBe(true);
    // Node has no localStorage: the default is no storage
    expect(new Records().submit(entchen, 'hard', 10)).toBe(true);
  });

  it('uses localStorage by default where the browser offers it', () => {
    const storage = memory();
    vi.stubGlobal('localStorage', storage);
    try {
      expect(new Records().submit(entchen, 'easy', 7)).toBe(true);
      expect(new Records().get(entchen, 'easy')).toBe(7);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
