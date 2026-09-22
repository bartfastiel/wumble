// Constant tables of the QR code standard (ISO/IEC 18004) for versions 1–10 at error correction level M.

// Per version: error correction codewords per block, blocks and data codewords per block of group 1, the same for
// group 2, and the centres of the alignment patterns (the same list for rows and columns)
export interface QrVersion {
  readonly version: number;
  readonly ecPerBlock: number;
  readonly blocks1: number;
  readonly data1: number;
  readonly blocks2: number;
  readonly data2: number;
  readonly alignment: readonly number[];
}
type VersionRow = readonly [number, number, number, number, number, readonly number[]];
const rows: readonly VersionRow[] = [
  [10, 1, 16, 0, 0, []],
  [16, 1, 28, 0, 0, [6, 18]],
  [26, 1, 44, 0, 0, [6, 22]],
  [18, 2, 32, 0, 0, [6, 26]],
  [24, 2, 43, 0, 0, [6, 30]],
  [16, 4, 27, 0, 0, [6, 34]],
  [18, 4, 31, 0, 0, [6, 22, 38]],
  [22, 2, 38, 2, 39, [6, 24, 42]],
  [22, 3, 36, 2, 37, [6, 26, 46]],
  [26, 4, 43, 1, 44, [6, 28, 50]],
];
export const QR_VERSIONS: readonly QrVersion[] = rows.map(
  ([ecPerBlock, blocks1, data1, blocks2, data2, alignment], i) => ({
    version: i + 1,
    ecPerBlock,
    blocks1,
    data1,
    blocks2,
    data2,
    alignment,
  }),
);
export const QR_MAX_VERSION = QR_VERSIONS.length;

// The eight mask patterns (x = column, y = row): where one applies, a data module is inverted
export type MaskPredicate = (x: number, y: number) => boolean;
type EightMasks = readonly [
  MaskPredicate,
  MaskPredicate,
  MaskPredicate,
  MaskPredicate,
  MaskPredicate,
  MaskPredicate,
  MaskPredicate,
  MaskPredicate,
];
export const QR_MASKS: EightMasks = [
  (x, y) => (x + y) % 2 === 0,
  (_x, y) => y % 2 === 0,
  (x) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

// BCH generator polynomials and the mask of the format information
export const FORMAT_GENERATOR = 0x537;
export const FORMAT_MASK = 0x5412;
export const VERSION_GENERATOR = 0x1f25;

// GF(256) with the primitive polynomial x⁸ + x⁴ + x³ + x² + 1 (0x11d): exponential and logarithm tables; the
// exponentials are listed twice so that a product of two logarithms needs no reduction modulo 255
const PRIMITIVE = 0x11d;
const powers: number[] = [];
for (let i = 0, x = 1; i < 255; i++) {
  powers.push(x);
  x <<= 1;
  if (x & 0x100) x ^= PRIMITIVE;
}
export const GF_EXP = Uint8Array.from([...powers, ...powers, ...powers.slice(0, 2)]);
export const GF_LOG = new Uint8Array(256);
powers.forEach((x, i) => {
  GF_LOG[x] = i;
});
