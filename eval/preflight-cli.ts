/** Offline fixture validation. No GEMINI_API_KEY is needed and no model is called. */
import path from 'node:path';
import { prepareBenchmarkSamples } from './preflight';

prepareBenchmarkSamples(path.resolve('samples'))
  .then(samples => {
    console.log('Offline preflight OK: ' + samples.length + ' labelled drawings');
    for (const item of samples) {
      console.log(item.name + ': ' + item.instruments.length + ' instruments, ' +
        item.signalConnections.length + ' directed signal annotations; sha256=' + item.drawingSha256);
    }
  })
  .catch(error => {
    console.error(error instanceof Error ? error.message : 'Offline preflight failed');
    process.exitCode = 1;
  });
