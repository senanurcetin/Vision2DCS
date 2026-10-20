import { describe, expect, it } from 'vitest';
import { stressScanPixels } from './scanStress';

const pixels = () => {
  const data = new Uint8ClampedArray(24 * 16 * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 255; data[i + 1] = (i / 4) % 256;
    data[i + 2] = 128; data[i + 3] = 255;
  }
  return data;
};

describe('seeded offline P&ID scan perturbations', () => {
  it('reproducibly perturbs a copied raster without changing the source bytes', () => {
    const image = pixels();
    const original = new Uint8ClampedArray(image);
    const options = { mode: 'combined' as const, specklePercent: 11, seed: 42 };
    const a = stressScanPixels(image, 24, 16, options);
    const b = stressScanPixels(image, 24, 16, options);
    expect(a).toEqual(b);
    expect(a).not.toEqual(original);
    expect(a).not.toBe(image);
    expect(image).toEqual(original);
    expect(stressScanPixels(image, 24, 16, { ...options, seed: 43 })).not.toEqual(a);
  });

  it('is explicit about controls and leaves output bounded', () => {
    const sample = pixels();
    const occluded = stressScanPixels(sample, 24, 16, { mode: 'occlusion', specklePercent: 0, seed: 1 });
    const noisy = stressScanPixels(sample, 24, 16, { mode: 'speckle', specklePercent: 8, seed: 1 });
    expect(occluded).not.toEqual(noisy);
    expect(occluded.length).toBe(sample.length);
    expect(occluded.some((value, index) => value !== sample[index])).toBe(true);
    expect(noisy.some((value, index) => value !== sample[index])).toBe(true);
  });

  it('rejects malformed dimensions, buffers, seeds and noise parameters', () => {
    const data = pixels();
    const options = { mode: 'combined' as const, specklePercent: 3, seed: 4 };
    const bad = [
      [0, 16, options], [24, 0, options], [25, 16, options],
      [2048, 2048, options], [24.5, 16, options],
      [24, 16, { ...options, seed: -1 }],
      [24, 16, { ...options, seed: 1.2 }],
      [24, 16, { ...options, specklePercent: 21 }],
      [24, 16, { ...options, mode: 'wrong' }],
    ] as const;
    for (const [w, h, o] of bad) {
      expect(() => stressScanPixels(data, w, h, o as never)).toThrow(/Invalid bounded/);
    }
  });
});
