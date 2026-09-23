// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '../i18n';
import { hint, segment } from './settings-groups';

beforeEach(() => {
  setLocale('de');
  document.body.replaceChildren();
});

describe('segment', () => {
  it('marks the active button and switches on click', () => {
    const onChange = vi.fn();
    const seg = segment(
      [
        { value: 1, label: '1' },
        { value: 2, label: '2' },
      ],
      2,
      onChange,
    );
    const buttons = [...seg.element.querySelectorAll('button')];
    expect(buttons.map((button) => button.classList.contains('on'))).toEqual([false, true]);
    buttons[0]?.click();
    expect(onChange).toHaveBeenCalledWith(1);
    seg.set(1);
    expect(buttons.map((button) => button.classList.contains('on'))).toEqual([true, false]);
  });
});

describe('hint', () => {
  it('builds a hint paragraph', () => {
    expect(hint('x').className).toBe('hint');
    expect(hint('x').textContent).toBe('x');
  });
});
