// A row of cells, each as tall and as bright as its value: a shape you can recognise at a glance and compare with
// the one next to it. What the values mean is not this widget's business.
const SVG_NS = 'http://www.w3.org/2000/svg';

export interface PatternOptions {
  readonly values: readonly number[]; // 0…1
  readonly width?: number;
  readonly height?: number;
  readonly gap?: number;
}

export const pattern = ({ values, width = 64, height = 22, gap = 1.5 }: PatternOptions): SVGSVGElement => {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${String(width)} ${String(height)}`);
  svg.setAttribute('class', 'pattern');
  const count = Math.max(1, values.length);
  const cell = (width - gap * (count - 1)) / count;
  values.forEach((value, i) => {
    const level = Math.max(0, Math.min(1, value));
    const tall = 4 + level * (height - 5);
    const rect = document.createElementNS(SVG_NS, 'rect');
    rect.setAttribute('x', String(i * (cell + gap)));
    rect.setAttribute('y', String(height - tall));
    rect.setAttribute('width', String(cell));
    rect.setAttribute('height', String(tall));
    rect.setAttribute('rx', String(Math.min(1.5, cell / 3)));
    rect.setAttribute('opacity', String(0.35 + level * 0.65));
    svg.append(rect);
  });
  return svg;
};
