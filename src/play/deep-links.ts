// State in the URL fragment: #blues, #key=A&tuning=just&labels=names, #song=twelve-bar-blues,
// #room=k7m3x. The fragment stays in the browser (never sent, never logged). Short forms without a key are allowed:
// #blues #A #just #hard.
import { keyBySignature, KEYS } from '../theory/keys';
import { pcOf } from '../theory/pitch';
import { STYLE_IDS, type StyleId, STYLES } from '../theory/styles';
import { COMBI_IDS } from '../audio/engine';
import { TUNING_IDS } from '../theory/tuning';
import {
  DEFAULTS,
  DIFFICULTIES,
  isTempo,
  LABEL_SETTINGS,
  LOOKS,
  PLAY_MODES,
  SCHEMA_IDS,
  type Settings,
  styleSettings,
} from './settings';

// The ids as they are written in a link: lower case, exactly as the module spells them
const idOf = <T extends string>(ids: readonly T[], value: string): T | undefined =>
  ids.find((id) => id.toLowerCase() === value);

export type LinkSettings = Pick<
  Settings,
  'signature' | 'style' | 'tuning' | 'mode' | 'combi' | 'labels' | 'look' | 'difficulty' | 'tempo' | 'schema'
>;
export interface LinkExtras {
  readonly song?: string; // the song's title (written as a slug)
  readonly band?: boolean; // the band plays right away
  readonly radio?: boolean; // the band plays the melody itself
  readonly room?: string; // the page starts as a listener of this room – everything else in the fragment is moot
  readonly scan?: boolean; // opens the sheet-scan panel
}
export type ParsedLink = Partial<LinkSettings> & LinkExtras;

// Resolves a slug to a song title; the learn module knows the songs, this module does not
export type SongLookup = (slug: string) => string | undefined;

const ROOM_CODE = /^[a-z0-9]{3,12}$/;

export const slug = (text: string): string =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replaceAll(/^-|-$/g, '');

