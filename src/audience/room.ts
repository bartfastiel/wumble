// Room codes and the addresses behind the QR code. The public address of the app is the page itself when online;
// from a local file or localhost it is the address entered in the settings (`publicUrl`) – so the audience works from
// the single file through the relay of the online version. Without one, the relay is expected on the local machine.

export interface PageLocation {
  readonly protocol: string;
  readonly hostname: string;
  readonly origin: string;
  readonly pathname: string;
  readonly href: string;
}

// Five characters without look-alikes (0/O, 1/l/I)
export const ROOM_CODE_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
export const ROOM_CODE_LENGTH = 5;
// What the relay accepts – also codes typed by hand
export const ROOM_CODE_PATTERN = /^[a-z0-9]{3,12}$/;
export const LOCAL_RELAY_URL = 'ws://127.0.0.1:8765/ws';
const ROOM_PARAMETER = 'room';

export const generateRoomCode = (random: () => number = Math.random): string =>
  Array.from(
    { length: ROOM_CODE_LENGTH },
    () => ROOM_CODE_ALPHABET[Math.floor(random() * ROOM_CODE_ALPHABET.length)],
  ).join('');

export const isRoomCode = (code: string): boolean => ROOM_CODE_PATTERN.test(code);

// The room code of a listener link `#room=<code>` (other fragment parts are ignored), or null
export const roomCodeFromHash = (hash: string): string | null => {
  let text: string;
  try {
    text = decodeURIComponent(hash.replace(/^#\/?/, ''));
  } catch {
    return null;
  }
  for (const part of text.split(/[&/,\s]+/)) {
    const [key, value] = part.split('=');
    const code = value?.toLowerCase();
    if (key?.toLowerCase() === ROOM_PARAMETER && code !== undefined && isRoomCode(code)) return code;
  }
  return null;
};

export const isLocalPage = (location: PageLocation): boolean =>
  location.protocol === 'file:' || ['localhost', '127.0.0.1'].includes(location.hostname);

const stripQueryAndHash = (url: string): string => {
  const cuts = [url.indexOf('#'), url.indexOf('?')].filter((i) => i >= 0);
  return cuts.length === 0 ? url : url.slice(0, Math.min(...cuts));
};

// The address the QR code points to, without query and fragment; empty when the page is local and no public address
// is set
export const publicPage = (location: PageLocation, publicUrl = ''): string => {
  const own = isLocalPage(location) ? '' : location.origin + location.pathname;
  const configured = publicUrl.trim();
  return stripQueryAndHash(configured === '' ? own : configured);
};

// The relay lives at /ws next to the public page; wss for https pages
export const relayUrl = (location: PageLocation, publicUrl = ''): string => {
  const page = publicPage(location, publicUrl);
  if (page === '') return LOCAL_RELAY_URL;
  try {
    const url = new URL(page);
    return `${url.protocol === 'https:' ? 'wss' : 'ws'}://${url.host}/ws`;
  } catch {
    return LOCAL_RELAY_URL;
  }
};

// The link listeners open: the public page, or the page itself when there is none, plus the room code
export const roomLink = (location: PageLocation, publicUrl: string, code: string): string => {
  const page = publicPage(location, publicUrl);
  return `${page === '' ? stripQueryAndHash(location.href) : page}#${ROOM_PARAMETER}=${code}`;
};
