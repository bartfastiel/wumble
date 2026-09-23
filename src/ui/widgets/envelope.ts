// The shape of a sound as a line: how fast it speaks, how long it rings, how much room is around it. Two of these
// side by side say more about the difference than two names ever would.
const SVG_NS = 'http://www.w3.org/2000/svg';
const W = 62;
const H = 24;

export interface EnvelopeOptions {
  readonly attack: number; // seconds to full
  readonly release: number; // seconds to silence
  readonly tail: number; // 0…1, how wet the room is
}

// Seconds are squeezed onto the width by their root, so a bell and a plucked string stay visibly different
const span = (seconds: number): number => Math.min(1, Math.sqrt(Math.max(0, seconds) / 2.2));

export const envelope = ({ attack, release, tail }: EnvelopeOptions): SVGSVGElement => {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${String(W)} ${String(H)}`);
  svg.setAttribute('class', 'envelope');
  const rise = 2 + span(attack) * 22;
  const fall = rise + 6 + span(release) * 30;
  const end = Math.min(W - 1, fall + tail * 16);
  const line = document.createElementNS(SVG_NS, 'path');
  line.setAttribute(
    'd',
    `M1 ${String(H - 2)}L${String(rise)} 3Q${String((rise + fall) / 2)} ${String(3 + (H - 8) * 0.35)} ${String(fall)} ${String(H - 4)}L${String(end)} ${String(H - 2)}`,
  );
  const room = document.createElementNS(SVG_NS, 'path');
  room.setAttribute('class', 'room');
  room.setAttribute(
    'd',
    `M${String(fall)} ${String(H - 4)}L${String(end)} ${String(H - 2)}L${String(end)} ${String(H - 2)}`,
  );
  svg.append(room, line);
  return svg;
};
