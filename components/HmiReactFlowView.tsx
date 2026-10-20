
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
import { buildConnections, groupLoops } from '../services/topologyLayout';
import { analyzeSignalTopology } from '../services/signalTopology';
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
    
    // 1. Group by ISA loop, ordered sensor -> controller -> actuator
    const loopGroups = groupLoops(instruments);

    let currentX = 50;
    let currentY = 50;

    loopGroups.forEach(({ loopId, items }) => {
      const groupId = `group-${loopId}`;
      // Wide enough for every instrument in the loop (130px per node)
      const groupWidth = Math.max(450, 100 + items.length * 130);
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
      });

      currentX += groupWidth + 100;
      if (currentX > 1500) {
        currentX = 50;
        currentY += groupHeight + 100;
      }
    });

    // Explicit directed links are declared project data; inferred loop chains
    // are visualization heuristics, not evidence.
    const declared = new Set(analyzeSignalTopology(instruments).edges
      .map(edge => edge.sourceId + '>' + edge.targetId));
    buildConnections(loopGroups).forEach(({ source, target }) => {
      const isDeclared = declared.has(source.id + '>' + target.id);
      rfEdges.push({
        id: `edge-${source.id}-${target.id}`,
        source: source.id,
        target: target.id,
        type: 'step',
        animated: false,
        label: isDeclared ? 'Declared' : undefined,
        labelStyle: { fill: '#7dd3fc', fontSize: 10 },
        style: {
          stroke: isDeclared ? '#00E0FF' : '#64748b',
          strokeWidth: isDeclared ? 2.5 : 1.3,
          strokeDasharray: isDeclared ? '0' : '5,5',
          opacity: isDeclared ? 1 : 0.65,
        }
      });
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
            <span className="flex items-center gap-1"><div className="h-0.5 w-4 bg-cyan-400" /> Declared directed link</span>
            <span className="flex items-center gap-1"><div className="w-4 border-t border-dashed border-slate-400" /> Inferred layout only</span>
            <span>Concept · no OT connection</span>
          </div>
        </Panel>
      </ReactFlow>
    </div>
  );
};

export default HmiReactFlowView;
