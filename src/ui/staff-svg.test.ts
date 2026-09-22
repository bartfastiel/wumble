// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { CLEF, staffSvg } from './staff-svg';

describe('staffSvg', () => {
  it('draws five lines, the clef and no accidentals for C major', () => {
    const svg = staffSvg(0);
    expect(svg.getAttribute('viewBox')).toBe('0 0 96 40');
    expect(svg.querySelectorAll('line')).toHaveLength(5);
    expect(svg.querySelector('path')?.getAttribute('d')).toBe(CLEF);
    expect(svg.querySelectorAll('text')).toHaveLength(0);
  });

  it('places three sharps on F C G and two flats on B E', () => {
    const sharps = [...staffSvg(3).querySelectorAll('text')];
    expect(sharps.map((text) => text.textContent)).toEqual(['♯', '♯', '♯']);
    // F5 sits on step 8 → y = 32 − 24 + 3.6
    expect(sharps.map((text) => text.getAttribute('y'))).toEqual(['11.6', '20.6', '8.6']);
    expect(sharps.map((text) => text.getAttribute('x'))).toEqual(['27', '35.5', '44']);
    const flats = [...staffSvg(-2).querySelectorAll('text')];
    expect(flats.map((text) => text.textContent)).toEqual(['♭', '♭']);
    expect(flats.map((text) => text.getAttribute('y'))).toEqual(['22.4', '13.4']);
  });
});
