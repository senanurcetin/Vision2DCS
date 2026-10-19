import { createHash } from 'node:crypto';
import { readdir, readFile, lstat } from 'node:fs/promises';
import path from 'node:path';
import { ISA_NAMING_PATTERN } from '../services/tagParser';
import { validateBenchmarkPng } from './png';
import { type ExpectedInstrument, scoreSample } from './score';
import { type ExpectedSignalConnection, scoreExplicitSignalConnections } from './topology';

export const MAX_BENCHMARK_SAMPLES = 100;
export const MAX_BENCHMARK_DRAWING_BYTES = 10 * 1024 * 1024;
export const MAX_BENCHMARK_LABEL_BYTES = 512 * 1024;
export const MAX_TOTAL_BENCHMARK_DRAWING_BYTES = 64 * 1024 * 1024;

export interface PreparedBenchmarkSample {
  name: string;
  drawing: Buffer;
  instruments: ExpectedInstrument[];
  signalConnections: ExpectedSignalConnection[];
  drawingSha256: string;
  expectedSha256: string;
}
const record = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v);
const allowedSignals = new Set(['AI', 'AO', 'DI', 'DO']);
const allowedBlocks = new Set(['MonAnL', 'MonDiL', 'MotL', 'VlvL', 'VlvAnL', 'PIDConL']);
const classification = (v: unknown, allowed: Set<string>) =>
  v === undefined || (typeof v === 'string' && allowed.has(v)) ||
  (Array.isArray(v) && v.length > 0 && v.every(x => typeof x === 'string' && allowed.has(x)) &&
    new Set(v).size === v.length);
const sha256 = (data: Buffer) => createHash('sha256').update(data).digest('hex');

/** Prevalidate every fixture before creating the paid model client. */
export async function prepareBenchmarkSamples(directory: string): Promise<PreparedBenchmarkSample[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const names = entries.filter(entry => entry.isDirectory()).map(entry => entry.name).sort();
  if (names.length < 1 || names.length > MAX_BENCHMARK_SAMPLES) {
    throw new Error('Benchmark requires between 1 and 100 sample directories.');
  }
  const prepared: PreparedBenchmarkSample[] = [];
  let totalDrawingBytes = 0;
  for (const name of names) {
    const drawingFile = path.join(directory, name, 'drawing.png');
    const expectedFile = path.join(directory, name, 'expected.json');
    const [drawingStat, labelStat] = await Promise.all([lstat(drawingFile), lstat(expectedFile)]);
    if (!drawingStat.isFile() || drawingStat.size < 24 ||
        drawingStat.size > MAX_BENCHMARK_DRAWING_BYTES) {
      throw new Error('Invalid or oversized benchmark PNG drawing: ' + name);
    }
    totalDrawingBytes += drawingStat.size;
    if (totalDrawingBytes > MAX_TOTAL_BENCHMARK_DRAWING_BYTES) {
      throw new Error('Benchmark drawings exceed the 64 MiB preflight limit.');
    }
    if (!labelStat.isFile() || labelStat.size < 2 || labelStat.size > MAX_BENCHMARK_LABEL_BYTES) {
      throw new Error('Invalid or oversized benchmark expected.json: ' + name);
    }
    const [drawing, labels] = await Promise.all([readFile(drawingFile), readFile(expectedFile)]);
    // A fixture can change between stat and read; reject a moving source.
    if (drawing.length !== drawingStat.size || labels.length !== labelStat.size) {
      throw new Error('Benchmark source changed during offline preflight: ' + name);
    }
    try {
      validateBenchmarkPng(drawing);
    } catch {
      throw new Error('Benchmark drawing is not a complete verified PNG: ' + name);
    }
    let parsed: unknown;
    try { parsed = JSON.parse(labels.toString('utf8')); }
    catch { throw new Error('Benchmark expected.json is malformed: ' + name); }
    if (!record(parsed) || !Array.isArray(parsed.instruments) ||
        parsed.instruments.length < 1 || parsed.instruments.length > 2000) {
      throw new Error('Benchmark requires 1-2000 labelled instruments: ' + name);
    }
    const instruments: ExpectedInstrument[] = [];
    for (const row of parsed.instruments) {
      if (!record(row) || typeof row.tagName !== 'string' ||
          !ISA_NAMING_PATTERN.test(row.tagName) ||
          !classification(row.signalType, allowedSignals) ||
          !classification(row.pcs7BlockType, allowedBlocks)) {
        throw new Error('Invalid benchmark instrument label: ' + name);
      }
      instruments.push({
        tagName: row.tagName,
        ...(row.signalType !== undefined ? { signalType: row.signalType as string | string[] } : {}),
        ...(row.pcs7BlockType !== undefined ? { pcs7BlockType: row.pcs7BlockType as string | string[] } : {}),
      });
    }
    scoreSample(instruments, []); // Duplicate canonical identities fail.
    if (!Array.isArray(parsed.signalConnections) || parsed.signalConnections.length === 0) {
      throw new Error('Benchmark v2 requires annotated signal connections for ' + name);
    }
    const signalConnections = parsed.signalConnections as ExpectedSignalConnection[];
    scoreExplicitSignalConnections(signalConnections, instruments.map(i => i.tagName), []);
    prepared.push({
      name, drawing, instruments, signalConnections,
      drawingSha256: sha256(drawing), expectedSha256: sha256(labels),
    });
  }
  return prepared;
}

/** Paid CLI requires explicit budget for ALL validated fixture samples. */
export function requireEvaluationCallBudget(raw: string | undefined, sampleCount: number): number {
  if (!raw || !/^[1-9][0-9]{0,2}$/.test(raw)) {
    throw new Error('Set VISION2DCS_EVAL_MAX_CALLS to a positive integer before paid evaluation.');
  }
  const budget = Number(raw);
  if (budget > MAX_BENCHMARK_SAMPLES || budget < sampleCount) {
    throw new Error('VISION2DCS_EVAL_MAX_CALLS must cover all samples and cannot exceed 100.');
  }
  return budget;
}
