// Drawing the field: stripes on the right, the chord map on the left. Nothing here decides anything —
// every value it needs is computed in the field, map and theory modules.
import type { Field, Stripe } from '../field/geometry';
import { cssOf, type Oklch, shade, toneColour } from '../field/palette';
import type { MapSpot } from '../map/geometry';
import { SHAPE_SUFFIX } from '../theory/chord-maps';
import type { Fitness } from '../theory/fitness';
import { pcOf } from '../theory/pitch';

export interface HeldStripe {
  readonly stripe: Stripe;
  readonly brightness: number;
  readonly vibrato: number;
  readonly y: number;
}

export interface Floater {
  readonly x: number;
  readonly y: number;
  readonly text: string;
  readonly t0: number;
  readonly up: boolean;
  readonly size: number;
}

export interface FieldScene {
  readonly field: Field;
  readonly fitness: readonly Fitness[];
  readonly tonicStep: number; // stripes on this degree are the tonic of the key
  readonly labels: readonly string[] | null;
  readonly held: readonly HeldStripe[];
  readonly spots: readonly MapSpot[];
  readonly chosen: MapSpot | null;
  readonly band: MapSpot | null; // the chord the band is playing right now
  readonly names: ReadonlyMap<MapSpot, { readonly role: string; readonly chord: string }>;
  readonly lit: (index: number) => boolean; // a tone that just sounded, from anywhere
  readonly ghosts: readonly number[]; // stripes the radio or the loop is playing
  readonly learn: LearnScene | null;
  readonly floaters: readonly Floater[];
  readonly centre: (index: number) => { readonly x: number; readonly y: number } | null;
  readonly now: number;
}

export interface LearnScene {
  readonly groups: readonly { readonly pos: number; readonly rings: readonly { ri: number; ro: number }[] }[];
  readonly spots: readonly (number | null)[]; // stripe per group position
  readonly current: number;
  readonly visibility: number;
  readonly unit: number;
}

const TONIC_SEAM = 'rgba(128,226,214,'; // the key's own tone keeps a seam of its own
const SHEEN = 'rgba(255,251,240,';

const stripePath = (cx: CanvasRenderingContext2D, field: Field, i: number, stripe: Stripe, gap: number): void => {
  const width =
    field.edgeAt(i + 1, (stripe.top + stripe.bottom) / 2) - field.edgeAt(i, (stripe.top + stripe.bottom) / 2);
  const inset = Math.min(gap, Math.max(0.8, width * 0.15));
  const top = stripe.top;
  const bottom = stripe.bottom;
  const round = Math.min(16, (bottom - top) * 0.1, Math.max(2, (width - 2 * inset) * 0.42));
  const left = (y: number): number => field.edgeAt(i, y) + inset;
  const right = (y: number): number => field.edgeAt(i + 1, y) - inset;
  const step = Math.max(12, (bottom - top) / 26);
  cx.beginPath();
  cx.moveTo(left(top + round), top + round);
  for (let y = top + round; y <= bottom - round; y += step) cx.lineTo(left(y), y);
  cx.lineTo(left(bottom - round), bottom - round);
  cx.quadraticCurveTo(left(bottom), bottom, left(bottom) + round, bottom);
  cx.lineTo(right(bottom) - round, bottom);
  cx.quadraticCurveTo(right(bottom), bottom, right(bottom - round), bottom - round);
  for (let y = bottom - round; y >= top + round; y -= step) cx.lineTo(right(y), y);
  cx.lineTo(right(top + round), top + round);
  cx.quadraticCurveTo(right(top), top, right(top) - round, top);
  cx.lineTo(left(top) + round, top);
  cx.quadraticCurveTo(left(top), top, left(top + round), top + round);
  cx.closePath();
};

