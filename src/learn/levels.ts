// Difficulty levels of the learn mode ("anticipation"): from medium on, the current dot stays invisible for `delay` ms
// and then fades in over `fade` ms; whoever hits it before gets more points (`factor` multiplies). `rings`: rings of
// repeated notes are shown.
export const LEVEL_IDS = ['easy', 'medium', 'hard'] as const;
export type LevelId = (typeof LEVEL_IDS)[number];

interface LevelShape {
  readonly delay: number; // ms until the dot begins to appear, 0 = always visible
  readonly fade: number;
  readonly factor: number; // point multiplier, 0 = no scoring
  readonly rings: boolean;
}

// Literal values stay in the type (as const satisfies): comparing level.delay with 999 is a compile error
export const LEVELS = {
  easy: { delay: 0, fade: 0, factor: 0, rings: true },
  medium: { delay: 400, fade: 1200, factor: 1, rings: true },
  hard: { delay: 1000, fade: 1200, factor: 2, rings: false },
} as const satisfies Readonly<Record<LevelId, LevelShape>>;
export type Level = (typeof LEVELS)[LevelId];

export const WRONG_PENALTY = -100;
export const WRONG_THROTTLE_MS = 300; // sliding across several spots costs at most once per 300 ms

// Visibility of the current dot 0…1: easy always 1, otherwise invisible until `delay` after the tone started, then
// linear over `fade`
export const learnVisibility = (level: Level, toneStartedAt: number, now: number): number =>
  level.delay === 0 ? 1 : Math.min(1, Math.max(0, (now - toneStartedAt - level.delay) / level.fade));

// Gain 10…100 by invisibility of the dot, doubled in hard: whoever anticipates gets the most
export const awardPoints = (level: Level, visibility: number): number =>
  level.factor * (10 + Math.round(90 * (1 - visibility)));
