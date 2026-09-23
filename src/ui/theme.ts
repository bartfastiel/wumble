// The key's hue colours the page: the CSS variable for the stylesheet and the theme colour of the browser chrome.
import type { Look } from '../field/geometry';

// The polished look answers to a cool lamp of its own – the key's hue would warm the surroundings up again.
const POLISHED_HUE = 216;
export const pageHue = (hue: number, look: Look): number => (look === 'polished' ? POLISHED_HUE : hue);

export const themeColor = (hue: number): string => `hsl(${String(hue)} 16% 14%)`;

export const applyTheme = (hue: number, root: Document = document): void => {
  root.documentElement.style.setProperty('--hue', String(hue));
  const meta = root.querySelector<HTMLMetaElement>('meta[name=theme-color]');
  if (meta !== null) meta.content = themeColor(hue);
};
