// The second generation, first step: a violin for the right hand, drawn in WebGL and sounded by a learned model in
// WebAssembly. Pointer events go straight to the audio thread – never through a frame or a render cycle.
import './next.css';
import { locale, t } from '../i18n';
import { readMeter, VOICES, writeVoice } from './engine/layout';
import { Finger, PressureSense, type Expression, type Haptic, type Sample } from './play/expression';
import { GAP, bluesKeys } from './play/keys';
import { VoicePool } from './play/voice-pool';
import { startEngine, type Engine } from './platform/audio';
import { Renderer, type SceneTouch } from './platform/renderer';
import { exposeForTests } from './platform/test-hook';

const HAPTIC_MS: Readonly<Record<Haptic, number>> = { start: 12, key: 8, step: 3 };

interface Held {
  readonly finger: Finger;
  readonly voice: number;
  readonly note: number;
  expression: Expression;
  x: number;
  y: number;
}

const element = <T extends HTMLElement>(selector: string, type: new () => T): T => {
  const found = document.querySelector(selector);
  if (!(found instanceof type)) throw new Error(`missing ${selector}`);
  return found;
};

document.documentElement.lang = locale();
const canvas = element('#field', HTMLCanvasElement);
const overlay = element('#welcome', HTMLElement);
const start = element('#start', HTMLButtonElement);
const status = element('#status', HTMLElement);
element('#title', HTMLElement).textContent = t('next.title');
element('#subtitle', HTMLElement).textContent = t('next.subtitle');
element('#hints', HTMLElement).replaceChildren(
  ...(['next.press', 'next.slide', 'next.rock', 'next.legato'] as const).map((key) => {
    const item = document.createElement('li');
    item.textContent = t(key);
    return item;
  }),
);
start.textContent = t('next.start');

const keys = bluesKeys();
const sense = new PressureSense();
const pool = new VoicePool();
const held = new Map<number, Held>();
const voiceKey: number[] = Array.from({ length: VOICES }, () => 0);
const glow: number[] = keys.map(() => 0);
const renderer = new Renderer(canvas);
let engine: Engine | undefined;
let notes = 0;

const vibrate = (haptic: Haptic | undefined): void => {
  if (haptic !== undefined && 'vibrate' in navigator) navigator.vibrate(HAPTIC_MS[haptic]);
};

const sampleOf = (event: PointerEvent): Sample => {
  const box = canvas.getBoundingClientRect();
  return {
    time: event.timeStamp,
    x: (event.clientX - box.left) / box.width,
    y: (event.clientY - box.top) / box.height,
    pressure: event.pressure,
  };
};

const send = (state: Held, gate: boolean): void => {
  if (!engine) return;
  const e = state.expression;
  writeVoice(engine.controls, state.voice, {
    gate,
    note: state.note,
    midi: e.tone,
    dynamics: e.dynamics,
    vibratoRate: e.vibrato.rate,
    vibratoDepth: e.vibrato.depth,
  });
  voiceKey[state.voice] = e.key;
  engine.commit();
};

canvas.addEventListener('pointerdown', (event) => {
  if (!engine) return;
  event.preventDefault();
  canvas.setPointerCapture(event.pointerId);
  const sample = sampleOf(event);
  const finger = new Finger(keys, sense, sample);
  const expression = finger.start(sample);
  const state: Held = {
    finger,
    voice: pool.acquire(event.pointerId),
    note: ++notes,
    expression,
    x: sample.x,
    y: sample.y,
  };
  held.set(event.pointerId, state);
  send(state, true);
  vibrate(expression.haptic);
});

// pointerrawupdate arrives before the frame-aligned pointermove; one of the two is enough
const moveEvent = 'onpointerrawupdate' in window ? 'pointerrawupdate' : 'pointermove';
canvas.addEventListener(moveEvent, (event: Event) => {
  if (!(event instanceof PointerEvent)) return;
  const state = held.get(event.pointerId);
  if (!state) return;
  const samples = event.getCoalescedEvents().length > 0 ? event.getCoalescedEvents() : [event];
  let haptic: Haptic | undefined;
  for (const sample of samples.map(sampleOf)) {
    state.expression = state.finger.move(sample);
    state.x = sample.x;
    state.y = sample.y;
    haptic ??= state.expression.haptic;
  }
  send(state, true);
  vibrate(haptic);
});

const lift = (event: PointerEvent): void => {
  const state = held.get(event.pointerId);
  if (!state) return;
  held.delete(event.pointerId);
  pool.release(event.pointerId, event.timeStamp);
  send(state, false);
};
canvas.addEventListener('pointerup', lift);
canvas.addEventListener('pointercancel', lift);
canvas.addEventListener('contextmenu', (event) => {
  event.preventDefault();
});

const showStatus = (): void => {
  if (!engine) return;
  const parts = [
    t('next.latency', { ms: Math.round(engine.latencyMs()) }),
    sense.supported ? t('next.pressure') : t('next.noPressure'),
    engine.shared ? t('next.shared') : t('next.messages'),
  ];
  status.textContent = parts.join(' · ');
};

const frame = (now: number): void => {
  const meters = engine?.meters;
  glow.fill(0);
  if (meters) {
    for (let v = 0; v < VOICES; v++) {
      const meter = readMeter(meters, v);
      const key = voiceKey[v] ?? 0;
      if (meter.active) glow[key] = Math.max(glow[key] ?? 0, Math.min(1, meter.level * 4));
    }
  }
  const touches: SceneTouch[] = [...held.values()].map((h) => ({
    x: h.x,
    y: h.y,
    dynamics: Math.max(0, h.expression.dynamics),
    vibrato: h.expression.vibrato.depth,
    vibratoPhase: meters ? readMeter(meters, h.voice).vibratoPhase : 0,
  }));
  renderer.draw(
    {
      keys: keys.map((k, i) => ({
        left: k.left,
        right: k.right,
        fitness: k.fitness,
        tonic: k.tonic,
        glow: glow[i] ?? 0,
      })),
      gap: GAP,
      touches,
      time: now / 1000,
    },
    now,
  );
  requestAnimationFrame(frame);
};
requestAnimationFrame(frame);

if (!renderer.available) status.textContent = t('next.noGraphics');

start.addEventListener('click', () => {
  start.disabled = true;
  start.textContent = t('next.loading');
  startEngine()
    .then((started) => {
      engine = started;
      overlay.hidden = true;
      document.body.dataset.engine = 'running';
      showStatus();
      setInterval(showStatus, 1000);
    })
    .catch((error: unknown) => {
      start.disabled = false;
      start.textContent = t('next.start');
      status.textContent = t('next.failed', { reason: error instanceof Error ? error.message : String(error) });
      document.body.dataset.engine = 'failed';
    });
});

exposeForTests({
  engine: () => engine,
  keyCentre: (index) => {
    const key = keys[index];
    if (!key) return null;
    return { x: ((key.left + key.right) / 2) * canvas.clientWidth, y: canvas.clientHeight * 0.5 };
  },
});
