// The welcome page: it opens every time, says in three lines where everything is, and starts the music on "Play".
// Nothing sounds before that click – a browser needs the gesture anyway, and the speakers may still be turned up.
import { t } from '../i18n';
import { CODE_LICENSE, creditLine, SOUND_CREDITS } from './credits';

// A tiny picture of each area, built from the same shapes the field uses
const GLYPHS: Readonly<Record<'map' | 'field' | 'slide', readonly number[]>> = {
  map: [0.5, 0.9, 0.6], // three spots of a chord map
  field: [0.4, 0.75, 1, 0.75, 0.4], // stripes, widest in the middle
  slide: [1], // one long bar
};

const glyph = (kind: keyof typeof GLYPHS): HTMLElement => {
  const box = document.createElement('span');
  box.className = `glyph ${kind}`;
  for (const size of GLYPHS[kind]) {
    const bar = document.createElement('i');
    bar.style.setProperty('--size', String(size));
    box.append(bar);
  }
  return box;
};

const line = (kind: keyof typeof GLYPHS): HTMLElement => {
  const row = document.createElement('p');
  row.className = 'where';
  const text = document.createElement('span');
  const lead = document.createElement('b');
  lead.textContent = t(`welcome.${kind}.lead`);
  text.append(lead, document.createTextNode(t(`welcome.${kind}.text`)));
  row.append(glyph(kind), text);
  return row;
};

export class WmWelcome extends HTMLElement {
  onPlay: (() => void) | null = null; // the app starts the music here

  connectedCallback(): void {
    if (this.classList.contains('modal')) return;
    this.className = 'modal';
    const card = document.createElement('div');
    card.className = 'card welcome';
    const title = document.createElement('h2');
    title.textContent = t('welcome.title');
    const intro = document.createElement('p');
    intro.className = 'intro';
    intro.textContent = t('welcome.intro');

    const credits = document.createElement('p');
    credits.className = 'credits-line';
    credits.append(document.createTextNode(`${t('credits.intro')} `));
    for (const [i, credit] of SOUND_CREDITS.entries()) {
      const link = document.createElement('a');
      link.href = credit.url;
      link.target = '_blank';
      link.rel = 'noopener';
      link.textContent = credit.name;
      link.title = creditLine(credit);
      credits.append(i === 0 ? link : document.createTextNode(', '));
      if (i > 0) credits.append(link);
    }
    const codeLink = document.createElement('a');
    codeLink.href = CODE_LICENSE.url;
    codeLink.target = '_blank';
    codeLink.rel = 'noopener';
    codeLink.textContent = CODE_LICENSE.name;
    credits.append(document.createTextNode(` · ${t('credits.code')} `), codeLink);

    const play = document.createElement('button');
    play.className = 'play';
    play.textContent = t('welcome.play');
    play.addEventListener('click', () => {
      this.hidden = true;
      this.onPlay?.();
    });
    card.append(title, intro, line('map'), line('field'), line('slide'), credits, play);
    this.append(card);
    this.hidden = false;
    requestAnimationFrame(() => {
      play.focus();
    });
  }
}
