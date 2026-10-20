import { describe, expect, it, vi } from 'vitest';
import { createLocalId } from './localIds';

describe('lossless local engineering object identities', () => {
  it('uses readable prefixes, bounded values, and never repeats on rapid creation', () => {
    const ids = Array.from({ length: 4000 }, (_, i) =>
      createLocalId(i % 3 === 0 ? 'proj' : i % 3 === 1 ? 'demo' : 'manual'));
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids[0]).toMatch(/^proj-[\w-]+$/);
    expect(ids[1]).toMatch(/^demo-[\w-]+$/);
    expect(ids[2]).toMatch(/^manual-[\w-]+$/);
    expect(ids.every(id => id.length <= 128)).toBe(true);
  });
  it('remains distinct when wall clock is frozen', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-10-21T12:00:00.000Z'));
      const a = createLocalId('proj');
      const b = createLocalId('proj');
      expect(a).not.toBe(b);
    } finally {
      vi.useRealTimers();
    }
  });
});
