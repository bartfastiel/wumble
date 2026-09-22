import { afterEach, describe, expect, it, type Mock, vi } from 'vitest';
import { decodedTone, FakeAudioContext } from './__tests__/fake-audio-context';
import { SAMPLE_MANIFEST } from './sample-manifest';
import { createSampleStore, DEFAULT_SAMPLE_BASE } from './sample-store';

const MP3 = new Uint8Array([0xff, 0xfb, 0x74, 0xc4]);
const fetchOk = (): Mock<(url: string) => Promise<Response>> => vi.fn(() => Promise.resolve(new Response(MP3)));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('createSampleStore', () => {
  it('fetches every file of a set below the base, decodes and bakes it', async () => {
    const fetch = fetchOk();
    vi.stubGlobal('fetch', fetch);
    const context = new FakeAudioContext();
    context.decode = () => decodedTone(48000, 2);
    const store = createSampleStore(context.asContext(), 'https://cdn.example/wumble/');
    expect(store.samples('doubleBass')).toEqual([]);
    await store.load('doubleBass');
    expect(fetch.mock.calls.map((call) => call[0])).toEqual([
      'https://cdn.example/wumble/doubleBass/36.mp3',
      'https://cdn.example/wumble/doubleBass/40.mp3',
      'https://cdn.example/wumble/doubleBass/44.mp3',
    ]);
    const samples = store.samples('doubleBass');
    expect(samples.map((sample) => sample.root)).toEqual([36.01, 40, 44]);
    // the decoded tone has 23 ms of lead-in and starts at sin 0; baked to the loop end minus the skipped lead
    const lead = Math.round(0.023 * 48000) + 1 - Math.round(0.002 * 48000);
    expect(samples[1]?.buffer.length).toBe(Math.round(1.246 * 48000) - lead);
    expect(samples[1]?.loop).toEqual([
      (Math.round(0.785 * 48000) - lead) / 48000,
      (samples[1]?.buffer.length ?? 0) / 48000,
    ]);
  });

  it('defaults to the relative samples/ folder', async () => {
    const fetch = fetchOk();
    vi.stubGlobal('fetch', fetch);
    const store = createSampleStore(new FakeAudioContext().asContext());
    await store.load('organ');
    expect(DEFAULT_SAMPLE_BASE).toBe('samples/');
    expect(fetch.mock.calls[0]?.[0]).toBe('samples/organ/36.mp3');
    expect(store.samples('organ')).toHaveLength(SAMPLE_MANIFEST.organ.length);
  });

  it('loads every set once, however often it is asked', async () => {
    const fetch = fetchOk();
    vi.stubGlobal('fetch', fetch);
    const store = createSampleStore(new FakeAudioContext().asContext());
    const first = store.load('violin');
    const second = store.load('violin');
    expect(second).toBe(first);
    await Promise.all([first, second, store.load('violin')]);
    expect(fetch).toHaveBeenCalledTimes(SAMPLE_MANIFEST.violin.length);
  });

  it('reads inlined data URLs without fetching', async () => {
    const fetch = fetchOk();
    vi.stubGlobal('fetch', fetch);
    const base64 = Buffer.from(MP3).toString('base64');
    vi.stubGlobal('__WUMBLE_SAMPLES__', { 'strings/55.mp3': `data:audio/mpeg;base64,${base64}` });
    const context = new FakeAudioContext();
    const received: number[][] = [];
    context.decode = (bytes) => {
      received.push(Array.from(new Uint8Array(bytes)));
      return decodedTone();
    };
    await createSampleStore(context.asContext()).load('strings');
    expect(received[0]).toEqual(Array.from(MP3));
    expect(fetch).toHaveBeenCalledTimes(SAMPLE_MANIFEST.strings.length - 1);
  });

  it('falls back to an empty set with a warning when a file is missing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response(null, { status: 404 }))),
    );
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const store = createSampleStore(new FakeAudioContext().asContext());
    await store.load('piano');
    expect(store.samples('piano')).toEqual([]);
    expect(warn).toHaveBeenCalledWith(
      'samples piano',
      expect.objectContaining({ message: 'samples/piano/36.mp3: HTTP 404' }),
    );
  });

  it('falls back to an empty set when decoding fails', async () => {
    vi.stubGlobal('fetch', fetchOk());
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const context = new FakeAudioContext();
    context.decode = () => {
      throw new Error('unsupported');
    };
    const store = createSampleStore(context.asContext());
    await store.load('piano');
    expect(store.samples('piano')).toEqual([]);
  });
});
