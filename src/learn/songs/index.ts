// The song library: 27 public-domain songs in four groups (see the ADR on songs), parsed once at load.
import { parseSong, type Song, type SongGroup } from '../song-notation';
import { BLUES_ROCK_JAZZ } from './blues-rock-jazz';
import { CHILDREN } from './children';
import { EXERCISES } from './exercises';
import { WORLD } from './world';

// Groups of the library in display order; the library sorts the songs of a group alphabetically
export const GROUPS: readonly SongGroup[] = ['children', 'world', 'bluesRockJazz', 'exercises'];

export const SONGS: readonly Song[] = [...CHILDREN, ...WORLD, ...BLUES_ROCK_JAZZ, ...EXERCISES].map(parseSong);
