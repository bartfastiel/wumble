import { describe, expect, it } from 'vitest';
import type { CombiId } from '../audio/engine';
import { setLocale, t } from '../i18n';
import { STYLES } from '../theory/styles';
import {
  clampTempo,
  COMBI_IDS,
  DEFAULTS,
  DIFFICULTIES,
  isTempo,
  LABEL_SETTINGS,
  LOOKS,
  PLAY_MODES,
  styleSettings,
} from './settings';

describe('DEFAULTS', () => {
  it('start the app on the twelve-bar blues in C, organ, polished, thinking along, labels off, easy, 100 bpm', () => {
    expect(DEFAULTS).toEqual({
      signature: 0,
      style: 'blues',
      tuning: 'equal',
      mode: 'autoHarmony',
      combi: 'organ',
      labels: 'off',
      look: 'polished',
      german: false,
      difficulty: 'easy',
      tempo: 100,
      schema: 'blues',
      loopBars: 2,
      publicUrl: '',
    });
  });

  it('list every combi of the audio engine', () => {
    const all: Record<CombiId, true> = {
      epiano: true,
      bell: true,
      organ: true,
      piano: true,
      strings: true,
      church: true,
      pop: true,
      jazzTrio: true,
      guitar: true,
    };
    const byName = (a: string, b: string): number => a.localeCompare(b);
    expect([...COMBI_IDS].sort(byName)).toEqual(Object.keys(all).sort(byName));
  });
});

describe('tempo', () => {
  it('is clamped to 60…160 and rounded', () => {
    expect(clampTempo(30)).toBe(60);
    expect(clampTempo(200)).toBe(160);
    expect(clampTempo(99.6)).toBe(100);
    expect(isTempo(60)).toBe(true);
    expect(isTempo(161)).toBe(false);
    expect(isTempo('100')).toBe(false);
  });
});

describe('styleSettings', () => {
  it('applies the style suggestions: sound, tempo and – for the harmonic series – the tuning', () => {
    expect(styleSettings('blues')).toEqual({ style: 'blues', combi: 'organ', tempo: 100 });
    expect(styleSettings('harmonicSeries')).toEqual({
      style: 'harmonicSeries',
      combi: 'church',
      tuning: 'just',
      tempo: STYLES.harmonicSeries.tempo,
    });
  });

  it('leaves the tempo alone while the band plays', () => {
    expect(styleSettings('techno', true)).toEqual({ style: 'techno', combi: 'pop' });
  });
});

describe('names', () => {
  it('exist for every mode, look, label setting and level in both locales', () => {
    for (const locale of ['de', 'en'] as const) {
      setLocale(locale);
      for (const mode of PLAY_MODES) expect(t(`play.mode.${mode}`)).not.toBe(`play.mode.${mode}`);
      for (const look of LOOKS) expect(t(`play.look.${look}`)).not.toBe(`play.look.${look}`);
      for (const labels of LABEL_SETTINGS) expect(t(`play.labels.${labels}`)).not.toBe(`play.labels.${labels}`);
      for (const level of DIFFICULTIES) expect(t(`play.level.${level}`)).not.toBe(`play.level.${level}`);
    }
  });

  it('read in plain German', () => {
    setLocale('de');
    expect(t('play.mode.twoHands')).toBe('Zwei Hände – links der Akkord, rechts die Melodie');
    expect(t('play.labels.off')).toBe('Aus');
    expect(t('play.level.hard')).toBe('Schwer');
  });
});
