// Every number the sounds, combis and samples carry is compared with the recorded reference values, and every
// recording with the bytes on disk.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { type CombiId, COMBIS } from './combis';
import { RECORDED } from './__fixtures__/recorded';
import { SAMPLE_MANIFEST, type SampleSetId } from './sample-manifest';
import { type SoundId, SOUNDS } from './sounds';

describe('SOUNDS', () => {
  const reference = RECORDED.sounds;

  it('has the same sounds as the reference', () => {
    expect(Object.keys(reference)).toEqual(Object.keys(SOUNDS));
  });

  it.each(Object.entries(reference))('%s keeps every parameter', (id, sound) => {
    const expected: Record<string, unknown> = { wet: 1, reverb: 'room' }; // the defaults
    for (const [key, value] of Object.entries(sound)) {
      if (key === 'name') continue; // never shown
      if (key === 'hall') expected.reverb = value;
      else expected[key] = value;
    }
    expect(SOUNDS[id as SoundId]).toEqual(expected);
  });
});

describe('COMBIS', () => {
  const reference = RECORDED.combis;

  it('has the same combis as the reference', () => {
    expect(Object.keys(reference)).toEqual(Object.keys(COMBIS));
  });

  it.each(Object.entries(reference))('%s keeps its layers and levels', (id, combi) => {
    const ours = COMBIS[id as CombiId];
    expect([ours.melody, ours.chord, ours.bass]).toEqual([combi.melody, combi.chord, combi.bass]);
  });
});

describe('SAMPLE_MANIFEST and public/samples', () => {
  const reference = RECORDED.samples;

  it('lists the same sets', () => {
    expect(Object.keys(reference)).toEqual(Object.keys(SAMPLE_MANIFEST));
  });

  it.each(Object.entries(reference))('%s keeps roots, loops and the recordings byte for byte', (id, samples) => {
    const manifest = SAMPLE_MANIFEST[id as SampleSetId];
    expect(manifest.map(({ root, loop }) => ({ root, loop }))).toEqual(
      samples.map(({ root, loop }) => ({ root, loop })),
    );
    manifest.forEach((info, i) => {
      const recording = readFileSync(`public/samples/${info.file}`);
      expect(recording.length, info.file).toBe(samples[i]?.bytes);
      expect(createHash('sha256').update(recording).digest('hex'), info.file).toBe(samples[i]?.sha256);
    });
  });
});
