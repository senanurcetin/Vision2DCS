
import React from 'react';
import { Instrument, SignalType, PCS7BlockType } from '../types';

interface Props {
  instruments: Instrument[];
  onUpdate: (id: string, updates: Partial<Instrument>) => void;
  onDelete: (id: string) => void;
}

const InstrumentTable: React.FC<Props> = ({ instruments, onUpdate, onDelete }) => {
  const signalTypes: SignalType[] = ['AI', 'AO', 'DI', 'DO'];
  const blockTypes: PCS7BlockType[] = ['MonAnL', 'MonDiL', 'MotL', 'VlvL', 'VlvAnL', 'PIDConL', 'Unknown'];

  const getConfidenceStyle = (conf: 'high' | 'medium' | 'low') => {
    switch (conf) {
      case 'high': return 'text-emerald-400';
      case 'low': return 'text-amber-400 underline decoration-amber-400/30';
      default: return 'text-blue-400';
    }
  };

  return (
    <div className="overflow-auto max-h-full rounded-xl border border-slate-800 shadow-2xl bg-slate-950/20 custom-scrollbar">
      <table className="w-full text-xs text-left border-separate border-spacing-0">
        <thead className="bg-slate-800/50 backdrop-blur sticky top-0 z-10">
          <tr>
            <th className="px-5 py-4 border-b border-slate-800 text-slate-500 font-bold uppercase tracking-wider">Object Tag</th>
            <th className="px-5 py-4 border-b border-slate-800 text-slate-500 font-bold uppercase tracking-wider">Description</th>
            <th className="px-5 py-4 border-b border-slate-800 text-slate-500 font-bold uppercase tracking-wider">Signal</th>
            <th className="px-5 py-4 border-b border-slate-800 text-slate-500 font-bold uppercase tracking-wider">Block</th>
            <th className="px-5 py-4 border-b border-slate-800 text-slate-500 font-bold uppercase tracking-wider">Units</th>
            <th className="px-5 py-4 border-b border-slate-800 text-slate-500 font-bold uppercase tracking-wider text-center">Manage</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/50">
          {instruments.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-5 py-24 text-center">
                <div className="flex flex-col items-center gap-2 opacity-30">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                  <p className="font-bold text-sm">NO DATA DETECTED</p>
                </div>
              </td>
            </tr>
          ) : (
            instruments.map((inst) => (
              <tr key={inst.id} className="hover:bg-slate-800/30 transition-colors group">
                <td className="px-5 py-3 align-top">
                  <input
                    className={`bg-transparent border-none focus:ring-1 focus:ring-blue-500/50 rounded px-1 w-full mono font-bold uppercase tracking-tight ${getConfidenceStyle(inst.confidence)}`}
                    value={inst.tagName}
                    onChange={(e) => onUpdate(inst.id, { tagName: e.target.value.toUpperCase() })}
                  />
                  <div className="text-[9px] text-slate-600 px-1 mt-0.5">{inst.equipmentType}</div>
                </td>
                <td className="px-5 py-3 align-top">
                  <textarea
                    rows={1}
                    className="bg-transparent border-none focus:ring-1 focus:ring-blue-500/50 rounded px-1 w-full text-slate-400 resize-none leading-relaxed h-auto"
                    value={inst.description}
                    onChange={(e) => onUpdate(inst.id, { description: e.target.value })}
                  />
                </td>
                <td className="px-5 py-3 align-top">
                  <select
                    className="bg-slate-900/50 border border-slate-700/50 rounded-lg px-2 py-1.5 text-[10px] text-slate-300 focus:ring-1 focus:ring-blue-500 focus:outline-none appearance-none font-bold"
                    value={inst.signalType}
                    onChange={(e) => onUpdate(inst.id, { signalType: e.target.value as SignalType })}
                  >
                    {signalTypes.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </td>
                <td className="px-5 py-3 align-top">
                  <select
                    className="bg-slate-900/50 border border-slate-700/50 rounded-lg px-2 py-1.5 text-[10px] text-slate-300 focus:ring-1 focus:ring-blue-500 focus:outline-none appearance-none font-bold"
                    value={inst.pcs7BlockType}
                    onChange={(e) => onUpdate(inst.id, { pcs7BlockType: e.target.value as PCS7BlockType })}
                  >
                    {blockTypes.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </td>
                <td className="px-5 py-3 align-top">
                  <input
                    className="bg-transparent border-none focus:ring-1 focus:ring-blue-500/50 rounded px-1 w-16 text-slate-500 font-mono text-[10px]"
                    value={inst.engineeringUnits}
                    onChange={(e) => onUpdate(inst.id, { engineeringUnits: e.target.value })}
                  />
                </td>
                <td className="px-5 py-3 align-top text-center">
                  <button 
                    onClick={() => onDelete(inst.id)}
                    className="text-slate-600 hover:text-red-500 p-2 transition-colors rounded-lg hover:bg-red-500/10"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

export default InstrumentTable;
