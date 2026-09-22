// Records per song and level, kept in localStorage under 'wumble-rekorde': { "alle-meine-entchen/hard": 1234 }.
import type { LevelId } from './levels';
import { slug, type Song } from './song-notation';

export const RECORD_STORAGE_KEY = 'wumble-rekorde';

// The part of the Storage interface the records need – tests inject a plain object
export interface RecordStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const recordKey = (song: Song, level: LevelId): string => `${slug(song.title)}/${level}`;

// Records written by the reference recording name the level in German; they keep counting after the switch
type LegacyLevel = 'leicht' | 'mittel' | 'schwer';
const LEGACY_LEVELS: Readonly<Record<LegacyLevel, LevelId>> = { leicht: 'easy', mittel: 'medium', schwer: 'hard' };
const currentKey = (key: string): string =>
  key.replace(/\/(leicht|mittel|schwer)$/, (_, legacy: string) => `/${LEGACY_LEVELS[legacy as LegacyLevel]}`);

const load = (storage: RecordStorage | null): Map<string, number> => {
  const best = new Map<string, number>();
  try {
    const parsed: unknown = JSON.parse(storage?.getItem(RECORD_STORAGE_KEY) ?? '{}');
    if (typeof parsed === 'object' && parsed !== null) {
      for (const [key, value] of Object.entries(parsed))
        if (typeof value === 'number') best.set(currentKey(key), value);
    }
  } catch {
    // unreadable storage: start without records
  }
  return best;
};

const browserStorage = (): RecordStorage | null => (typeof localStorage === 'undefined' ? null : localStorage);

export class Records {
  private readonly best: Map<string, number>;
  private readonly storage: RecordStorage | null;

  constructor(storage: RecordStorage | null = browserStorage()) {
    this.storage = storage;
    this.best = load(storage);
  }

  get(song: Song, level: LevelId): number | null {
    return this.best.get(recordKey(song, level)) ?? null;
  }

  // Keeps the score when it beats the record and says whether it did
  submit(song: Song, level: LevelId, score: number): boolean {
    const key = recordKey(song, level);
    const best = this.best.get(key);
    if (best !== undefined && score <= best) return false;
    this.best.set(key, score);
    try {
      this.storage?.setItem(RECORD_STORAGE_KEY, JSON.stringify(Object.fromEntries(this.best)));
    } catch {
      // blocked or full storage: the record lives until the page reloads
    }
    return true;
  }
}
