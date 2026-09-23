// A switch that shows its state by where the knob sits, not by a word next to it.
export interface Toggle {
  readonly element: HTMLButtonElement;
  set(on: boolean): void;
}

export const toggle = (label: string, current: boolean, onChange: (on: boolean) => void): Toggle => {
  const element = document.createElement('button');
  element.type = 'button';
  element.className = 'switch';
  element.title = label;
  element.setAttribute('role', 'switch');
  element.setAttribute('aria-label', label);
  const knob = document.createElement('span');
  knob.className = 'knob';
  element.append(knob);
  let on = current;
  const set = (value: boolean): void => {
    on = value;
    element.classList.toggle('on', on);
    element.setAttribute('aria-checked', String(on));
  };
  element.addEventListener('click', () => {
    set(!on);
    onChange(on);
  });
  set(current);
  return { element, set };
};
