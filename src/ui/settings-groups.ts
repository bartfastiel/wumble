// Building blocks the panels share: a hint line and a segment of buttons.

export interface Group<V> {
  readonly nodes: readonly Node[];
  set(value: V): void;
}

export const hint = (text: string): HTMLParagraphElement => {
  const node = document.createElement('p');
  node.className = 'hint';
  node.textContent = text;
  return node;
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
