// The staff of the key list as inline SVG (96 × 40): five lines 6 px apart from y = 8, treble clef, key signature.
// A position counts staff steps from the lowest line E4 (0), every step half a line spacing.
import { signaturePositions } from '../theory/staff-position';

// Stylised treble clef as one stroke: hook at the bottom, upstroke, tip at the top, sweep to the left, loop around the
// G line. The canvas draws the same path in the head strip of the grid.
export const CLEF =
  'M10.4 35.6C10.4 38.6 14.8 38.8 14.4 35.4L16.2 3.2C18.6 5.2 19.6 10.6 16.6 15C12.6 20 5.2 22.6 5.2 28' +
  'C5.2 33.2 10.6 35.6 14.6 34C19.2 32 19.6 26 15.2 24.2C11 22.6 8.2 25.4 8.8 28C9.4 30.2 12.6 29.6 12.8 27.4';

const SVG = 'http://www.w3.org/2000/svg';
const LINE_SPACING = 6;
const BOTTOM_LINE_Y = 32;

const element = (name: string, attributes: Readonly<Record<string, string>>): SVGElement => {
  const node = document.createElementNS(SVG, name);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
  return node;
};

export const staffSvg = (signature: number): SVGElement => {
  const svg = element('svg', { viewBox: '0 0 96 40', width: '96', height: '40', 'aria-hidden': 'true' });
  const lines = element('g', { stroke: 'currentColor', 'stroke-width': '.8', opacity: '.6' });
  for (let i = 0; i < 5; i++) {
    const y = String(8 + i * LINE_SPACING);
    lines.append(element('line', { x1: '1', x2: '95', y1: y, y2: y }));
  }
  const clef = element('path', {
    d: CLEF,
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': '1.7',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
  });
  const accidentals = element('g', { fill: 'currentColor', 'font-size': '10', 'text-anchor': 'middle' });
  // ♯ sits centred on its position, ♭ a little higher so its belly lies there
  const mark = signature > 0 ? '♯' : '♭';
  const lift = signature > 0 ? 3.6 : 2.4;
  signaturePositions(signature).forEach((position, i) => {
    const text = element('text', { x: String(27 + 8.5 * i), y: String(BOTTOM_LINE_Y - 3 * position + lift) });
    text.textContent = mark;
    accidentals.append(text);
  });
  svg.append(lines, clef, accidentals);
  return svg;
};
