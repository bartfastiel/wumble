import { describe, expect, it } from 'vitest';
import { COMBI_IDS } from '../audio/engine';
import { KEYS } from '../theory/keys';
import { STYLE_IDS, STYLES } from '../theory/styles';
import { TUNING_IDS } from '../theory/tuning';
import { formatHash, keyNameOf, parseHash, settingsFromLink, signatureByName, slug } from './deep-links';
import {
  DEFAULTS,
  DIFFICULTIES,
  LABEL_SETTINGS,
  LOOKS,
  PLAY_MODES,
  SCHEMA_IDS,
  type Settings,
  styleSettings,
} from './settings';

const songs: Readonly<Record<string, string>> = {
  'alle-meine-entchen': 'Alle meine Entchen',
  'twelve-bar-blues': 'Twelve-bar blues',
};
const findSong = (text: string): string | undefined => songs[text];

describe('slug', () => {
  it('lower-cases and joins everything else with hyphens', () => {
    expect(slug('Alle meine Entchen')).toBe('alle-meine-entchen');
    expect(slug('Hejo, spann den Wagen an!')).toBe('hejo-spann-den-wagen-an');
    expect(slug('  ')).toBe('');
  });
});

describe('signatureByName and keyNameOf', () => {
  it('reads sharps, flats and the German spellings', () => {
    expect(signatureByName('C')).toBe(0);
    expect(signatureByName('G')).toBe(1);
    expect(signatureByName('F')).toBe(-1);
    expect(signatureByName('F#')).toBe(6);
    expect(signatureByName('Gb')).toBe(-6);
    expect(signatureByName('H')).toBe(5); // German B
    expect(signatureByName('Es')).toBe(-3);
    expect(signatureByName('Fis')).toBe(6);
  });

  it('rejects anything that is not a key name', () => {
    expect(signatureByName('X')).toBeUndefined();
    expect(signatureByName('C##')).toBeUndefined();
    expect(signatureByName('')).toBeUndefined();
  });

  it('writes a name every reader can type back', () => {
    for (const key of KEYS) {
      expect(signatureByName(keyNameOf(key.signature))).toBe(key.signature);
    }
  });
});

describe('parseHash', () => {
  it('reads every setting from its key', () => {
    expect(
      parseHash('#style=jazz&key=F%23&tuning=just&labels=names&mode=autoHarmony&sound=piano&level=hard&schema=canon'),
    ).toEqual({
      style: 'jazz',
      signature: 6,
      tuning: 'just',
      labels: 'names',
      mode: 'autoHarmony',
      combi: 'piano',
      difficulty: 'hard',
      schema: 'canon',
    });
  });

  it('reads the short forms without a key', () => {
    expect(parseHash('#blues')).toEqual({ style: 'blues' });
    expect(parseHash('#A')).toEqual({ signature: 3 });
    expect(parseHash('#just')).toEqual({ tuning: 'just' });
    expect(parseHash('#hard')).toEqual({ difficulty: 'hard' });
    expect(parseHash('#scan')).toEqual({ scan: true });
  });

  it('accepts every id the settings know', () => {
    for (const id of STYLE_IDS) expect(parseHash(`#style=${id}`)).toEqual({ style: id });
    for (const id of TUNING_IDS) expect(parseHash(`#tuning=${id}`)).toEqual({ tuning: id });
    for (const id of PLAY_MODES) expect(parseHash(`#mode=${id}`)).toEqual({ mode: id });
    for (const id of COMBI_IDS) expect(parseHash(`#sound=${id}`)).toEqual({ combi: id });
    for (const id of DIFFICULTIES) expect(parseHash(`#level=${id}`)).toEqual({ difficulty: id });
    for (const id of SCHEMA_IDS) expect(parseHash(`#schema=${id}`)).toEqual({ schema: id });
    for (const id of LABEL_SETTINGS) expect(parseHash(`#labels=${id}`)).toEqual({ labels: id });
    for (const id of LOOKS) expect(parseHash(`#look=${id}`)).toEqual({ look: id });
  });

  it('reads flags, tempo, room and song', () => {
    expect(parseHash('#band&radio')).toEqual({ band: true, radio: true });
    expect(parseHash('#band=0&radio=0')).toEqual({ band: false, radio: false });
    expect(parseHash('#tempo=120')).toEqual({ tempo: 120 });
    expect(parseHash('#tempo=3')).toEqual({});
    expect(parseHash('#room=k7m3x')).toEqual({ room: 'k7m3x' });
    expect(parseHash('#room=NO!')).toEqual({});
    expect(parseHash('#song=alle-meine-entchen', findSong)).toEqual({ song: 'Alle meine Entchen' });
    expect(parseHash('#song=unknown', findSong)).toEqual({});
  });

  it('separates parts by & / , and whitespace, and ignores what it does not know', () => {
    expect(parseHash('#blues/just,hard A')).toEqual({
      style: 'blues',
      tuning: 'just',
      difficulty: 'hard',
      signature: 3,
    });
    expect(parseHash('#nonsense=1')).toEqual({});
    expect(parseHash('')).toEqual({});
    expect(parseHash('#%E0%A4%A')).toEqual({}); // broken encoding, read as written
  });

  it('lets the later part of a link win', () => {
    expect(parseHash('#style=blues&style=jazz')).toEqual({ style: 'jazz' });
  });
});

