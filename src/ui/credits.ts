// The credits shown on the first start and again whenever they change (see the ADR on the public repository). One
// source for the splash; the README keeps its own section.
import { type MessageKey, t } from '../i18n';

export const CREDITS_STORAGE_KEY = 'wumble-credits';

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

// The text of the splash in the current locale; its hash is what the browser remembers
export const creditsText = (): string =>
  [t('credits.intro'), ...SOUND_CREDITS.map(creditLine), `${t('credits.code')} (${CODE_LICENSE.name})`].join('\n');

// djb2 as hex – a fingerprint to notice a changed text, nothing more
export const textHash = (text: string): string => {
  let hash = 5381;
  for (let i = 0; i < text.length; i++) hash = ((hash << 5) + hash + (text.codePointAt(i) ?? 0)) >>> 0;
  return hash.toString(16);
};

export interface CreditsStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const creditsSeen = (storage: CreditsStorage, text: string): boolean => {
  try {
    return storage.getItem(CREDITS_STORAGE_KEY) === textHash(text);
  } catch {
    return false;
  }
};

export const rememberCredits = (storage: CreditsStorage, text: string): void => {
  try {
    storage.setItem(CREDITS_STORAGE_KEY, textHash(text));
  } catch {
    // blocked storage: the splash shows again next time, which is harmless
  }
};
