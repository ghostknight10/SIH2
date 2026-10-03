import React, { useMemo, useCallback, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  Position,
} from '@xyflow/react';
import type { Edge, Node } from '@xyflow/react';
import { useTacticalStore } from '@/store/tacticalStore';
import { TacticalNode } from './TacticalNode';
import type { TeamId, RadioStatus } from '@/services/types';

const nodeTypes = {
  tactical: TacticalNode,
};

interface NetworkMeshProps {
  className?: string;
}

export const NetworkMesh: React.FC<NetworkMeshProps> = ({ className = 'h-[440px]' }) => {
  const {
    nodeDiagnostics,
    radios,
    selectedNodeId,
    setSelectedNodeId,
    scenarioVersion,
    globalSearch,
  } = useTacticalStore();

  const getLinkStatus = useCallback((n1: TeamId, n2: TeamId): {
    color: string;
    strokeDasharray?: string;
    label: string;
    status: RadioStatus;
  } => {
    const s1 = radios[n1];
    const s2 = radios[n2];

    if (s1 === 'CUT' || s2 === 'CUT') {
      return {
        color: '#f43f5e',
        strokeDasharray: '3 3',
        label: 'SEVERED',
        status: 'CUT',
      };
    }
    if (s1 === 'DEGRADED' || s2 === 'DEGRADED') {
      return {
        color: '#f59e0b',
        strokeDasharray: '5 5',
        label: 'DEGRADED',
        status: 'DEGRADED',
      };
    }
    return {
      color: '#10b981',
      strokeDasharray: undefined,
      label: 'NOMINAL',
      status: 'ONLINE',
    };
  }, [radios]);

  // Fixed structured grid coordinates for military tactical map layout
  const rawNodes: Node[] = useMemo(() => {
    const positions: Record<TeamId, { x: number; y: number }> = {
      HQ: { x: 40, y: 140 },
      ALPHA: { x: 360, y: 20 },
      BRAVO: { x: 360, y: 260 },
      CHARLIE: { x: 680, y: 140 },
    };

    const teams: TeamId[] = ['HQ', 'ALPHA', 'BRAVO', 'CHARLIE'];
    const searchLower = globalSearch.trim().toLowerCase();

    return teams.map((team) => {
      const diag = nodeDiagnostics[team];
      const isSearchMatch = Boolean(
        searchLower &&
          (team.toLowerCase().includes(searchLower) ||
            (diag?.label || '').toLowerCase().includes(searchLower) ||
            (diag?.role || '').toLowerCase().includes(searchLower))
      );

      return {
        id: team,
        type: 'tactical',
        position: positions[team],
        data: {
          team,
          label: diag?.label || team,
          role: diag?.role || 'Unit',
          status: diag?.status || 'ONLINE',
          latencyMs: diag?.latencyMs || 0,
          packetLossPercent: diag?.packetLossPercent || 0,
          hardwareTemp: diag?.hardwareTemp || 40,
          signalStrengthDbm: diag?.signalStrengthDbm || -60,
          isSelected: selectedNodeId === team || isSearchMatch,
        },
      };
    });
  }, [nodeDiagnostics, selectedNodeId, globalSearch]);

  const rawEdges: Edge[] = useMemo(() => {
    const links: [TeamId, TeamId, Position, Position][] = [
      ['HQ', 'ALPHA', Position.Right, Position.Left],
      ['HQ', 'BRAVO', Position.Right, Position.Left],
      ['ALPHA', 'BRAVO', Position.Bottom, Position.Top],
      ['ALPHA', 'CHARLIE', Position.Right, Position.Left],
      ['BRAVO', 'CHARLIE', Position.Right, Position.Left],
    ];

    return links.map(([source, target, sourceHandle, targetHandle]) => {
      const linkInfo = getLinkStatus(source, target);
      return {
        id: `e-${source}-${target}`,
        source,
        target,
        sourceHandle: sourceHandle === Position.Right ? 'right' : sourceHandle === Position.Bottom ? 'bottom' : undefined,
        targetHandle: targetHandle === Position.Left ? 'left' : targetHandle === Position.Top ? 'top' : undefined,
        type: 'step', // Strict 90-degree orthogonal paths
        style: {
          stroke: linkInfo.color,
          strokeWidth: 2,
          strokeDasharray: linkInfo.strokeDasharray,
        },
        label: linkInfo.label,
        labelStyle: {
          fill: linkInfo.color,
          fontWeight: 700,
          fontFamily: 'monospace',
          fontSize: '10px',
        },
        labelBgStyle: {
          fill: '#09090b',
          stroke: linkInfo.color,
          strokeWidth: 1,
        },
        labelBgPadding: [4, 2] as [number, number],
        labelBgBorderRadius: 0,
      };
    });
  }, [getLinkStatus]);

  const [nodes, setNodes, onNodesChange] = useNodesState(rawNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(rawEdges);

  const lastScenarioVersion = React.useRef(scenarioVersion);

  // Sync state: restore initial coordinates on scenario reset, otherwise preserve dragged positions
  useEffect(() => {
    if (lastScenarioVersion.current !== scenarioVersion) {
      lastScenarioVersion.current = scenarioVersion;
      setNodes(rawNodes);
      return;
    }

    setNodes((prevNodes) =>
      rawNodes.map((rawNode) => {
        const existing = prevNodes.find((n) => n.id === rawNode.id);
        if (!existing) return rawNode;
        return {
          ...rawNode,
          position: existing.position,
        };
      })
    );
  }, [rawNodes, scenarioVersion, setNodes]);

  useEffect(() => {
    setEdges(rawEdges);
  }, [rawEdges, setEdges]);

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      setSelectedNodeId(node.id as TeamId);
    },
    [setSelectedNodeId]
  );

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, [setSelectedNodeId]);

  return (
    <div className={`relative w-full ${className} bg-[#09090b] border border-zinc-800 rounded-none overflow-hidden bg-dot-grid`}>
      {/* Top Banner & Legend */}
      <div className="absolute top-2 left-3 z-10 flex items-center space-x-4 bg-zinc-950/90 border border-zinc-800 px-3 py-1.5 text-[11px] font-mono rounded-none">
        <span className="text-zinc-400 font-semibold tracking-wider">
          TACTICAL 2D MESH
        </span>
        <span className="text-zinc-700">|</span>
        <div className="flex items-center space-x-1.5">
          <span className="w-2 h-2 rounded-none bg-emerald-500" />
          <span className="text-zinc-300">NOMINAL</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <span className="w-2 h-2 rounded-none bg-amber-500" />
          <span className="text-zinc-300">DEGRADED</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <span className="w-2 h-2 rounded-none bg-rose-500" />
          <span className="text-zinc-300">SEVERED</span>
        </div>
      </div>

      <div className="absolute top-2 right-3 z-10 bg-zinc-950/90 border border-zinc-800 px-2.5 py-1 text-[10px] font-mono text-zinc-400 rounded-none">
        CLICK NODE TO INSPECT
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        snapToGrid={true}
        snapGrid={[16, 16] as [number, number]}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        proOptions={{ hideAttribution: true }}
        nodesDraggable={true}
        zoomOnScroll={true}
        minZoom={0.5}
        maxZoom={1.5}
      >
        <Background color="#27272a" gap={16} size={1} />
        <Controls
          showInteractive={false}
          className="!border !border-zinc-800 !bg-zinc-950 !rounded-none !shadow-none"
        />
      </ReactFlow>
    </div>
  );
};
