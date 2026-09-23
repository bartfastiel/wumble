// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { iconButton, setIcon } from './button';
import { choice } from './choice';
import { dial } from './dial';
import { envelope } from './envelope';
import { icon } from './icons';
import { attachPopover, bindPopoverDismiss, closeAllPopovers } from './popover';
import { pattern } from './pattern';
import { toggle } from './toggle';
import { wheel } from './wheel';

beforeEach(() => {
  closeAllPopovers();
  document.body.replaceChildren();
});

describe('icon', () => {
  it('draws a named line drawing that carries no text of its own', () => {
    const art = icon('band');
    expect(art.tagName.toLowerCase()).toBe('svg');
    expect(art.getAttribute('viewBox')).toBe('0 0 24 24');
    expect(art.getAttribute('aria-hidden')).toBe('true'); // the label lives on the button
    expect(art.querySelectorAll('path').length).toBeGreaterThan(0);
    expect(art.textContent).toBe('');
  });
});

describe('iconButton', () => {
  it('names itself for a screen reader and reports its clicks', () => {
    const onClick = vi.fn();
    const button = iconButton({ name: 'share', label: 'Link teilen', onClick });
    expect(button.title).toBe('Link teilen');
    expect(button.getAttribute('aria-label')).toBe('Link teilen');
    expect(button.querySelector('svg')).not.toBeNull();
    button.click();
    expect(onClick).toHaveBeenCalledWith(button);
  });

  it('marks the filled icons and swaps the drawing when the meaning changes', () => {
    const button = iconButton({ name: 'record', label: 'Aufnehmen' });
    expect(button.classList.contains('filled')).toBe(true);
    setIcon(button, 'band');
    expect(button.classList.contains('filled')).toBe(false);
    expect(button.querySelectorAll('svg')).toHaveLength(1);
  });
});

describe('attachPopover', () => {
  const make = (): { button: HTMLButtonElement; built: () => number } => {
    const button = document.createElement('button');
    let builds = 0;
    const { panel } = attachPopover(button, () => {
      builds++;
    });
    document.body.append(button, panel);
    return { button, built: () => builds };
  };

  it('builds its contents once, on the first opening', () => {
    const { button, built } = make();
    expect(built()).toBe(0);
    button.click();
    expect(built()).toBe(1);
    button.click();
    button.click();
    expect(built()).toBe(1);
  });

  it('opens, closes on a second click and says so on the button', () => {
    const { button } = make();
    button.click();
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(button.classList.contains('open')).toBe(true);
    button.click();
    expect(button.getAttribute('aria-expanded')).toBe('false');
  });

  it('keeps one panel open at a time', () => {
    const first = make();
    const second = make();
    first.button.click();
    second.button.click();
    expect(first.button.classList.contains('open')).toBe(false);
    expect(second.button.classList.contains('open')).toBe(true);
  });

  it('closes on a click anywhere else and on Escape', () => {
    const release = bindPopoverDismiss(document);
    const { button } = make();
    button.click();
    document.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    expect(button.classList.contains('open')).toBe(false);
    button.click();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(button.classList.contains('open')).toBe(false);
    release();
  });
});

describe('choice', () => {
  const items = [
    { value: 'a', label: 'A', art: () => document.createElement('i') },
    { value: 'b', label: 'B', art: () => document.createElement('i') },
  ] as const;

  it('marks the current tile and reports what was picked', () => {
    const onPick = vi.fn();
    const made = choice([...items], 'b', onPick);
    const tiles = [...made.element.querySelectorAll('button')];
    expect(tiles.map((tile) => tile.getAttribute('aria-checked'))).toEqual(['false', 'true']);
    tiles[0]?.click();
    expect(onPick).toHaveBeenCalledWith('a');
    made.set('a');
    expect(tiles.map((tile) => tile.classList.contains('on'))).toEqual([true, false]);
  });

  it('carries the words in the tooltip, never on the tile', () => {
    const made = choice([...items], 'a', () => undefined);
    const tile = made.element.querySelector('button');
    expect(tile?.title).toBe('A');
    expect(tile?.textContent).toBe('');
  });
});

