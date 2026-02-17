
import React from 'react';
import { Instrument } from '../types';

interface Props {
  instruments: Instrument[];
}

const AuditBOM: React.FC<Props> = ({ instruments }) => {
  const totalCost = instruments.reduce((sum, inst) => sum + (inst.estimatedCost || 0), 0);
  const issues = instruments.filter(inst => inst.safetyWarning);

  return (
    <div className="space-y-6 h-full overflow-auto custom-scrollbar p-1">
      {/* Safety Audit Section */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center text-red-500">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          </div>
          <h3 className="font-bold text-slate-200">Safety & Naming Audit (Sentinel)</h3>
        </div>
        
        <div className="space-y-2">
          {issues.length === 0 ? (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-sm font-medium">
              No critical safety or standard violations detected.
            </div>
          ) : (
            issues.map(inst => (
              <div key={inst.id} className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex gap-3">
                <div className="font-bold text-red-400 text-xs mt-0.5">{inst.tagName}</div>
                <div className="text-slate-400 text-xs leading-relaxed">{inst.safetyWarning}</div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* BOM Section */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-500">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
            </div>
            <h3 className="font-bold text-slate-200">Procurement & BOM</h3>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Est. Project Capex</div>
            <div className="text-xl font-bold text-blue-400">${totalCost.toLocaleString()}</div>
          </div>
        </div>

        <div className="bg-slate-950/40 rounded-xl border border-slate-800 overflow-hidden">
          <table className="w-full text-[11px] text-left">
            <thead className="bg-slate-800/50 text-slate-500 font-bold uppercase tracking-wider">
              <tr>
                <th className="p-3">Item</th>
                <th className="p-3">Brand/Model</th>
                <th className="p-3 text-right">Unit Est.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {instruments.map(inst => (
                <tr key={inst.id} className="hover:bg-white/5">
                  <td className="p-3 font-bold text-slate-300">{inst.tagName}</td>
                  <td className="p-3">
                    <div className="text-slate-400">{inst.brand || 'TBD'}</div>
                    <div className="text-[9px] text-slate-500">{inst.model || 'Generic Model'}</div>
                  </td>
                  <td className="p-3 text-right font-mono text-blue-400">
                    ${(inst.estimatedCost || 0).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default AuditBOM;
