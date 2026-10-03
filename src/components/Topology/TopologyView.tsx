import React from 'react';
import { useTacticalStore } from '@/store/tacticalStore';
import { NetworkMesh } from './NetworkMesh';
import { NodeInspectorDrawer } from './NodeInspectorDrawer';
import type { TeamId } from '@/services/types';

export const TopologyView: React.FC = () => {
  const {
    selectedNodeId,
    setSelectedNodeId,
    radios,
    globalReliability,
    avgNetworkLatencyMs,
  } = useTacticalStore();

  const teams: TeamId[] = ['HQ', 'ALPHA', 'BRAVO', 'CHARLIE'];
  const onlineCount = Object.values(radios).filter((s) => s === 'ONLINE').length;
  const degradedCount = Object.values(radios).filter((s) => s === 'DEGRADED').length;
  const cutCount = Object.values(radios).filter((s) => s === 'CUT').length;

  return (
    <div className="max-w-7xl mx-auto px-4 py-3 space-y-3 font-mono text-xs">
      {/* Top Status Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-zinc-800">
        <div className="flex items-center space-x-3">
          <span className="text-zinc-100 font-semibold uppercase tracking-wider text-xs">
            TOPOLOGY GRAPH CANVAS
          </span>
          <span className="text-zinc-600">/</span>
          <span className="text-zinc-400 text-[11px]">
            {onlineCount}/{teams.length} CHANNELS NOMINAL
          </span>
        </div>

        {/* Node Selector Quick Strip */}
        <div className="flex items-center space-x-1">
          <span className="text-zinc-500 text-[10px] uppercase mr-1">SELECT:</span>
          {teams.map((t) => {
            const isSelected = selectedNodeId === t;
            const status = radios[t];
            return (
              <button
                key={t}
                onClick={() => setSelectedNodeId(isSelected ? null : t)}
                className={`px-2 py-0.5 border rounded-none transition-none text-[11px] cursor-pointer ${
                  isSelected
                    ? 'border-zinc-100 bg-zinc-100 text-zinc-950 font-semibold'
                    : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-zinc-950 hover:bg-zinc-100 hover:border-zinc-400'
                }`}
              >
                <div className="flex items-center space-x-1">
                  <span
                    className={`w-1.5 h-1.5 rounded-none ${
                      status === 'CUT'
                        ? 'bg-rose-500'
                        : status === 'DEGRADED'
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                    }`}
                  />
                  <span>{t}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Interactive Canvas + Side Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* Network Mesh 2D Canvas */}
        <div className={selectedNodeId ? 'lg:col-span-8' : 'lg:col-span-12'}>
          <NetworkMesh className="h-[540px]" />
        </div>

        {/* Node Inspector Drawer */}
        {selectedNodeId && (
          <div className="lg:col-span-4 flex flex-col">
            <NodeInspectorDrawer onClose={() => setSelectedNodeId(null)} />
          </div>
        )}
      </div>

      {/* Bottom Telemetry Status Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-zinc-800 text-[11px]">
        <div className="p-2 border border-zinc-800/80 bg-[#0c0c0e]">
          <div className="text-zinc-500 uppercase text-[9px]">MESH MESHING</div>
          <div className="text-zinc-200 font-semibold mt-0.5">ORTHOGONAL 90° STEP</div>
        </div>
        <div className="p-2 border border-zinc-800/80 bg-[#0c0c0e]">
          <div className="text-zinc-500 uppercase text-[9px]">ACTIVE LINKS</div>
          <div className="text-zinc-200 font-semibold mt-0.5 tabular-nums">
            {onlineCount} NOMINAL · {degradedCount} DEG · {cutCount} CUT
          </div>
        </div>
        <div className="p-2 border border-zinc-800/80 bg-[#0c0c0e]">
          <div className="text-zinc-500 uppercase text-[9px]">NETWORK RELIABILITY</div>
          <div className="text-zinc-200 font-semibold mt-0.5 tabular-nums">
            {globalReliability}% COMPLIANT
          </div>
        </div>
        <div className="p-2 border border-zinc-800/80 bg-[#0c0c0e]">
          <div className="text-zinc-500 uppercase text-[9px]">GLOBAL LATENCY</div>
          <div className="text-zinc-200 font-semibold mt-0.5 tabular-nums">
            {avgNetworkLatencyMs}ms (JITTER &lt;3ms)
          </div>
        </div>
      </div>
    </div>
  );
};