describe('settingsFromLink', () => {
  it('lets a style bring its suggestions and the link override them', () => {
    const settings = settingsFromLink(DEFAULTS, { style: 'blues', tuning: 'just', tempo: 100 });
    expect(settings.style).toBe('blues');
    expect(settings.tuning).toBe('just');
    expect(settings.tempo).toBe(100);
    const plain = settingsFromLink(DEFAULTS, { style: 'blues' });
    expect(plain.tempo).toBe(STYLES.blues.tempo);
  });

  it('lets a song overrule the link, because it brings its own key and style', () => {
    const settings = settingsFromLink(DEFAULTS, { style: 'jazz', signature: 6 }, { signature: -1, style: 'blues' });
    expect(settings.style).toBe('blues');
    expect(settings.signature).toBe(-1);
  });

  it('changes nothing for an empty link', () => {
    expect(settingsFromLink(DEFAULTS, {})).toEqual(DEFAULTS);
  });
});

describe('formatHash', () => {
  it('writes only what differs from the defaults', () => {
    expect(formatHash(DEFAULTS)).toBe('');
    const settings: Settings = { ...DEFAULTS, style: 'jazz', tempo: STYLES.jazz.tempo };
    expect(formatHash(settings)).toBe('#style=jazz');
  });

  it('writes the look only when it differs from the default', () => {
    expect(formatHash({ ...DEFAULTS, look: 'precise' })).toBe('#look=precise');
    expect(formatHash({ ...DEFAULTS, look: 'organic' })).toBe('#look=organic');
    expect(formatHash({ ...DEFAULTS, look: 'polished' })).toBe('');
  });

  it('writes the key by name and the extras', () => {
    const settings: Settings = { ...DEFAULTS, signature: 6, tuning: 'just', labels: 'names' };
    // Band and radio play by default, so only switching them off is carried
    expect(formatHash(settings, { song: 'Alle meine Entchen', band: true, radio: true })).toBe(
      '#key=F#&tuning=just&labels=names&song=alle-meine-entchen',
    );
    expect(formatHash(settings, { band: false, radio: false })).toBe('#key=F#&tuning=just&labels=names&band=0&radio=0');
  });

  it('writes a room alone, because nothing else matters to a listener', () => {
    expect(formatHash({ ...DEFAULTS, style: 'jazz' }, { room: 'k7m3x' })).toBe('#room=k7m3x');
  });

  it('writes links that read back to the same settings', () => {
    for (const style of STYLE_IDS) {
      for (const key of KEYS) {
        const settings: Settings = { ...DEFAULTS, ...styleSettings(style), signature: key.signature };
        expect(settingsFromLink(DEFAULTS, parseHash(formatHash(settings)))).toEqual(settings);
      }
    }
  });
});
