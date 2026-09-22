// Loads and decodes the sample sets of the manifest lazily, one promise per set. Files come from `base` (relative
// `samples/` by default); the single-file build inlines them as data URLs in window.__WUMBLE_SAMPLES__ instead.
import { SAMPLE_MANIFEST, type SampleInfo, type SampleSetId } from './sample-manifest';
import { bake, type PreparedSample } from './sampler';

export const DEFAULT_SAMPLE_BASE = 'samples/';

interface InlinedSamplesHost {
  readonly __WUMBLE_SAMPLES__?: Readonly<Record<string, string>>;
}
const inlined = (file: string): string | undefined => (globalThis as InlinedSamplesHost).__WUMBLE_SAMPLES__?.[file];

const DATA_URL = /^data:[^,]*;base64,/;
const bytesOf = async (url: string): Promise<ArrayBuffer> => {
  if (DATA_URL.test(url)) return Uint8Array.from(atob(url.replace(DATA_URL, '')), (c) => c.codePointAt(0) ?? 0).buffer;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: HTTP ${String(response.status)}`);
  return response.arrayBuffer();
};

export interface SampleStore {
  load(set: SampleSetId): Promise<void>;
  // decoded samples of the set – empty until loaded, and after a failed load (the caller falls back to a synth)
  samples(set: SampleSetId): readonly PreparedSample[];
}

export const createSampleStore = (context: BaseAudioContext, base = DEFAULT_SAMPLE_BASE): SampleStore => {
  const loading = new Map<SampleSetId, Promise<void>>();
  const decoded = new Map<SampleSetId, readonly PreparedSample[]>();

  const decode = async (info: SampleInfo): Promise<PreparedSample> => {
    const buffer = await context.decodeAudioData(await bytesOf(inlined(info.file) ?? base + info.file));
    return { root: info.root, ...bake(context, buffer, info.loop) };
  };
  const load = (set: SampleSetId): Promise<void> => {
    const pending = loading.get(set);
    if (pending) return pending;
    const promise = Promise.all(SAMPLE_MANIFEST[set].map(decode)).then(
      (samples) => {
        decoded.set(set, samples);
      },
      (error: unknown) => {
        console.warn(`samples ${set}`, error);
        decoded.set(set, []);
      },
    );
    loading.set(set, promise);
    return promise;
  };

  return { load, samples: (set) => decoded.get(set) ?? [] };
};