describe('toggle', () => {
  it('flips, reports and follows the setter', () => {
    const onChange = vi.fn();
    const made = toggle('Radio', false, onChange);
    expect(made.element.getAttribute('aria-checked')).toBe('false');
    made.element.click();
    expect(onChange).toHaveBeenCalledWith(true);
    expect(made.element.classList.contains('on')).toBe(true);
    made.set(false);
    expect(made.element.classList.contains('on')).toBe(false);
  });
});

describe('dial', () => {
  it('shows the value in the middle and keeps it inside the range', () => {
    const onChange = vi.fn();
    const made = dial({ label: 'Tempo', min: 60, max: 160, value: 100, onChange });
    const read = made.element.querySelector('.read');
    expect(read?.textContent).toBe('100');
    expect(made.element.getAttribute('aria-valuenow')).toBe('100');
    made.set(500);
    expect(read?.textContent).toBe('160');
    made.set(0);
    expect(read?.textContent).toBe('60');
  });

  it('nudges with the arrow keys and reports every turn', () => {
    const onChange = vi.fn();
    const made = dial({ label: 'Tempo', min: 60, max: 160, value: 100, step: 2, onChange });
    made.element.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    expect(onChange).toHaveBeenLastCalledWith(102);
    made.element.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expect(onChange).toHaveBeenLastCalledWith(100);
    made.element.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
    expect(onChange).toHaveBeenCalledTimes(2); // anything else is not for the dial
  });

  it('writes the value the way it was asked to', () => {
    const made = dial({
      label: 'Tempo',
      min: 60,
      max: 160,
      value: 96,
      format: (value) => `${String(value)} bpm`,
      onChange: () => undefined,
    });
    expect(made.element.querySelector('.read')?.textContent).toBe('96 bpm');
  });
});

describe('wheel', () => {
  const items = [0, 1, 2].map((i) => ({
    value: i,
    label: String(i),
    title: `Nr ${String(i)}`,
    tint: '#123456',
    mark: i === 0 ? '' : `${String(i)} #`,
  }));

  it('seats every item on the ring and puts the current one in the middle', () => {
    const made = wheel(items, 1, () => undefined);
    const seats = [...made.element.querySelectorAll('.seat')];
    expect(seats).toHaveLength(3);
    expect(made.element.querySelector('.centre')?.textContent).toBe('1');
    expect(made.element.querySelector('.under')?.textContent).toBe('1 #');
    made.set(2);
    expect(made.element.querySelector('.centre')?.textContent).toBe('2');
    expect(seats[2]?.getAttribute('aria-checked')).toBe('true');
  });

  it('picks by click and by keyboard', () => {
    const onPick = vi.fn();
    const made = wheel(items, 0, onPick);
    const seats = [...made.element.querySelectorAll('.seat')];
    seats[1]?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onPick).toHaveBeenLastCalledWith(1);
    seats[2]?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(onPick).toHaveBeenLastCalledWith(2);
  });
});

describe('pattern and envelope', () => {
  it('draws one cell per value, taller and brighter the higher it is', () => {
    const svg = pattern({ values: [0, 0.5, 1] });
    const cells = [...svg.querySelectorAll('rect')];
    expect(cells).toHaveLength(3);
    const heights = cells.map((cell) => Number(cell.getAttribute('height')));
    expect(heights[0]).toBeLessThan(heights[1] ?? 0);
    expect(heights[1]).toBeLessThan(heights[2] ?? 0);
    expect(Number(cells[2]?.getAttribute('opacity'))).toBeGreaterThan(Number(cells[0]?.getAttribute('opacity')));
  });

  it('draws a sound as a line that rises and falls', () => {
    const quick = envelope({ attack: 0.003, release: 0.2, tail: 0.5 });
    const slow = envelope({ attack: 0.4, release: 2, tail: 1 });
    const riseOf = (svg: SVGSVGElement): number =>
      Number(/L([\d.]+) /.exec(svg.querySelectorAll('path')[1]?.getAttribute('d') ?? '')?.[1] ?? 0);
    expect(riseOf(quick)).toBeLessThan(riseOf(slow)); // a slow attack reaches its peak later
  });
});
