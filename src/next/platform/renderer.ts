// Draws the field in one call (the picture itself is in shaders.ts). The key of the music shows in the material:
// what carries is nearly white, what pulls falls away into slate, and the tonic carries a blue seam.
//
// The resolution regulates itself: when frames arrive late, it renders fewer pixels rather than fewer frames.
import { VERTEX, fragment } from './shaders';

export interface SceneKey {
  readonly left: number; // 0 … 1 of the width
  readonly right: number;
  readonly fitness: number; // 0 carries … 3 pulls
  readonly tonic: boolean;
  readonly glow: number; // 0 … 1, how loud it sounds
}

export interface SceneTouch {
  readonly x: number; // 0 … 1
  readonly y: number; // 0 … 1, 0 at the top
  readonly dynamics: number;
  readonly vibrato: number; // 0 … 1, its depth
  readonly vibratoPhase: number; // 0 … 1, from the synth
}

export interface Scene {
  readonly keys: readonly SceneKey[];
  readonly touches: readonly SceneTouch[];
  readonly gap: number; // between two keys, 0 … 1 of the width
  readonly time: number; // seconds
}

const MAX_KEYS = 32;
const MAX_TOUCHES = 8;
const FRAGMENT = fragment(MAX_KEYS, MAX_TOUCHES);

const compileShader = (gl: WebGL2RenderingContext, type: number, source: string): WebGLShader => {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('no shader');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) ?? 'shader');
  return shader;
};

interface Program {
  readonly gl: WebGL2RenderingContext;
  readonly locations: Record<string, WebGLUniformLocation | null>;
}

const build = (gl: WebGL2RenderingContext): Program => {
  const program = gl.createProgram();
  gl.attachShader(program, compileShader(gl, gl.VERTEX_SHADER, VERTEX));
  gl.attachShader(program, compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? 'link');
  gl.useProgram(program);
  gl.bindVertexArray(gl.createVertexArray());
  const names = [
    'u_res',
    'u_scale',
    'u_time',
    'u_keyCount',
    'u_keys',
    'u_halfGap',
    'u_bottom',
    'u_touchCount',
    'u_touches',
    'u_touchPhase',
  ];
  return { gl, locations: Object.fromEntries(names.map((n) => [n, gl.getUniformLocation(program, n)])) };
};

const LATE = 21; // ms: a frame gap above this, kept up, means the device is struggling
const STEPS = [1, 1.25, 1.5, 2, 2.5, 3];

export class Renderer {
  private program: Program | undefined;
  private readonly keys = new Float32Array(MAX_KEYS * 4);
  private readonly touches = new Float32Array(MAX_TOUCHES * 4);
  private readonly phases = new Float32Array(MAX_TOUCHES);
  private step: number;
  private lastFrame = 0;
  private slowFrames = 0;
  private fastFrames = 0;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const best = STEPS.filter((s) => s <= Math.max(1, devicePixelRatio)).length - 1;
    this.step = Math.max(0, best - 1); // the first frames are the expensive ones
    canvas.addEventListener('webglcontextlost', (event) => {
      event.preventDefault();
      this.program = undefined;
    });
    canvas.addEventListener('webglcontextrestored', () => {
      this.program = this.create();
    });
    this.program = this.create();
  }

  private create(): Program | undefined {
    const gl = this.canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      powerPreference: 'high-performance',
    });
    if (!gl) return undefined;
    try {
      return build(gl);
    } catch (error) {
      console.error('wumble: no picture', error);
      return undefined;
    }
  }

  get available(): boolean {
    return this.program !== undefined;
  }

  get scale(): number {
    return STEPS[this.step] ?? 1;
  }

  private regulate(now: number): void {
    const gap = now - this.lastFrame;
    this.lastFrame = now;
    if (gap > 200) return; // the page was hidden
    if (gap > LATE) {
      this.slowFrames++;
      this.fastFrames = 0;
    } else {
      this.fastFrames++;
      this.slowFrames = Math.max(0, this.slowFrames - 1);
    }
    if (this.slowFrames > 20 && this.step > 0) {
      this.step--;
      this.slowFrames = 0;
    } else if (
      this.fastFrames > 240 &&
      STEPS[this.step + 1] !== undefined &&
      (STEPS[this.step + 1] ?? 9) <= devicePixelRatio
    ) {
      this.step++;
      this.fastFrames = 0;
    }
  }

  draw(scene: Scene, now: number): void {
    this.regulate(now);
    const program = this.program;
    if (!program) return;
    const { gl, locations } = program;
    const scale = this.scale;
    const width = Math.round(this.canvas.clientWidth * scale);
    const height = Math.round(this.canvas.clientHeight * scale);
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    gl.viewport(0, 0, width, height);

    this.keys.fill(0);
    scene.keys.slice(0, MAX_KEYS).forEach((k, i) => {
      this.keys.set([k.left, k.right, k.fitness + (k.tonic ? 10 : 0), k.glow], i * 4);
    });
    this.touches.fill(0);
    scene.touches.slice(0, MAX_TOUCHES).forEach((t, i) => {
      this.touches.set([t.x, t.y, t.dynamics, t.vibrato], i * 4);
      this.phases[i] = t.vibratoPhase;
    });
    gl.uniform2f(locations.u_res ?? null, width, height);
    // Sizes in the shader are layout pixels of a medium tablet, shrunk on a phone so a finger's light stays near it
    const size = Math.min(1.2, Math.max(0.55, Math.min(this.canvas.clientWidth, this.canvas.clientHeight) / 700));
    gl.uniform1f(locations.u_scale ?? null, scale * size);
    gl.uniform1f(locations.u_time ?? null, scene.time);
    gl.uniform1i(locations.u_keyCount ?? null, Math.min(MAX_KEYS, scene.keys.length));
    gl.uniform4fv(locations.u_keys ?? null, this.keys);
    gl.uniform1f(locations.u_halfGap ?? null, scene.gap / 2);
    gl.uniform1f(locations.u_bottom ?? null, 26 * scale);
    gl.uniform1i(locations.u_touchCount ?? null, Math.min(MAX_TOUCHES, scene.touches.length));
    gl.uniform4fv(locations.u_touches ?? null, this.touches);
    gl.uniform1fv(locations.u_touchPhase ?? null, this.phases);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
}
