// The icon set: one line drawing per name, on a 24×24 grid, stroked rather than filled so every icon carries the
// same weight as the lines around it. Nothing here knows what the icons stand for – that is the caller's business.
export type IconName =
  | 'songs'
  | 'key'
  | 'style'
  | 'sound'
  | 'band'
  | 'record'
  | 'view'
  | 'share'
  | 'help'
  | 'close'
  | 'radio'
  | 'tempo'
  | 'loop'
  | 'check'
  | 'play'
  | 'hands'
  | 'tuning'
  | 'labels'
  | 'back'
  | 'clap'
  | 'keys'
  | 'bell'
  | 'pipes'
  | 'strings'
  | 'guitar'
  | 'trio'
  | 'onehand'
  | 'staff'
  | 'camera'
  | 'mic'
  | 'people'
  | 'stop';

// Paths are drawn in a 24×24 box with a 2-unit margin, so they sit optically level next to each other.
const PATHS: Readonly<Record<IconName, readonly string[]>> = {
  // A ball of yarn with a thread running off it: the way through a song, to pick up and follow
  songs: [
    'M11 3.5a8 8 0 1 0 0 16 8 8 0 0 0 0-16Z',
    'M5.6 7.4c3.5 1.1 7 3.6 9.4 7.4',
    'M7.6 4.9c2.5 1.7 5.1 4.8 6.5 8.8',
    'M3.2 11.9c2.9.4 6.1 2.3 8.2 5.4',
    'M17.6 17.1c1.9 1 2.7 2.4 1.8 3.5-.8.9-2.3.6-2.6-.5',
  ],
  key: [
    'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z',
    'M12 3v4',
    'M20.8 9.8 17 11',
    'M17.4 19.6 15 16.3',
    'M6.6 19.6 9 16.3',
    'M3.2 9.8 7 11',
  ],
  style: ['M3 12c2-6 4-6 6 0s4 6 6 0 4-6 6 0'],
  sound: ['M4 6h16v12H4z', 'M8 6v7', 'M12 6v7', 'M16 6v7', 'M4 13h16'],
  band: ['M4 9h16v6a8 3 0 0 1-16 0Z', 'M4 9a8 3 0 0 1 16 0 8 3 0 0 1-16 0Z', 'M7 4.5 10 8', 'M17 4.5 14 8'],
  record: ['M12 5.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13Z'],
  view: ['M4 8h7v8H4z', 'M13 6h7v12h-7z'],
  share: [
    'M10.5 13.5a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.2 1.2',
    'M13.5 10.5a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.2-1.2',
  ],
  help: ['M9 9a3 3 0 1 1 4 2.8c-.7.3-1 1-1 1.7v.5', 'M12 17.5v.5'],
  close: ['M6 6l12 12', 'M18 6 6 18'],
  radio: [
    'M12 14v6',
    'M8.5 10.5a5 5 0 0 1 7 0',
    'M5.5 7.5a9 9 0 0 1 13 0',
    'M12 12.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z',
  ],
  tempo: ['M12 3 5 21h14z', 'M12 3v11', 'M8.2 14h7.6'],
  loop: ['M4 12a8 8 0 0 1 13.7-5.6', 'M20 12a8 8 0 0 1-13.7 5.6', 'M17.5 3v3.5H14', 'M6.5 21v-3.5H10'],
  check: ['M5 12.5 10 17.5 19 7'],
  play: ['M8 5.5 18 12 8 18.5z'],
  hands: ['M7 20v-6l-2-2V7', 'M7 14V5', 'M10 14V4.5', 'M17 20v-6l2-2V7', 'M17 14V5', 'M14 14V4.5'],
  tuning: ['M12 4v16', 'M6 8v8', 'M18 8v8', 'M3 11v2', 'M21 11v2'],
  labels: ['M4 6h16', 'M4 12h10', 'M4 18h13'],
  back: ['M14.5 5.5 8 12l6.5 6.5'],
  clap: [
    'M11 13 6.6 8.6a2.1 2.1 0 0 1 3-3L14 10',
    'M13 11l4.4 4.4a2.1 2.1 0 0 1-3 3L10 14',
    'M4.6 14.6 3 16.2',
    'M9.4 19.4 8.4 21.4',
    'M19.4 9.4 21 7.8',
  ],
  keys: ['M3 7h18v10H3z', 'M7.5 7v6', 'M12 7v6', 'M16.5 7v6', 'M3 13h18'],
  bell: ['M7 16V11a5 5 0 0 1 10 0v5', 'M5 16h14', 'M10.5 19a1.5 1.5 0 0 0 3 0'],
  pipes: ['M5 20V8', 'M9.7 20V4.5', 'M14.3 20V6.5', 'M19 20V10', 'M3.5 20h17'],
  strings: ['M6 19c4-1 8-5 9-9s1-5 1-5', 'M4.5 17.5 7.5 20.5', 'M10 4.5c2 3 5 6 8 7'],
  guitar: [
    'M13.5 10.5a5.2 5.2 0 1 1-4 4',
    'M14.5 9.5 19 5',
    'M18 4l2 2',
    'M11.5 12.5a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2Z',
  ],
  trio: [
    'M5 18a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z',
    'M12 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z',
    'M19 16a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z',
    'M7 15V6l12-2v10',
  ],
  onehand: ['M9 20v-6l-2-2V7', 'M9 14V5', 'M12 14V4.5', 'M17 6.5 19 8.5', 'M19 5.5 17 3.5', 'M20.5 12h2'],
  camera: ['M3 8.5h4L8.5 6h7L17 8.5h4v10H3z', 'M12 16.5a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z'],
  mic: [
    'M12 3.5a2.6 2.6 0 0 1 2.6 2.6v5a2.6 2.6 0 0 1-5.2 0v-5A2.6 2.6 0 0 1 12 3.5Z',
    'M6.5 11a5.5 5.5 0 0 0 11 0',
    'M12 16.5V20',
    'M9 20h6',
  ],
  people: [
    'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
    'M3.5 19.5a5.5 5.5 0 0 1 11 0',
    'M16 6.2a3 3 0 0 1 0 5.6',
    'M17 14.4a5.5 5.5 0 0 1 3.5 5.1',
  ],
  staff: ['M3 6h18', 'M3 10h18', 'M3 14h18', 'M3 18h18', 'M9 15.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z'],
  stop: ['M6.5 6.5h11v11h-11z'],
};

const SVG_NS = 'http://www.w3.org/2000/svg';

export const icon = (name: IconName): SVGSVGElement => {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.classList.add('icon-art', `icon-${name}`);
  for (const d of PATHS[name]) {
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', d);
    svg.append(path);
  }
  return svg;
};

// Filled icons read as a state rather than a thing: the record dot, the play triangle, the stop square.
export const FILLED: ReadonlySet<IconName> = new Set<IconName>(['record', 'play', 'stop']);
