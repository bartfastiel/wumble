// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '../i18n';
import { checkbox, counted, hint, radioGroup, segment, tempoRow } from './settings-groups';

const mount = (nodes: readonly Node[]): HTMLElement => {
  const host = document.createElement('div');
  host.append(...nodes);
  document.body.append(host);
  return host;
};

beforeEach(() => {
  setLocale('de');
  document.body.replaceChildren();
});

describe('radioGroup', () => {
  it('renders heading, hints, sub-headings and options, checks the current value', () => {
    const onChange = vi.fn();
    const group = radioGroup(
      'Stil',
      [{ hint: 'Tipp' }, { heading: 'Bühne' }, { value: 'a', label: 'A' }, { value: 'b', label: 'B' }],
      'b',
      onChange,
    );
    const host = mount(group.nodes);
    expect(host.querySelector('h2')?.textContent).toBe('Stil');
    expect(host.querySelector('p.hint')?.textContent).toBe('Tipp');
    expect(host.querySelector('h3')?.textContent).toBe('Bühne');
    const inputs = [...host.querySelectorAll<HTMLInputElement>('input[type=radio]')];
    expect(inputs.map((input) => input.checked)).toEqual([false, true]);
    expect(inputs.every((input) => input.name === 'Stil')).toBe(true);
    inputs[0]?.click();
    expect(onChange).toHaveBeenCalledWith('a');
    group.set('a');
    expect(inputs.map((input) => input.checked)).toEqual([true, false]);
  });

  it('shows a node in front of the label', () => {
    const before = document.createElement('i');
    const host = mount(radioGroup('Tonart', [{ value: 1, label: 'G', before }], 1, () => undefined).nodes);
    expect(host.querySelector('label.opt .pre i')).toBe(before);
    expect(host.querySelector('label.opt')?.textContent).toBe('G');
  });
});

describe('checkbox', () => {
  it('reports its state and follows the setter', () => {
    const onChange = vi.fn();
    const box = checkbox('Deutsch', false, onChange);
    const host = mount(box.nodes);
    const input = host.querySelector<HTMLInputElement>('input[type=checkbox]');
    expect(input?.checked).toBe(false);
    input?.click();
    expect(onChange).toHaveBeenCalledWith(true);
    box.set(false);
    expect(input?.checked).toBe(false);
  });
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

describe('tempoRow', () => {
  it('shows the bpm, reports slider input and taps', () => {
    const onInput = vi.fn();
    const onTap = vi.fn();
    const row = tempoRow(100, onInput, onTap);
    const host = mount(row.nodes);
    const range = host.querySelector<HTMLInputElement>('input[type=range]');
    expect(range?.min).toBe('60');
    expect(range?.max).toBe('160');
    expect(host.querySelector('output')?.textContent).toBe('100 bpm');
    if (range === null) throw new Error('no range');
    range.value = '120';
    range.dispatchEvent(new Event('input'));
    expect(onInput).toHaveBeenCalledWith(120);
    host.querySelector('button')?.click();
    expect(onTap).toHaveBeenCalledTimes(1);
    row.set(96);
    expect(range.value).toBe('96');
    expect(host.querySelector('output')?.textContent).toBe('96 bpm');
  });
});

describe('hint and counted', () => {
  it('build a hint paragraph and count in the locale', () => {
    expect(hint('x').className).toBe('hint');
    expect(counted('band.loop.bars', 1)).toBe('1 Takt');
    expect(counted('band.loop.bars', 4)).toBe('4 Takte');
    setLocale('en');
    expect(counted('band.loop.tones', 7)).toBe('7 tones');
  });
});