// A glance of light along the edge, close to it but with a drift of its own
const sheen = (cx: CanvasRenderingContext2D, field: Field, i: number, stripe: Stripe, strength: number): void => {
  const top = stripe.top + 14;
  const bottom = stripe.bottom - 14;
  if (bottom <= top) return;
  const width = field.edgeAt(i + 1, (top + bottom) / 2) - field.edgeAt(i, (top + bottom) / 2);
  const line = Math.max(1, width * 0.1);
  const offset = Math.max(2, width * 0.2);
  const gradient = cx.createLinearGradient(0, top, 0, bottom);
  gradient.addColorStop(0, `${SHEEN}0)`);
  gradient.addColorStop(0.22, `${SHEEN}${String(0.3 * strength)})`);
  gradient.addColorStop(0.55, `${SHEEN}${String(0.52 * strength)})`);
  gradient.addColorStop(0.86, `${SHEEN}${String(0.14 * strength)})`);
  gradient.addColorStop(1, `${SHEEN}0)`);
  cx.strokeStyle = gradient;
  cx.lineWidth = line;
  cx.lineCap = 'round';
  cx.beginPath();
  const step = Math.max(10, (bottom - top) / 26);
  for (let y = top, first = true; y <= bottom; y += step, first = false) {
    const drift = Math.sin((y - top) * 0.009 + i * 0.7) * line * 0.8;
    const x = field.edgeAt(i, y) + offset + drift;
    if (first) cx.moveTo(x, y);
    else cx.lineTo(x, y);
  }
  cx.stroke();
};

// A stripe that is held, sounding or played by someone else glows; everything else stands back a little
interface StripeState {
  readonly fit: Fitness;
  readonly grip: HeldStripe | undefined;
  readonly glow: boolean;
  readonly base: boolean; // the tonic of the key
  readonly colour: Oklch;
}

const stateOf = (scene: FieldScene, i: number, stripe: Stripe): StripeState => {
  const grip = scene.held.find((h) => h.stripe === stripe);
  const sounding = scene.lit(i);
  const ghost = scene.ghosts.includes(i);
  const base = stripe.step === scene.tonicStep;
  const glow = grip !== undefined || sounding || ghost;
  const lift = (grip === undefined ? 0 : 0.07 + grip.brightness * 0.08) + (sounding ? 0.1 : 0) + (ghost ? 0.06 : 0);
  const fit = scene.fitness[i] ?? 2;
  return { fit, grip, glow, base, colour: toneColour(fit, pcOf(stripe.midi), stripe.midi, { held: glow, lift, base }) };
};

// Two seams running along the tonic stripe, so the eye finds home without reading a label
const drawTonicSeam = (cx: CanvasRenderingContext2D, field: Field, i: number, stripe: Stripe): void => {
  const step = Math.max(12, (stripe.bottom - stripe.top) / 26);
  for (const [offset, width, alpha] of [
    [2.6, 3.4, 0.9],
    [6.6, 1.4, 0.35],
  ] as const) {
    cx.strokeStyle = `${TONIC_SEAM}${String(alpha)})`;
    cx.lineWidth = width;
    cx.beginPath();
    cx.moveTo(field.edgeAt(i, stripe.top + 13) + offset, stripe.top + 13);
    for (let y = stripe.top + 13; y <= stripe.bottom - 13; y += step) cx.lineTo(field.edgeAt(i, y) + offset, y);
    cx.stroke();
  }
};

const drawStripeLabel = (
  cx: CanvasRenderingContext2D,
  field: Field,
  i: number,
  stripe: Stripe,
  label: string,
  colour: Oklch,
): void => {
  const y = stripe.bottom - 24;
  cx.textAlign = 'center';
  cx.textBaseline = 'middle';
  cx.font = '600 13px system-ui, sans-serif';
  cx.fillStyle = cssOf(shade(colour, -0.36, 0.6));
  cx.fillText(label, (field.edgeAt(i, y) + field.edgeAt(i + 1, y)) / 2, y);
};

