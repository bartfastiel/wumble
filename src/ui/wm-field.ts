// The playing surface: one canvas with the chord map on the left and the melody field on the right.
// Pointers are handled here, because a finger belongs to one of the two areas and keeps its gesture until it lifts.
import { random } from '../audio/random';
import { Field } from '../field/geometry';
import { breatheMap, layoutMap, type MapSpot, spotAt } from '../map/geometry';
import { Memory, pullOf } from '../map/pull';
import type { PointerId } from '../play/pointer';
import { SHAPE_SUFFIX } from '../theory/chord-maps';
import { fitnessOf } from '../theory/fitness';
import { fieldLabels } from '../theory/labels';
import { pcOf } from '../theory/pitch';
import type { App } from './app';
import { BarClock } from '../band/bar-clock';
import { CLAP, drawField, type AheadScene, type Floater, type HeldStripe, type LearnScene } from './field-draw';
import { t } from '../i18n';

const DWELL_MS = 95; // resting chooses a chord, sweeping passes over it
const MAP_SHARE = 0.26;
const MAP_MIN = 230; // below this the chord names stop being readable
const MAP_MAX = 340;
const MAP_NARROW = 0.34; // on a narrow screen the map never takes more than a third
const HEAD = 52;
const APPLAUSE_SIZE = 2.2;
const SLIDER_HEIGHT = 46; // the strip below the field: grab it anywhere and pull the octaves past
const OPEN_ON = 65; // the field opens on the octave around F4, where most playing happens
const LOOK_AHEAD_BARS = 8; // how far the map promises the schema's next chord

interface Grip {
  readonly area: 'map' | 'field' | 'slider';
  stripe: number | null;
  startY: number;
  y: number;
  brightness: number;
  vibrato: number;
  trail: [number, number, number][];
  pending: MapSpot | null;
  timer: number;
  startX: number; // where the slide began
  startFocus: number;
}

export class WmField extends HTMLElement {
  app: App | null = null;
  private readonly canvas = document.createElement('canvas');
  private context: CanvasRenderingContext2D | null = null;
  private readonly field = new Field();
  private readonly memory = new Memory();
  private spots: MapSpot[] = [];
  private grips = new Map<PointerId, Grip>();
  private needsDraw = true;
  private frameHandle = 0;
  private lastFrame = 0;
  private floaters: Floater[] = [];

  // What the schema will play next, as the last frame saw it – the end-to-end tests read it
  get upcoming(): { role: string; progress: number } | null {
    const ahead = this.lastAhead;
    return ahead === null ? null : { role: ahead.spot.chord.role, progress: ahead.progress };
  }

  // What floats over the field right now – the end-to-end tests read it
  get floating(): readonly Floater[] {
    return this.floaters;
  }

  // Where the field stands and where it is heading – the end-to-end tests read it
  get geometry(): Field {
    return this.field;
  }
  private readonly cleanups: (() => void)[] = [];
  private readonly bar = new BarClock(); // how far this bar has run, for what the schema will do next
  private lastAhead: AheadScene | null = null;

