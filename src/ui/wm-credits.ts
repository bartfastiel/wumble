// The credits splash: shown on the first start and again whenever its text changed (the browser remembers a hash).
import { t } from '../i18n';
import {
  CODE_LICENSE,
  creditLine,
  creditsSeen,
  type CreditsStorage,
  creditsText,
  rememberCredits,
  SOUND_CREDITS,
} from './credits';

export class WmCredits extends HTMLElement {
  storage: CreditsStorage | null = null; // set by the app root; without storage the splash never shows

  connectedCallback(): void {
    if (this.classList.contains('modal')) return;
    this.className = 'modal';
    this.hidden = true;
    const text = creditsText();
    if (this.storage === null || creditsSeen(this.storage, text)) return;
    const card = document.createElement('div');
    card.className = 'card credits';
    const title = document.createElement('h2');
    title.textContent = t('credits.title');
    const intro = document.createElement('p');
    intro.textContent = t('credits.intro');
    const list = document.createElement('ul');
    for (const credit of SOUND_CREDITS) {
      const item = document.createElement('li');
      const link = document.createElement('a');
      link.href = credit.url;
      link.target = '_blank';
      link.rel = 'noopener';
      link.textContent = credit.name;
      item.append(link, document.createTextNode(creditLine(credit).slice(credit.name.length)));
      list.append(item);
    }
    const code = document.createElement('p');
    const codeLink = document.createElement('a');
    codeLink.href = CODE_LICENSE.url;
    codeLink.target = '_blank';
    codeLink.rel = 'noopener';
    codeLink.textContent = CODE_LICENSE.name;
    code.append(document.createTextNode(`${t('credits.code')} `), codeLink);
    const close = document.createElement('button');
    close.textContent = t('credits.close');
    const storage = this.storage;
    close.addEventListener('click', () => {
      rememberCredits(storage, text);
      this.hidden = true;
    });
    card.append(title, intro, list, code, close);
    this.append(card);
    this.hidden = false;
  }
}
