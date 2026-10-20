import path from 'node:path';
import { prepareBenchmarkSamples } from './preflight';
import { inspectBenchmarkCorpus } from './inspect';

const main = async () => {
  const samples = await prepareBenchmarkSamples(path.resolve('samples'));
  process.stdout.write(JSON.stringify(inspectBenchmarkCorpus(samples), null, 2) + '\n');
};
main().catch(error => {
  console.error(error instanceof Error ? error.message : 'Fixture inventory failed.');
  process.exitCode = 1;
});
