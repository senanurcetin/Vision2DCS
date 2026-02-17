
import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Instrument } from '../../types';

const TransmitterNode = ({ data }: { data: { instrument: Instrument } }) => {
  const { instrument } = data;
  
  return (
    <div className="bg-slate-900 border-2 border-slate-700 rounded-full w-20 h-20 flex flex-col items-center justify-center shadow-2xl relative group hover:border-emerald-500/50 transition-colors">
      <Handle type="target" position={Position.Left} className="opacity-0 group-hover:opacity-100" />
      
      <div className="text-[10px] font-bold text-slate-500 mb-1">{instrument.tagName}</div>
      <div className="text-sm font-mono font-bold text-emerald-400">0.00</div>
      <div className="text-[8px] text-slate-600 uppercase font-bold">{instrument.engineeringUnits}</div>
      
      <Handle type="source" position={Position.Right} className="opacity-0 group-hover:opacity-100" />
    </div>
  );
};

export default memo(TransmitterNode);
