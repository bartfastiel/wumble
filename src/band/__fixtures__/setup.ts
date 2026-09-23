// A band wired like the app would wire it, on fake time and a recording engine, for the tests of the band modules.
import { keyBySignature } from '../../theory/keys';
import { buildModel, type Model } from '../../theory/model';
import { type StyleId, STYLES } from '../../theory/styles';
import { melodyFrequency, type TuningId } from '../../theory/tuning';
import { type Band, createBand } from '../band';
import { createPlayer, type Player } from '../player';
import type { SchemaId } from '../schemata';
import { createFakeTime, createRecordingEngine, type FakeTime, type RecordingEngine } from './fakes';

export interface Setup {
  readonly time: FakeTime;
  readonly engine: RecordingEngine;
  readonly band: Band;
  readonly player: Player;
  readonly model: () => Model;
  readonly tuning: () => TuningId;
  readonly beats: number[]; // audio times of the beat callbacks
  readonly chords: (number | null)[]; // the chords the band showed
  setStyle(id: StyleId): void; // adopts the style's tempo like the app does while the band is off
  setTuning(id: TuningId): void;
  setChordSource(chord: number | (() => number)): void;
}

// `tempo` is for the golden recordings: they were taken at a beat that must not move when a style changes its own.
export const createSetup = (styleId: StyleId = 'classical', schema: SchemaId = 'follow', tempo?: number): Setup => {
  const time = createFakeTime();
  const engine = createRecordingEngine(time.clock);
  let model = buildModel(keyBySignature(0), styleId);
  let tuning: TuningId = 'equal';
  let chordSource: () => number = () => model.home;
  const beats: number[] = [];
  const chords: (number | null)[] = [];
  const band = createBand({
    engine,
    clock: time.clock,
    timers: time.timers,
    model: () => model,
    tuning: () => tuning,
    chordSource: () => chordSource(),
    onBeat: () => beats.push(time.clock.now()),
    onChord: (chord) => chords.push(chord),
  });
  band.setTempo(tempo ?? STYLES[styleId].tempo);
  band.setSchema(schema);
  const player = createPlayer({
    engine: () => band.output(),
    scheduler: band.scheduler,
    melodyFrequency: (chord, tone) => melodyFrequency(model, tuning, chord, tone),
  });
  return {
    time,
    engine,
    band,
    player,
    model: () => model,
    tuning: () => tuning,
    beats,
    chords,
    setStyle(id) {
      model = buildModel(keyBySignature(0), id);
      if (!band.running()) band.setTempo(STYLES[id].tempo);
    },
    setTuning(id) {
      tuning = id;
    },
    setChordSource(chord) {
      chordSource = typeof chord === 'number' ? () => chord : chord;
    },
  };
};
