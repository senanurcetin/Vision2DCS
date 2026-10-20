import React, { useEffect, useRef, useState } from 'react';
import { stressScanPixels, type ScanStressMode } from '../services/scanStress';

interface Props {
  imageUrl?: string;
}

const hex = (bytes: ArrayBuffer) =>
  Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');

/** Local educational image perturbations. No model evaluation, no uploads. */
const ScanStressLab: React.FC<Props> = ({ imageUrl }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [seed, setSeed] = useState(42);
  const [percent, setPercent] = useState(7);
  const [mode, setMode] = useState<ScanStressMode>('combined');
  const [evidence, setEvidence] = useState<{ source: string; stressed: string; size: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setEvidence(null);
    setError(null);
    if (!imageUrl) return;
    // Reject external URLs: no implicit downloads of a plant image or tracking
    // requests by opening this training panel.
    if (!/^data:image\/(?:png|jpeg|webp);base64,/i.test(imageUrl)) {
      setError('Local embedded PNG, JPEG or WebP project image required.');
      return;
    }
    const image = new Image();
    setWorking(true);
    image.onload = async () => {
      try {
        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;
        if (!image.naturalWidth || !image.naturalHeight) throw new Error('Invalid source image dimensions.');
        const scale = Math.min(1, 1400 / image.naturalWidth, 1400 / image.naturalHeight,
          Math.sqrt(2_097_152 / (image.naturalWidth * image.naturalHeight)));
        const width = Math.max(1, Math.floor(image.naturalWidth * scale));
        const height = Math.max(1, Math.floor(image.naturalHeight * scale));
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx || !crypto?.subtle) throw new Error('Canvas or secure local hashing unavailable.');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(image, 0, 0, width, height);
        const rgba = ctx.getImageData(0, 0, width, height);
        const before = await crypto.subtle.digest('SHA-256', new Uint8Array(rgba.data));
        const altered = stressScanPixels(rgba.data, width, height,
          { seed, specklePercent: percent, mode });
        const after = await crypto.subtle.digest('SHA-256', new Uint8Array(altered));
        if (cancelled) return;
        const degradedImage = ctx.createImageData(width, height);
        degradedImage.data.set(altered);
        ctx.putImageData(degradedImage, 0, 0);
        setEvidence({ source: hex(before), stressed: hex(after), size: width + ' × ' + height + ' pixels' });
      } catch {
        if (!cancelled) setError('Could not locally decode or transform this source drawing.');
      } finally {
        if (!cancelled) setWorking(false);
      }
    };
    image.onerror = () => {
      if (!cancelled) { setError('The embedded project image could not be decoded.'); setWorking(false); }
    };
    image.src = imageUrl;
    return () => { cancelled = true; image.src = ''; };
  }, [imageUrl, seed, percent, mode]);

  const exportPng = () => {
    const canvas = canvasRef.current;
    if (!canvas || !evidence) return;
    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = 'vision2dcs-stress-seed-' + seed + '.png';
    link.click();
  };

  return (
    <section aria-label="Offline scan robustness lab"
      className="h-full space-y-4 overflow-y-auto rounded-xl border border-cyan-400/20 bg-slate-950/60 p-4 text-slate-200 custom-scrollbar sm:p-6">
      <header className="space-y-2">
        <h3 className="text-lg font-semibold text-white">Offline scan robustness lab</h3>
        <p className="max-w-2xl text-xs leading-relaxed text-slate-400">
          Reproduce synthetic speckle noise and paper-mask occlusions on the
          locally embedded P&amp;ID. A seed and unchanged source pixels yield
          the same RGBA SHA-256 digest. This is a visual perturbation exercise,
          not a measured OCR/Gemini robustness benchmark or a plant validation.
          No provider calls, external images, network I/O or project modifications.
        </p>
      </header>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="space-y-1 text-xs font-semibold" htmlFor="stress-seed">
          Reproduction seed
          <input id="stress-seed" type="number" min={0} max={1000000000} step={1}
            value={seed} onChange={event => {
              const n = Number(event.target.value);
              if (Number.isSafeInteger(n) && n >= 0 && n <= 1_000_000_000) setSeed(n);
            }}
            className="block w-full rounded-md border border-slate-600 bg-slate-900 p-2 font-mono text-white" />
        </label>
        <label className="space-y-1 text-xs font-semibold" htmlFor="stress-mode">
          Degradation mode
          <select id="stress-mode" value={mode} onChange={event => setMode(event.target.value as ScanStressMode)}
            className="block w-full rounded-md border border-slate-600 bg-slate-900 p-2 text-white">
            <option value="combined">Speckle + occlusion</option>
            <option value="speckle">Speckle only</option>
            <option value="occlusion">Paper masks only</option>
          </select>
        </label>
        <label className="space-y-1 text-xs font-semibold" htmlFor="stress-percent">
          Speckle intensity: {percent}%
          <input id="stress-percent" type="range" min={0} max={20} step={1} value={percent}
            onChange={event => setPercent(Number(event.target.value))}
            className="block w-full accent-cyan-400" />
        </label>
      </div>
      {!imageUrl && <p role="status" className="rounded border border-slate-700 p-4 text-xs text-slate-400">
        Load a synthetic P&amp;ID project to inspect reproducible image degradation.
      </p>}
      {working && <p role="status" className="text-xs text-cyan-200">Transforming in the local browser…</p>}
      {error && <p role="alert" className="rounded border border-rose-500/30 p-3 text-xs text-rose-200">{error}</p>}
      <div className="overflow-auto rounded-lg border border-slate-700 bg-white p-2">
        <canvas ref={canvasRef} aria-label="Locally degraded P&ID image preview"
          role="img" className="h-auto max-w-full" />
      </div>
      {evidence && (
        <div className="space-y-2 rounded-lg border border-slate-700 bg-slate-900/60 p-4">
          <p className="text-xs text-slate-300">{evidence.size} · RGBA SHA-256 checksums (not source file hashes)</p>
          <p className="break-all font-mono text-[10px] text-slate-400">
            Rendered source: <output aria-label="Rendered source SHA-256">{evidence.source}</output>
          </p>
          <p className="break-all font-mono text-[10px] text-cyan-200">
            Degraded pixels: <output aria-label="Stressed image SHA-256">{evidence.stressed}</output>
          </p>
          <button type="button" onClick={exportPng}
            className="mt-2 rounded-md border border-cyan-400/40 bg-cyan-400/10 px-3 py-2 text-xs font-semibold text-cyan-100 hover:bg-cyan-400/20">
            Download synthetic degraded PNG
          </button>
        </div>
      )}
    </section>
  );
};

export default ScanStressLab;
