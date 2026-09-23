// Drawing the field: stripes on the right, the chord map on the left. Nothing here decides anything —
// every value it needs is computed in the field, map and theory modules.
import { type Field, isStraight, type Look, type Stripe } from '../field/geometry';
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

export const CLAP = 'clap'; // a floater that is drawn rather than written

export interface Floater {
  readonly x: number;
  readonly y: number;
  readonly text: string; // CLAP, or the text itself
  readonly t0: number;
  readonly up: boolean;
  readonly size: number;
}

// The strip below the field: a map of the whole range, with the octave it settles on marked
export interface SliderScene {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
  readonly focus: number; // the stripe in the middle right now
  readonly settling: number; // where it will come to rest
  readonly count: number;
  readonly perOctave: number;
  readonly held: boolean;
}

// Where the schema is heading, and how much of this bar is left before it gets there
export interface AheadScene {
  readonly spot: MapSpot;
  readonly progress: number; // 0 at the start of the bar, 1 when the chord changes
}

export interface FieldScene {
  readonly look: Look;
  readonly ahead: AheadScene | null;
  readonly slider: SliderScene;
  readonly field: Field;
  readonly fitness: readonly Fitness[];
  readonly tonicStep: number; // stripes on this degree are the tonic of the key
  readonly labels: readonly string[] | null;
  readonly held: readonly HeldStripe[];
  readonly spots: readonly MapSpot[];
  readonly chosen: MapSpot | null;
  readonly accompanying: boolean; // false: the chosen chord is only the reference, it is not heard
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

// Every look brings its own light. The grown and built ones are warm on graphite; the polished one is white
// lacquer under a cool lamp, where the shapes are bright and the lines between them are the dark.
interface Ink {
  readonly back: string; // the canvas behind everything
  readonly sheen: string; // the glance running along an edge, as an 'rgba(r,g,b,' prefix
  readonly seam: string; // the tonic keeps a seam of its own
  readonly homeRing: string; // the ring around the tonic's chord, which must not look like the chosen one
  readonly nameFloor: number; // how present a chord's name is at its faintest
  readonly gloss: readonly [number, number]; // how much brighter the top of a face is, how much deeper its foot
  readonly rim: number; // a lit edge along the top, as lightness above the face – 0 leaves it flat
  readonly lift: readonly [string, number, number]; // the shadow a face casts: colour, blur, drop
  readonly edge: string; // the line around a shape
  readonly onShape: string; // a chord's name on an unchosen shape, as an 'rgba(r,g,b,' prefix
  readonly onShapeSub: string; // the chord symbol under it
  readonly onChosen: string; // the name on the chosen shape, which is bright in every look
  readonly onChosenSub: string;
  readonly range: string; // the window and the mark on the range strip
  readonly wave: Oklch; // the rings a held tone sends out
}

const WARM: Ink = {
  back: '#0b0c0d',
  sheen: 'rgba(255,251,240,',
  seam: 'rgba(128,226,214,',
  homeRing: 'rgba(128,226,214,',
  nameFloor: 0.45,
  gloss: [0.055, -0.075],
  rim: 0,
  lift: ['rgba(0,0,0,0)', 0, 0],
  edge: '#090a0b',
  onShape: 'rgba(232,228,218,',
  onShapeSub: 'rgba(150,152,143,',
  onChosen: 'rgba(22,20,16,.95)',
  onChosenSub: 'rgba(52,40,12,.9)',
  range: '255,214,140',
  wave: { l: 0.8, c: 0.08, h: 90 },
};

const INK: Readonly<Record<Look, Ink>> = {
  organic: WARM,
  precise: WARM,
  polished: {
    back: '#0b0e13',
    sheen: 'rgba(232,247,255,',
    seam: 'rgba(56,146,238,',
    homeRing: 'rgba(246,250,255,',
    nameFloor: 0.62,
    gloss: [0.035, -0.185], // lacquer: the light sits on top, the foot falls away
    rim: 0.08,
    lift: ['rgba(2,5,12,0.72)', 13, 5],
    edge: 'rgba(7,10,15,0.8)',
    onShape: 'rgba(18,24,32,',
    onShapeSub: 'rgba(64,78,96,',
    onChosen: 'rgba(12,24,42,.96)',
    onChosenSub: 'rgba(30,48,74,.9)',
    range: '168,210,255',
    wave: { l: 0.88, c: 0.05, h: 236 },
  },
};

// The built look: a straight bar with one even radius – no waves, no tilt, nothing to read into it
const barPath = (cx: CanvasRenderingContext2D, field: Field, i: number, stripe: Stripe, gap: number): void => {
  const middle = (stripe.top + stripe.bottom) / 2;
  const width = field.edgeAt(i + 1, middle) - field.edgeAt(i, middle);
  const inset = Math.min(gap, Math.max(0.6, width * 0.13));
  const left = field.edgeAt(i, middle) + inset;
  const right = field.edgeAt(i + 1, middle) - inset;
  const round = Math.max(1, Math.min(5, (right - left) * 0.3));
  cx.beginPath();
  cx.roundRect(left, stripe.top, Math.max(0.5, right - left), Math.max(1, stripe.bottom - stripe.top), round);
};

const stripePath = (
  cx: CanvasRenderingContext2D,
  field: Field,
  i: number,
  stripe: Stripe,
  gap: number,
  look: Look = 'organic',
): void => {
  if (isStraight(look)) {
    barPath(cx, field, i, stripe, gap);
    return;
  }
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

// A glance of light along the edge, close to it but with a drift of its own; dead straight in the built look
const sheen = (
  cx: CanvasRenderingContext2D,
  field: Field,
  i: number,
  stripe: Stripe,
  strength: number,
  look: Look = 'organic',
): void => {
  const light = INK[look].sheen;
  const top = stripe.top + 14;
  const bottom = stripe.bottom - 14;
  if (bottom <= top) return;
  const width = field.edgeAt(i + 1, (top + bottom) / 2) - field.edgeAt(i, (top + bottom) / 2);
  const line = Math.max(1, width * 0.1);
  const offset = Math.max(2, width * 0.2);
  const gradient = cx.createLinearGradient(0, top, 0, bottom);
  gradient.addColorStop(0, `${light}0)`);
  gradient.addColorStop(0.22, `${light}${String(0.3 * strength)})`);
  gradient.addColorStop(0.55, `${light}${String(0.52 * strength)})`);
  gradient.addColorStop(0.86, `${light}${String(0.14 * strength)})`);
  gradient.addColorStop(1, `${light}0)`);
  cx.strokeStyle = gradient;
  cx.lineWidth = line;
  cx.lineCap = 'round';
  cx.beginPath();
  if (isStraight(look)) {
    const x = field.edgeAt(i, (top + bottom) / 2) + offset;
    cx.moveTo(x, top);
    cx.lineTo(x, bottom);
    cx.stroke();
    return;
  }
  const step = Math.max(10, (bottom - top) / 26);
  for (let y = top, first = true; y <= bottom; y += step, first = false) {
    const drift = Math.sin((y - top) * 0.009 + i * 0.7) * line * 0.8;
    const x = field.edgeAt(i, y) + offset + drift;
    if (first) cx.moveTo(x, y);
    else cx.lineTo(x, y);
  }
  cx.stroke();
};

// Lacquer on a face, the same on both sides of the screen: a lit edge along the top, the body of the colour,
// and a foot that falls away. The rim is what makes it read as a surface rather than a fill.
const faceGradient = (
  cx: CanvasRenderingContext2D,
  colour: Oklch,
  x: number,
  top: number,
  bottom: number,
  ink: Ink,
  middle: number,
): CanvasGradient => {
  const [up, down] = ink.gloss;
  const gradient = cx.createLinearGradient(x, top, x, bottom);
  if (ink.rim > 0) {
    gradient.addColorStop(0, cssOf(shade(colour, up + ink.rim, 0.6, 6)));
    gradient.addColorStop(0.035, cssOf(shade(colour, up, 0.92, 4)));
  } else gradient.addColorStop(0, cssOf(shade(colour, up, 0.92, 4)));
  gradient.addColorStop(middle, cssOf(colour));
  gradient.addColorStop(1, cssOf(shade(colour, down, 0.8, -5)));
  return gradient;
};

// The shadow a face casts on the ground behind it – what makes the surface sit above the page, not in it
const castLift = (cx: CanvasRenderingContext2D, ink: Ink): void => {
  const [colour, blur, drop] = ink.lift;
  if (blur <= 0) return;
  cx.shadowColor = colour;
  cx.shadowBlur = blur;
  cx.shadowOffsetY = drop;
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
  const colour = toneColour(fit, pcOf(stripe.midi), stripe.midi, { held: glow, lift, base, look: scene.look });
  return { fit, grip, glow, base, colour };
};

// Two seams running along the tonic stripe, so the eye finds home without reading a label
const drawTonicSeam = (cx: CanvasRenderingContext2D, field: Field, i: number, stripe: Stripe, look: Look): void => {
  const step = Math.max(12, (stripe.bottom - stripe.top) / 26);
  const from = stripe.top + 13;
  const to = stripe.bottom - 13;
  if (to <= from) return;
  for (const [offset, width, alpha] of [
    [2.6, 3.4, 0.9],
    [6.6, 1.4, 0.35],
  ] as const) {
    cx.strokeStyle = `${INK[look].seam}${String(alpha)})`;
    cx.lineWidth = width;
    cx.beginPath();
    if (isStraight(look)) {
      const x = field.edgeAt(i, (from + to) / 2) + offset;
      cx.moveTo(x, from);
      cx.lineTo(x, to);
    } else {
      cx.moveTo(field.edgeAt(i, from) + offset, from);
      for (let y = from; y <= to; y += step) cx.lineTo(field.edgeAt(i, y) + offset, y);
    }
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
  const gradient = faceGradient(cx, colour, x, stripe.top, stripe.bottom, INK[scene.look], 0.58);

  cx.globalAlpha = base || glow ? 1 : 0.78;
  cx.save();
  if (glow) {
    cx.shadowColor = cssOf(shade(colour, 0.2, 1.4));
    cx.shadowBlur = grip === undefined ? 12 : 16 + grip.brightness * 28 + grip.vibrato * 18;
  } else castLift(cx, INK[scene.look]);
  stripePath(cx, field, i, stripe, grip === undefined ? 3.2 : 2, scene.look);
  cx.fillStyle = gradient;
  cx.fill();
  if (glow) cx.fill(); // a second pass deepens the glow
  cx.restore();
  cx.lineWidth = grip === undefined ? 1.2 : 2.4;
  cx.strokeStyle = grip === undefined ? INK[scene.look].edge : cssOf(shade(colour, -0.36, 0.5));
  cx.stroke();
  const held = grip === undefined ? 0 : 0.25;
  sheen(cx, field, i, stripe, base ? 0.62 : 0.17 + held, scene.look);
  if (base) drawTonicSeam(cx, field, i, stripe, scene.look);
  cx.globalAlpha = 1;

  const label = labels?.[i];
  if (label !== undefined && label !== '') drawStripeLabel(cx, field, i, stripe, label, colour);
};

const drawStripes = (cx: CanvasRenderingContext2D, scene: FieldScene): void => {
  scene.field.stripes.forEach((stripe, i) => {
    drawStripe(cx, scene, i, stripe);
  });
};

// The built look: the same bar as on the right, upright and evenly rounded
const spotBarPath = (cx: CanvasRenderingContext2D, spot: MapSpot, radius: number): void => {
  const width = radius * 1.86;
  const height = radius * 1.34;
  cx.beginPath();
  cx.roundRect(spot.x - width / 2, spot.y - height / 2, width, height, Math.max(1, Math.min(5, height * 0.14)));
};

const spotPath = (cx: CanvasRenderingContext2D, spot: MapSpot, radius: number, look: Look): void => {
  if (isStraight(look)) spotBarPath(cx, spot, radius);
  else blobPath(cx, spot, radius);
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

const CHOSEN: Oklch = { l: 0.72, c: 0.14, h: 78 };
const PRECISE_CHOSEN: Oklch = { l: 0.7, c: 0.115, h: 72 };
const POLISHED_CHOSEN: Oklch = { l: 0.87, c: 0.082, h: 238 };
const POLISHED_SPOT_HUE = 243; // the same blue the stripes are lacquered in

// How far a chord has grown towards its limit: the stronger the pull, the brighter it stands
const pullOf = (spot: MapSpot): number => Math.max(0, Math.min(1, spot.radius / Math.max(1, spot.limit) - 0.5));

// Away from home is warm, towards it is cool, home itself has a hue of its own
const hueOfSpot = (step: number, precise: boolean): number => {
  if (step < 0) return precise ? 244 : 252;
  if (step > 0) return precise ? 60 : 44;
  return precise ? 232 : 120;
};

// Polished: every chord is white and stays white. How likely it is reads as brightness alone – where it leads is
// already said by its place on the map, so the hue has nothing left to add.
const polishedSpot = (spot: MapSpot, chosen: boolean): Oklch => {
  if (chosen) return POLISHED_CHOSEN;
  const pull = pullOf(spot);
  const atHome = spot.chord.step === 0 && spot.chord.side === 0;
  return {
    l: (atHome ? 0.815 : 0.695) + pull * (atHome ? 0.15 : 0.245),
    c: 0.03 + pull * 0.034,
    h: POLISHED_SPOT_HUE,
  };
};

// Cool towards home, warm away from it; the chosen chord is the one warm light

const colourOfSpot = (spot: MapSpot, chosen: boolean, look: Look): Oklch => {
  if (look === 'polished') return polishedSpot(spot, chosen);
  const precise = look === 'precise';
  if (chosen) return precise ? PRECISE_CHOSEN : CHOSEN;
  const pull = pullOf(spot);
  const home = spot.chord.step === 0 && spot.chord.side === 0;
  if (home) {
    return precise
      ? { l: 0.46 + pull * 0.22, c: 0.03 + pull * 0.03, h: 214 }
      : { l: 0.5 + pull * 0.3, c: 0.075 + pull * 0.1, h: 196 };
  }
  const hue = hueOfSpot(spot.chord.step, precise);
  return precise
    ? { l: 0.38 + pull * 0.26, c: 0.008 + pull * 0.035, h: hue }
    : { l: 0.42 + pull * 0.36, c: 0.025 + pull * 0.12, h: hue };
};

// A light running down the left flank, as if the chord were a pebble in the sun
const drawSpotGlance = (
  cx: CanvasRenderingContext2D,
  spot: MapSpot,
  radius: number,
  chosen: boolean,
  look: Look,
): void => {
  cx.save();
  cx.clip();
  const light = INK[look].sheen;
  const glance = cx.createLinearGradient(spot.x - radius, spot.y - radius, spot.x - radius * 0.1, spot.y + radius);
  glance.addColorStop(0, `${light}0)`);
  glance.addColorStop(0.42, `${light}${String(chosen ? 0.5 : 0.26)})`);
  glance.addColorStop(1, `${light}0)`);
  cx.strokeStyle = glance;
  cx.lineWidth = Math.max(2, radius * (isStraight(look) ? 0.1 : 0.17));
  cx.beginPath();
  if (isStraight(look)) {
    const x = spot.x - radius * 0.78;
    cx.moveTo(x, spot.y - radius * 0.5);
    cx.lineTo(x, spot.y + radius * 0.5);
  } else {
    cx.moveTo(spot.x - radius * 0.62, spot.y - radius * 0.5);
    cx.quadraticCurveTo(spot.x - radius * 0.92, spot.y, spot.x - radius * 0.5, spot.y + radius * 0.58);
  }
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
  ink: Ink,
): void => {
  const pull = pullOf(spot);
  cx.textAlign = 'center';
  cx.textBaseline = 'middle';
  const words = name.role.split(' ');
  const longest = Math.max(...words.map((w) => w.length));
  const size = Math.max(8, Math.min(radius * 0.34, (radius * 1.7) / (longest * 0.58)));
  const floor = ink.nameFloor;
  cx.fillStyle = chosen ? ink.onChosen : `${ink.onShape}${String(floor + pull * (0.95 - floor))})`;
  cx.font = `600 ${String(size)}px system-ui, sans-serif`;
  const twoLines = words.length > 1 && name.role.length > 12 && radius > 30;
  if (twoLines) {
    const half = Math.ceil(words.length / 2);
    cx.fillText(words.slice(0, half).join(' '), spot.x, spot.y - size * 0.6);
    cx.fillText(words.slice(half).join(' '), spot.x, spot.y + size * 0.5);
  } else cx.fillText(name.role, spot.x, spot.y - (radius > 26 ? 2 : 0));
  if (radius > 26 && name.chord !== '') {
    cx.fillStyle = chosen ? ink.onChosenSub : `${ink.onShapeSub}${String(floor - 0.05 + pull * (0.9 - floor))})`;
    cx.font = `${String(size - 2)}px system-ui, sans-serif`;
    cx.fillText(name.chord, spot.x, spot.y + size * (twoLines ? 1.6 : 1.3));
  }
};

const drawSpot = (cx: CanvasRenderingContext2D, scene: FieldScene, spot: MapSpot): void => {
  const chosen = spot === scene.chosen;
  // The chosen chord with the accompaniment muted: drawn as an outline, so it is clearly still the one in charge
  const muted = chosen && !scene.accompanying;
  const colour = colourOfSpot(spot, chosen, scene.look);
  const radius = spot.radius;

  spotPath(cx, spot, radius, scene.look);
  const gradient = faceGradient(cx, colour, spot.x, spot.y - radius, spot.y + radius, INK[scene.look], 0.6);
  cx.save();
  if (chosen && !muted) {
    cx.shadowColor = cssOf(shade(colour, 0.12, 1.1));
    cx.shadowBlur = 26;
  } else if (!muted) castLift(cx, INK[scene.look]);
  cx.globalAlpha = muted ? 0.16 : 1;
  cx.fillStyle = gradient;
  cx.fill();
  cx.restore();
  cx.globalAlpha = 1;
  cx.lineWidth = muted ? 2.6 : 1.4;
  cx.strokeStyle = muted ? cssOf(shade(colour, 0.05, 1)) : INK[scene.look].edge;
  cx.stroke();
  if (!muted) drawSpotGlance(cx, spot, radius, chosen, scene.look);

  if (spot.chord.step === 0 && spot.chord.side === 0) {
    cx.strokeStyle = `${INK[scene.look].homeRing}0.85)`;
    cx.lineWidth = 2.6;
    spotPath(cx, spot, radius * 1.1, scene.look);
    cx.stroke();
  }

  const name = scene.names.get(spot);
  if (name !== undefined && radius > 15) drawSpotName(cx, spot, radius, chosen, name, INK[scene.look]);
};

// What the schema will play next: a ring that closes as the bar runs out, and a glow that grows with it. The eye
// learns the twelve-bar blues from it without being told – and knows the change is coming before it happens.
const drawAhead = (cx: CanvasRenderingContext2D, scene: FieldScene, ahead: AheadScene): void => {
  const { spot, progress } = ahead;
  const ink = INK[scene.look];
  const radius = spot.radius * 1.14;
  const around = isStraight(scene.look) ? (radius * 1.86 + radius * 1.34) * 2 : 2 * Math.PI * radius;
  cx.save();

  // The whole ring, faint: this is the one that is coming, however far away it still is
  cx.strokeStyle = `${ink.seam}0.2)`;
  cx.lineWidth = 1.6;
  spotPath(cx, spot, radius, scene.look);
  cx.stroke();

  // The light in it fills as the bars run out, and the last beat before the change is the brightest
  const close = Math.max(0, (progress - 0.85) / 0.15); // the final breath before it happens
  cx.shadowColor = `${ink.seam}0.9)`;
  cx.shadowBlur = 5 + progress * 14 + close * 10;
  cx.strokeStyle = `${ink.seam}${String(0.45 + progress * 0.55)})`;
  cx.lineWidth = 2 + progress * 1.8;
  cx.setLineDash([Math.max(0.001, around * progress), around]);
  cx.lineDashOffset = around * 0.25; // it closes from the top, where a clock would
  spotPath(cx, spot, radius, scene.look);
  cx.stroke();

  // And the face itself takes on a little of that light, so the eye finds it without looking for a ring
  cx.setLineDash([]);
  cx.globalAlpha = 0.06 + progress * 0.16;
  cx.fillStyle = `${ink.seam}1)`;
  spotPath(cx, spot, spot.radius, scene.look);
  cx.fill();
  cx.restore();
};

const drawMap = (cx: CanvasRenderingContext2D, scene: FieldScene): void => {
  for (const spot of scene.spots) drawSpot(cx, scene, spot);
  if (scene.ahead !== null) drawAhead(cx, scene, scene.ahead);
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
      cx.strokeStyle = cssOf(INK[scene.look].wave);
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

// The strip below the field: grab it anywhere and pull the octaves past. The bright band is what is in view,
// the ticks are the octaves, and the field settles on the one the band is centred on.
const drawSlider = (cx: CanvasRenderingContext2D, scene: FieldScene): void => {
  const { left, right, top, bottom, focus, settling, count, perOctave, held } = scene.slider;
  const width = Math.max(1, right - left);
  const height = bottom - top;
  const round = isStraight(scene.look) ? 4 : height / 2;
  const { range } = INK[scene.look];

  cx.beginPath();
  cx.roundRect(left, top, width, height, round);
  cx.fillStyle = held ? 'rgba(255,255,255,.075)' : 'rgba(255,255,255,.045)';
  cx.fill();
  cx.strokeStyle = 'rgba(255,255,255,.07)';
  cx.lineWidth = 1;
  cx.stroke();

  // Every octave a tick, the tonic ones taller
  const perStep = width / Math.max(1, count);
  for (let i = 0; i < count; i += perOctave) {
    const x = left + (i + 0.5) * perStep;
    const tall = i % (perOctave * 2) === 0;
    cx.strokeStyle = `rgba(232,228,218,${String(tall ? 0.26 : 0.14)})`;
    cx.lineWidth = 1;
    cx.beginPath();
    cx.moveTo(x, bottom - (tall ? height * 0.52 : height * 0.34));
    cx.lineTo(x, bottom - height * 0.16);
    cx.stroke();
  }

  // The window that is in view: as wide as the focus reaches
  const span = Math.min(count, perOctave * 2.4);
  const centre = left + (focus + 0.5) * perStep;
  const half = (span * perStep) / 2;
  const window = { from: Math.max(left + 1, centre - half), to: Math.min(right - 1, centre + half) };
  const glow = cx.createLinearGradient(window.from, 0, window.to, 0);
  const alpha = held ? 0.3 : 0.2;
  glow.addColorStop(0, `rgba(${range},0)`);
  glow.addColorStop(0.5, `rgba(${range},${String(alpha)})`);
  glow.addColorStop(1, `rgba(${range},0)`);
  cx.fillStyle = glow;
  cx.beginPath();
  cx.roundRect(window.from, top + 3, Math.max(2, window.to - window.from), height - 6, round);
  cx.fill();

  // Where it will come to rest
  const mark = left + (settling + 0.5) * perStep;
  cx.strokeStyle = `rgba(${range},${String(held ? 0.9 : 0.55)})`;
  cx.lineWidth = 2;
  cx.beginPath();
  cx.moveTo(mark, top + 5);
  cx.lineTo(mark, bottom - 5);
  cx.stroke();
};

const FLOATER_MS = 900;

// Two hands meeting, with a few sparks: the applause of a listener, drawn so it needs no font
const drawClap = (cx: CanvasRenderingContext2D, x: number, y: number, size: number): void => {
  const r = 9 * size;
  cx.lineWidth = Math.max(1.4, r * 0.22);
  cx.lineCap = 'round';
  cx.beginPath();
  cx.moveTo(x - r, y + r * 0.7);
  cx.lineTo(x, y - r * 0.2);
  cx.lineTo(x - r * 0.35, y + r);
  cx.moveTo(x + r, y - r * 0.7);
  cx.lineTo(x, y + r * 0.2);
  cx.lineTo(x + r * 0.35, y - r);
  cx.stroke();
  for (const [dx, dy] of [
    [-1.35, -0.95],
    [1.35, 0.95],
    [0, -1.5],
  ] as const) {
    cx.beginPath();
    cx.moveTo(x + dx * r, y + dy * r);
    cx.lineTo(x + dx * r * 1.3, y + dy * r * 1.3);
    cx.stroke();
  }
};

const drawFloaters = (cx: CanvasRenderingContext2D, scene: FieldScene): void => {
  cx.textAlign = 'center';
  cx.textBaseline = 'middle';
  for (const floater of scene.floaters) {
    const k = (scene.now - floater.t0) / FLOATER_MS;
    if (k >= 1) continue;
    cx.globalAlpha = 1 - k * k;
    const ink = floater.up ? 'rgba(246,242,232,.96)' : 'rgba(255,150,110,.96)';
    const y = floater.y + (floater.up ? -40 * k : 30 * k * k);
    if (floater.text === CLAP) {
      cx.strokeStyle = ink;
      drawClap(cx, floater.x, y, floater.size);
      continue;
    }
    cx.font = `700 ${String(18 * floater.size)}px system-ui, sans-serif`;
    cx.fillStyle = ink;
    cx.fillText(floater.text, floater.x, y);
  }
  cx.globalAlpha = 1;
};

export const drawField = (cx: CanvasRenderingContext2D, scene: FieldScene, width: number, height: number): void => {
  cx.fillStyle = INK[scene.look].back;
  cx.fillRect(0, 0, width, height);
  drawStripes(cx, scene);
  drawSlider(cx, scene);
  drawLearn(cx, scene);
  drawMap(cx, scene);
  drawWaves(cx, scene);
  drawFloaters(cx, scene);
};

export const chordCaption = (spot: MapSpot, role: string, tonic: number): string =>
  `${role} · ${String(tonic)}${SHAPE_SUFFIX[spot.chord.shape]}`;
