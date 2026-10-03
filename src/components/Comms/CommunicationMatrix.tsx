import React from 'react';
import { useTacticalStore } from '@/store/tacticalStore';
import type { TeamId } from '@/services/types';

export const CommunicationMatrix: React.FC = () => {
  const { radios, nodeDiagnostics, setSelectedNodeId, setActiveTab } = useTacticalStore();
  const teams: TeamId[] = ['HQ', 'ALPHA', 'BRAVO', 'CHARLIE'];

  const getLinkMetrics = (from: TeamId, to: TeamId) => {
    if (from === to) return { status: 'self', latency: '—', loss: '—', label: '—', dotClass: '' };
    const fromStatus = radios[from];
    const toStatus = radios[to];

    if (fromStatus === 'CUT' || toStatus === 'CUT') {
      return { 
        status: 'cut', 
        latency: 'TIMEOUT', 
        loss: '100%', 
        label: 'Severed', 
        dotClass: 'bg-rose-500',
        textColor: 'text-rose-400'
      };
    }
    if (fromStatus === 'DEGRADED' || toStatus === 'DEGRADED') {
      return { 
        status: 'degraded', 
        latency: '184ms', 
        loss: '28.4%', 
        label: 'Degraded', 
        dotClass: 'bg-amber-500',
        textColor: 'text-amber-400'
      };
    }
    return { 
      status: 'normal', 
      latency: '22ms', 
      loss: '0.8%', 
      label: 'Optimal', 
      dotClass: 'bg-emerald-500',
      textColor: 'text-emerald-400'
    };
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-4 space-y-4 font-mono text-xs">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
        <h2 className="text-[11px] uppercase font-semibold text-zinc-400 tracking-wider">
          INTER-NODE RF LINK MATRIX (4x4 MESH)
        </h2>

        {/* Legend */}
        <div className="flex items-center space-x-4 text-xs font-mono">
          <div className="flex items-center space-x-1.5">
            <span className="w-1.5 h-1.5 rounded-none bg-emerald-500" />
            <span className="text-zinc-400 text-[11px]">OPTIMAL</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-1.5 h-1.5 rounded-none bg-amber-500" />
            <span className="text-zinc-400 text-[11px]">DEGRADED</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-1.5 h-1.5 rounded-none bg-rose-500" />
            <span className="text-zinc-400 text-[11px]">SEVERED</span>
          </div>
        </div>
      </div>

      {/* Hyper-Dense Monochrome Data Grid (Single-pixel border bottoms, border-collapse, zebra-striping) */}
      <div className="border border-zinc-800 bg-[#0c0c0e] rounded-none overflow-x-auto">
        <table className="w-full text-left font-mono text-xs border-collapse">
          <thead>
            <tr className="text-zinc-500 text-[10px] border-b border-zinc-800 bg-zinc-950">
              <th className="py-2.5 px-3 font-semibold">FROM \ TO</th>
              {teams.map((t) => (
                <th key={t} className="py-2.5 px-3 text-center font-semibold text-zinc-400">
                  {nodeDiagnostics[t]?.label || t}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {teams.map((from) => (
              <tr
                key={from}
                onClick={() => {
                  setSelectedNodeId(from);
                  setActiveTab('map');
                }}
                className="border-b border-zinc-800 even:bg-zinc-900/20 hover:bg-zinc-800/40 transition-none cursor-pointer"
                title={`Click to inspect ${from} in Mesh Canvas`}
              >
                <td className="py-3 px-3 font-semibold text-zinc-200">
                  {nodeDiagnostics[from]?.label || from}
                </td>
                {teams.map((to) => {
                  const m = getLinkMetrics(from, to);
                  if (m.status === 'self') {
                    return (
                      <td key={to} className="py-3 px-3 text-center text-zinc-700">
                        —
                      </td>
                    );
                  }
                  return (
                    <td key={to} className="py-3 px-3 text-center">
                      <div className="inline-flex flex-col items-center">
                        <div className="flex items-center space-x-1.5">
                          <span className={`w-1.5 h-1.5 rounded-none ${m.dotClass}`} />
                          <span className={`font-semibold tabular-nums ${m.textColor || 'text-zinc-100'}`}>
                            {m.latency}
                          </span>
                        </div>
                        <span className="text-[10px] text-zinc-500 tabular-nums mt-0.5">
                          {m.loss} loss
                        </span>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Dense Diagnostic Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
        <div className="p-3 border border-zinc-800 bg-[#0c0c0e] rounded-none space-y-1">
          <div className="text-[10px] uppercase font-semibold text-zinc-500 tracking-wider">
            OPTIMAL CHANNELS
          </div>
          <div className="text-xs font-mono text-zinc-200">
            HQ ↔ Alpha, HQ ↔ Bravo (0% loss, &lt;40ms)
          </div>
        </div>

        <div className="p-3 border border-zinc-800 bg-[#0c0c0e] rounded-none space-y-1">
          <div className="text-[10px] uppercase font-semibold text-zinc-500 tracking-wider">
            DEGRADED CHANNELS
          </div>
          <div className="text-xs font-mono text-amber-400">
            Charlie Support: 28.4% loss (EW interference)
          </div>
        </div>

        <div className="p-3 border border-zinc-800 bg-[#0c0c0e] rounded-none space-y-1">
          <div className="text-[10px] uppercase font-semibold text-zinc-500 tracking-wider">
            SEVERED CHANNELS
          </div>
          <div className="text-xs font-mono text-zinc-400">
            Zero channels offline
          </div>
        </div>
      </div>
    </div>
  );
};
