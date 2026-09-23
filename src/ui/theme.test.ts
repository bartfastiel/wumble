import { describe, expect, it } from 'vitest';
import { pageHue, themeColor } from './theme';

describe('pageHue', () => {
  it('lets the key colour the surroundings in the grown and built looks', () => {
    for (const look of ['organic', 'precise'] as const) {
      expect(pageHue(85, look)).toBe(85);
      expect(pageHue(355, look)).toBe(355);
    }
  });

  it('holds the polished look to its own cool light, whatever the key', () => {
    const cool = pageHue(85, 'polished');
    expect(pageHue(355, 'polished')).toBe(cool);
    expect(cool).toBeGreaterThan(190); // blue, not the warm end of the circle
    expect(cool).toBeLessThan(260);
  });
});

describe('themeColor', () => {
  it('writes a dark colour of that hue for the browser chrome', () => {
    expect(themeColor(216)).toBe('hsl(216 16% 14%)');
  });
});
