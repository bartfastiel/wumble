// The keys as a circle of fifths: a step around the ring is a step along the fifths, and the colour is the one the
// whole page takes on. Where a key sits says how far from home it is – no sentence needed.
import { keySign, keyTitle, signatureLabel } from '../../theory/key-labels';
import { hueOf, KEYS } from '../../theory/keys';
import { wheel, type Wheel, type WheelItem } from '../widgets/wheel';

export const keyWheel = (signature: number, german: boolean, onPick: (signature: number) => void): Wheel<number> => {
  // The ring starts at C and walks up in fifths, so sharps run clockwise and flats counter-clockwise
  const order = [...KEYS].sort((a, b) => a.signature - b.signature);
  const start = order.findIndex((key) => key.signature === 0);
  const ring = [...order.slice(start), ...order.slice(0, start)];
  const items: WheelItem<number>[] = ring.map((key) => ({
    value: key.signature,
    label: keySign(key, german),
    title: keyTitle(key, german),
    tint: `hsl(${String(hueOf(key))} 46% 52%)`,
    mark: signatureLabel(key.signature),
  }));
  return wheel(items, signature, onPick);
};
