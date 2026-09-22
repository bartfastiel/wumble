// QR code (ISO/IEC 18004) without dependencies: byte mode, the smallest of versions 1–10, error correction level M.
// qrMatrix(text) gives the modules with a quiet zone of four for drawing; qrEncode(text) also exposes version, mask,
// blocks and format bits so the encoding can be verified.
import {
  FORMAT_GENERATOR,
  FORMAT_MASK,
  GF_EXP,
  GF_LOG,
  type MaskPredicate,
  QR_MASKS,
  QR_VERSIONS,
  type QrVersion,
  VERSION_GENERATOR,
} from './qr-tables';

export type Bit = 0 | 1;
export type Rows = readonly (readonly Bit[])[];

export interface QrBlock {
  readonly data: readonly number[];
  readonly ec: readonly number[];
}
export interface QrCode {
  readonly version: number;
  readonly size: number;
  readonly mask: number;
  readonly modules: Rows; // 1 = dark, without quiet zone
  readonly blocks: readonly QrBlock[];
  readonly dataCodewords: readonly number[];
  readonly codewords: readonly number[]; // interleaved data and error correction, as placed
  readonly format: number;
  readonly generator: readonly number[];
  readonly freeBits: number; // modules available for codewords, incl. the remainder bits
  readonly penalty: number;
}

export const QUIET_ZONE = 4;
const BYTE_MODE = 4;
const PAD_BYTES = [0xec, 0x11];

// Table lookups that are within bounds by construction (the types cannot tell)
const at = (table: ArrayLike<number>, index: number): number => table[index] ?? 0;

const gfMul = (a: number, b: number): number => (a === 0 || b === 0 ? 0 : at(GF_EXP, at(GF_LOG, a) + at(GF_LOG, b)));

// Generator polynomial of degree n: the product of (x − αⁱ) for i = 0 … n−1, coefficients descending, leading 1
export const rsGenerator = (degree: number): number[] => {
  let polynomial = [1];
  for (let i = 0; i < degree; i++) {
    const previous = polynomial;
    polynomial = Array.from(
      { length: previous.length + 1 },
      (_, j) => (previous[j] ?? 0) ^ gfMul(previous[j - 1] ?? 0, at(GF_EXP, i)),
    );
  }
  return polynomial;
};

// Remainder of (message · xⁿ) / generator: the n error correction codewords; with them appended the remainder is zero
export const rsRemainder = (data: readonly number[], generator: readonly number[]): number[] => {
  let remainder = new Array<number>(generator.length - 1).fill(0);
  for (const byte of data) {
    const factor = byte ^ at(remainder, 0);
    const shifted = [...remainder.slice(1), 0];
    remainder = factor === 0 ? shifted : shifted.map((value, j) => value ^ gfMul(at(generator, j + 1), factor));
  }
  return remainder;
};

// BCH: data · x^degree modulo generator, returned as data · x^degree + remainder – the format information (15, 5) and
// the version information (18, 6)
export const bch = (data: number, generator: number, degree: number): number => {
  let remainder = data << degree;
  for (let i = 31 - Math.clz32(remainder); i >= degree; i--) {
    if ((remainder >> i) & 1) remainder ^= generator << (i - degree);
  }
  return (data << degree) | remainder;
};

// Level M is 00, followed by the mask; the xor with FORMAT_MASK keeps the bits from being all zero
export const qrFormatBits = (mask: number): number => bch(mask, FORMAT_GENERATOR, 10) ^ FORMAT_MASK;
export const qrVersionBits = (version: number): number => bch(version, VERSION_GENERATOR, 12);

const countBits = (version: number): number => (version >= 10 ? 16 : 8);
const dataCapacity = (layout: QrVersion): number => layout.blocks1 * layout.data1 + layout.blocks2 * layout.data2;

// The smallest version whose data codewords hold mode, character count and the bytes
const chooseVersion = (byteCount: number): QrVersion => {
  const found = QR_VERSIONS.find(
    (layout) => BYTE_MODE + countBits(layout.version) + 8 * byteCount <= 8 * dataCapacity(layout),
  );
  if (found === undefined)
    throw new RangeError(`text too long for a QR code up to version ${String(QR_VERSIONS.length)}`);
  return found;
};

