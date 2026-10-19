import { describe, expect, it } from 'vitest';
import { validateBenchmarkPng } from './png';

// Pillow-generated genuine 1x1 RGBA PNG, all chunk CRCs are valid.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgZGL+DwABFAEG1rmmRQAAAABJRU5ErkJggg==',
  'base64',
);

describe('offline PNG benchmark integrity', () => {
  it('accepts a complete PNG with a valid IHDR, IDAT and IEND checksum chain', () => {
    expect(validateBenchmarkPng(PNG)).toEqual({ width: 1, height: 1 });
  });
  it('rejects missing bytes, corrupt IDAT data and trailing content', () => {
    for (const bad of [
      PNG.subarray(0, 40),
      PNG.subarray(0, PNG.length - 4),
      Buffer.concat([PNG, Buffer.from('trailing')]),
      Buffer.from('not png'),
    ]) {
      expect(() => validateBenchmarkPng(bad)).toThrow();
    }
    const tampered = Buffer.from(PNG);
    tampered[47] ^= 1;
    expect(() => validateBenchmarkPng(tampered)).toThrow('CRC');
  });
  it('rejects inflated IHDR dimension metadata even when caller changes the image later', () => {
    const tampered = Buffer.from(PNG);
    tampered.writeUInt32BE(100_000, 16);
    expect(() => validateBenchmarkPng(tampered)).toThrow();
  });
});