const drawStripe = (cx: CanvasRenderingContext2D, scene: FieldScene, i: number, stripe: Stripe): void => {
  const { field, labels } = scene;
  const { grip, glow, base, colour } = stateOf(scene, i, stripe);
  const middle = (stripe.top + stripe.bottom) / 2;
  const x = (field.edgeAt(i, middle) + field.edgeAt(i + 1, middle)) / 2;
  const gradient = cx.createLinearGradient(x, stripe.top, x, stripe.bottom);
  gradient.addColorStop(0, cssOf(shade(colour, 0.055, 0.92, 4)));
  gradient.addColorStop(0.58, cssOf(colour));
  gradient.addColorStop(1, cssOf(shade(colour, -0.075, 0.8, -5)));

  cx.globalAlpha = base || glow ? 1 : 0.78;
  if (glow) {
    cx.save();
    cx.shadowColor = cssOf(shade(colour, 0.2, 1.4));
    cx.shadowBlur = grip === undefined ? 12 : 16 + grip.brightness * 28 + grip.vibrato * 18;
  }
  stripePath(cx, field, i, stripe, grip === undefined ? 3.2 : 2);
  cx.fillStyle = gradient;
  cx.fill();
  if (glow) {
    cx.fill(); // a second pass deepens the glow
    cx.restore();
  }
  cx.lineWidth = grip === undefined ? 1.2 : 2.4;
  cx.strokeStyle = grip === undefined ? '#090a0b' : cssOf(shade(colour, -0.36, 0.5));
  cx.stroke();
  const held = grip === undefined ? 0 : 0.25;
  sheen(cx, field, i, stripe, base ? 0.62 : 0.17 + held);
  if (base) drawTonicSeam(cx, field, i, stripe);
  cx.globalAlpha = 1;

  const label = labels?.[i];
  if (label !== undefined && label !== '') drawStripeLabel(cx, field, i, stripe, label, colour);
};

const drawStripes = (cx: CanvasRenderingContext2D, scene: FieldScene): void => {
  scene.field.stripes.forEach((stripe, i) => {
    drawStripe(cx, scene, i, stripe);
  });
};

const blobPath = (cx: CanvasRenderingContext2D, spot: MapSpot, radius: number): void => {
  const points: [number, number][] = [];
  const count = 9;
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const wobble = radius * (0.9 + ((Math.sin(spot.seed * 3 + i * 5) + 1) / 2) * 0.17);
    points.push([spot.x + Math.cos(angle) * wobble, spot.y + Math.sin(angle) * wobble * 0.94]);
  }
  const first = points[0] ?? [spot.x, spot.y];
  const last = points[count - 1] ?? first;
  cx.beginPath();
  cx.moveTo((first[0] + last[0]) / 2, (first[1] + last[1]) / 2);
  for (let i = 0; i < count; i++) {
    const p = points[i] ?? first;
    const q = points[(i + 1) % count] ?? first;
    cx.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
  }
  cx.closePath();
};

const SILENCE: Oklch = { l: 0.36, c: 0.004, h: 100 };
const CHOSEN: Oklch = { l: 0.72, c: 0.14, h: 78 };

// How far a chord has grown towards its limit: the stronger the pull, the brighter it stands
const pullOf = (spot: MapSpot): number => Math.max(0, Math.min(1, spot.radius / Math.max(1, spot.limit) - 0.5));

// Cool towards home, warm away from it; the silence stays grey and the chosen chord is the one warm light
const colourOfSpot = (spot: MapSpot, chosen: boolean): Oklch => {
  if (spot.chord === null) return chosen ? { ...SILENCE, l: 0.62 } : SILENCE;
  if (chosen) return CHOSEN;
  const pull = pullOf(spot);
  if (spot.chord.step === 0 && spot.chord.side === 0) return { l: 0.5 + pull * 0.3, c: 0.075 + pull * 0.1, h: 196 };
  let hue = 120;
  if (spot.chord.step < 0) hue = 252;
  else if (spot.chord.step > 0) hue = 44;
  return { l: 0.42 + pull * 0.36, c: 0.025 + pull * 0.12, h: hue };
};

// A light running down the left flank, as if the chord were a pebble in the sun
const drawSpotGlance = (cx: CanvasRenderingContext2D, spot: MapSpot, radius: number, chosen: boolean): void => {
  cx.save();
  cx.clip();
  const glance = cx.createLinearGradient(spot.x - radius, spot.y - radius, spot.x - radius * 0.1, spot.y + radius);
  glance.addColorStop(0, `${SHEEN}0)`);
  glance.addColorStop(0.42, `${SHEEN}${String(chosen ? 0.5 : 0.26)})`);
  glance.addColorStop(1, `${SHEEN}0)`);
  cx.strokeStyle = glance;
  cx.lineWidth = Math.max(2, radius * 0.17);
  cx.beginPath();
  cx.moveTo(spot.x - radius * 0.62, spot.y - radius * 0.5);
  cx.quadraticCurveTo(spot.x - radius * 0.92, spot.y, spot.x - radius * 0.5, spot.y + radius * 0.58);
  cx.stroke();
  cx.restore();
};

