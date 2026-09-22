// The help page: one paragraph per topic, the lead in bold – the texts live in the i18n resources.
import { t } from '../i18n';
import { WmPanel } from './wm-panel';

export const HELP_TOPICS = [
  'field',
  'width',
  'map',
  'silence',
  'songs',
  'scan',
  'levels',
  'autoHarmony',
  'band',
  'loop',
  'echo',
  'audience',
  'radio',
  'keyboard',
  'styles',
  'tunings',
  'sounds',
  'labels',
] as const;

export const helpParagraph = (topic: (typeof HELP_TOPICS)[number]): HTMLParagraphElement => {
  const paragraph = document.createElement('p');
  const lead = document.createElement('b');
  lead.textContent = t(`help.${topic}.lead`);
  paragraph.append(lead, document.createTextNode(t(`help.${topic}.text`)));
  return paragraph;
};

export class WmHelp extends WmPanel {
  protected override build(): void {
    this.setHeading(t('help.title'));
    this.body.replaceChildren(...HELP_TOPICS.map(helpParagraph));
  }
}
