import jsQR from 'jsqr';
import { describe, expect, it } from 'vitest';
import { RECORDED } from './__fixtures__/recorded';
import {
  bch,
  type Bit,
  qrEncode,
  qrFormatBits,
  qrMatrix,
  qrVersionBits,
  QUIET_ZONE,
  rsGenerator,
  rsRemainder,
} from './qr-encoder';
import { FORMAT_GENERATOR, FORMAT_MASK, QR_MAX_VERSION, QR_VERSIONS } from './qr-tables';

const toRows = (matrix: readonly (readonly Bit[])[]): string[] =>
  matrix.map((row) => row.map((bit) => (bit ? '#' : '.')).join(''));

// The matrix as an RGBA image with `scale` pixels per module, the way a camera would see it
const toImage = (matrix: readonly (readonly Bit[])[], scale: number): Uint8ClampedArray => {
  const n = matrix.length * scale;
  const pixels = new Uint8ClampedArray(n * n * 4);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const dark = matrix[Math.floor(y / scale)]?.[Math.floor(x / scale)] === 1;
      const offset = (y * n + x) * 4;
      pixels.fill(dark ? 0 : 255, offset, offset + 3);
      pixels[offset + 3] = 255;
    }
  }
  return pixels;
};

// Level M format information for masks 0–7 as listed in the specification
const FORMAT_BITS_M = [0x5412, 0x5125, 0x5e7c, 0x5b4b, 0x45f9, 0x40ce, 0x4f97, 0x4aa0];
const hex = (bytes: readonly number[]): string => bytes.map((b) => b.toString(16).padStart(2, '0')).join(' ');

