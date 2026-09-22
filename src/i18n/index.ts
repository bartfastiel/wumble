// `de` is the schema: every locale must provide the same keys.
import { de } from './de';
import { en } from './en';

export type Locale = 'de' | 'en';
interface Tree {
  readonly [key: string]: string | Tree;
}
type Shape<T> = { readonly [K in keyof T]: T[K] extends string ? string : Shape<T[K]> };
type Paths<T> = { [K in keyof T & string]: T[K] extends string ? K : `${K}.${Paths<T[K]>}` }[keyof T & string];

export type MessageKey = Paths<typeof de>;

const messages: Record<Locale, Shape<typeof de>> = { de, en };

export const detectLocale = (language: string): Locale => (language.startsWith('de') ? 'de' : 'en');

let current = detectLocale(navigator.language);

export const locale = (): Locale => current;

export const setLocale = (next: Locale): void => {
  current = next;
};

const lookup = (tree: Tree, key: string): string | undefined => {
  let node: string | Tree | undefined = tree;
  for (const part of key.split('.')) node = typeof node === 'object' ? node[part] : undefined;
  return typeof node === 'string' ? node : undefined;
};

export const t = (key: MessageKey, params: Record<string, string | number> = {}): string =>
  (lookup(messages[current], key) ?? key).replaceAll(/\{(\w+)\}/g, (placeholder, name: string) =>
    String(params[name] ?? placeholder),
  );
