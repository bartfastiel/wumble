// The shaders of the field. One full-screen triangle; the fragment shader is the whole picture.
//
// The keys are white resin under a hard clear coat, lying on a dark velvet stage beneath a long studio softbox. The
// view is 2.5D: every key is a height field derived exactly from its rounded-box distance – a quarter-round bevel
// with an analytic normal – lit by a key light and reflecting a procedural studio. Depth comes from what a real
// surface does: the softbox reflection breaks a little differently on every key, joints hold contact and drop
// shadows, the front of each key shows a narrow face, a pressed key sinks and glows from inside like acrylic, and its
// neighbours catch that light only on the bevels that face it. Vibrato runs as waves along the pressed key – seen as
// bands of gloss, never painted on – and a sounding key shimmers like a bowed string.

export const VERTEX = `#version 300 es
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

export const fragment = (maxKeys: number, maxTouches: number): string => {
  const KEYS = String(maxKeys);
  const TOUCHES = String(maxTouches);
  return `#version 300 es
precision highp float;
uniform vec2 u_res;
uniform float u_scale;     // device pixels per layout pixel
uniform float u_time;
uniform int u_keyCount;
uniform vec4 u_keys[${KEYS}];          // left, right, fitness (+10 for the tonic), glow
uniform float u_halfGap;
uniform float u_bottom;    // device pixels kept free below the keys
uniform int u_touchCount;
uniform vec4 u_touches[${TOUCHES}];    // x, y, dynamics, vibrato depth
uniform float u_touchPhase[${TOUCHES}]; // vibrato phase from the synth, 0 … 1
out vec4 colour;

const float TAU = 6.2831853;
const vec3 LIGHT = vec3(0.30, 0.56, 1.00);
const vec3 SEAM = vec3(0.04, 0.20, 0.90);
const vec3 RESIN = vec3(0.70, 0.71, 0.73);
const vec3 SLATE = vec3(0.17, 0.20, 0.25);

float hash(float n) { return fract(sin(n * 91.345) * 47453.21); }
float hash2(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash2(i), hash2(i + vec2(1, 0)), f.x), mix(hash2(i + vec2(0, 1)), hash2(i + vec2(1, 1)), f.x), f.y);
}

float roundedBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

// .x distance, .yz outward gradient
vec3 roundedBoxGrad(vec2 p, vec2 b, float r) {
  vec2 w = abs(p) - b + r, q = max(w, 0.0);
  float g = max(w.x, w.y), l = length(q);
  vec2 n = g > 0.0 ? q / max(l, 1e-4) : (w.x > w.y ? vec2(1, 0) : vec2(0, 1));
  return vec3((g > 0.0 ? l : g) - r, sign(p) * n);
}

struct Box { vec2 c; vec2 b; float r; };

Box keyBox(int i, float s) {
  vec4 k = u_keys[i];
  vec2 lo = vec2(k.x * u_res.x, 18.0 * s);
  vec2 hi = vec2(k.y * u_res.x, u_res.y - u_bottom);
  float r = min(16.0 * s, (hi.x - lo.x) * 0.45) * (1.0 + (hash(float(i) * 3.1) - 0.5) * 0.12);
  return Box((lo + hi) * 0.5, (hi - lo) * 0.5, r);
}

// A studio around the instrument: dark floor, a long softbox across, a narrow strip light down the left
vec3 studio(vec3 r) {
  vec3 e = mix(vec3(0.02, 0.025, 0.035), vec3(0.20, 0.23, 0.28), smoothstep(-0.1, 0.95, r.z));
  e += vec3(16.0, 16.4, 17.0) * smoothstep(0.11, 0.03, abs(r.y + 0.5)) * smoothstep(0.85, 0.55, abs(r.x));
  e += vec3(4.0, 4.6, 5.4) * smoothstep(0.12, 0.0, abs(r.y + 0.12)) * smoothstep(0.9, 0.4, abs(r.x));
  e += vec3(9.0, 10.0, 12.0) * smoothstep(0.03, 0.0, abs(r.x + 0.18)) * step(r.y, 0.2);
  return e;
}

vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }

