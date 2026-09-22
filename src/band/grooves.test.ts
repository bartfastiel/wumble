import { describe, expect, it } from 'vitest';
import { setLocale, t } from '../i18n';
import { STYLES } from '../theory/styles';
import { laneOf, RECORDED } from './__fixtures__/recorded';
import { DRUM_LANES, type GrooveId, GROOVES, LEVEL, TONE_LANES, VELOCITY } from './grooves';

const IDS: readonly GrooveId[] = ['blues', 'rock', 'techno', 'jazz', 'pop', 'calm'];

describe('GROOVES', () => {
  it('are six, one per style family', () => {
    expect(Object.keys(RECORDED.tables.GROOVES)).toEqual([...IDS]);
    expect(Object.keys(GROOVES)).toEqual([...IDS]);
  });

  it.each(IDS)('%s keeps its patterns, swing and levels', (id) => {
    const reference = RECORDED.tables.GROOVES[id];
    const expected: Record<string, string | number> = {};
    for (const [key, value] of Object.entries(reference ?? {})) {
      if (key === 'name') continue;
      const plain = key === 'swing' || key === 'drums' || key === 'tones';
      expected[plain ? key : laneOf(key)] = value;
    }
    expect(GROOVES[id]).toEqual(expected);
  });

  it('name every groove in both locales', () => {
    setLocale('de');
    for (const id of IDS) expect(t(`band.groove.${id}`)).toBe(RECORDED.tables.GROOVES[id]?.name);
    setLocale('en');
    for (const id of IDS) expect(t(`band.groove.${id}`)).not.toBe(`band.groove.${id}`);
  });

  it('cover every groove a style suggests', () => {
    for (const style of Object.values(STYLES)) expect(GROOVES[style.groove]).toBeDefined();
  });

  it('keep their lanes, velocities and levels', () => {
    expect(DRUM_LANES).toEqual(RECORDED.tables.DRUM_LANES.map(laneOf));
    expect(TONE_LANES).toEqual(RECORDED.tables.TONE_LANES.map(laneOf));
    expect(VELOCITY).toEqual(RECORDED.tables.VEL);
    expect(LEVEL).toEqual(RECORDED.tables.LEVEL);
  });
});
