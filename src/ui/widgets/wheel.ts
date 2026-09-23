// A ring of choices with the current one in the middle. Neighbours on the ring are neighbours in the thing being
// chosen – that is the whole point of it, and the reason this is a wheel and not a list.
const SVG_NS = 'http://www.w3.org/2000/svg';
const SIZE = 200;
const MID = SIZE / 2;
const RING = 74;

export interface WheelItem<V> {
  readonly value: V;
  readonly label: string; // the short sign on the ring
  readonly title: string; // the whole name, for the tooltip
  readonly tint: string; // a colour of its own, so the ring shows how far it is from home
  readonly mark?: string; // a line under the sign: the accidentals of a key, for instance
}

export interface Wheel<V> {
  readonly element: HTMLDivElement;
  set(value: V): void;
}

export const wheel = <V extends string | number>(
  items: readonly WheelItem<V>[],
  current: V,
  onPick: (value: V) => void,
): Wheel<V> => {
  const element = document.createElement('div');
  element.className = 'wheel';
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${String(SIZE)} ${String(SIZE)}`);
  svg.setAttribute('role', 'radiogroup');
  const ring = document.createElementNS(SVG_NS, 'circle');
  ring.setAttribute('cx', String(MID));
  ring.setAttribute('cy', String(MID));
  ring.setAttribute('r', String(RING));
  ring.setAttribute('class', 'ring');
  svg.append(ring);

  const centre = document.createElementNS(SVG_NS, 'text');
  centre.setAttribute('x', String(MID));
  centre.setAttribute('y', String(MID + 4));
  centre.setAttribute('text-anchor', 'middle');
  centre.setAttribute('class', 'centre');
  const under = document.createElementNS(SVG_NS, 'text');
  under.setAttribute('x', String(MID));
  under.setAttribute('y', String(MID + 24));
  under.setAttribute('text-anchor', 'middle');
  under.setAttribute('class', 'under');

  const seats = items.map((item, i) => {
    const angle = (i / items.length) * Math.PI * 2 - Math.PI / 2;
    const x = MID + Math.cos(angle) * RING;
    const y = MID + Math.sin(angle) * RING;
    const seat = document.createElementNS(SVG_NS, 'g');
    seat.setAttribute('class', 'seat');
    seat.setAttribute('role', 'radio');
    seat.setAttribute('tabindex', '0');
    const disc = document.createElementNS(SVG_NS, 'circle');
    disc.setAttribute('cx', String(x));
    disc.setAttribute('cy', String(y));
    disc.setAttribute('r', '15');
    disc.setAttribute('fill', item.tint);
    const text = document.createElementNS(SVG_NS, 'text');
    text.setAttribute('x', String(x));
    text.setAttribute('y', String(y + (item.mark === undefined ? 4 : 1)));
    text.setAttribute('text-anchor', 'middle');
    text.textContent = item.label;
    seat.append(disc, text);
    if (item.mark !== undefined && item.mark !== '') {
      const mark = document.createElementNS(SVG_NS, 'text');
      mark.setAttribute('x', String(x));
      mark.setAttribute('y', String(y + 11));
      mark.setAttribute('text-anchor', 'middle');
      mark.setAttribute('class', 'mark');
      mark.textContent = item.mark;
      seat.append(mark);
    }
    const title = document.createElementNS(SVG_NS, 'title');
    title.textContent = item.title;
    seat.append(title);
    const pick = (): void => {
      onPick(item.value);
    };
    seat.addEventListener('click', pick);
    seat.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        pick();
      }
    });
    svg.append(seat);
    return { seat, item };
  });
  svg.append(centre, under);
  element.append(svg);

  const set = (value: V): void => {
    for (const { seat, item } of seats) {
      const on = item.value === value;
      seat.classList.toggle('on', on);
      seat.setAttribute('aria-checked', String(on));
      if (!on) continue;
      centre.textContent = item.label;
      centre.setAttribute('fill', item.tint);
      under.textContent = item.mark ?? '';
    }
  };
  set(current);
  return { element, set };
};