// Bit stream: mode 0100, character count, the bytes, terminator (up to four zeros), fill to a byte boundary, pad bytes
const encodeData = (bytes: Uint8Array, version: number, capacity: number): number[] => {
  const bits: number[] = [];
  const put = (value: number, count: number): void => {
    for (let i = count - 1; i >= 0; i--) bits.push((value >> i) & 1);
  };
  put(BYTE_MODE, 4);
  put(bytes.length, countBits(version));
  for (const byte of bytes) put(byte, 8);
  put(0, Math.min(4, capacity * 8 - bits.length));
  while (bits.length % 8) bits.push(0);
  const data: number[] = [];
  for (let i = 0; i < bits.length; i += 8) data.push(bits.slice(i, i + 8).reduce((a, b) => a * 2 + b, 0));
  const padCount = capacity - data.length;
  for (let i = 0; i < padCount; i++) data.push(at(PAD_BYTES, i % 2));
  return data;
};

// Blocks (group 2 one data codeword longer), Reed–Solomon per block, then interleaved: all data codewords column by
// column across the blocks, then the error correction
const splitBlocks = (data: readonly number[], layout: QrVersion, generator: readonly number[]): QrBlock[] => {
  const blocks: QrBlock[] = [];
  let offset = 0;
  for (let i = 0; i < layout.blocks1 + layout.blocks2; i++) {
    const length = i < layout.blocks1 ? layout.data1 : layout.data2;
    const blockData = data.slice(offset, offset + length);
    blocks.push({ data: blockData, ec: rsRemainder(blockData, generator) });
    offset += length;
  }
  return blocks;
};
const interleave = (blocks: readonly QrBlock[], layout: QrVersion): number[] => {
  const out: number[] = [];
  for (let i = 0; i < Math.max(layout.data1, layout.data2); i++) {
    for (const block of blocks) if (i < block.data.length) out.push(at(block.data, i));
  }
  for (let i = 0; i < layout.ecPerBlock; i++) for (const block of blocks) out.push(at(block.ec, i));
  return out;
};

// The module grid plus a map of the function patterns, which masks leave alone
class Grid {
  private readonly cells: Uint8Array;
  private readonly reserved: Uint8Array;

  constructor(readonly size: number) {
    this.cells = new Uint8Array(size * size);
    this.reserved = new Uint8Array(size * size);
  }

  at(x: number, y: number): number {
    return at(this.cells, y * this.size + x);
  }

  isReserved(x: number, y: number): boolean {
    return this.reserved[y * this.size + x] === 1;
  }

  // Function pattern module: set and reserved
  fix(x: number, y: number, dark: boolean): void {
    if (x < 0 || y < 0 || x >= this.size || y >= this.size) return;
    this.cells[y * this.size + x] = dark ? 1 : 0;
    this.reserved[y * this.size + x] = 1;
  }

  put(x: number, y: number, bit: number): void {
    this.cells[y * this.size + x] = bit;
  }

  flip(x: number, y: number): void {
    this.cells[y * this.size + x] = this.at(x, y) ^ 1;
  }

  rows(): Bit[][] {
    return Array.from({ length: this.size }, (_, y) =>
      Array.from({ length: this.size }, (_, x) => (this.at(x, y) ? 1 : 0)),
    );
  }
}

const placeFinder = (grid: Grid, cx: number, cy: number): void => {
  for (let dy = -4; dy <= 4; dy++) {
    for (let dx = -4; dx <= 4; dx++) {
      const distance = Math.max(Math.abs(dx), Math.abs(dy));
      grid.fix(cx + dx, cy + dy, distance !== 2 && distance !== 4);
    }
  }
};

const placeAlignmentPattern = (grid: Grid, cx: number, cy: number): void => {
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) grid.fix(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  }
};