  connectedCallback(): void {
    if (this.app === null) throw new Error('wm-field needs the app');
    const app = this.app;
    if (this.childElementCount === 0) this.append(this.canvas);
    this.context = this.canvas.getContext('2d');
    this.resize();
    this.bindPointers();
    this.cleanups.push(
      app.on('draw', () => {
        this.requestDraw();
      }),
      app.on('settings', () => {
        this.relayout();
      }),
    );
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => {
        this.resize();
      });
      observer.observe(this);
      this.cleanups.push(() => {
        observer.disconnect();
      });
    }
    this.frameHandle = requestAnimationFrame((now) => {
      this.frame(now);
    });
  }

  disconnectedCallback(): void {
    for (const cleanup of this.cleanups.splice(0)) cleanup();
    cancelAnimationFrame(this.frameHandle);
  }

  requestDraw(): void {
    this.needsDraw = true;
  }

  float(text: string, x: number, y: number, size = 1): void {
    this.floaters.push({ x, y, text, t0: performance.now(), size, up: !text.startsWith('−') });
    this.requestDraw();
  }

  // The learn mode scores on the stripe it was played on
  floatAt(text: string, tone: number, size = 1): void {
    const centre = this.stripeCentre(tone);
    if (centre !== null) this.float(text, centre.x, centre.y, size);
  }

  applaud(): void {
    const { width, height } = this.canvas.getBoundingClientRect();
    this.float(CLAP, width * (0.4 + 0.5 * random()), height * (0.2 + 0.6 * random()), APPLAUSE_SIZE);
  }

  // Centre of a chord on the map – the end-to-end tests aim at it
  spotCentre(index: number): { x: number; y: number } | null {
    const chord = this.app?.store.model().map[index] ?? null;
    const spot = chord === null ? undefined : this.spots.find((candidate) => candidate.chord === chord);
    return spot === undefined ? null : { x: spot.x, y: spot.y };
  }

  // What the field measures right now: the size of the canvas and how many stripes fit
  layout(): { width: number; height: number; stripes: number } {
    const { width, height } = this.canvas.getBoundingClientRect();
    return { width, height, stripes: this.field.stripes.length };
  }

  // Centre of a stripe – the learn mode points at tones with it
  stripeCentre(tone: number): { x: number; y: number } | null {
    const stripe = this.field.stripes[tone];
    if (stripe === undefined) return null;
    const y = (stripe.top + stripe.bottom) / 2;
    return { x: (this.field.edgeAt(tone, y) + this.field.edgeAt(tone + 1, y)) / 2, y };
  }

  // Size of a learn dot: as wide as a stripe in the middle of the field
  private unit(): number {
    const middle = Math.floor(this.field.stripes.length / 2);
    const stripe = this.field.stripes[middle];
    if (stripe === undefined) return 40;
    const y = (stripe.top + stripe.bottom) / 2;
    return Math.max(18, Math.abs(this.field.edgeAt(middle + 1, y) - this.field.edgeAt(middle, y)) * 1.6);
  }

  // Where the map ends and the field begins. On a phone held upright the map has to give way: the stripes need the
  // width more than the chord names do.
  private get split(): number {
    const { width } = this.canvas.getBoundingClientRect();
    const roomy = Math.min(MAP_MAX, Math.max(MAP_MIN, width * MAP_SHARE));
    return Math.min(roomy, width * MAP_NARROW);
  }

  // The strip along the bottom of the field, where the octaves are pulled past
  private get slider(): { left: number; right: number; top: number; bottom: number } {
    const { width, height } = this.canvas.getBoundingClientRect();
    return { left: this.split + 10, right: width - 16, top: height - SLIDER_HEIGHT, bottom: height - 8 };
  }

  private resize(): void {
    const dpr = window.devicePixelRatio || 1;
    const width = this.clientWidth;
    const height = this.clientHeight;
    this.canvas.width = Math.round(width * dpr);
    this.canvas.height = Math.round(height * dpr);
    this.context?.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.relayout();
  }

  private relayout(): void {
    const app = this.app;
    if (app === null) return;
    const { width, height } = this.canvas.getBoundingClientRect();
    if (width === 0 || height === 0) return;
    const model = app.store.model();
    const split = this.split;
    // The bar above follows the same split: what belongs to the chords sits over the map
    document.documentElement.style.setProperty('--map', `${String(Math.round(split))}px`);
    const fresh = this.field.stripes.length === 0;
    this.field.look = app.store.get().look;
    this.field.layout(
      { left: split + 10, right: width - 16, top: HEAD + 4, bottom: height - SLIDER_HEIGHT - 8 },
      model.tones,
      model.style.scale.length,
    );
    if (fresh || this.field.settling > model.tones.length - 1) this.field.settling = this.field.octaveOf(OPEN_ON);
    this.spots = layoutMap(model.map, { width: split, height, top: HEAD }, this.field.look);
    this.requestDraw();
  }

  private bindPointers(): void {
    const target = this.canvas;
    const down = (event: PointerEvent): void => {
      const app = this.app;
      if (app === null) return;
      event.preventDefault();
      const { x, y } = this.local(event);
      const slider = this.slider;
      let area: Grip['area'] = 'field';
      if (x < this.split) area = 'map';
      else if (y >= slider.top) area = 'slider';
      const grip: Grip = {
        area,
        stripe: null,
        startY: y,
        y,
        brightness: 0.45,
        vibrato: 0,
        trail: [],
        pending: null,
        timer: 0,
        startX: x,
        startFocus: this.field.settling,
      };
      this.grips.set(event.pointerId, grip);
      target.setPointerCapture(event.pointerId);
      if (area === 'map') this.chooseAt(grip, x, y, true);
      else if (area === 'field') this.playAt(grip, x, y);
      else this.requestDraw();
    };
    const move = (event: PointerEvent): void => {
      const grip = this.grips.get(event.pointerId);
      if (grip === undefined) return;
      const { x, y } = this.local(event);
      grip.y = y;
      if (grip.area === 'map') this.chooseAt(grip, x, y, false);
      else if (grip.area === 'field') this.playAt(grip, x, y);
      else this.slideTo(grip, x);
    };
    const up = (event: PointerEvent): void => {
      const grip = this.grips.get(event.pointerId);
      if (grip === undefined) return;
      window.clearTimeout(grip.timer);
      if (grip.pending !== null) this.choose(grip.pending);
      if (grip.area === 'field') this.app?.player.release(event.pointerId);
      if (grip.area === 'slider') this.field.release();
      this.grips.delete(event.pointerId);
      this.requestDraw();
    };
    target.addEventListener('pointerdown', down);
    target.addEventListener('pointermove', move);
    target.addEventListener('pointerup', up);
    target.addEventListener('pointercancel', up);
    this.cleanups.push(() => {
      target.removeEventListener('pointerdown', down);
      target.removeEventListener('pointermove', move);
      target.removeEventListener('pointerup', up);
      target.removeEventListener('pointercancel', up);
    });
  }

  private local(event: PointerEvent): { x: number; y: number } {
    const box = this.canvas.getBoundingClientRect();
    return { x: event.clientX - box.left, y: event.clientY - box.top };
  }

  // The strip is a map of the whole range: a finger drags the field past, tone for tone
  private slideTo(grip: Grip, x: number): void {
    const { left, right } = this.slider;
    const perPixel = this.field.stripes.length / Math.max(1, right - left);
    this.field.settling = grip.startFocus - (x - grip.startX) * perPixel;
    this.requestDraw();
  }

  private sliding(): boolean {
    for (const grip of this.grips.values()) if (grip.area === 'slider') return true;
    return false;
  }

  private chooseAt(grip: Grip, x: number, y: number, immediate: boolean): void {
    const spot = spotAt(this.spots, x, y);
    if (spot === null) {
      window.clearTimeout(grip.timer);
      grip.pending = null;
      return;
    }
    if (immediate) {
      this.choose(spot);
      return;
    }
    if (spot === grip.pending || spot === this.chosenSpot()) return;
    window.clearTimeout(grip.timer);
    grip.pending = spot;
    grip.timer = window.setTimeout(() => {
      this.choose(spot);
      grip.pending = null;
    }, DWELL_MS);
  }

  private choose(spot: MapSpot): void {
    const app = this.app;
    if (app === null) return;
    const index = app.store.model().map.indexOf(spot.chord);
    app.player.chooseChord(index);
    this.memory.remember(spot.chord);
    this.requestDraw();
  }

  // What the schema will play next, once it is a schema and not the hand that leads. Nothing is shown while the
  // band follows the play: there is no future to promise then.
  private ahead(now: number): AheadScene | null {
    this.lastAhead = this.lookAhead(now);
    return this.lastAhead;
  }

  private lookAhead(now: number): AheadScene | null {
    const app = this.app;
    if (app === null) return null;
    const { band } = app;
    if (!band.running() || band.schema() === 'follow') {
      this.bar.reset();
      return null;
    }
    const { bar, step } = band.scheduler.position();
    this.bar.mark(step, now);
    // Look ahead until the chord changes: the ring then fills over the whole way there, not only over the last bar
    const current = band.currentChord();
    let bars = 1;
    while (bars <= LOOK_AHEAD_BARS && band.chordForBar(bar + bars) === current) bars++;
    if (bars > LOOK_AHEAD_BARS) return null; // nothing changes in sight
    const next = band.chordForBar(bar + bars);
    const chord = app.store.model().map[next] ?? null;
    const spot = this.spots.find((candidate) => candidate.chord === chord);
    if (spot === undefined) return null;
    const left = bars - this.bar.progress(now); // bars still to run, the current one counted from where it is
    return { spot, progress: Math.max(0, Math.min(1, 1 - left / bars)) };
  }

  private chosenSpot(): MapSpot | null {
    const app = this.app;
    if (app === null) return null;
    const chord = app.store.model().map[app.player.chord] ?? null;
    return this.spots.find((spot) => spot.chord === chord) ?? null;
  }

  private playAt(grip: Grip, x: number, y: number): void {
    const app = this.app;
    if (app === null) return;
    const stripe = this.field.at(x, y);
    if (stripe === null) return;
    const id = [...this.grips.entries()].find(([, g]) => g === grip)?.[0];
    if (id === undefined) return;
    if (grip.stripe !== stripe.index) {
      grip.stripe = stripe.index;
      grip.startY = y;
      grip.trail = [];
      grip.vibrato = 0;
      grip.brightness = 0.24 + this.field.airAt(y) * 0.46;
      app.player.press(id, stripe.index);
    }
    this.shape(grip, x, y);
  }

  // Dragging up opens the note, circling makes it waver
  private shape(grip: Grip, x: number, y: number): void {
    const app = this.app;
    if (app === null || grip.stripe === null) return;
    const height = Math.max(1, this.canvas.getBoundingClientRect().height);
    grip.brightness = Math.max(
      0,
      Math.min(1, 0.24 + this.field.airAt(grip.startY) * 0.46 + (grip.startY - y) / (height * 0.4)),
    );
    grip.trail.push([x, y, performance.now()]);
    if (grip.trail.length > 12) grip.trail.shift();
    if (grip.trail.length > 6) grip.vibrato = circling(grip.trail);
    const id = [...this.grips.entries()].find(([, g]) => g === grip)?.[0];
    if (id === undefined) return;
    for (const voice of app.player.pointers.get(id)?.voices ?? []) voice.shape?.(grip.brightness, grip.vibrato);
    this.requestDraw();
  }

  private frame(now: number): void {
    const app = this.app;
    if (app !== null) {
      const seconds = Math.min(0.05, (now - this.lastFrame) / 1000);
      this.lastFrame = now;
      app.learn.tick(now);
      const breathing = this.breathe(seconds);
      this.floaters = this.floaters.filter((floater) => now - floater.t0 < 900);
      const busy =
        breathing ||
        this.grips.size > 0 ||
        app.player.lit.size > 0 ||
        this.floaters.length > 0 ||
        app.ghosts().length > 0 ||
        app.band.running() ||
        app.learn.animating(now);
      if (this.needsDraw || busy) {
        this.draw(now);
        this.needsDraw = false;
      }
    }
    this.frameHandle = requestAnimationFrame((next) => {
      this.frame(next);
    });
  }

  private breathe(seconds: number): boolean {
    const app = this.app;
    if (app === null) return false;
    const model = app.store.model();
    const chord = model.map[app.player.chord];
    const fitness = model.tones.map((midi) =>
      chord === undefined ? (2 as const) : fitnessOf(pcOf(midi), chord, model.key.tonic, model.style),
    );
    const moved = this.field.breathe(fitness, seconds);
    const chosen = this.chosenSpot();
    const mapMoved = breatheMap(
      this.spots,
      chosen,
      (spot) => pullOf(spot.chord, { from: chord ?? null, tonic: model.key.tonic, memory: this.memory }),
      seconds,
    );
    return moved || mapMoved;
  }

  private draw(now: number): void {
    const app = this.app;
    const cx = this.context;
    if (app === null || cx === null) return;
    const { width, height } = this.canvas.getBoundingClientRect();
    const model = app.store.model();
    const settings = app.store.get();
    const chord = model.map[app.player.chord];
    const labels =
      settings.labels === 'off' ? null : fieldLabels(model, { mode: settings.labels, german: settings.german }).tones;
    const held: HeldStripe[] = [];
    for (const grip of this.grips.values())
      if (grip.area === 'field' && grip.stripe !== null) {
        const stripe = this.field.stripes[grip.stripe];
        if (stripe !== undefined) held.push({ stripe, brightness: grip.brightness, vibrato: grip.vibrato, y: grip.y });
      }
    const names = new Map(
      this.spots.map((spot) => [
        spot,
        {
          role: t(`theory.role.${spot.chord.role}`),
          chord: (model.chords[model.map.indexOf(spot.chord)]?.name ?? '') + SHAPE_SUFFIX[spot.chord.shape],
        },
      ]),
    );
    const learn: LearnScene | null =
      app.learn.song === null
        ? null
        : (() => {
            const unit = this.unit();
            const groups = app.learn.groups(unit);
            return {
              groups,
              spots: groups.map((group) => app.learn.placed[group.pos]?.spot?.tone ?? null),
              current: app.learn.pos,
              visibility: app.learn.visibility(now),
              unit,
            };
          })();
    const slider = this.slider;
    drawField(
      cx,
      {
        look: settings.look,
        ahead: this.ahead(now),
        slider: {
          ...slider,
          focus: this.field.focus,
          settling: this.field.settling,
          count: model.tones.length,
          perOctave: model.style.scale.length,
          held: this.sliding(),
        },
        field: this.field,
        fitness: model.tones.map((midi) =>
          chord === undefined ? 2 : fitnessOf(pcOf(midi), chord, model.key.tonic, model.style),
        ),
        tonicStep: 0,
        labels,
        held,
        spots: this.spots,
        chosen: this.chosenSpot(),
        accompanying: app.player.accompanying,
        names,
        lit: (index) => app.player.isLit(model.tones[index] ?? 0, now),
        ghosts: app.ghosts().map((ghost) => ghost.tone),
        learn,
        floaters: [
          // the learn mode's scores rise from the stripe they were played on
          ...app.learn.floaters.flatMap((floater) => {
            const centre = this.stripeCentre(floater.spot.tone);
            return centre === null ? [] : [{ ...centre, text: floater.text, t0: floater.t0, up: floater.up, size: 1 }];
          }),
          ...this.floaters,
        ],
        centre: (index) => this.stripeCentre(index),
        now,
      },
      width,
      height,
    );
  }
}

// Rate and size of the circles a finger is making
const circling = (trail: readonly [number, number, number][]): number => {
  let cx = 0;
  let cy = 0;
  for (const [x, y] of trail) {
    cx += x;
    cy += y;
  }
  cx /= trail.length;
  cy /= trail.length;
  let turn = 0;
  let radius = 0;
  let previous: number | null = null;
  for (const [x, y] of trail) {
    const angle = Math.atan2(y - cy, x - cx);
    radius += Math.hypot(x - cx, y - cy);
    if (previous !== null) {
      let delta = angle - previous;
      while (delta > Math.PI) delta -= 2 * Math.PI;
      while (delta < -Math.PI) delta += 2 * Math.PI;
      turn += delta;
    }
    previous = angle;
  }
  radius /= trail.length;
  const first = trail[0];
  const last = trail[trail.length - 1];
  const seconds = first === undefined || last === undefined ? 0.1 : (last[2] - first[2]) / 1000 || 0.1;
  const rate = Math.abs(turn) / (2 * Math.PI) / seconds;
  return Math.min(1, radius / 40) * Math.min(1, rate / 3.2);
};
