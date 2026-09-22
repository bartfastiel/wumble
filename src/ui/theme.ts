// The key's hue colours the page: the CSS variable for the stylesheet and the theme colour of the browser chrome.
export const themeColor = (hue: number): string => `hsl(${String(hue)} 16% 14%)`;

export const applyTheme = (hue: number, root: Document = document): void => {
  root.documentElement.style.setProperty('--hue', String(hue));
  const meta = root.querySelector<HTMLMetaElement>('meta[name=theme-color]');
  if (meta !== null) meta.content = themeColor(hue);
};
