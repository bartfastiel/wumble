// Names of a key for the settings list and the header: "C-Dur / A-Moll", "A-Dur ♯♯♯", "3 ♯".
import { t } from '../i18n';
import type { Key } from './keys';
import { germanName, pcOf } from './pitch';

const spell = (name: string, german: boolean): string => (german ? germanName(name) : name);

export const keyLabel = (key: Key, german = false): string => {
  const tonic = spell(key.names[key.tonic], german);
  const relative = spell(key.names[pcOf(key.tonic + 9)], german);
  return `${t('theory.major', { tonic })} / ${t('theory.minor', { tonic: relative })}`;
};

// Major key with its accidentals: "A-Dur ♯♯♯", "F-Dur ♭", "C-Dur"
export const keyTitle = (key: Key, german = false): string => {
  const major = t('theory.major', { tonic: spell(key.names[key.tonic], german) });
  const marks = (key.signature > 0 ? '♯' : '♭').repeat(Math.abs(key.signature));
  return marks === '' ? major : `${major} ${marks}`;
};

// Count of accidentals: "3 ♯", "2 ♭", "–"
export const signatureLabel = (signature: number): string => {
  if (signature > 0) return `${String(signature)} ♯`;
  if (signature < 0) return `${String(-signature)} ♭`;
  return '–';
};
