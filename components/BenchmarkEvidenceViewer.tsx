import React, { useState } from 'react';
import { diagnoseBenchmarkReport, type BenchmarkDiagnostics } from '../eval/diagnostics';

const MAX_REPORT_BYTES = 8 * 1024 * 1024;
const percent = (value: number | null | undefined) =>
  value == null ? 'N/A' : (100 * value).toFixed(1) + '%';

/**
 * Read-only local report explorer: source hashes and mathematically validated
 * samples, never a certified model result or an implicit claim of provenance.
 * The uploaded report is held in component memory and is never transmitted.
 */
const BenchmarkEvidenceViewer: React.FC = () => {
  const [diagnostics, setDiagnostics] = useState<BenchmarkDiagnostics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const load = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setDiagnostics(null);
    setError(null);
    if (file.size < 1 || file.size > MAX_REPORT_BYTES) {
      setError('Report must be a nonempty JSON file no larger than 8 MiB.');
      return;
    }
    setBusy(true);
    try {
      const input: unknown = JSON.parse(await file.text());
      setDiagnostics(diagnoseBenchmarkReport(input));
    } catch {
      setError('Invalid, incomplete, altered or unsupported benchmark report. Evidence was not loaded.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-label="Offline research evidence viewer"
      className="h-full space-y-5 overflow-y-auto rounded-xl border border-indigo-400/20 bg-slate-950/60 p-4 text-slate-200 custom-scrollbar sm:p-6">
      <header className="space-y-2">
        <h3 className="text-lg font-semibold text-white">Offline benchmark evidence viewer</h3>
        <p className="max-w-2xl text-xs leading-relaxed text-slate-400">
          Open a saved Vision2DCS v1/v2 evaluation report to inspect exact source hashes,
          micro versus drawing-level macro metrics and missed drawings. This viewer
          checks internal score consistency but cannot independently verify that
          Gemini, OCR or a human generated the predictions. No model calls, uploads,
          external requests, persistence, certification or vendor import.
        </p>
      </header>

      <label htmlFor="benchmark-report-file"
        className="inline-block text-xs font-semibold text-cyan-200">Select a local source-hashed report</label>
      <input id="benchmark-report-file" type="file" accept=".json,application/json"
        onChange={load}
        className="block w-full min-w-0 rounded-md border border-slate-700 bg-slate-900 p-2 text-xs text-slate-300 file:mr-3 file:rounded file:border-0 file:bg-cyan-400/15 file:px-3 file:py-2 file:font-semibold file:text-cyan-100"/>

      {busy && <p role="status" className="text-sm text-slate-300">Validating report locally…</p>}
      {error && <p role="alert" className="rounded-md border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-200">{error}</p>}
      {!diagnostics && !error && !busy &&
        <p role="status" className="rounded-lg border border-slate-700 p-4 text-xs text-slate-400">
          No measured evaluation report loaded. Synthetic P&amp;ID samples alone are not model accuracy evidence.
        </p>}
      {diagnostics && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-700 bg-slate-900/70 p-4 text-xs">
            <div className="min-w-0 flex-1">
              <p className="font-bold text-white break-all">{diagnostics.model}</p>
              <p className="mt-1 text-slate-400">Schema v{diagnostics.schemaVersion} · {diagnostics.drawingCount} drawings · {diagnostics.generatedAt}</p>
            </div>
            <button type="button" onClick={() => setDiagnostics(null)}
              className="rounded border border-slate-600 px-3 py-2 text-xs text-slate-300 hover:border-cyan-400">
              Clear local report
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-lg border border-cyan-400/25 bg-cyan-400/5 p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Tag micro F1</p>
              <p className="mt-2 font-mono text-2xl text-cyan-100">{percent(diagnostics.micro.f1)}</p>
              <p className="mt-1 text-[11px] text-slate-400">Weighted by tag counts</p>
            </div>
            <div className="rounded-lg border border-indigo-400/25 bg-indigo-400/5 p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Tag macro F1</p>
              <p className="mt-2 font-mono text-2xl text-indigo-100">{percent(diagnostics.macroTags.f1.mean)}</p>
              <p className="mt-1 text-[11px] text-slate-400">
                {diagnostics.macroTags.f1.evaluatedDrawings}/{diagnostics.drawingCount} evaluable drawings
              </p>
            </div>
            {diagnostics.schemaVersion === 2 && (
              <div className="rounded-lg border border-slate-600 bg-slate-900/70 p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Directed signal macro F1</p>
                <p className="mt-2 font-mono text-2xl text-white">{percent(diagnostics.macroTopology?.f1.mean)}</p>
                <p className="mt-1 text-[11px] text-slate-400">
                  {diagnostics.macroTopology?.f1.evaluatedDrawings ?? 0}/{diagnostics.drawingCount} evaluable drawings
                </p>
              </div>
            )}
          </div>

          <p role="status" className="text-xs leading-relaxed text-amber-200">
            Lowest observed tag F1: <strong>{diagnostics.weakestTagDrawing ?? 'N/A'}</strong>.
            These statistics describe this unverified uploaded record, not independently
            confirmed model performance or generalization.
          </p>
          <div className="overflow-x-auto rounded-lg border border-slate-700">
            <table className="w-full min-w-[780px] text-left text-xs">
              <caption className="p-3 text-left text-slate-400">
                Per-drawing evidence · scores with undefined denominators display N/A
              </caption>
              <thead className="bg-slate-800/70 text-[10px] uppercase tracking-wider text-slate-300">
                <tr>
                  <th scope="col" className="px-3 py-2">Drawing</th>
                  <th scope="col" className="px-3 py-2">Matched tags</th>
                  <th scope="col" className="px-3 py-2">Precision</th>
                  <th scope="col" className="px-3 py-2">Recall</th>
                  <th scope="col" className="px-3 py-2">Tag F1</th>
                  <th scope="col" className="px-3 py-2">Directed F1</th>
                  <th scope="col" className="px-3 py-2">Source SHA-256</th>
                </tr>
              </thead>
              <tbody>
                {diagnostics.drawings.map(row => (
                  <tr key={row.name} className="border-t border-slate-800 hover:bg-slate-800/30">
                    <th scope="row" className="px-3 py-2 font-semibold text-cyan-100">{row.name}</th>
                    <td className="px-3 py-2 font-mono">{row.tags.matched}/{row.tags.expected}</td>
                    <td className="px-3 py-2 font-mono">{percent(row.tags.metrics.precision)}</td>
                    <td className="px-3 py-2 font-mono">{percent(row.tags.metrics.recall)}</td>
                    <td className="px-3 py-2 font-mono">{percent(row.tags.metrics.f1)}</td>
                    <td className="px-3 py-2 font-mono">{percent(row.topology?.metrics.f1)}</td>
                    <td className="px-3 py-2 font-mono text-[10px]">
                      <span title={'Drawing SHA-256: ' + row.drawingSha256 + '; labels SHA-256: ' + row.expectedSha256}>
                        {row.drawingSha256.slice(0, 12)}…
                      </span>
                      <p className="text-slate-500" title={'Labels SHA-256: ' + row.expectedSha256}>
                        labels {row.expectedSha256.slice(0, 12)}…
                      </p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <details className="rounded-lg border border-slate-700 bg-slate-900/30 p-4 text-xs">
            <summary className="cursor-pointer font-semibold text-slate-200">Scientific limitations</summary>
            <ul className="mt-3 list-disc space-y-2 pl-5 leading-relaxed text-slate-400">
              {diagnostics.limitations.map(text => <li key={text}>{text}</li>)}
            </ul>
          </details>
        </div>
      )}
    </section>
  );
};

export default BenchmarkEvidenceViewer;
