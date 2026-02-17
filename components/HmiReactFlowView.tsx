
import React, { useMemo } from 'react';
import { 
  ReactFlow, 
  Background, 
  Controls, 
  MiniMap, 
  Panel,
  type Node,
  type Edge
} from '@xyflow/react';

import { Instrument } from '../types';
import TransmitterNode from './nodes/TransmitterNode';
import ValveNode from './nodes/ValveNode';
import LoopGroupNode from './nodes/LoopGroupNode';

interface Props {
  instruments: Instrument[];
}

const nodeTypes = {
  transmitter: TransmitterNode,
  valve: ValveNode,
  loopGroup: LoopGroupNode
};

const HmiReactFlowView: React.FC<Props> = ({ instruments }) => {
  // Transformation Logic: Instruments -> React Flow Nodes & Edges
  const { nodes, edges } = useMemo(() => {
    const rfNodes: Node[] = [];
    const rfEdges: Edge[] = [];
    
    // 1. Group by Loop
    const loopGroups: Record<string, Instrument[]> = {};
    instruments.forEach(inst => {
      const loop = inst.tagName.match(/[0-9]+/)?.[0] || 'Misc';
      if (!loopGroups[loop]) loopGroups[loop] = [];
      loopGroups[loop].push(inst);
    });

    let currentX = 50;
    let currentY = 50;

    Object.entries(loopGroups).forEach(([loopId, items]) => {
      const groupId = `group-${loopId}`;
      const groupWidth = 450;
      const groupHeight = 250;

      // Add the Loop Area Group Node
      rfNodes.push({
        id: groupId,
        type: 'loopGroup',
        data: { label: loopId },
        position: { x: currentX, y: currentY },
        style: { width: groupWidth, height: groupHeight },
      });

      // Position Items inside group
      items.forEach((inst, idx) => {
        const nodeId = inst.id;
        const type = inst.pcs7BlockType.includes('Vlv') ? 'valve' : 'transmitter';
        
        rfNodes.push({
          id: nodeId,
          type,
          data: { instrument: inst },
          position: { x: 50 + (idx * 130), y: 70 },
          parentId: groupId,
          extent: 'parent',
        });

        // Simple Loop Piping: Connect AI -> AO or sequence
        if (idx > 0) {
          rfEdges.push({
            id: `edge-${items[idx-1].id}-${nodeId}`,
            source: items[idx-1].id,
            target: nodeId,
            type: 'step',
            animated: inst.signalType.startsWith('A'),
            style: { 
              stroke: inst.signalType.startsWith('A') ? '#10b981' : '#3b82f6',
              strokeDasharray: inst.signalType.startsWith('D') ? '5,5' : '0'
            }
          });
        }
      });

      currentX += groupWidth + 100;
      if (currentX > 1500) {
        currentX = 50;
        currentY += groupHeight + 100;
      }
    });

    return { nodes: rfNodes, edges: rfEdges };
  }, [instruments]);

  return (
    <div className="w-full h-full border border-slate-800 rounded-xl overflow-hidden bg-slate-950">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        colorMode="dark"
      >
        <Background color="#1e293b" gap={20} />
        <Controls className="bg-slate-900 border-slate-700 fill-slate-300" />
        <MiniMap 
          className="bg-slate-900 border-slate-700" 
          nodeColor={(node) => {
            if (node.type === 'transmitter') return '#10b981';
            if (node.type === 'valve') return '#60a5fa';
            return '#1e293b';
          }}
          maskColor="rgba(15, 23, 42, 0.7)"
        />
        <Panel position="top-right" className="bg-slate-900/80 p-2 rounded border border-slate-700 backdrop-blur shadow-xl">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-4">
            <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-500" /> AI/Transmitter</span>
            <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-500" /> AO/Valve</span>
          </div>
        </Panel>
      </ReactFlow>
    </div>
  );
};

export default HmiReactFlowView;