// The name of the chord's job, and under it the chord symbol – as much as fits inside
const drawSpotName = (
  cx: CanvasRenderingContext2D,
  spot: MapSpot,
  radius: number,
  chosen: boolean,
  name: { readonly role: string; readonly chord: string },
): void => {
  const pull = pullOf(spot);
  cx.textAlign = 'center';
  cx.textBaseline = 'middle';
  const words = name.role.split(' ');
  const longest = Math.max(...words.map((w) => w.length));
  const size = Math.max(8, Math.min(radius * 0.34, (radius * 1.7) / (longest * 0.58)));
  cx.fillStyle = chosen ? 'rgba(22,20,16,.95)' : `rgba(232,228,218,${String(0.45 + pull * 0.5)})`;
  cx.font = `600 ${String(size)}px system-ui, sans-serif`;
  const twoLines = words.length > 1 && name.role.length > 12 && radius > 30;
  if (twoLines) {
    const half = Math.ceil(words.length / 2);
    cx.fillText(words.slice(0, half).join(' '), spot.x, spot.y - size * 0.6);
    cx.fillText(words.slice(half).join(' '), spot.x, spot.y + size * 0.5);
  } else cx.fillText(name.role, spot.x, spot.y - (radius > 26 ? 2 : 0));
  if (radius > 26 && name.chord !== '') {
    cx.fillStyle = chosen ? 'rgba(52,40,12,.9)' : `rgba(150,152,143,${String(0.4 + pull * 0.45)})`;
    cx.font = `${String(size - 2)}px system-ui, sans-serif`;
    cx.fillText(name.chord, spot.x, spot.y + size * (twoLines ? 1.6 : 1.3));
  }
};

const drawSpot = (cx: CanvasRenderingContext2D, scene: FieldScene, spot: MapSpot): void => {
  const chosen = spot === scene.chosen;
  const colour = colourOfSpot(spot, chosen);
  const radius = spot.radius;

  blobPath(cx, spot, radius);
  const gradient = cx.createLinearGradient(spot.x, spot.y - radius, spot.x, spot.y + radius);
  gradient.addColorStop(0, cssOf(shade(colour, 0.06, 0.9, 4)));
  gradient.addColorStop(0.6, cssOf(colour));
  gradient.addColorStop(1, cssOf(shade(colour, -0.08, 0.8, -5)));
  if (chosen) {
    cx.save();
    cx.shadowColor = cssOf(shade(colour, 0.12, 1.1));
    cx.shadowBlur = 26;
  }
  cx.fillStyle = gradient;
  cx.fill();
  if (chosen) cx.restore();
  cx.lineWidth = 1.4;
  cx.strokeStyle = '#090a0b';
  cx.stroke();
  drawSpotGlance(cx, spot, radius, chosen);

  if (spot.chord?.step === 0 && spot.chord.side === 0) {
    cx.strokeStyle = `${TONIC_SEAM}0.85)`;
    cx.lineWidth = 2.6;
    blobPath(cx, spot, radius * 1.1);
    cx.stroke();
  }
  if (spot === scene.band) {
    // The band is on this chord: a ring that breathes with the bar
    const pulse = 0.5 + 0.5 * Math.sin(scene.now / 260);
    cx.strokeStyle = `rgba(255,206,120,${String(0.45 + pulse * 0.4)})`;
    cx.lineWidth = 3;
    blobPath(cx, spot, radius * (1.16 + pulse * 0.06));
    cx.stroke();
  }

  const name = scene.names.get(spot);
  if (name !== undefined && radius > 15) drawSpotName(cx, spot, radius, chosen, name);
};

const drawMap = (cx: CanvasRenderingContext2D, scene: FieldScene): void => {
  for (const spot of scene.spots) drawSpot(cx, scene, spot);
};

