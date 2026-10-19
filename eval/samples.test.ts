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

  it('exist', () => {
    expect(samples.length).toBeGreaterThan(0);
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
