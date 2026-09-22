import { describe, expect, it } from 'vitest';
import { de } from './de';
import { en } from './en';
import { detectLocale, locale, setLocale, t, type MessageKey } from './index';

const keys = (tree: Record<string, unknown>, prefix = ''): string[] =>
  Object.entries(tree).flatMap(([key, value]) =>
    typeof value === 'object' && value !== null
      ? keys(value as Record<string, unknown>, `${prefix}${key}.`)
      : [prefix + key],
  );

describe('locale resources', () => {
  it('have the same keys in de and en', () => {
    expect(new Set(keys(en))).toEqual(new Set(keys(de)));
  });
});

describe('detectLocale', () => {
  it('picks de for German, en otherwise', () => {
    expect(detectLocale('de-AT')).toBe('de');
    expect(detectLocale('fr')).toBe('en');
  });
});

describe('t', () => {
  it('translates in the current locale', () => {
    setLocale('de');
    expect(locale()).toBe('de');
    expect(t('theory.group.stage')).toBe('Bühne');
    setLocale('en');
    expect(t('theory.group.stage')).toBe('Stage');
  });

  it('substitutes placeholders', () => {
    setLocale('en');
    expect(t('app.version', { version: '1.2.3' })).toBe('Version 1.2.3');
  });

  it('keeps a placeholder without value and falls back to the key', () => {
    setLocale('en');
    expect(t('app.version')).toBe('Version {version}');
    expect(t('missing.key' as MessageKey)).toBe('missing.key');
  });
});
