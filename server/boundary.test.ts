import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '..');
// Everything Vite bundles for the browser
const clientRoots = ['App.tsx', 'index.tsx', 'types.ts', 'components', 'hooks', 'services'];

const sourceFiles = (entry: string): string[] => {
  const full = path.join(root, entry);
  if (statSync(full).isFile()) return [full];
  return readdirSync(full).flatMap(name => sourceFiles(path.join(entry, name)));
};

describe('client/server boundary', () => {
  it('keeps browser code from importing server modules', () => {
    const offenders = clientRoots
      .flatMap(sourceFiles)
      .filter(file => /\.tsx?$/.test(file) && !file.endsWith('.test.ts'))
      // Static (`from '...'`), side-effect (`import '...'`) and dynamic (`import('...')`) imports
      .filter(file => /(?:from|import)\s*\(?\s*['"](?:\.{1,2}\/)+server\//.test(readFileSync(file, 'utf8')))
      .map(file => path.relative(root, file));
    expect(offenders).toEqual([]);
  });
});
