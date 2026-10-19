import { describe, expect, it } from 'vitest';
import { decodedBase64Bytes, isValidCanonicalBase64, matchesRasterSignature } from './base64';

describe('large safe inline base64 inputs', () => {
  it('accepts exact canonical padded and unpadded full groups', () => {
    for (const [value, bytes] of [
      ['AAAA', 3], ['AQ==', 1], ['AAA=', 2], ['AAAAAQ==', 4],
    ] as const) {
      expect(isValidCanonicalBase64(value)).toBe(true);
      expect(decodedBase64Bytes(value)).toBe(bytes);
    }
  });

  it('matches raster signatures only when declared MIME agrees with the bytes', () => {
    const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO8mSY8AAAAASUVORK5CYII=';
    expect(matchesRasterSignature(png, 'image/png')).toBe(true);
    expect(matchesRasterSignature(png, 'image/jpeg')).toBe(false);
    expect(matchesRasterSignature('AQID', 'image/png')).toBe(false);
    const webp = Buffer.from('RIFF1234WEBPVP8 0000').toString('base64');
    expect(matchesRasterSignature(webp, 'image/webp')).toBe(true);
    expect(matchesRasterSignature(webp, 'image/png')).toBe(false);
  });

  it('rejects short groups, misplaced padding, newlines and URL-safe variants', () => {
    for (const value of [
      '', 'A', 'AA', 'AAA', 'AA=', 'AAAA===', '=AAA', 'AA=A', 'AAAA\n',
      'AAA\r', 'AA A', '-AAA', '_AAA', 'data:image/png;base64,AAAA',
    ]) {
      expect(isValidCanonicalBase64(value)).toBe(false);
    }
  });

  it('checks multi-megabyte data without overflowing the call stack', () => {
    // 12 MiB encoded input (9 MiB decoded) is valid for /api/analyze.
    const large = 'A'.repeat(12 * 1024 * 1024);
    expect(isValidCanonicalBase64(large)).toBe(true);
    expect(decodedBase64Bytes(large)).toBe(9 * 1024 * 1024);
    const altered = large.slice(0, -1) + '?';
    expect(isValidCanonicalBase64(altered)).toBe(false);
  });
});
