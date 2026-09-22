// Colours in OKLCH, where equal numbers look equally bright. Hue carries fitness, lightness the register,
// chroma the certainty — three readable channels instead of one colourful one.
import type { Fitness } from '../theory/fitness';
import type { PitchClass } from '../theory/pitch';

export interface Oklch {
  readonly l: number;
  readonly c: number;
  readonly h: number; // degrees
}

const gamma = (v: number): number => {
  const s = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(Math.max(v, 0), 1 / 2.4) - 0.055;
  return Math.round(Math.max(0, Math.min(1, s)) * 255);
};

export const cssOf = ({ l, c, h }: Oklch): string => {
  const rad = (h * Math.PI) / 180;
  const a = c * Math.cos(rad);
  const b = c * Math.sin(rad);
  const lms = [
    (l + 0.3963377774 * a + 0.2158037573 * b) ** 3,
    (l - 0.1055613458 * a - 0.0638541728 * b) ** 3,
    (l - 0.0894841775 * a - 1.291485548 * b) ** 3,
  ] as const;
  const [x, y, z] = lms;
  return `rgb(${String(gamma(4.0767416621 * x - 3.3077115913 * y + 0.2309699292 * z))},${String(
    gamma(-1.2684380046 * x + 2.6097574011 * y - 0.3413193965 * z),
  )},${String(gamma(-0.0041960863 * x - 0.7034186147 * y + 1.707614701 * z))})`;
};

// Warm where a tone carries, cool where it pulls — a narrow arc, not a rainbow
const FITNESS_HUE: readonly [number, number, number, number] = [74, 96, 148, 238];
const FITNESS_CHROMA: readonly [number, number, number, number] = [0.135, 0.1, 0.05, 0.026];
export const CENTRE_MIDI = 65;

export const registerTilt = (midi: number): number => Math.max(-1.2, Math.min(1.2, (midi - CENTRE_MIDI) / 24));

export interface ToneColourOptions {
  readonly held?: boolean;
  readonly lift?: number;
  readonly base?: boolean; // the tonic of the key keeps its full colour
}

export const toneColour = (
  fitness: Fitness,
  pc: PitchClass,
  midi: number,
  { held = false, lift = 0, base = false }: ToneColourOptions = {},
): Oklch => {
  const tilt = registerTilt(midi);
  // a touch of pitch class, enough to tell two stripes apart, not enough to be colourful
  const nudge = (((((pc * 7) % 12) + 12) % 12) - 5.5) * 1.5;
  const dim = base || held ? 0 : 0.07;
  return {
    l: 0.585 + tilt * 0.085 + lift - dim,
    c: FITNESS_CHROMA[fitness] * (base || held ? 1 : 0.88),
    h: FITNESS_HUE[fitness] + nudge,
  };
};

export const shade = (colour: Oklch, dl: number, dc = 1, dh = 0): Oklch => ({
  l: Math.max(0.06, Math.min(0.94, colour.l + dl)),
  c: Math.max(0, colour.c * dc),
  h: colour.h + dh,
});
