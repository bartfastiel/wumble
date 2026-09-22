// "Done!" after the last tone of a song: title, points and record from medium on, once more or free play.
import { t } from '../i18n';
import type { Finish } from '../learn/session';
import { points } from './title';

export const doneText = ({ song, scored, score, best, newRecord }: Finish): string => {
  if (!scored) return song.title;
  const record = newRecord ? t('learn.done.newRecord') : t('learn.done.record', { points: points(best ?? 0) });
  return `${song.title} · ${t('learn.done.points', { points: points(score) })} · ${record}`;
};

export class WmDone extends HTMLElement {
  onAgain: (() => void) | null = null;
  onFreePlay: (() => void) | null = null;
  private readonly text = document.createElement('p');

  connectedCallback(): void {
    if (this.classList.contains('modal')) return;
    this.className = 'modal';
    this.hidden = true;
    const card = document.createElement('div');
    card.className = 'card';
    const title = document.createElement('h2');
    title.textContent = t('ui.done.title');
    const again = document.createElement('button');
    again.textContent = t('ui.done.again');
    again.addEventListener('click', () => {
      this.hidden = true;
      this.onAgain?.();
    });
    const free = document.createElement('button');
    free.className = 'secondary';
    free.textContent = t('learn.freePlay');
    free.addEventListener('click', () => {
      this.hidden = true;
      this.onFreePlay?.();
    });
    card.append(title, this.text, again, free);
    this.append(card);
  }

  show(result: Finish): void {
    this.text.textContent = doneText(result);
    this.hidden = false;
  }
}
