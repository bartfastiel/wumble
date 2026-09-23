// A row of cells, each sitting at its own height above or below a middle line: a shape that says which way things
// move, not only how much of them there is. What up and down mean is the caller's business.
const SVG_NS = 'http://www.w3.org/2000/svg';

export interface ContourOptions {
  readonly values: readonly number[]; // whole steps above (+) and below (−) the middle
  readonly reach?: number; // the largest step the picture has room for
  readonly width?: number;
  readonly height?: number;
  readonly gap?: number;
}

export const contour = ({ values, reach = 2, width = 62, height = 22, gap = 1.5 }: ContourOptions): SVGSVGElement => {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${String(width)} ${String(height)}`);
  svg.setAttribute('class', 'contour');
  const count = Math.max(1, values.length);
  const cell = (width - gap * (count - 1)) / count;
  const tall = Math.max(2.5, Math.min(5, height / (reach * 2 + 2.6)));
  const middle = height / 2;
  const step = (middle - tall / 2) / Math.max(1, reach);

  const line = document.createElementNS(SVG_NS, 'line');
  line.setAttribute('x1', '0');
  line.setAttribute('x2', String(width));
  line.setAttribute('y1', String(middle));
  line.setAttribute('y2', String(middle));
  line.setAttribute('class', 'home');
  svg.append(line);

  values.forEach((value, i) => {
    const level = Math.max(-reach, Math.min(reach, value));
    const rect = document.createElementNS(SVG_NS, 'rect');
    rect.setAttribute('x', String(i * (cell + gap)));
    rect.setAttribute('y', String(middle - level * step - tall / 2));
    rect.setAttribute('width', String(cell));
    rect.setAttribute('height', String(tall));
    rect.setAttribute('rx', String(Math.min(1.5, cell / 3)));
    rect.setAttribute('opacity', String(level === 0 ? 0.55 : 1));
    svg.append(rect);
  });
  return svg;
};
