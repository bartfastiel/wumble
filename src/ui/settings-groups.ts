// Building blocks of the settings and library panels: radio groups from data with headings
// and hints, checkboxes, segments and the tempo row. Every builder returns its nodes and a setter to follow the state.
import { t } from '../i18n';
import { TEMPO_MAX, TEMPO_MIN } from '../play/settings';

export interface RadioOption<V extends string | number> {
  readonly value: V;
  readonly label: string;
  readonly before?: Node; // shown in front of the label, e.g. a colour swatch and a staff
}
export interface Heading {
  readonly heading: string;
}
export interface Hint {
  readonly hint: string;
}
export type RadioEntry<V extends string | number> = RadioOption<V> | Heading | Hint;

export interface Group<V> {
  readonly nodes: readonly Node[];
  set(value: V): void;
}

const heading = (level: 'h2' | 'h3', text: string): HTMLHeadingElement => {
  const node = document.createElement(level);
  node.textContent = text;
  return node;
};

export const hint = (text: string): HTMLParagraphElement => {
  const node = document.createElement('p');
  node.className = 'hint';
  node.textContent = text;
  return node;
};

const option = (label: string, input: HTMLInputElement, before?: Node): HTMLLabelElement => {
  const node = document.createElement('label');
  node.className = 'opt';
  node.append(input);
  if (before !== undefined) {
    const pre = document.createElement('span');
    pre.className = 'pre';
    pre.append(before);
    node.append(pre);
  }
  node.append(document.createTextNode(label));
  return node;
};

export const radioGroup = <V extends string | number>(
  title: string,
  entries: readonly RadioEntry<V>[],
  current: V,
  onChange: (value: V) => void,
): Group<V> => {
  const nodes: Node[] = [heading('h2', title)];
  const inputs: { input: HTMLInputElement; value: V }[] = [];
  for (const entry of entries) {
    if ('heading' in entry) {
      nodes.push(heading('h3', entry.heading));
      continue;
    }
    if ('hint' in entry) {
      nodes.push(hint(entry.hint));
      continue;
    }
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = title;
    input.value = String(entry.value);
    input.checked = entry.value === current;
    input.addEventListener('change', () => {
      onChange(entry.value);
    });
    inputs.push({ input, value: entry.value });
    nodes.push(option(entry.label, input, entry.before));
  }
  return {
    nodes,
    set: (value) => {
      for (const { input, value: own } of inputs) input.checked = own === value;
    },
  };
};

export const checkbox = (text: string, current: boolean, onChange: (on: boolean) => void): Group<boolean> => {
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = current;
  input.addEventListener('change', () => {
    onChange(input.checked);
  });
  return {
    nodes: [option(text, input)],
    set: (on) => {
      input.checked = on;
    },
  };
};

export interface SegmentOption<V> {
  readonly value: V;
  readonly label: string;
}

// A row of buttons, the active one bright
export const segment = <V extends string | number>(
  options: readonly SegmentOption<V>[],
  current: V,
  onChange: (value: V) => void,
): Group<V> & { readonly element: HTMLDivElement } => {
  const element = document.createElement('div');
  element.className = 'seg';
  const buttons = options.map(({ value, label }) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.classList.toggle('on', value === current);
    button.addEventListener('click', () => {
      onChange(value);
    });
    element.append(button);
    return { button, value };
  });
  return {
    element,
    nodes: [element],
    set: (value) => {
      for (const { button, value: own } of buttons) button.classList.toggle('on', own === value);
    },
  };
};

// Tempo of the band: slider 60–160 bpm, the value next to it, "tap tempo"
export const tempoRow = (tempo: number, onInput: (bpm: number) => void, onTap: () => void): Group<number> => {
  const row = document.createElement('div');
  row.className = 'tempo';
  const name = document.createElement('span');
  name.textContent = t('band.tempo');
  const range = document.createElement('input');
  range.type = 'range';
  range.min = String(TEMPO_MIN);
  range.max = String(TEMPO_MAX);
  const out = document.createElement('output');
  const tap = document.createElement('button');
  tap.type = 'button';
  tap.textContent = t('band.tapTempo');
  const set = (bpm: number): void => {
    range.value = String(bpm);
    out.textContent = t('band.bpm', { bpm });
  };
  set(tempo);
  range.addEventListener('input', () => {
    onInput(Number(range.value));
  });
  tap.addEventListener('click', onTap);
  row.append(name, range, out, tap);
  return { nodes: [row], set };
};

// "1 bar" / "2 bars": the counted form of a message with `one` and `other`
export const counted = (key: 'band.loop.bars' | 'band.loop.layers' | 'band.loop.tones', n: number): string =>
  n === 1 ? t(`${key}.one`) : t(`${key}.other`, { n });
