// The whole picture in one draw call: a full-screen triangle whose fragment shader paints the keys as white lacquer,
// the fingers as light pressed into it, and the sound as a glow along the edges.
//
// The resolution regulates itself: when frames arrive late, it renders fewer pixels rather than fewer frames.

export interface SceneKey {
  readonly left: number; // 0 … 1 of the width
  readonly right: number;
  readonly fitness: number; // 0 carries … 3 pulls
  readonly glow: number; // 0 … 1, how loud it sounds
}

export interface SceneTouch {
  readonly x: number; // 0 … 1
  readonly y: number; // 0 … 1, 0 at the top
  readonly dynamics: number;
  readonly bendCents: number;
}

export interface Scene {
  readonly keys: readonly SceneKey[];
  readonly touches: readonly SceneTouch[];
  readonly time: number; // seconds
}

const MAX_KEYS = 8;
const MAX_TOUCHES = 8;
// GLSL needs the array sizes as literals
const KEYS_GLSL = String(MAX_KEYS);
const TOUCHES_GLSL = String(MAX_TOUCHES);

const VERTEX = `#version 300 es
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const FRAGMENT = `#version 300 es
precision highp float;
uniform vec2 u_res;
uniform float u_scale;   // device pixels per layout pixel
uniform float u_time;
uniform int u_keyCount;
uniform vec4 u_keys[${KEYS_GLSL}];     // left, right, fitness, glow
uniform int u_touchCount;
uniform vec4 u_touches[${TOUCHES_GLSL}]; // x, y, dynamics, bend
out vec4 colour;

const vec3 NIGHT = vec3(0.043, 0.055, 0.078);
const vec3 DUSK = vec3(0.090, 0.110, 0.150);
const vec3 LACQUER = vec3(0.965, 0.970, 0.980);
const vec3 SHADE = vec3(0.800, 0.825, 0.865);
const vec3 LIGHT = vec3(0.420, 0.640, 1.000);

float roundedBox(vec2 p, vec2 extent, float r) {
  vec2 q = abs(p) - extent + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

void main() {
  float s = u_scale;
  vec2 px = vec2(gl_FragCoord.x, u_res.y - gl_FragCoord.y); // y down, as the page
  vec2 uv = px / u_res;
  float margin = 18.0 * s;

  // Ground: a dark, cool stage with a soft fall-off
  vec3 c = mix(DUSK, NIGHT, uv.y) * (1.0 - 0.35 * length(uv - vec2(0.5, 0.35)));

  // Which key this pixel belongs to: the keys are sorted, so the first whose right edge lies beyond it
  int k = u_keyCount - 1;
  for (int i = 0; i < ${KEYS_GLSL}; i++) {
    if (i >= u_keyCount) break;
    if (uv.x < u_keys[i].y + 0.006) { k = i; break; }
  }
  vec4 key = u_keys[k];
  vec2 lo = vec2(key.x * u_res.x, margin);
  vec2 hi = vec2(key.y * u_res.x, u_res.y - margin - 18.0 * s); // room for the status line
  float d = roundedBox(px - (lo + hi) * 0.5, (hi - lo) * 0.5, 16.0 * s);
  float inside = clamp(0.5 - d / s, 0.0, 1.0);
  float glow = key.w;

  // Lacquer: brighter where it carries, a breath of slate where it pulls; a highlight near the top, a bevel round it
  float depth = (px.y - lo.y) / (hi.y - lo.y);
  vec3 lacquer = mix(LACQUER, SHADE, 0.10 + 0.35 * depth * depth) * (1.0 - 0.035 * key.z);
  lacquer += 0.10 * exp(-pow((px.y - lo.y - 46.0 * s) / (26.0 * s), 2.0));
  float bevel = smoothstep(-14.0 * s, 0.0, d);
  lacquer *= 1.0 - 0.16 * bevel;
  lacquer = mix(lacquer, LACQUER + LIGHT * 0.25, glow * 0.22);
  lacquer += LIGHT * bevel * glow * 0.65;

  vec3 spill = vec3(0.0);
  for (int t = 0; t < ${TOUCHES_GLSL}; t++) {
    if (t >= u_touchCount) break;
    vec4 f = u_touches[t];
    float dyn = clamp(f.z, 0.0, 1.2);
    float bend = f.w / 45.0;
    // The light follows the vibrato: it wavers sideways with the bend
    vec2 at = vec2(f.x * u_res.x + bend * 22.0 * s, f.y * u_res.y);
    float r = length(px - at);
    float radius = (34.0 + 150.0 * dyn) * s;
    // The finger presses into the lacquer: the deeper the pressure, the wider and darker the hollow
    float hollow = exp(-pow(r / radius, 2.0)) * (0.06 + 0.30 * dyn);
    lacquer *= 1.0 - hollow;
    // and light gathers in the hollow
    lacquer += LIGHT * exp(-pow(r / (radius * 0.55), 2.0)) * (0.25 + 0.75 * dyn);
    // Rings run outwards while the note is bent – the vibrato made visible
    float rings = 0.5 + 0.5 * sin(r / (9.0 * s) - u_time * 9.0);
    lacquer += LIGHT * rings * abs(bend) * 0.35 * exp(-r / (radius * 1.4));
    spill += LIGHT * exp(-r / (radius * 0.9)) * (0.10 + 0.25 * dyn);
  }

  c = mix(c + spill, lacquer, inside);
  colour = vec4(pow(c, vec3(1.0 / 1.08)), 1.0);
}`;

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
  const names = ['u_res', 'u_scale', 'u_time', 'u_keyCount', 'u_keys', 'u_touchCount', 'u_touches'];
  return { gl, locations: Object.fromEntries(names.map((n) => [n, gl.getUniformLocation(program, n)])) };
};

const LATE = 21; // ms: a frame gap above this, kept up, means the device is struggling
const STEPS = [1, 1.25, 1.5, 2, 2.5, 3];

export class Renderer {
  private program: Program | undefined;
  private readonly keys = new Float32Array(MAX_KEYS * 4);
  private readonly touches = new Float32Array(MAX_TOUCHES * 4);
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
      this.keys.set([k.left, k.right, k.fitness, k.glow], i * 4);
    });
    this.touches.fill(0);
    scene.touches.slice(0, MAX_TOUCHES).forEach((t, i) => {
      this.touches.set([t.x, t.y, t.dynamics, t.bendCents], i * 4);
    });
    gl.uniform2f(locations.u_res ?? null, width, height);
    // Sizes in the shader are layout pixels of a medium tablet, shrunk on a phone so a finger's light stays near it
    const size = Math.min(1.2, Math.max(0.55, Math.min(this.canvas.clientWidth, this.canvas.clientHeight) / 700));
    gl.uniform1f(locations.u_scale ?? null, scale * size);
    gl.uniform1f(locations.u_time ?? null, scene.time);
    gl.uniform1i(locations.u_keyCount ?? null, Math.min(MAX_KEYS, scene.keys.length));
    gl.uniform4fv(locations.u_keys ?? null, this.keys);
    gl.uniform1i(locations.u_touchCount ?? null, Math.min(MAX_TOUCHES, scene.touches.length));
    gl.uniform4fv(locations.u_touches ?? null, this.touches);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
}