const LETTER_SEMITONES = 'C.D.EF.G.A.B'; // every letter at its semitone above C
const accidentalShift = (accidental: string): number => {
  if (accidental === '') return 0;
  return /^(#|♯|is)$/.test(accidental) ? 1 : -1;
};

// Key signature of a name like A, Bb, F#, Es, H – for enharmonic doubles the spelling decides (F# vs Gb)
export const signatureByName = (name: string): number | undefined => {
  const text = name.trim();
  const letter = text.charAt(0).toUpperCase();
  const accidental = text.slice(1);
  if (!/^[A-H]$/.test(letter) || !/^(#|♯|b|♭|is|es|s)?$/.test(accidental)) return undefined;
  const shift = accidentalShift(accidental);
  const tonic = pcOf(LETTER_SEMITONES.indexOf(letter === 'H' ? 'B' : letter) + shift);
  const candidates = KEYS.filter((key) => key.tonic === tonic); // sharps first
  return (shift < 0 ? candidates.at(-1) : candidates[0])?.signature;
};

// Key name as written in the link: C, F#, Bb
export const keyNameOf = (signature: number): string => {
  const key = keyBySignature(signature);
  return key.names[key.tonic].replace('♯', '#').replace('♭', 'b');
};

interface Part {
  readonly key: string | null; // null for a short form without "key="
  readonly value: string; // lower-cased
  readonly raw: string;
  readonly findSong: SongLookup;
}
interface Rule {
  readonly keys: readonly string[];
  readonly short: boolean; // also matches without a key
  readonly parse: (part: Part) => ParsedLink | undefined;
}

const idRule = <K extends keyof LinkSettings>(
  key: string,
  field: K,
  ids: readonly (LinkSettings[K] & string)[],
): Rule => ({
  keys: [key],
  short: true,
  parse: ({ value }) => {
    const id = idOf(ids, value);
    return id === undefined ? undefined : { [field]: id };
  },
});
// "band=1" or short "#band" switches on, "band=0" off
const flagRule = (keys: readonly string[], field: 'band' | 'radio'): Rule => ({
  keys,
  short: true,
  parse: ({ key, value }) =>
    key === null && !keys.includes(value) ? undefined : { [field]: key === null || value === '1' },
});

// The order decides for a short form that fits more than one rule: #blues is the style and #pop the sound,
// although both are schemata too
const RULES: readonly Rule[] = [
  idRule('style', 'style', STYLE_IDS),
  idRule('tuning', 'tuning', TUNING_IDS),
  idRule('labels', 'labels', LABEL_SETTINGS),
  idRule('look', 'look', LOOKS),
  idRule('mode', 'mode', PLAY_MODES),
  idRule('sound', 'combi', COMBI_IDS),
  idRule('level', 'difficulty', DIFFICULTIES),
  flagRule(['band'], 'band'),
  flagRule(['radio'], 'radio'),
  {
    keys: ['tempo'],
    short: false,
    parse: ({ value }) => {
      const bpm = Number(value);
      return isTempo(bpm) ? { tempo: Math.round(bpm) } : undefined;
    },
  },
  idRule('schema', 'schema', SCHEMA_IDS),
  {
    keys: ['key'],
    short: true,
    parse: ({ raw }) => {
      const signature = signatureByName(raw);
      return signature === undefined ? undefined : { signature };
    },
  },
  { keys: [], short: true, parse: ({ value }) => (value === 'scan' ? { scan: true } : undefined) },
  { keys: ['room'], short: false, parse: ({ value }) => (ROOM_CODE.test(value) ? { room: value } : undefined) },
  {
    keys: ['song'],
    short: true,
    parse: ({ raw, findSong }) => {
      const song = findSong(slug(raw));
      return song === undefined ? undefined : { song };
    },
  },
];

const decode = (hash: string): string => {
  const text = hash.replace(/^#\/?/, '');
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
};

const partOf = (text: string, findSong: SongLookup): Part => {
  const separator = text.indexOf('=');
  const key = separator < 0 ? null : text.slice(0, separator).toLowerCase();
  const raw = separator < 0 ? text : text.slice(separator + 1);
  return { key: key === '' ? null : key, value: raw.toLowerCase(), raw, findSong };
};

export const parseHash = (hash: string, findSong: SongLookup = () => undefined): ParsedLink => {
  let link: ParsedLink = {};
  for (const text of decode(hash)
    .split(/[&/,\s]+/)
    .filter(Boolean)) {
    const part = partOf(text, findSong);
    for (const rule of RULES) {
      if (part.key === null ? !rule.short : !rule.keys.includes(part.key)) continue;
      const patch = rule.parse(part);
      if (patch !== undefined) {
        link = { ...link, ...patch };
        break;
      }
    }
  }
  return link;
};

export interface LinkSong {
  readonly signature: number;
  readonly style: StyleId;
}

// The settings a link leads to: a song brings its own key and style (the link's are ignored), a style brings its
// suggestions, and the link's tuning, sound and tempo override them
export const settingsFromLink = (
  settings: Settings,
  link: ParsedLink,
  song?: LinkSong,
  bandRunning = false,
): Settings => {
  const style = song?.style ?? link.style;
  const signature = song?.signature ?? link.signature;
  const { tuning, labels, look, mode, combi, difficulty, schema, tempo } = link;
  return {
    ...settings,
    ...(style === undefined ? {} : styleSettings(style, bandRunning)),
    ...(signature === undefined ? {} : { signature }),
    ...(tuning === undefined ? {} : { tuning }),
    ...(labels === undefined ? {} : { labels }),
    ...(look === undefined ? {} : { look }),
    ...(mode === undefined ? {} : { mode }),
    ...(combi === undefined ? {} : { combi }),
    ...(difficulty === undefined ? {} : { difficulty }),
    ...(schema === undefined ? {} : { schema }),
    ...(tempo === undefined ? {} : { tempo }),
  };
};

// The fragment for the current state so it can be shared – only what differs from the defaults
export const formatHash = (settings: Settings, extras: LinkExtras = {}): string => {
  if (extras.room !== undefined) return `#room=${extras.room}`;
  const parts: string[] = [];
  const part = (key: string, value: string | number): void => {
    parts.push(`${key}=${String(value)}`);
  };
  if (settings.style !== DEFAULTS.style) part('style', settings.style);
  if (settings.signature !== DEFAULTS.signature) part('key', keyNameOf(settings.signature));
  if (settings.tuning !== DEFAULTS.tuning) part('tuning', settings.tuning);
  if (settings.labels !== DEFAULTS.labels) part('labels', settings.labels);
  if (settings.look !== DEFAULTS.look) part('look', settings.look);
  if (settings.mode !== DEFAULTS.mode) part('mode', settings.mode);
  if (settings.combi !== DEFAULTS.combi) part('sound', settings.combi);
  if (settings.difficulty !== DEFAULTS.difficulty) part('level', settings.difficulty);
  if (extras.song !== undefined) part('song', slug(extras.song));
  // Band and radio play by default, so only switching them off is worth carrying in a link
  if (extras.band === false) part('band', 0);
  if (settings.tempo !== STYLES[settings.style].tempo) part('tempo', settings.tempo);
  if (settings.schema !== DEFAULTS.schema) part('schema', settings.schema);
  if (extras.radio === false) part('radio', 0);
  return parts.length === 0 ? '' : `#${parts.join('&')}`;
};
