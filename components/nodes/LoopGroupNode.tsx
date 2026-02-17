
import React, { memo } from 'react';

const LoopGroupNode = ({ data }: { data: { label: string } }) => {
  return (
    <div className="w-full h-full border-2 border-dashed border-slate-800 rounded-2xl bg-slate-900/10 pointer-events-none">
      <div className="absolute -top-3 left-4 bg-slate-900 px-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest border border-slate-800 rounded">
        Loop Area: {data.label}
      </div>
    </div>
  );
};

export default memo(LoopGroupNode);
