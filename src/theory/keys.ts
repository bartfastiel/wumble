// Keys by key signature: major and its relative minor share one entry (see the ADR on key = key signature).
import { NAMES_FLAT, NAMES_SHARP, type NoteNames, type PitchClass, pcOf } from './pitch';

export interface Key {
  readonly signature: number; // sharps counted positive, flats negative
  readonly tonic: PitchClass;
  readonly names: NoteNames; // spelling of the key: sharps or flats
}

// From six sharps to six flats, in the order of the settings list
export const KEYS: readonly Key[] = Array.from({ length: 13 }, (_, i) => {
  const signature = 6 - i;
  return { signature, tonic: pcOf(7 * signature), names: signature >= 0 ? NAMES_SHARP : NAMES_FLAT };
});

export const keyBySignature = (signature: number): Key => {
  const key = KEYS.find((k) => k.signature === signature);
  if (key === undefined) throw new RangeError(`no key with signature ${String(signature)}`);
  return key;
};

// Every key has its own hue: one step of fifths = 30° on the colour wheel
export const hueOf = (key: Key): number => (((85 - 30 * key.signature) % 360) + 360) % 360;
