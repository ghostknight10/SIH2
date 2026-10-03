import React from 'react';
import { Handle, Position } from '@xyflow/react';
import type { TeamId, RadioStatus } from '@/services/types';

export interface TacticalNodeData {
  team: TeamId;
  label: string;
  role: string;
  status: RadioStatus;
  latencyMs: number;
  packetLossPercent: number;
  hardwareTemp: number;
  signalStrengthDbm: number;
  isSelected?: boolean;
}

interface TacticalNodeProps {
  data: TacticalNodeData;
}

export const TacticalNode: React.FC<TacticalNodeProps> = ({ data }) => {
  const isSelected = !!data.isSelected;
  const isDegraded = data.status === 'DEGRADED';
  const isCut = data.status === 'CUT';

  const statusBorder = isSelected
    ? 'border-zinc-100 ring-1 ring-zinc-100'
    : isCut
    ? 'border-rose-600/80 hover:border-rose-500'
    : isDegraded
    ? 'border-amber-600/80 hover:border-amber-500'
    : 'border-zinc-700 hover:border-zinc-400';

  const statusBg = isCut
    ? 'bg-rose-950/20'
    : isDegraded
    ? 'bg-amber-950/20'
    : 'bg-[#09090b]';

  function getStatusDot() {
    if (isCut) return 'bg-rose-500';
    if (isDegraded) return 'bg-amber-500';
    return 'bg-emerald-500';
  }

  return (
    <div
      className={`w-48 ${statusBg} border ${statusBorder} rounded-none p-2.5 font-mono text-xs select-none shadow-none transition-none cursor-pointer`}
    >
      {/* 4 Handles for orthogonal 90-degree Step routing */}
      <Handle
        type="target"
        position={Position.Top}
        id="top"
        className="!bg-zinc-600 !w-2 !h-2 !border !border-zinc-900 rounded-none !top-[-4px]"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        className="!bg-zinc-600 !w-2 !h-2 !border !border-zinc-900 rounded-none !bottom-[-4px]"
      />
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        className="!bg-zinc-600 !w-2 !h-2 !border !border-zinc-900 rounded-none !left-[-4px]"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        className="!bg-zinc-600 !w-2 !h-2 !border !border-zinc-900 rounded-none !right-[-4px]"
      />

      {/* Header */}
      <div className="flex items-center justify-between pb-1.5 border-b border-zinc-800">
        <div className="flex items-center space-x-1.5">
          <span className={`w-2 h-2 rounded-none ${getStatusDot()}`} />
          <span className="font-semibold text-zinc-100 tracking-wide text-xs">
            {data.team}
          </span>
        </div>
        <span
          className={`text-[10px] uppercase font-mono px-1 py-0.5 border ${
            isCut
              ? 'border-rose-900 text-rose-400 bg-rose-950/40'
              : isDegraded
              ? 'border-amber-900 text-amber-400 bg-amber-950/40'
              : 'border-emerald-900 text-emerald-400 bg-emerald-950/40'
          }`}
        >
          {data.status}
        </span>
      </div>

      {/* Subtitle / Role */}
      <div className="py-1 text-[10px] text-zinc-400 truncate font-sans">
        {data.role}
      </div>

      {/* Telemetry Matrix Grid */}
      <div className="grid grid-cols-2 gap-1 pt-1.5 border-t border-zinc-800/80 text-[10px] tabular-nums">
        <div>
          <span className="text-zinc-500 uppercase block text-[9px]">PING</span>
          <span className="text-zinc-200 font-semibold">
            {isCut ? 'TIMEOUT' : `${data.latencyMs}ms`}
          </span>
        </div>
        <div>
          <span className="text-zinc-500 uppercase block text-[9px]">LOSS</span>
          <span
            className={`font-semibold ${
              isCut ? 'text-rose-400' : isDegraded ? 'text-amber-400' : 'text-zinc-200'
            }`}
          >
            {data.packetLossPercent}%
          </span>
        </div>
      </div>
    </div>
  );
};
