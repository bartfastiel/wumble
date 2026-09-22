// Base of the overlay pages (songs, settings, help): a fixed overlay with a back button and a scrolling body. The
// back button (and Escape, handled by the app) fire `wm-close`; the app closes every open panel.
import type { App } from './app';

export const CLOSE_EVENT = 'wm-close';

export class WmPanel extends HTMLElement {
  app: App | null = null; // set by the app root before the panel is attached
  protected readonly body = document.createElement('div');
  private readonly heading = document.createElement('h1');

  connectedCallback(): void {
    if (this.classList.contains('panel')) return; // already built: the element was moved
    this.classList.add('panel');
    const header = document.createElement('header');
    const back = document.createElement('button');
    back.className = 'icon back';
    back.textContent = '‹';
    back.addEventListener('click', () => {
      this.dispatchEvent(new Event(CLOSE_EVENT, { bubbles: true }));
    });
    const spacer = document.createElement('span');
    spacer.className = 'spacer';
    header.append(back, this.heading, spacer);
    this.body.className = 'body';
    this.append(header, this.body);
    this.build();
  }

  // Subclasses fill the body here
  protected build(): void {
    // nothing by default
  }

  protected setHeading(text: string): void {
    this.heading.textContent = text;
  }

  protected get context(): App {
    if (this.app === null) throw new Error(`${this.tagName.toLowerCase()} needs the app`);
    return this.app;
  }

  get isOpen(): boolean {
    return this.classList.contains('open');
  }

  open(): void {
    this.classList.add('open');
    this.opened();
  }

  close(): void {
    this.classList.remove('open');
  }

  // Subclasses refresh what may have changed while the panel was closed
  protected opened(): void {
    // nothing by default
  }
}
