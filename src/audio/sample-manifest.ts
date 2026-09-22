// Generated from the recordings under public/samples – do not edit by hand.
// One entry per recording: root = measured fundamental (MIDI, fractional), loop = [start, end] in seconds of the decoded
// buffer or null, file = path below the sample base URL. Sources and licenses: README "Sounds and licenses".
export type SampleSetId = 'piano' | 'violin' | 'strings' | 'doubleBass' | 'organ';

export interface SampleInfo {
  readonly root: number;
  readonly loop: readonly [number, number] | null;
  readonly file: string;
}

export const SAMPLE_MANIFEST: Readonly<Record<SampleSetId, readonly SampleInfo[]>> = {
  piano: [
    { root: 36.04, loop: null, file: 'piano/36.mp3' },
    { root: 39.02, loop: null, file: 'piano/39.mp3' },
    { root: 42, loop: null, file: 'piano/42.mp3' },
    { root: 45.02, loop: null, file: 'piano/45.mp3' },
    { root: 47.97, loop: null, file: 'piano/48.mp3' },
    { root: 51.01, loop: null, file: 'piano/51.mp3' },
    { root: 54.01, loop: null, file: 'piano/54.mp3' },
    { root: 57.05, loop: null, file: 'piano/57.mp3' },
    { root: 60.02, loop: null, file: 'piano/60.mp3' },
    { root: 63.06, loop: null, file: 'piano/63.mp3' },
    { root: 66.01, loop: null, file: 'piano/66.mp3' },
    { root: 69.07, loop: null, file: 'piano/69.mp3' },
    { root: 72.07, loop: null, file: 'piano/72.mp3' },
    { root: 75.05, loop: null, file: 'piano/75.mp3' },
    { root: 78.05, loop: null, file: 'piano/78.mp3' },
    { root: 81.08, loop: null, file: 'piano/81.mp3' },
    { root: 84.11, loop: null, file: 'piano/84.mp3' },
  ],
  violin: [
    { root: 54.96, loop: [0.6444, 1.0484], file: 'violin/55.mp3' },
    { root: 59.86, loop: [0.5187, 1.0615], file: 'violin/60.mp3' },
    { root: 64.03, loop: [0.7975, 1.4298], file: 'violin/64.mp3' },
    { root: 67.04, loop: [0.7963, 1.326], file: 'violin/67.mp3' },
    { root: 71.97, loop: [0.6452, 1.2393], file: 'violin/72.mp3' },
    { root: 76.2, loop: [0.5525, 1.0597], file: 'violin/76.mp3' },
    { root: 79.07, loop: [0.7963, 1.4211], file: 'violin/79.mp3' },
    { root: 81.02, loop: [0.5387, 1.0813], file: 'violin/81.mp3' },
  ],
  strings: [
    { root: 55.01, loop: [0.5526, 0.9621], file: 'strings/55.mp3' },
    { root: 58.98, loop: [0.5799, 1.4341], file: 'strings/59.mp3' },
    { root: 61.99, loop: [0.5234, 1.2878], file: 'strings/62.mp3' },
    { root: 66.03, loop: [0.5667, 1.003], file: 'strings/66.mp3' },
    { root: 69.01, loop: [0.6741, 1.3294], file: 'strings/69.mp3' },
    { root: 72, loop: [0.7985, 1.2947], file: 'strings/72.mp3' },
    { root: 76, loop: [0.5413, 1.7021], file: 'strings/76.mp3' },
  ],
  doubleBass: [
    { root: 36.01, loop: [0.569, 1.2414], file: 'doubleBass/36.mp3' },
    { root: 40, loop: [0.785, 1.246], file: 'doubleBass/40.mp3' },
    { root: 44, loop: [0.5276, 1.7599], file: 'doubleBass/44.mp3' },
  ],
  organ: [
    { root: 36.02, loop: [0.7877, 1.5131], file: 'organ/36.mp3' },
    { root: 45, loop: [0.5612, 0.9971], file: 'organ/45.mp3' },
    { root: 51.01, loop: [0.5055, 1.2059], file: 'organ/51.mp3' },
    { root: 57, loop: [0.6003, 1.4928], file: 'organ/57.mp3' },
    { root: 62.96, loop: [0.6343, 1.0396], file: 'organ/63.mp3' },
    { root: 69, loop: [0.6947, 1.5324], file: 'organ/69.mp3' },
    { root: 74.97, loop: [0.7933, 1.4184], file: 'organ/75.mp3' },
    { root: 81, loop: [0.7034, 1.6616], file: 'organ/81.mp3' },
  ],
};
