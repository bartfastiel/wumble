// The audio thread: runs the Rust synth once per render quantum. It allocates nothing while playing.
import { CONTROL_LEN, METER_LEN, sharedControls, snapshot, type SharedControls } from '../engine/layout';

// The AudioWorkletGlobalScope is not part of TypeScript's DOM library
declare abstract class AudioWorkletProcessor {
  readonly port: MessagePort;
  abstract process(inputs: Float32Array[][], outputs: Float32Array[][]): boolean;
}
declare function registerProcessor(
  name: string,
  processor: new (options: ProcessorOptions) => AudioWorkletProcessor,
): void;
declare const sampleRate: number;

interface SynthExports {
  readonly memory: WebAssembly.Memory;
  wumble_init(rate: number): void;
  wumble_controls(): number;
  wumble_meters(): number;
  wumble_left(): number;
  wumble_right(): number;
  wumble_render(frames: number): void;
}

export interface ProcessorOptions {
  readonly processorOptions: {
    readonly module: WebAssembly.Module;
    readonly controls: SharedArrayBuffer | undefined;
    readonly meters: SharedArrayBuffer | undefined;
  };
}

const QUANTUM = 128;
const METER_EVERY = 4; // blocks between two meter messages when memory is not shared (~94 per second)

class ViolinProcessor extends AudioWorkletProcessor {
  private readonly synth: SynthExports;
  private readonly controls: Float32Array;
  private readonly meters: Float32Array;
  private readonly left: Float32Array;
  private readonly right: Float32Array;
  private readonly shared: SharedControls | undefined;
  private readonly sharedMeters: Float32Array | undefined;
  private pending: Float32Array | undefined;
  private block = 0;

  constructor(options: ProcessorOptions) {
    super();
    const { module, controls, meters } = options.processorOptions;
    this.synth = new WebAssembly.Instance(module, {}).exports as unknown as SynthExports;
    this.synth.wumble_init(sampleRate);
    // The engine allocates only in init, so the memory never grows and these views stay valid
    const buffer = this.synth.memory.buffer;
    this.controls = new Float32Array(buffer, this.synth.wumble_controls(), CONTROL_LEN);
    this.meters = new Float32Array(buffer, this.synth.wumble_meters(), METER_LEN);
    this.left = new Float32Array(buffer, this.synth.wumble_left(), QUANTUM);
    this.right = new Float32Array(buffer, this.synth.wumble_right(), QUANTUM);
    this.shared = controls === undefined ? undefined : sharedControls(controls);
    this.sharedMeters = meters === undefined ? undefined : new Float32Array(meters);
    this.port.onmessage = (event: MessageEvent<Float32Array>) => {
      this.pending = event.data;
    };
    this.port.postMessage({ ready: true, sampleRate });
  }

  process(_inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
    if (this.shared) snapshot(this.shared, this.controls);
    else if (this.pending) {
      this.controls.set(this.pending);
      this.pending = undefined;
    }
    this.synth.wumble_render(QUANTUM);
    const [out] = outputs;
    out?.[0]?.set(this.left);
    out?.[1]?.set(this.right);
    if (this.sharedMeters) this.sharedMeters.set(this.meters);
    else if (++this.block % METER_EVERY === 0) this.port.postMessage(this.meters.slice());
    return true;
  }
}

registerProcessor('wumble-violin', ViolinProcessor);
