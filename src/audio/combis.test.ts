import { describe, expect, it } from 'vitest';
import { setLocale, t } from '../i18n';
import { type CombiId, COMBIS, LAYERS, layerOf } from './combis';
import { SOUNDS } from './sounds';

const ids = Object.keys(COMBIS) as CombiId[];

describe('COMBIS', () => {
  it('lists nine combis', () => {
    expect(ids).toEqual(['epiano', 'bell', 'organ', 'piano', 'strings', 'church', 'pop', 'jazzTrio', 'guitar']);
  });

  it('names every combi in German and English', () => {
    for (const id of ids) {
      setLocale('de');
      expect(t(COMBIS[id].name)).not.toBe(COMBIS[id].name);
      expect(t(COMBIS[id].hint)).not.toBe(COMBIS[id].hint);
      setLocale('en');
      expect(t(COMBIS[id].name)).not.toBe(COMBIS[id].name);
    }
    setLocale('de');
    expect([t(COMBIS.church.name), t(COMBIS.church.hint)]).toEqual(['Kirchenorgel', 'Rode-Orgel mit Kirchenhall']);
    setLocale('en');
    expect([t(COMBIS.jazzTrio.name), t(COMBIS.jazzTrio.hint)]).toEqual([
      'Jazz trio',
      'e-piano, grand piano chords, double bass',
    ]);
  });
});

describe('layerOf', () => {
  it('takes the level from the sound unless the combi sets its own', () => {
    expect(layerOf('epiano', 'melody')).toEqual({ sound: SOUNDS.epiano, gain: 0.5 });
    expect(layerOf('epiano', 'chord')).toEqual({ sound: SOUNDS.softPad, gain: 0.035 });
    expect(layerOf('epiano', 'bass')).toEqual({ sound: SOUNDS.sineBass, gain: 0.25 });
    expect(layerOf('piano', 'melody')).toEqual({ sound: SOUNDS.piano, gain: 1.2 });
    expect(layerOf('piano', 'chord')).toEqual({ sound: SOUNDS.piano, gain: 0.5 });
    expect(layerOf('piano', 'bass')).toEqual({ sound: SOUNDS.piano, gain: 1.2 });
    expect(layerOf('church', 'chord')).toEqual({ sound: SOUNDS.churchOrgan, gain: 0.4 });
    expect(layerOf('guitar', 'chord')).toEqual({ sound: SOUNDS.pluck, gain: 0.2 });
    expect(layerOf('jazzTrio', 'bass')).toEqual({ sound: SOUNDS.doubleBass, gain: 0.9 });
  });

  it('resolves every layer of every combi', () => {
    for (const id of ids) for (const layer of LAYERS) expect(layerOf(id, layer).gain).toBeGreaterThan(0);
  });
});
