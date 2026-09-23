// A panel hanging under the button that opened it. One is open at a time; a click outside, the Escape key or
// another popover closes it. It knows nothing about its contents.
const open = new Set<() => void>();

export interface Popover {
  readonly panel: HTMLDivElement;
  toggle(): void;
  close(): void;
  readonly isOpen: boolean;
}

export const closeAllPopovers = (): void => {
  for (const close of [...open]) close();
};

export const attachPopover = (button: HTMLButtonElement, build: (panel: HTMLDivElement) => void): Popover => {
  const panel = document.createElement('div');
  panel.className = 'pop';
  panel.hidden = true;
  let built = false;

  const close = (): void => {
    if (panel.hidden) return;
    panel.hidden = true;
    button.classList.remove('open');
    button.setAttribute('aria-expanded', 'false');
    open.delete(close);
  };

  const place = (): void => {
    // Hang it under the button, pulled back inside the window if it would leave it
    panel.style.left = '0';
    const anchor = button.getBoundingClientRect();
    const box = panel.getBoundingClientRect();
    const wanted = anchor.left + anchor.width / 2 - box.width / 2;
    const margin = 8;
    const left = Math.max(margin, Math.min(wanted, window.innerWidth - box.width - margin));
    panel.style.left = `${String(left - box.left)}px`;
  };

  const show = (): void => {
    closeAllPopovers();
    if (!built) {
      build(panel);
      built = true;
    }
    panel.hidden = false;
    button.classList.add('open');
    button.setAttribute('aria-expanded', 'true');
    open.add(close);
    place();
  };

  button.setAttribute('aria-expanded', 'false');
  button.addEventListener('click', (event) => {
    event.stopPropagation();
    if (panel.hidden) show();
    else close();
  });
  panel.addEventListener('click', (event) => {
    event.stopPropagation();
  });
  return {
    panel,
    toggle: () => {
      if (panel.hidden) show();
      else close();
    },
    close,
    get isOpen() {
      return !panel.hidden;
    },
  };
};

// One listener for the whole document, however many popovers there are
export const bindPopoverDismiss = (root: Document = document): (() => void) => {
  const onDown = (): void => {
    closeAllPopovers();
  };
  const onKey = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') closeAllPopovers();
  };
  root.addEventListener('pointerdown', onDown);
  root.addEventListener('keydown', onKey);
  return () => {
    root.removeEventListener('pointerdown', onDown);
    root.removeEventListener('keydown', onKey);
  };
};
