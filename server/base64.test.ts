import { describe, expect, it } from 'vitest';
import { decodedBase64Bytes, isValidCanonicalBase64 } from './base64';

describe('large safe inline base64 inputs', () => {
  it('accepts exact canonical padded and unpadded full groups', () => {
    for (const [value, bytes] of [
      ['AAAA', 3], ['AQ==', 1], ['AAA=', 2], ['AAAAAQ==', 4],
    ] as const) {
      expect(isValidCanonicalBase64(value)).toBe(true);
      expect(decodedBase64Bytes(value)).toBe(bytes);
    }
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
