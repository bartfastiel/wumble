// A dial: a value on an arc, turned by dragging across it, nudged by the arrow keys or the wheel. The number in
// the middle is the only writing on it, because a tempo without its number is a guess.
const SVG_NS = 'http://www.w3.org/2000/svg';
const START = 135; // degrees, measured clockwise from three o'clock
const SWEEP = 270;
const R = 34;
const CENTRE = 44;

export interface DialOptions {
  readonly label: string;
  readonly min: number;
  readonly max: number;
  readonly value: number;
  readonly step?: number;
  readonly ticks?: number; // how many marks around the arc
  readonly format?: (value: number) => string;
  readonly onChange: (value: number) => void;
}

export interface Dial {
  readonly element: HTMLDivElement;
  set(value: number): void;
}

const point = (angle: number, radius: number): readonly [number, number] => {
  const rad = (angle * Math.PI) / 180;
  return [CENTRE + Math.cos(rad) * radius, CENTRE + Math.sin(rad) * radius];
};

const arc = (from: number, to: number, radius: number): string => {
  const [x0, y0] = point(from, radius);
  const [x1, y1] = point(to, radius);
  const large = Math.abs(to - from) > 180 ? 1 : 0;
  return `M${String(x0)} ${String(y0)}A${String(radius)} ${String(radius)} 0 ${String(large)} 1 ${String(x1)} ${String(y1)}`;
};

const path = (d: string, className: string): SVGPathElement => {
  const node = document.createElementNS(SVG_NS, 'path');
  node.setAttribute('d', d);
  node.setAttribute('class', className);
  return node;
};

export const dial = ({ label, min, max, value, step = 1, ticks = 9, format = String, onChange }: DialOptions): Dial => {
  const element = document.createElement('div');
  element.className = 'dial';
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${String(CENTRE * 2)} ${String(CENTRE * 2)}`);
  svg.append(path(arc(START, START + SWEEP, R), 'track'));
  for (let i = 0; i < ticks; i++) {
    const angle = START + (SWEEP * i) / (ticks - 1);
    const [x0, y0] = point(angle, R + 5);
    const [x1, y1] = point(angle, R + (i === 0 || i === ticks - 1 ? 10 : 8));
    svg.append(path(`M${String(x0)} ${String(y0)}L${String(x1)} ${String(y1)}`, 'tick'));
  }
  const filled = path('', 'fill');
  const needle = path('', 'needle');
  svg.append(filled, needle);
  const text = document.createElementNS(SVG_NS, 'text');
  text.setAttribute('x', String(CENTRE));
  text.setAttribute('y', String(CENTRE + 6));
  text.setAttribute('text-anchor', 'middle');
  text.setAttribute('class', 'read');
  svg.append(text);
  element.append(svg);
  element.tabIndex = 0;
  element.setAttribute('role', 'slider');
  element.setAttribute('aria-label', label);
  element.setAttribute('aria-valuemin', String(min));
  element.setAttribute('aria-valuemax', String(max));

  let now = value;
  const set = (raw: number): void => {
    now = Math.max(min, Math.min(max, Math.round(raw / step) * step));
    const angle = START + (SWEEP * (now - min)) / Math.max(1, max - min);
    filled.setAttribute('d', arc(START, Math.max(START + 0.01, angle), R));
    const [x0, y0] = point(angle, 12);
    const [x1, y1] = point(angle, R - 3);
    needle.setAttribute('d', `M${String(x0)} ${String(y0)}L${String(x1)} ${String(y1)}`);
    text.textContent = format(now);
    element.setAttribute('aria-valuenow', String(now));
  };

  // Dragging anywhere on the dial turns it: the angle under the finger is the value
  const fromPointer = (event: PointerEvent): void => {
    const box = svg.getBoundingClientRect();
    const dx = event.clientX - (box.left + box.width / 2);
    const dy = event.clientY - (box.top + box.height / 2);
    let angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    if (angle < START - 360 + SWEEP + 1) angle += 360; // the gap at the bottom belongs to the near end
    const k = (angle - START) / SWEEP;
    set(min + Math.max(0, Math.min(1, k)) * (max - min));
    onChange(now);
  };
  element.addEventListener('pointerdown', (event) => {
    element.setPointerCapture(event.pointerId);
    fromPointer(event);
  });
  element.addEventListener('pointermove', (event) => {
    if (element.hasPointerCapture(event.pointerId)) fromPointer(event);
  });
  element.addEventListener('keydown', (event) => {
    const by = { ArrowUp: step, ArrowRight: step, ArrowDown: -step, ArrowLeft: -step }[event.key];
    if (by === undefined) return;
    event.preventDefault();
    set(now + by);
    onChange(now);
  });
  set(value);
  return { element, set };
};