// Alignment patterns at every combination of the centres except the three that lie on a finder pattern
const placeAlignment = (grid: Grid, centers: readonly number[]): void => {
  const last = centers.length - 1;
  centers.forEach((cx, i) => {
    centers.forEach((cy, j) => {
      const onFinder = (i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0);
      if (!onFinder) placeAlignmentPattern(grid, cx, cy);
    });
  });
};

// Finder patterns with separators, timing patterns, alignment patterns
const placeFunctionPatterns = (grid: Grid, layout: QrVersion): void => {
  const size = grid.size;
  placeFinder(grid, 3, 3);
  placeFinder(grid, size - 4, 3);
  placeFinder(grid, 3, size - 4);
  for (let i = 8; i < size - 8; i++) {
    grid.fix(6, i, i % 2 === 0);
    grid.fix(i, 6, i % 2 === 0);
  }
  placeAlignment(grid, layout.alignment);
};

// Format information (15 bits, bit 0 first) in both places: around the top left finder pattern and split between top
// right and bottom left; the dark module next to the bottom left finder pattern is always set
const placeFormat = (grid: Grid, formatBits: number): void => {
  const size = grid.size;
  const bit = (i: number): boolean => ((formatBits >> i) & 1) === 1;
  for (let i = 0; i <= 5; i++) grid.fix(8, i, bit(i));
  grid.fix(8, 7, bit(6));
  grid.fix(8, 8, bit(7));
  grid.fix(7, 8, bit(8));
  for (let i = 9; i < 15; i++) grid.fix(14 - i, 8, bit(i));
  for (let i = 0; i < 8; i++) grid.fix(size - 1 - i, 8, bit(i));
  for (let i = 8; i < 15; i++) grid.fix(8, size - 15 + i, bit(i));
  grid.fix(8, size - 8, true);
};

// Version information (18 bits) as 3×6 top right and 6×3 bottom left, from version 7 on
const placeVersion = (grid: Grid, version: number): void => {
  const size = grid.size;
  const versionBits = qrVersionBits(version);
  for (let i = 0; i < 18; i++) {
    const dark = ((versionBits >> i) & 1) === 1;
    const a = size - 11 + (i % 3);
    const b = Math.floor(i / 3);
    grid.fix(a, b, dark);
    grid.fix(b, a, dark);
  }
};

// Right columns of the two-module columns from right to left; the timing column 6 is skipped
const rightColumns = (size: number): number[] => {
  const columns: number[] = [];
  for (let right = size - 1; right >= 1; right -= 2) columns.push(right <= 6 ? right - 1 : right);
  return columns;
};

// The free modules in placement order: zigzag in two-module columns from right to left, alternating upwards and
// downwards, skipping the function patterns
const freeModules = (grid: Grid): { readonly x: number; readonly y: number }[] => {
  const size = grid.size;
  const modules: { readonly x: number; readonly y: number }[] = [];
  for (const right of rightColumns(size)) {
    const upwards = ((right + 1) & 2) === 0;
    for (let v = 0; v < size; v++) {
      const y = upwards ? size - 1 - v : v;
      for (const x of [right, right - 1]) if (!grid.isReserved(x, y)) modules.push({ x, y });
    }
  }
  return modules;
};

// Codewords bit by bit into the free modules; returns their number (codeword bits plus remainder bits)
const placeCodewords = (grid: Grid, codewords: readonly number[]): number => {
  const modules = freeModules(grid);
  modules.forEach(({ x, y }, k) => {
    const codeword = codewords[k >> 3];
    if (codeword !== undefined) grid.put(x, y, (codeword >> (7 - (k & 7))) & 1);
  });
  return modules.length;
};

// Penalty rule 1: runs of the same colour from five modules score 3 plus the excess; rule 3: the finder-like sequence
// 1011101 with four light modules before or after it scores 40 – both along one row or column
const linePenalty = (size: number, at: (i: number) => number): number => {
  let score = 0;
  let run = 0;
  let last = -1;
  for (let i = 0; i <= size; i++) {
    const value = i < size ? at(i) : -1;
    if (value === last) {
      run++;
      continue;
    }
    if (run >= 5) score += run - 2;
    run = 1;
    last = value;
  }
  for (let i = 0; i + 11 <= size; i++) {
    let sequence = '';
    for (let k = 0; k < 11; k++) sequence += String(at(i + k));
    if (sequence === '10111010000' || sequence === '00001011101') score += 40;
  }
  return score;
};

