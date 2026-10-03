import React from 'react';
import { useTacticalStore } from '@/store/tacticalStore';
import { PerformanceCharts } from '@/components/Telemetry/PerformanceCharts';
import type { TeamId, RadioStatus } from '@/services/types';

export const MapScreen: React.FC = () => {
  const {
    radios,
    nodeDiagnostics,
    setRadioStatus,
    selectedNodeId,
    setSelectedNodeId,
    avgNetworkLatencyMs,
    globalReliability,
  } = useTacticalStore();

  const teams: TeamId[] = ['HQ', 'ALPHA', 'BRAVO', 'CHARLIE'];

  const getTeamName = (t: TeamId) => {
    switch (t) {
      case 'HQ':
        return 'Headquarters';
      case 'ALPHA':
        return 'Team Alpha';
      case 'BRAVO':
        return 'Team Bravo';
      case 'CHARLIE':
        return 'Team Charlie';
      default:
        return t;
    }
  };

  const handleStatusChange = (team: TeamId, status: RadioStatus) => {
    setRadioStatus(team, status);
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Clean Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-zinc-800">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-zinc-100 tracking-tight">
            Network Performance & Channel Health
          </h2>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
            Real-time response times, packet delivery rates, and channel health across all connected teams.
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs font-mono">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 bg-emerald-500" />
            <span className="text-slate-600 dark:text-zinc-400">Good Connection</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 bg-amber-500" />
            <span className="text-slate-600 dark:text-zinc-400">Slow / Degraded</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 bg-rose-500" />
            <span className="text-slate-600 dark:text-zinc-400">Offline</span>
          </div>
        </div>
      </div>

      {/* 1. Main Telemetry Graphs */}
      <PerformanceCharts className="min-h-[340px]" />

      {/* 2. Comparative Ping & Latency Bar Chart */}
      <div className="border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 rounded-none p-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-zinc-800 mb-4">
          <span className="text-xs font-semibold uppercase text-slate-700 dark:text-zinc-300 tracking-wider">
            Response Time Comparison
          </span>
          <span className="text-[11px] font-mono text-slate-500 dark:text-zinc-400">
            Average: {avgNetworkLatencyMs}ms · Overall Health: {globalReliability}%
          </span>
        </div>

        {/* Clean horizontal bar indicators for each team */}
        <div className="space-y-3.5">
          {teams.map((t) => {
            const node = nodeDiagnostics[t];
            const status = radios[t];
            const isCut = status === 'CUT';
            const latency = isCut ? 0 : node?.latencyMs || 20;
            const maxDisplay = 200;
            const pct = Math.min(100, Math.max(5, (latency / maxDisplay) * 100));

            return (
              <div key={t} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-800 dark:text-zinc-200">
                      {getTeamName(t)}
                    </span>
                    <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-mono">
                      ({t})
                    </span>
                  </div>
                  <div className="font-mono text-[11px] text-slate-600 dark:text-zinc-400">
                    {isCut ? (
                      <span className="text-rose-600 dark:text-rose-400 font-semibold">Offline (Timeout)</span>
                    ) : (
                      <span>{latency} ms ping · {node?.packetLossPercent || 0}% loss</span>
                    )}
                  </div>
                </div>

                <div className="h-2 w-full bg-slate-100 dark:bg-zinc-800 overflow-hidden">
                  {!isCut && (
                    <div
                      className={`h-full transition-all duration-300 ${
                        latency > 100
                          ? 'bg-amber-500'
                          : latency > 50
                          ? 'bg-blue-500'
                          : 'bg-emerald-500'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Channel Health & Diagnostic Matrix */}
      <div className="border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 rounded-none p-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-zinc-800 mb-3">
          <span className="text-xs font-semibold uppercase text-slate-700 dark:text-zinc-300 tracking-wider">
            Connected Channels & Status Management
          </span>
          <span className="text-[11px] font-mono text-slate-500 dark:text-zinc-400">
            4 Connected Teams
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse font-mono">
            <thead>
              <tr className="border-b border-slate-200 dark:border-zinc-800 text-slate-500 dark:text-zinc-400 text-[11px] bg-slate-50/50 dark:bg-zinc-950/40">
                <th className="py-2.5 px-3 font-semibold">Team</th>
                <th className="py-2.5 px-3 font-semibold">Role</th>
                <th className="py-2.5 px-3 font-semibold">Status</th>
                <th className="py-2.5 px-3 font-semibold">Latency</th>
                <th className="py-2.5 px-3 font-semibold">Packet Loss</th>
                <th className="py-2.5 px-3 font-semibold">Packets Sent/Recv</th>
                <th className="py-2.5 px-3 font-semibold text-right">Channel Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-900/60">
              {teams.map((t) => {
                const isSelected = selectedNodeId === t;
                const node = nodeDiagnostics[t];
                const status = radios[t];
                const isCut = status === 'CUT';
                const isDegraded = status === 'DEGRADED';

                return (
                  <tr
                    key={t}
                    onClick={() => setSelectedNodeId(isSelected ? null : t)}
                    className={`hover:bg-slate-50 dark:hover:bg-zinc-900/30 transition-colors cursor-pointer ${
                      isSelected ? 'bg-slate-100/60 dark:bg-zinc-900/50' : ''
                    }`}
                  >
                    <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-zinc-200 font-sans">
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-2 h-2 ${
                            isCut
                              ? 'bg-rose-500'
                              : isDegraded
                              ? 'bg-amber-500'
                              : 'bg-emerald-500'
                          }`}
                        />
                        <span>{getTeamName(t)}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-slate-500 dark:text-zinc-400 font-sans text-xs">
                      {node?.role || 'Team'}
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`text-[11px] px-1.5 py-0.5 border ${
                          isCut
                            ? 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-400'
                            : isDegraded
                            ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-400'
                            : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400'
                        }`}
                      >
                        {isCut ? 'Offline' : isDegraded ? 'Slow' : 'Good'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-700 dark:text-zinc-300 tabular-nums">
                      {isCut ? 'Timeout' : `${node?.latencyMs} ms`}
                    </td>
                    <td className="py-2.5 px-3 text-slate-700 dark:text-zinc-300 tabular-nums">
                      {node?.packetLossPercent}%
                    </td>
                    <td className="py-2.5 px-3 text-slate-500 dark:text-zinc-400 tabular-nums text-[11px]">
                      {node?.packetsSent} / {node?.packetsReceived}
                    </td>
                    <td className="py-2.5 px-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <select
                        value={radios[t]}
                        onChange={(e) => handleStatusChange(t, e.target.value as RadioStatus)}
                        className={`px-2 py-0.5 text-xs font-mono border rounded-none cursor-pointer focus:outline-none ${
                          isCut
                            ? 'border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-400'
                            : isDegraded
                            ? 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-400'
                            : 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400'
                        }`}
                      >
                        <option value="ONLINE" className="bg-white text-slate-900 dark:bg-zinc-900 dark:text-zinc-100">Good (Online)</option>
                        <option value="DEGRADED" className="bg-white text-slate-900 dark:bg-zinc-900 dark:text-zinc-100">Slow (Degraded)</option>
                        <option value="CUT" className="bg-white text-slate-900 dark:bg-zinc-900 dark:text-zinc-100">Offline (Cut)</option>
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
