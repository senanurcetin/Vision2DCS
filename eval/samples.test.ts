import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { ISA_NAMING_PATTERN } from '../services/tagParser';
import type { ExpectedInstrument } from './score';
import { scoreExplicitSignalConnections, type ExpectedSignalConnection } from './topology';
import { prepareBenchmarkSamples } from './preflight';

const samplesDir = path.resolve(__dirname, '..', 'samples');
const samples = readdirSync(samplesDir).filter(name => statSync(path.join(samplesDir, name)).isDirectory());

describe('benchmark samples', () => {
  it('all real repository fixtures pass the exact offline paid-run preflight', async () => {
    const prepared = await prepareBenchmarkSamples(samplesDir);
    expect(prepared.map(item => item.name)).toEqual([...samples].sort());
    expect(prepared.every(item => item.drawingSha256.length === 64 &&
      item.expectedSha256.length === 64 && item.signalConnections.length > 0)).toBe(true);
  });

  it('contains ten validated synthetic cases with mixed analog and discrete types', async () => {
    expect(samples.length).toBeGreaterThanOrEqual(10);
    const prepared = await prepareBenchmarkSamples(samplesDir);
    const classes = new Set(prepared.flatMap(item => item.instruments.flatMap(inst =>
      Array.isArray(inst.signalType) ? inst.signalType : [inst.signalType])));
    for (const klass of ['AI', 'AO', 'DI', 'DO']) expect(classes.has(klass)).toBe(true);
    expect(prepared.reduce((n, item) => n + item.signalConnections.length, 0)).toBeGreaterThanOrEqual(20);
  });

  it('preserves vector source text corresponding to every generated raster gold tag', () => {
    for (const name of samples.filter(item => item.startsWith('synthetic-'))) {
      const folder = path.join(samplesDir, name);
      const svg = readFileSync(path.join(folder, 'drawing.svg'), 'utf8');
      const gold = JSON.parse(readFileSync(path.join(folder, 'expected.json'), 'utf8')) as {
        instruments: { tagName: string }[];
      };
      expect(svg).toContain('<svg');
      expect(svg).toContain('stroke-dasharray');
      for (const inst of gold.instruments) expect(svg).toContain(inst.tagName);
    }
  });

  it.each(samples)('%s has a drawing and a valid expected.json', name => {
    const dir = path.join(samplesDir, name);
    expect(statSync(path.join(dir, 'drawing.png')).size).toBeGreaterThan(0);

    const { instruments, signalConnections } = JSON.parse(readFileSync(path.join(dir, 'expected.json'), 'utf8')) as {
      instruments: ExpectedInstrument[];
      signalConnections: ExpectedSignalConnection[];
    };
    expect(instruments.length).toBeGreaterThan(0);
    const tags = instruments.map(i => i.tagName);
    expect(new Set(tags).size).toBe(tags.length);
    tags.forEach(tag => expect(tag).toMatch(ISA_NAMING_PATTERN));
    expect(Array.isArray(signalConnections)).toBe(true);
    expect(signalConnections.length).toBeGreaterThan(0);
    expect(scoreExplicitSignalConnections(signalConnections, tags, []).expected).toBe(signalConnections.length);
  });
});