void main() {
  float s = u_scale;
  vec2 px = vec2(gl_FragCoord.x, u_res.y - gl_FragCoord.y); // y down, towards the player
  vec2 uv = px / u_res;

  // The key under this pixel and its neighbours
  int k = u_keyCount - 1;
  for (int i = 0; i < ${KEYS}; i++) {
    if (i >= u_keyCount) break;
    if (uv.x < u_keys[i].y + u_halfGap) { k = i; break; }
  }
  int kl = max(k - 1, 0), kr = min(k + 1, u_keyCount - 1);
  vec4 key = u_keys[k];
  Box box = keyBox(k, s), boxL = keyBox(kl, s), boxR = keyBox(kr, s);
  float glow = key.w;
  float tonic = step(9.5, key.z);
  float fitness = key.z - 10.0 * tonic;
  float height = 2.0 * box.b.y;
  vec2 lo = box.c - box.b;

  // How far this key is pressed in: the firmest finger on it
  float sink = 0.0;
  for (int i = 0; i < ${TOUCHES}; i++) {
    if (i >= u_touchCount) break;
    vec2 at = u_touches[i].xy * u_res;
    if (abs(at.x - box.c.x) < box.b.x) sink = max(sink, clamp(u_touches[i].z, 0.0, 1.0));
  }

  // ---- stage: velvet, contact and drop shadows in the joints, a glimmer where a key sounds ----------------------
  vec3 stage = mix(vec3(0.045, 0.055, 0.075), vec3(0.010, 0.012, 0.018), uv.y);
  vec2 e = (uv - vec2(0.5, 0.4)) * vec2(1.0, u_res.y / u_res.x * 0.7);
  stage *= 1.0 - 0.55 * dot(e, e) * 2.0;
  float dK = roundedBox(px - box.c, box.b, box.r);
  float dL = roundedBox(px - boxL.c, boxL.b, boxL.r);
  float dR = roundedBox(px - boxR.c, boxR.b, boxR.r);
  float contact = max(min(dK, min(dL, dR)), 0.0);
  vec2 drop = vec2(0.0, 5.0 * s * (1.0 - 0.5 * sink));
  float dS = min(roundedBox(px - box.c - drop, box.b, box.r),
                 min(roundedBox(px - boxL.c - drop, boxL.b, boxL.r), roundedBox(px - boxR.c - drop, boxR.b, boxR.r)));
  stage *= (1.0 - 0.75 * exp(-contact / (4.0 * s))) * mix(0.45, 1.0, smoothstep(-2.0 * s, 7.0 * s, dS));
  float g5 = 5.0 * s;
  stage += LIGHT * 0.3 * (glow * exp(-max(dK, 0.0) / g5) + u_keys[kl].w * exp(-max(dL, 0.0) / g5)
                       + u_keys[kr].w * exp(-max(dR, 0.0) / g5));

  // ---- the key's material -----------------------------------------------------------------------------------
  float kh = hash(float(k) + 0.37);
  vec3 albedo = mix(RESIN, SLATE, fitness / 3.0 * 0.85);
  albedo *= 1.0 + (vec3(hash(kh + 2.1), hash(kh + 4.3), hash(kh + 6.5)) - 0.5) * 0.024; // colour temperature

  // Front face: a narrow band below each key, narrower as it sinks
  float face = 4.0 * s * (1.0 - 0.6 * sink);
  float dF = roundedBox(px - box.c - vec2(0.0, face), box.b, box.r);
  float frontMask = clamp(0.5 - dF / s, 0.0, 1.0) * step(0.0, dK);
  vec3 front = albedo * 0.42 + vec3(0.6) * exp(-pow((dF + 1.2 * s) / (0.8 * s), 2.0)) * 0.35;

  // Height field: a quarter-round bevel, its normal analytic
  vec3 sg = roundedBoxGrad(px - box.c, box.b, box.r);
  float bevel = min(9.0 * s, box.b.x * 0.55);
  float t = clamp(-sg.x / bevel, 0.0, 1.0);
  float hp = sqrt(max(t * (2.0 - t), 0.0025));
  vec2 grad = 0.6 * (1.0 - t) / hp * sg.yz;
  grad += (vec2(hash(kh), hash(kh + 1.7)) - 0.5) * 0.012; // every key tilts a hair differently
  grad += (vec2(noise(px / (5.0 * s)), noise(px / (5.0 * s) + 17.0)) - 0.5) * 0.006; // orange peel in the lacquer

  vec3 inner = vec3(0.0);
  vec3 rim = vec3(0.0);
  float caustic = 1.0;
  for (int i = 0; i < ${TOUCHES}; i++) {
    if (i >= u_touchCount) break;
    vec4 f = u_touches[i];
    vec2 at = f.xy * u_res;
    vec2 dv = px - at;
    float dyn = clamp(f.z, 0.0, 1.2);
    bool own = abs(at.x - box.c.x) < box.b.x;
    if (own) {
      // The finger presses a hollow: seen as the reflection bending round it, not as a dark stain
      float sig = (20.0 + 22.0 * dyn) * s;
      grad -= t * 0.8 * dyn * exp(-dot(dv, dv) / (sig * sig)) * 2.0 * dv / sig;
      // Light inside the resin: bright where the finger presses, guided along the key from there
      float reach = height * 0.3 * (0.5 + dyn);
      float spot = (14.0 + 18.0 * dyn) * s;
      inner += LIGHT * (0.35 + 0.7 * dyn) * exp(-abs(dv.y) / reach);
      inner += LIGHT * (0.4 + 2.2 * dyn) * exp(-dot(dv, dv) / (spot * spot));
      // Vibrato: waves running along the key away from the finger, in step with the synth
      float ady = abs(dv.y);
      float phase = u_touchPhase[i];
      float wave = ady * TAU / (14.0 * s) - TAU * phase * 2.0;
      float amp = f.w * 0.10 * (0.6 + 0.4 * sin(TAU * phase)) * exp(-ady / (height * 0.25)) * t;
      grad.y += amp * cos(wave) * sign(dv.y);
      caustic *= 1.0 + 3.0 * amp * sin(wave);
    }
    // Neighbours catch the light only on the bevels that face it
    vec3 toLight = normalize(vec3(at - px, 6.0 * s));
    vec3 n0 = normalize(vec3(grad, 1.0));
    rim += LIGHT * dyn * max(dot(n0, toLight), 0.0) * (1.0 - n0.z) * exp(-length(dv) / (70.0 * s));
  }
  // A sounding key shimmers like a bowed string: a standing wave in the strip light's line along its bevel
  float yN = (px.y - lo.y) / height;
  float rate = TAU * (3.0 + 6.0 * float(k) / float(max(u_keyCount, 1)));
  grad.x += glow * 0.05 * sin(TAU * yN) * sin(rate * u_time) * (1.0 - t);
  inner += LIGHT * glow * (0.35 + 0.15 * abs(sin(TAU * yN)));
  inner *= caustic * (1.0 + 0.8 * (1.0 - t));

  vec3 N = normalize(vec3(grad, 1.0));
  vec3 eye = vec3(0.5 * u_res.x, 1.25 * u_res.y, 1.6 * u_res.y);
  vec3 V = normalize(eye - vec3(px, 0.0));
  vec3 Rf = reflect(-V, N);
  float F = 0.04 + 0.96 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
  vec3 keyLight = normalize(vec3(0.0, -0.5, 1.0));
  vec3 base = albedo * (0.20 + 0.65 * max(dot(N, keyLight), 0.0)) * (1.0 - 0.06 * sink);
  vec3 lit = base * (1.0 - F) + studio(Rf) * F + inner * (1.0 - F) + rim;
  // The tonic's seam: a fine blue inlay down the flat top
  float seam = smoothstep(1.6 * s, 0.4 * s, abs(px.x - box.c.x)) * smoothstep(0.0, 0.12, yN) * smoothstep(1.0, 0.85, yN);
  lit = mix(lit, SEAM * (0.6 + inner), seam * tonic * t * 0.85);

  float inside = clamp(0.5 - dK / max(s, 1.0), 0.0, 1.0);
  // A faint mirror of the key in the lacquered floor below
  float below = px.y - (box.c.y + box.b.y + face);
  stage += albedo * 0.12 * step(0.0, below) * exp(-max(below, 0.0) / (20.0 * s)) * step(abs(px.x - box.c.x), box.b.x);
  vec3 c = mix(stage, front, frontMask);
  c = mix(c, lit, inside);

  // Film grain, tone mapping, dither against banding in the dark gradient
  c *= 1.0 + (hash2(gl_FragCoord.xy + fract(u_time) * 97.0) - 0.5) * mix(0.03, 0.01, inside);
  c = pow(aces(c * 1.25), vec3(1.0 / 2.2));
  c += (hash2(gl_FragCoord.xy) + hash2(gl_FragCoord.yx + 3.7) - 1.0) / 255.0;
  colour = vec4(c, 1.0);
}`;
};