// Waves running outwards from a held stripe, faster and stronger the more it wavers
const drawWaves = (cx: CanvasRenderingContext2D, scene: FieldScene): void => {
  const t = scene.now / 1000;
  for (const grip of scene.held) {
    const i = scene.field.stripes.indexOf(grip.stripe);
    if (i < 0) continue;
    const middle = (scene.field.edgeAt(i, grip.y) + scene.field.edgeAt(i + 1, grip.y)) / 2;
    const half = (scene.field.edgeAt(i + 1, grip.y) - scene.field.edgeAt(i, grip.y)) / 2;
    const speed = 0.5 + grip.vibrato * 2;
    for (let k = 0; k < 2; k++) {
      const phase = (t * speed + k / 2) % 1;
      cx.globalAlpha = (1 - phase) * (0.12 + grip.vibrato * 0.45 + grip.brightness * 0.12);
      cx.strokeStyle = cssOf({ l: 0.8, c: 0.08, h: 90 });
      cx.lineWidth = 2.4 * (1 - phase * 0.5);
      cx.beginPath();
      cx.ellipse(middle, grip.y, Math.abs(half) * (0.5 + phase * 0.8), 18 + phase * 30, 0, 0, Math.PI * 2);
      cx.stroke();
    }
    cx.globalAlpha = 1;
  }
};

// A ring of the learn mode: the one that is due glows, the ones ahead fade with their distance
const drawLearnRing = (
  cx: CanvasRenderingContext2D,
  centre: { readonly x: number; readonly y: number },
  ring: { readonly ri: number; readonly ro: number },
  ahead: number,
  visibility: number,
  onHeldStripe: boolean,
): void => {
  const alpha = (ahead === 0 ? 1 : Math.max(0.12, 0.7 - ahead * 0.16)) * visibility;
  const rest = onHeldStripe ? '30,28,24' : '244,240,230';
  cx.fillStyle = ahead === 0 ? `rgba(255,214,102,${String(alpha)})` : `rgba(${rest},${String(alpha)})`;
  cx.beginPath();
  cx.arc(centre.x, centre.y, ring.ro, 0, Math.PI * 2);
  if (ring.ri > 0) cx.arc(centre.x, centre.y, ring.ri, 0, Math.PI * 2, true);
  cx.fill();
};

// The learn mode's dots sit on the stripe of their tone; rings show how often it repeats. Drawn from the back, so
// the tone that is due lies on top.
const drawLearn = (cx: CanvasRenderingContext2D, scene: FieldScene): void => {
  const learn = scene.learn;
  if (learn === null) return;
  for (const [g, group] of [...learn.groups.entries()].reverse()) {
    const index = learn.spots[g] ?? null;
    const centre = index === null ? null : scene.centre(index);
    if (centre === null) continue;
    const onHeldStripe = scene.held.some((h) => h.stripe.index === index);
    for (const [i, ring] of [...group.rings.entries()].reverse()) {
      drawLearnRing(cx, centre, ring, group.pos - learn.current + i, learn.visibility, onHeldStripe);
    }
  }
};

const FLOATER_MS = 900;

const drawFloaters = (cx: CanvasRenderingContext2D, scene: FieldScene): void => {
  cx.textAlign = 'center';
  cx.textBaseline = 'middle';
  for (const floater of scene.floaters) {
    const k = (scene.now - floater.t0) / FLOATER_MS;
    if (k >= 1) continue;
    cx.globalAlpha = 1 - k * k;
    cx.font = `700 ${String(18 * floater.size)}px system-ui, sans-serif`;
    cx.fillStyle = floater.up ? 'rgba(246,242,232,.96)' : 'rgba(255,150,110,.96)';
    cx.fillText(floater.text, floater.x, floater.y + (floater.up ? -40 * k : 30 * k * k));
  }
  cx.globalAlpha = 1;
};

export const drawField = (cx: CanvasRenderingContext2D, scene: FieldScene, width: number, height: number): void => {
  cx.fillStyle = '#0b0c0d';
  cx.fillRect(0, 0, width, height);
  drawStripes(cx, scene);
  drawLearn(cx, scene);
  drawMap(cx, scene);
  drawWaves(cx, scene);
  drawFloaters(cx, scene);
};

export const chordCaption = (spot: MapSpot, role: string, tonic: number): string =>
  spot.chord === null ? role : `${role} · ${String(tonic)}${SHAPE_SUFFIX[spot.chord.shape]}`;