// Rule 2: every 2×2 block of one colour scores 3
const blockPenalty = (grid: Grid): number => {
  let score = 0;
  for (let y = 0; y + 1 < grid.size; y++) {
    for (let x = 0; x + 1 < grid.size; x++) {
      const value = grid.at(x, y);
      if (value === grid.at(x + 1, y) && value === grid.at(x, y + 1) && value === grid.at(x + 1, y + 1)) score += 3;
    }
  }
  return score;
};

// Rule 4: ten points per full 5 % the dark share deviates from 50 %
const balancePenalty = (grid: Grid): number => {
  let dark = 0;
  for (let y = 0; y < grid.size; y++) for (let x = 0; x < grid.size; x++) dark += grid.at(x, y);
  return 10 * Math.floor(Math.abs((dark * 100) / (grid.size * grid.size) - 50) / 5);
};

const qrPenalty = (grid: Grid): number => {
  let score = 0;
  for (let i = 0; i < grid.size; i++) {
    score += linePenalty(grid.size, (j) => grid.at(j, i));
    score += linePenalty(grid.size, (j) => grid.at(i, j));
  }
  return score + blockPenalty(grid) + balancePenalty(grid);
};

const applyMask = (grid: Grid, predicate: MaskPredicate): void => {
  for (let y = 0; y < grid.size; y++) {
    for (let x = 0; x < grid.size; x++) if (!grid.isReserved(x, y) && predicate(x, y)) grid.flip(x, y);
  }
};

interface MaskChoice {
  readonly mask: number;
  readonly predicate: MaskPredicate;
  readonly penalty: number;
}

// Apply and score all eight masks (each with its own format information); the best one stays
const chooseMask = (grid: Grid): MaskChoice => {
  let best: MaskChoice = { mask: 0, predicate: QR_MASKS[0], penalty: Infinity };
  QR_MASKS.forEach((predicate, mask) => {
    applyMask(grid, predicate);
    placeFormat(grid, qrFormatBits(mask));
    const penalty = qrPenalty(grid);
    if (penalty < best.penalty) best = { mask, predicate, penalty };
    applyMask(grid, predicate);
  });
  applyMask(grid, best.predicate);
  placeFormat(grid, qrFormatBits(best.mask));
  return best;
};

export const qrEncode = (text: string): QrCode => {
  const bytes = new TextEncoder().encode(text);
  const layout = chooseVersion(bytes.length);
  const { version } = layout;
  const dataCodewords = encodeData(bytes, version, dataCapacity(layout));
  const generator = rsGenerator(layout.ecPerBlock);
  const blocks = splitBlocks(dataCodewords, layout, generator);
  const codewords = interleave(blocks, layout);

  const grid = new Grid(17 + 4 * version);
  placeFunctionPatterns(grid, layout);
  placeFormat(grid, 0);
  if (version >= 7) placeVersion(grid, version);
  const freeBits = placeCodewords(grid, codewords);
  const { mask, penalty } = chooseMask(grid);
  return {
    version,
    size: grid.size,
    mask,
    modules: grid.rows(),
    blocks,
    dataCodewords,
    codewords,
    format: qrFormatBits(mask),
    generator,
    freeBits,
    penalty,
  };
};

// The modules with a quiet zone of four light modules on every side – what gets drawn
export const qrMatrix = (text: string): Bit[][] => {
  const { modules, size } = qrEncode(text);
  const light = (length: number): Bit[] => new Array<Bit>(length).fill(0);
  const margin = (): Bit[][] => Array.from({ length: QUIET_ZONE }, () => light(size + 2 * QUIET_ZONE));
  return [...margin(), ...modules.map((row) => [...light(QUIET_ZONE), ...row, ...light(QUIET_ZONE)]), ...margin()];
};