describe('qrEncode', () => {
  it('matches the reference for every text: version, mask, codewords, blocks, format, penalty', () => {
    for (const fixture of RECORDED.qr) {
      const code = qrEncode(fixture.text);
      expect(code.version, fixture.text).toBe(fixture.version);
      expect(code.size).toBe(fixture.size);
      expect(code.mask).toBe(fixture.mask);
      expect(code.format).toBe(fixture.format);
      expect(code.penalty).toBe(fixture.penalty);
      expect(code.freeBits).toBe(fixture.freeBits);
      expect(code.dataCodewords).toEqual(fixture.dataCodewords);
      expect(code.codewords).toEqual(fixture.codewords);
      expect(code.blocks).toEqual(fixture.blocks);
    }
  });

  it('reaches every version from 1 to 10 with the fixtures', () => {
    const versions = new Set(RECORDED.qr.map((fixture) => fixture.version));
    expect([...versions].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(QR_MAX_VERSION).toBe(10);
  });

  it('encodes HELLO WORLD in version 1 with the well-known data codewords', () => {
    const code = qrEncode('HELLO WORLD');
    expect(code.version).toBe(1);
    expect(hex(code.dataCodewords)).toBe('40 b4 84 54 c4 c4 f2 05 74 f5 24 c4 40 ec 11 ec');
    expect(code.freeBits - code.codewords.length * 8).toBe(0); // version 1 has no remainder bits
  });

  it('leaves seven remainder bits in versions 2 to 6', () => {
    const code = qrEncode('https://wumble.example/secret-xxxxxxxx/#room=k7m3x');
    expect(code.version).toBe(4);
    expect(code.freeBits - code.codewords.length * 8).toBe(7);
  });

  it('places finder patterns, timing patterns and the dark module', () => {
    for (const fixture of RECORDED.qr) {
      const { modules, size } = qrEncode(fixture.text);
      const at = (x: number, y: number): Bit => modules[y]?.[x] ?? 0;
      const finder = (x0: number, y0: number): boolean => {
        for (let y = 0; y < 7; y++) {
          for (let x = 0; x < 7; x++) {
            const distance = Math.max(Math.abs(x - 3), Math.abs(y - 3));
            if (at(x0 + x, y0 + y) !== (distance === 2 ? 0 : 1)) return false;
          }
        }
        return true;
      };
      expect(finder(0, 0) && finder(size - 7, 0) && finder(0, size - 7)).toBe(true);
      for (let i = 8; i < size - 8; i++) {
        expect(at(6, i)).toBe(i % 2 === 0 ? 1 : 0);
        expect(at(i, 6)).toBe(i % 2 === 0 ? 1 : 0);
      }
      expect(at(8, size - 8)).toBe(1);
    }
  });

  it('writes the same format information in both places', () => {
    for (const fixture of RECORDED.qr) {
      const { modules, size, format } = qrEncode(fixture.text);
      const at = (x: number, y: number): number => modules[y]?.[x] ?? 0;
      const first = (i: number): number => {
        if (i <= 5) return at(8, i);
        if (i === 6) return at(8, 7);
        if (i === 7) return at(8, 8);
        if (i === 8) return at(7, 8);
        return at(14 - i, 8);
      };
      const second = (i: number): number => (i < 8 ? at(size - 1 - i, 8) : at(8, size - 15 + i));
      let read1 = 0;
      let read2 = 0;
      for (let i = 0; i < 15; i++) {
        read1 |= first(i) << i;
        read2 |= second(i) << i;
      }
      expect(read1).toBe(format);
      expect(read2).toBe(format);
      expect(RECORDED.qrTables.formatTable).toContain(format);
    }
  });

  it('rejects a text longer than version 10 holds', () => {
    expect(() => qrEncode('x'.repeat(213)).version).not.toThrow();
    expect(() => qrEncode('x'.repeat(214))).toThrow(RangeError);
  });
});

describe('qrMatrix', () => {
  it('matches the reference rows including the quiet zone', () => {
    for (const fixture of RECORDED.qr) expect(toRows(qrMatrix(fixture.text)), fixture.text).toEqual(fixture.rows);
  });

  it('adds a quiet zone of four light modules', () => {
    const matrix = qrMatrix('HELLO WORLD');
    expect(matrix).toHaveLength(21 + 2 * QUIET_ZONE);
    expect(
      matrix
        .slice(0, QUIET_ZONE)
        .flat()
        .every((bit) => bit === 0),
    ).toBe(true);
    expect(matrix.every((row) => row.slice(0, QUIET_ZONE).every((bit) => bit === 0))).toBe(true);
  });

  it('is decoded by jsQR to the original text for every fixture', () => {
    for (const fixture of RECORDED.qr) {
      const matrix = qrMatrix(fixture.text);
      const scale = 4;
      const width = matrix.length * scale;
      const decoded = jsQR(toImage(matrix, scale), width, width, { inversionAttempts: 'dontInvert' });
      expect(decoded?.data, fixture.text).toBe(fixture.text);
      expect(decoded?.version).toBe(fixture.version);
    }
  });
});

describe('Reed–Solomon over GF(256)', () => {
  it('builds the generator polynomials of the standard', () => {
    for (const { degree, coefficients } of RECORDED.qrTables.generators)
      expect(rsGenerator(degree)).toEqual(coefficients);
    expect(new Set(QR_VERSIONS.map((layout) => layout.ecPerBlock)).size).toBe(RECORDED.qrTables.generators.length);
  });

  it('leaves remainder zero once the error correction codewords are appended', () => {
    for (const fixture of RECORDED.qr) {
      const { blocks, generator } = qrEncode(fixture.text);
      for (const block of blocks) {
        expect(rsRemainder([...block.data, ...block.ec], generator).every((value) => value === 0)).toBe(true);
      }
    }
  });

  it('is linear: the remainder of a zero message is zero', () => {
    expect(rsRemainder([0, 0, 0], rsGenerator(10))).toEqual(new Array<number>(10).fill(0));
  });
});

describe('BCH codes', () => {
  it('gives the format bits of level M for the eight masks', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7].map(qrFormatBits)).toEqual(FORMAT_BITS_M);
    expect([0, 1, 2, 3, 4, 5, 6, 7].map(qrFormatBits)).toEqual(RECORDED.qrTables.formatBits);
  });

  it('spans the table of all 32 format information values', () => {
    const table = Array.from({ length: 32 }, (_, i) => bch(i, FORMAT_GENERATOR, 10) ^ FORMAT_MASK);
    expect(table).toEqual(RECORDED.qrTables.formatTable);
  });

  it('gives the version information of versions 1 to 10', () => {
    expect(Array.from({ length: 10 }, (_, i) => qrVersionBits(i + 1))).toEqual(RECORDED.qrTables.versionBits);
    expect(qrVersionBits(7)).toBe(0x07c94); // the example of the specification
  });
});
