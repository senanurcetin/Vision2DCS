import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { prepareBenchmarkSamples, requireEvaluationCallBudget } from './preflight';

const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgZGL+DwABFAEG1rmmRQAAAABJRU5ErkJggg==', 'base64',
);
const expected = {
  instruments: [
    { tagName: 'FT-101', signalType: 'AI', pcs7BlockType: 'MonAnL' },
    { tagName: 'FIC-101', signalType: ['AI', 'AO'], pcs7BlockType: 'PIDConL' },
  ],
  signalConnections: [{ source: 'FT-101', target: 'FIC-101' }],
};
const temporary: string[] = [];
async function dir() {
  const value = await mkdtemp(path.join(tmpdir(), 'vision2dcs-preflight-'));
  temporary.push(value);
  return value;
}
async function sample(root: string, name: string, labels: unknown, drawing = png) {
  const folder = path.join(root, name);
  await mkdir(folder);
  await writeFile(path.join(folder, 'drawing.png'), drawing);
  await writeFile(path.join(folder, 'expected.json'), JSON.stringify(labels));
}
afterEach(async () => {
  await Promise.all(temporary.splice(0).map(folder => rm(folder, { recursive: true, force: true })));
});
describe('offline all-fixture benchmark preflight', () => {
  it('sorts, hashes, and snapshots valid PNGs and human labels', async () => {
    const root = await dir();
    await sample(root, 'z-later', expected);
    await sample(root, 'a-first', expected);
    const items = await prepareBenchmarkSamples(root);
    expect(items.map(item => item.name)).toEqual(['a-first', 'z-later']);
    expect(items[0].drawing.equals(png)).toBe(true);
    expect(items[0].drawingSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(items[0].expectedSha256).toMatch(/^[0-9a-f]{64}$/);
  });
  it('rejects a bad later fixture before any provider client can be created', async () => {
    const root = await dir();
    await sample(root, 'a-valid', expected);
    await sample(root, 'z-invalid', {
      ...expected, signalConnections: [{ source: 'FT-101', target: 'NOT-A-TAG' }],
    });
    await expect(prepareBenchmarkSamples(root)).rejects.toThrow('unknown or self-referencing');
  });
  it('refuses duplicate tags and unsupported signal classifications', async () => {
    const root = await dir();
    await sample(root, 'duplicate', { ...expected,
      instruments: [...expected.instruments, expected.instruments[0]] });
    await expect(prepareBenchmarkSamples(root)).rejects.toThrow('Duplicate expected instrument');
    const other = await dir();
    await sample(other, 'bad-class', { ...expected,
      instruments: [{ ...expected.instruments[0], signalType: 'HART' }] });
    await expect(prepareBenchmarkSamples(other)).rejects.toThrow('Invalid benchmark instrument');
  });
  it('rejects false PNG content and missing fixture directories', async () => {
    const root = await dir();
    await sample(root, 'false-png', expected, Buffer.from('this is not a real png header'));
    await expect(prepareBenchmarkSamples(root)).rejects.toThrow('not a complete verified PNG');
    await expect(prepareBenchmarkSamples(await dir())).rejects.toThrow('between 1 and 100');
  });
  it('rejects a later drawing with altered PNG bytes before any paid model call', async () => {
    const root = await dir();
    await sample(root, 'a-valid', expected);
    const damaged = Buffer.from(png);
    damaged[47] ^= 1; // Invalidate the image's IDAT checksum.
    await sample(root, 'z-bad-crc', expected, damaged);
    await expect(prepareBenchmarkSamples(root)).rejects.toThrow('not a complete verified PNG');
  });

  it('requires an explicit paid request budget covering every sample', () => {
    for (const input of [undefined, '', '0', '01', '-1', '1', '101', '1.5']) {
      expect(() => requireEvaluationCallBudget(input, 2)).toThrow();
    }
    expect(requireEvaluationCallBudget('2', 2)).toBe(2);
    expect(requireEvaluationCallBudget('5', 2)).toBe(5);
  });
});
