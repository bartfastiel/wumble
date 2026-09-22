// A hand-written stand-in for the Web Audio API: nodes record their connections, params record scheduled values,
// sources record start/stop times. Enough to assert graphs and envelopes in a node test without a browser.
export type ParamMethod =
  'setValueAtTime' | 'linearRampToValueAtTime' | 'exponentialRampToValueAtTime' | 'setTargetAtTime';
export interface ParamEvent {
  readonly method: ParamMethod;
  readonly value: number;
  readonly time: number;
  readonly timeConstant?: number;
}

export class FakeParam {
  readonly events: ParamEvent[] = [];
  constructor(public value: number) {}
  setValueAtTime(value: number, time: number): this {
    this.events.push({ method: 'setValueAtTime', value, time });
    return this;
  }
  linearRampToValueAtTime(value: number, time: number): this {
    this.events.push({ method: 'linearRampToValueAtTime', value, time });
    return this;
  }
  exponentialRampToValueAtTime(value: number, time: number): this {
    this.events.push({ method: 'exponentialRampToValueAtTime', value, time });
    return this;
  }
  setTargetAtTime(value: number, time: number, timeConstant: number): this {
    this.events.push({ method: 'setTargetAtTime', value, time, timeConstant });
    return this;
  }
}

export class FakeBuffer {
  private readonly channels: Float32Array[];
  constructor(
    readonly numberOfChannels: number,
    readonly length: number,
    readonly sampleRate: number,
  ) {
    this.channels = Array.from({ length: numberOfChannels }, () => new Float32Array(length));
  }
  getChannelData(channel: number): Float32Array {
    const data = this.channels[channel];
    if (!data) throw new RangeError(`no channel ${String(channel)}`);
    return data;
  }
  // the modules take the DOM type; structurally the fake provides what they use
  asBuffer(): AudioBuffer {
    return this as unknown as AudioBuffer;
  }
}

export type FakeTarget = FakeNode | FakeParam;

export class FakeNode {
  readonly targets: FakeTarget[] = [];
  disconnected = false;
  constructor(
    readonly kind: string,
    readonly context: FakeAudioContext,
  ) {
    context.nodes.push(this);
  }
  connect<T extends FakeTarget>(target: T): T {
    this.targets.push(target);
    return target;
  }
  disconnect(): void {
    this.disconnected = true;
    this.targets.length = 0;
  }
  // every node this one feeds, directly or through other nodes
  reaches(target: FakeTarget): boolean {
    return this.targets.some((next) => next === target || (next instanceof FakeNode && next.reaches(target)));
  }
}

export class FakeGain extends FakeNode {
  readonly gain = new FakeParam(1);
}
export class FakeSource extends FakeNode {
  startedAt: number | null = null;
  offset = 0;
  stoppedAt: number | null = null;
  start(when = 0, offset = 0): void {
    this.startedAt = when;
    this.offset = offset;
  }
  stop(when: number): void {
    this.stoppedAt = when;
  }
}
export class FakeOscillator extends FakeSource {
  type: OscillatorType = 'sine';
  readonly frequency = new FakeParam(440);
  readonly detune = new FakeParam(0);
}
export class FakeBufferSource extends FakeSource {
  buffer: FakeBuffer | null = null;
  readonly playbackRate = new FakeParam(1);
  loop = false;
  loopStart = 0;
  loopEnd = 0;
}
export class FakeBiquad extends FakeNode {
  type: BiquadFilterType = 'lowpass';
  readonly frequency = new FakeParam(350);
  readonly Q = new FakeParam(1);
}
export class FakeConvolver extends FakeNode {
  buffer: FakeBuffer | null = null;
}
export class FakeCompressor extends FakeNode {
  readonly threshold = new FakeParam(-24);
  readonly knee = new FakeParam(30);
  readonly ratio = new FakeParam(12);
  readonly attack = new FakeParam(0.003);
  readonly release = new FakeParam(0.25);
}
export class FakeDelay extends FakeNode {
  readonly delayTime = new FakeParam(0);
  constructor(
    readonly maxDelayTime: number,
    context: FakeAudioContext,
  ) {
    super('delay', context);
  }
}

type Constructor<T extends FakeNode> = abstract new (...args: never[]) => T;

// Decoded audio as a browser would hand it over: 23 ms of encoder silence, then a 440 Hz tone
export const decodedTone = (sampleRate = 48000, seconds = 0.3, lead = 0.023): FakeBuffer => {
  const buffer = new FakeBuffer(1, Math.round(sampleRate * seconds), sampleRate);
  const data = buffer.getChannelData(0);
  const first = Math.round(sampleRate * lead);
  for (let i = first; i < data.length; i++) data[i] = 0.5 * Math.sin((2 * Math.PI * 440 * (i - first)) / sampleRate);
  return buffer;
};

export class FakeAudioContext {
  readonly nodes: FakeNode[] = [];
  readonly destination: FakeNode;
  currentTime = 0;
  state: AudioContextState = 'suspended';
  resumes = 0;
  decode: (bytes: ArrayBuffer) => FakeBuffer = () => decodedTone(this.sampleRate);
  constructor(readonly sampleRate = 48000) {
    this.destination = new FakeNode('destination', this);
  }
  createGain(): FakeGain {
    return new FakeGain('gain', this);
  }
  createOscillator(): FakeOscillator {
    return new FakeOscillator('oscillator', this);
  }
  createBufferSource(): FakeBufferSource {
    return new FakeBufferSource('bufferSource', this);
  }
  createBiquadFilter(): FakeBiquad {
    return new FakeBiquad('biquad', this);
  }
  createConvolver(): FakeConvolver {
    return new FakeConvolver('convolver', this);
  }
  createDynamicsCompressor(): FakeCompressor {
    return new FakeCompressor('compressor', this);
  }
  createDelay(maxDelayTime: number): FakeDelay {
    return new FakeDelay(maxDelayTime, this);
  }
  createBuffer(channels: number, length: number, sampleRate: number): FakeBuffer {
    return new FakeBuffer(channels, length, sampleRate);
  }
  decodeAudioData(bytes: ArrayBuffer): Promise<FakeBuffer> {
    return Promise.resolve().then(() => this.decode(bytes));
  }
  resume(): Promise<void> {
    this.resumes++;
    this.state = 'running';
    return Promise.resolve();
  }
  // all nodes of one class, in creation order
  all<T extends FakeNode>(type: Constructor<T>): T[] {
    return this.nodes.filter((node): node is T => node instanceof type);
  }
  // the one node of a class – fails when there are none or several
  single<T extends FakeNode>(type: Constructor<T>): T {
    const [node, ...rest] = this.all(type);
    if (!node || rest.length > 0) throw new Error(`expected exactly one ${type.name}`);
    return node;
  }
  // the engine and its modules take the DOM type; structurally the fake provides what they use
  asContext(): AudioContext {
    return this as unknown as AudioContext;
  }
}
