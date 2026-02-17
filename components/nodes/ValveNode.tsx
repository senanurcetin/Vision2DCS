
import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Instrument } from '../../types';

const ValveNode = ({ data }: { data: { instrument: Instrument } }) => {
  const { instrument } = data;
  const isAnalog = instrument.pcs7BlockType === 'VlvAnL';

  return (
    <div className="bg-transparent w-24 h-24 flex flex-col items-center justify-center relative group">
      <Handle type="target" position={Position.Top} className="opacity-0 group-hover:opacity-100" />
      
      <div className="text-[10px] font-bold text-slate-400 mb-2">{instrument.tagName}</div>
      
      {/* Bowtie Symbol */}
      <svg width="40" height="20" viewBox="0 0 40 20" className="drop-shadow-lg">
        <path d="M 0 0 L 40 20 L 40 0 L 0 20 Z" fill="#1e293b" stroke="#60a5fa" strokeWidth="2" />
        {isAnalog && <circle cx="20" cy="10" r="4" fill="#60a5fa" />}
      </svg>

      {/* Analog Feedback Bar */}
      {isAnalog && (
        <div className="mt-3 w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
          <div className="h-full bg-blue-500 w-[45%]" />
        </div>
      )}

      <div className="text-[8px] mt-1 text-slate-600 font-bold uppercase tracking-widest">
        {isAnalog ? 'Analog' : 'On/Off'}
      </div>

      <Handle type="source" position={Position.Bottom} className="opacity-0 group-hover:opacity-100" />
    </div>
  );
};

export default memo(ValveNode);
