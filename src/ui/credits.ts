// Who made the recordings the sampler plays. One source for the welcome page; the README keeps its own section.
import { type MessageKey, t } from '../i18n';

export interface Credit {
  readonly name: string;
  readonly author: string;
  readonly license: string;
  readonly url: string;
  readonly use: MessageKey; // what the recording plays here
}

export const SOUND_CREDITS: readonly Credit[] = [
  {
    name: 'Salamander Grand Piano V3',
    author: 'Alexander Holm',
    license: 'CC BY 3.0',
    url: 'https://github.com/sfzinstruments/SalamanderGrandPiano',
    use: 'credits.piano',
  },
  {
    name: 'VSCO 2 Community Edition',
    author: 'Versilian Studios (Sam Gossner, Simon Dalzell)',
    license: 'CC0',
    url: 'https://github.com/sgossner/VSCO-2-CE',
    use: 'credits.vsco',
  },
];

export const CODE_LICENSE = { name: 'MIT', url: 'https://github.com/bartfastiel/wumble' } as const;

export const creditLine = (credit: Credit): string =>
  `${credit.name} – ${credit.author}, ${credit.license} – ${t(credit.use)}`;
