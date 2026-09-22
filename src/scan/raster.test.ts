import { describe, expect, it } from 'vitest';
import {
  byteAt,
  floatAt,
  grayscale,
  IntegralImage,
  intAt,
  numberAt,
  resize,
  type RgbaImage,
  sampleBilinear,
  scaleToWidth,
  toRgba,
  wordAt,
} from './raster';

describe('typed accessors', () => {
  it('read an element and fall back to zero outside', () => {
    expect(byteAt(new Uint8Array([5, 6]), 1)).toBe(6);
    expect(byteAt(new Uint8Array([5, 6]), 2)).toBe(0);
    expect(wordAt(new Uint32Array([7]), 0)).toBe(7);
    expect(wordAt(new Uint32Array([7]), 1)).toBe(0);
    expect(intAt(new Int32Array([-3]), 0)).toBe(-3);
    expect(intAt(new Int32Array([-3]), 1)).toBe(0);
    expect(floatAt(new Float32Array([0.5]), 0)).toBe(0.5);
    expect(floatAt(new Float32Array([0.5]), 1)).toBe(0);
    expect(numberAt([9], 0)).toBe(9);
    expect(numberAt([], 3)).toBe(0);
  });
});

const rgba = (width: number, height: number, pixels: readonly (readonly [number, number, number])[]): RgbaImage => ({
  width,
  height,
  data: new Uint8ClampedArray(pixels.flatMap(([r, g, b]) => [r, g, b, 255])),
});

describe('grayscale', () => {
  it('weights green most, as the reference does', () => {
    const gray = grayscale(
      rgba(3, 1, [
        [255, 0, 0],
        [0, 255, 0],
        [0, 0, 255],
      ]),
    );
    expect([...gray.data]).toEqual([76, 150, 27]);
  });

  it('round-trips through toRgba', () => {
    const image = toRgba({ width: 2, height: 1, data: new Uint8Array([0, 200]) });
    expect([...image.data]).toEqual([0, 0, 0, 255, 200, 200, 200, 255]);
    expect([...grayscale(image).data]).toEqual([0, 200]);
  });
});

describe('sampleBilinear', () => {
  const image = { width: 2, height: 2, data: new Uint8Array([0, 100, 200, 255]) };

  it('interpolates between the four neighbours', () => {
    expect(sampleBilinear(image, 0, 0)).toBe(0);
    expect(sampleBilinear(image, 0.5, 0)).toBe(50);
    expect(sampleBilinear(image, 0, 0.5)).toBe(100);
    expect(sampleBilinear(image, 0.5, 0.5)).toBeCloseTo(138.75);
  });

  it('clamps to the border', () => {
    expect(sampleBilinear(image, -3, -3)).toBe(0);
    expect(sampleBilinear(image, 9, 9)).toBe(255);
  });
});

describe('resize', () => {
  it('keeps a flat image flat and scales the size', () => {
    const image = resize({ width: 2, height: 2, data: new Uint8Array([7, 7, 7, 7]) }, 5, 3);
    expect(image.width).toBe(5);
    expect(image.height).toBe(3);
    expect([...image.data]).toEqual(Array<number>(15).fill(7));
  });

  it('blends when shrinking', () => {
    const image = resize({ width: 4, height: 1, data: new Uint8Array([0, 0, 255, 255]) }, 2, 1);
    expect(image.data[0]).toBeLessThan(image.data[1] ?? 0);
  });
});

describe('scaleToWidth', () => {
  it('returns the image itself at the target width', () => {
    const image = { width: 1400, height: 10, data: new Uint8Array(14000) };
    expect(scaleToWidth(image)).toBe(image);
  });

  it('scales the height proportionally, up as well as down', () => {
    expect(scaleToWidth({ width: 700, height: 300, data: new Uint8Array(210000) })).toMatchObject({
      width: 1400,
      height: 600,
    });
    expect(scaleToWidth({ width: 2800, height: 300, data: new Uint8Array(840000) }, 1400)).toMatchObject({
      width: 1400,
      height: 150,
    });
  });
});

describe('IntegralImage', () => {
  const integral = new IntegralImage({ width: 3, height: 2, data: new Uint8Array([1, 2, 3, 4, 5, 6]) });

  it('sums rectangles', () => {
    expect(integral.sum(0, 0, 3, 2)).toBe(21);
    expect(integral.sum(1, 0, 3, 1)).toBe(5);
    expect(integral.sum(2, 1, 3, 2)).toBe(6);
    expect(integral.sum(1, 1, 1, 1)).toBe(0);
  });

  it('computes means', () => {
    expect(integral.mean(0, 0, 3, 2)).toBe(3.5);
  });
});
