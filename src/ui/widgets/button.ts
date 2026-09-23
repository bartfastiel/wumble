// A button that carries an icon and nothing else. The label lives in the tooltip and in the accessible name,
// so the bar stays wordless without going mute for a screen reader.
import { FILLED, icon, type IconName } from './icons';

export interface IconButtonOptions {
  readonly name: IconName;
  readonly label: string;
  readonly onClick?: (button: HTMLButtonElement) => void;
  readonly extra?: string; // one more class, for the few buttons with a state of their own
}

export const iconButton = ({ name, label, onClick, extra }: IconButtonOptions): HTMLButtonElement => {
  const button = document.createElement('button');
  button.type = 'button';
  const classes = ['ibtn'];
  if (extra !== undefined) classes.push(extra);
  if (FILLED.has(name)) classes.push('filled');
  button.className = classes.join(' ');
  button.title = label;
  button.setAttribute('aria-label', label);
  button.append(icon(name));
  if (onClick !== undefined)
    button.addEventListener('click', () => {
      onClick(button);
    });
  return button;
};

// Swaps the drawing inside a button that means two things – play and stop, for instance.
export const setIcon = (button: HTMLButtonElement, name: IconName): void => {
  button.querySelector('svg')?.remove();
  button.classList.toggle('filled', FILLED.has(name));
  button.prepend(icon(name));
};
