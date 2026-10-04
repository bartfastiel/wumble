// Starts the synth: an AudioContext, the WebAssembly module and the worklet that runs it.
//
// With cross-origin isolation the page writes controls straight into memory the audio thread reads; without it they
// travel as messages, a little later and less evenly.
import wasmUrl from '../../../synth/pkg/synth.wasm?url';
import workletUrl from './worklet.ts?worker&url';
import { METER_LEN, SHARED_CONTROL_BYTES, defaultControls, publish, sharedControls } from '../engine/layout';
import type { ProcessorOptions } from './worklet';
import { createUnlock } from '../../audio/unlock';

export interface Engine {
  readonly controls: Float32Array; // write, then commit()
  readonly meters: Float32Array; // read in every frame
  readonly shared: boolean;
  readonly context: AudioContext;
  commit(): void;
  latencyMs(): number;
}

const compile = async (): Promise<WebAssembly.Module> => {
  const response = await fetch(wasmUrl);
  if (!response.ok) throw new Error(`synth.wasm: HTTP ${String(response.status)}`);
  // compileStreaming needs the server to say application/wasm; the buffer works everywhere
  return WebAssembly.compile(await response.arrayBuffer());
};

const unlock = createUnlock();

// Must be called from a user gesture: the context and the iOS unlock are both created synchronously here
export const startEngine = async (): Promise<Engine> => {
  unlock();
  const context = new AudioContext({ latencyHint: 'interactive' });
  const resumed = context.resume();
  const [module] = await Promise.all([compile(), context.audioWorklet.addModule(workletUrl), resumed]);

  const shared = globalThis.crossOriginIsolated && typeof SharedArrayBuffer === 'function';
  const controlBuffer = shared ? new SharedArrayBuffer(SHARED_CONTROL_BYTES) : undefined;
  const meterBuffer = shared ? new SharedArrayBuffer(METER_LEN * 4) : undefined;
  const options: ProcessorOptions = {
    processorOptions: { module, controls: controlBuffer, meters: meterBuffer },
  };
  const node = new AudioWorkletNode(context, 'wumble-violin', {
    numberOfInputs: 0,
    numberOfOutputs: 1,
    outputChannelCount: [2],
    ...options,
  });

  const controls = defaultControls();
  const meters = meterBuffer ? new Float32Array(meterBuffer) : new Float32Array(METER_LEN);
  const ready = new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('the audio thread did not answer'));
    }, 8000);
    node.port.onmessage = (event: MessageEvent<unknown>) => {
      if (event.data instanceof Float32Array) {
        meters.set(event.data);
        return;
      }
      clearTimeout(timer);
      resolve();
    };
  });
  node.onprocessorerror = () => {
    console.error('wumble: the synth stopped');
  };
  node.connect(context.destination);
  await ready;

  const sharedBlock = controlBuffer ? sharedControls(controlBuffer) : undefined;
  const commit = sharedBlock
    ? () => {
        publish(sharedBlock, controls);
      }
    : () => {
        node.port.postMessage(controls.slice());
      };
  commit();

  return {
    controls,
    meters,
    shared,
    context,
    commit,
    latencyMs: () => 1000 * (context.baseLatency + (context.outputLatency || 0)),
  };
};
