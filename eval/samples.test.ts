import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { ISA_NAMING_PATTERN } from '../services/tagParser';
import type { ExpectedInstrument } from './score';

const samplesDir = path.resolve(__dirname, '..', 'samples');
const samples = readdirSync(samplesDir).filter(name => statSync(path.join(samplesDir, name)).isDirectory());

describe('benchmark samples', () => {
  it('exist', () => {
    expect(samples.length).toBeGreaterThan(0);
  });

  it.each(samples)('%s has a drawing and a valid expected.json', name => {
    const dir = path.join(samplesDir, name);
    expect(statSync(path.join(dir, 'drawing.png')).size).toBeGreaterThan(0);

    const { instruments } = JSON.parse(readFileSync(path.join(dir, 'expected.json'), 'utf8')) as { instruments: ExpectedInstrument[] };
    expect(instruments.length).toBeGreaterThan(0);
    const tags = instruments.map(i => i.tagName);
    expect(new Set(tags).size).toBe(tags.length);
    tags.forEach(tag => expect(tag).toMatch(ISA_NAMING_PATTERN));
  });
});
