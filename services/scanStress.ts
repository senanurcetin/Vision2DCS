/**
 * Deterministic offline P&ID scan stress demonstration.
 * Pure RGBA pixel transform; no OCR inference, API calls, unsafe file codecs,
 * interpretation of plant labels, or performance measurements.
 */
export type ScanStressMode = 'speckle' | 'occlusion' | 'combined';
export interface ScanStressOptions {
  seed: number;
  specklePercent: number;
  mode: ScanStressMode;
}
const MAX_PIXELS = 2_097_152;

const randomGenerator = (seed: number) => {
  let x = (seed >>> 0) || 0x9e3779b9;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return (x >>> 0) / 0x100000000;
  };
};

/** Returns a fresh RGBA buffer; input pixels are never changed. */
export function stressScanPixels(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  options: ScanStressOptions,
): Uint8ClampedArray {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) ||
      width < 1 || height < 1 || width * height > MAX_PIXELS ||
      pixels.length !== width * height * 4 ||
      !Number.isSafeInteger(options.seed) || options.seed < 0 || options.seed > 1_000_000_000 ||
      !Number.isInteger(options.specklePercent) ||
      options.specklePercent < 0 || options.specklePercent > 20 ||
      !(['speckle', 'occlusion', 'combined'] as const).includes(options.mode)) {
    throw new Error('Invalid bounded synthetic scan-stress input.');
  }
  const out = new Uint8ClampedArray(pixels);
  const next = randomGenerator(options.seed);
  if (options.mode === 'speckle' || options.mode === 'combined') {
    for (let i = 0; i < pixels.length; i += 4) {
      // Convert to a grayscale print/scan representation.
      const gray = Math.round(0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2]);
      let sample = gray;
      if (next() < options.specklePercent / 100) sample = next() < 0.5 ? 0 : 255;
      out[i] = sample;
      out[i + 1] = sample;
      out[i + 2] = sample;
      out[i + 3] = 255;
    }
  }
  if (options.mode === 'occlusion' || options.mode === 'combined') {
    // Two bounded seeded paper-mask rectangles, always no more than one
    // quarter of each image dimension. These illustrate lost source evidence.
    for (let n = 0; n < 2; n++) {
      const rectWidth = Math.max(1, Math.floor(width * (0.07 + 0.12 * next())));
      const rectHeight = Math.max(1, Math.floor(height * (0.07 + 0.12 * next())));
      const left = Math.floor(next() * (width - rectWidth + 1));
      const top = Math.floor(next() * (height - rectHeight + 1));
      for (let y = top; y < top + rectHeight; y++) {
        for (let x = left; x < left + rectWidth; x++) {
          const offset = (y * width + x) * 4;
          out[offset] = out[offset + 1] = out[offset + 2] = out[offset + 3] = 255;
        }
      }
    }
  }
  return out;
}
