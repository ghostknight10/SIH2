import React, { useState } from 'react';
import { useTacticalStore } from '@/store/tacticalStore';
import { NetworkMesh } from '@/components/Topology/NetworkMesh';
import { NodeInspectorDrawer } from '@/components/Topology/NodeInspectorDrawer';
import type { TeamId } from '@/services/types';

export const SystemOverview: React.FC = () => {
  const {
    nodeDiagnostics,
    setRadioStatus,
    injectConflictingIntel,
    sendMessage,
    userRole,
    radios,
    events,
    selectedNodeId,
    setSelectedNodeId,
    globalSearch,
  } = useTacticalStore();

  const [quickTarget, setQuickTarget] = useState<TeamId>('BRAVO');
  const [quickContent, setQuickContent] = useState<string>('');
  const [injectTarget, setInjectTarget] = useState<TeamId>('BRAVO');
  const [injectPayload, setInjectPayload] = useState<string>(
    'Eastern corridor confirmed clear. Hostile scout eliminated.'
  );

  const handleQuickSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickContent.trim()) return;
    sendMessage({
      sender: userRole === 'instructor' ? 'HQ' : 'ALPHA',
      receiver: quickTarget,
      content: quickContent,
      priority: 'NORMAL',
      delaySeconds: 2.4,
      freshnessPercent: 92,
      confidencePercent: 94,
    });
    setQuickContent('');
  };

  const handleInject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!injectPayload.trim()) return;
    injectConflictingIntel(injectTarget, injectPayload);
  };

  const searchLower = globalSearch.trim().toLowerCase();
  const nodes = Object.values(nodeDiagnostics);
  const filteredNodes = nodes.filter((n) => {
    if (!searchLower) return true;
    return (
      n.team.toLowerCase().includes(searchLower) ||
      n.label.toLowerCase().includes(searchLower) ||
      n.role.toLowerCase().includes(searchLower) ||
      n.status.toLowerCase().includes(searchLower)
    );
  });
  const filteredEvents = events.filter((ev) => {
    if (!searchLower) return true;
    return ev.text.toLowerCase().includes(searchLower) || ev.type.toLowerCase().includes(searchLower);
  });
  const teams: TeamId[] = ['HQ', 'ALPHA', 'BRAVO', 'CHARLIE'];

  const getLinkMetrics = (from: TeamId, to: TeamId) => {
    if (from === to) return { status: 'self', latency: '—', loss: '—', dotClass: '' };
    const fromStatus = radios[from];
    const toStatus = radios[to];

    if (fromStatus === 'CUT' || toStatus === 'CUT') {
      return { status: 'cut', latency: 'TIMEOUT', loss: '100%', dotClass: 'bg-rose-500' };
    }
    if (fromStatus === 'DEGRADED' || toStatus === 'DEGRADED') {
      return { status: 'degraded', latency: '184ms', loss: '28.4%', dotClass: 'bg-amber-500' };
    }
    return { status: 'normal', latency: '22ms', loss: '0.8%', dotClass: 'bg-emerald-500' };
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-4 space-y-4">
      {/* 1. Bento Row 1: Interactive Network Mesh Canvas + Node Inspector / Incident Stream */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* Left: 2D Mesh Canvas & Quick Transmit */}
        <div className={selectedNodeId ? 'lg:col-span-8 space-y-2' : 'lg:col-span-8 space-y-2'}>
          <div className="bg-[#0c0c0e] border border-zinc-800 rounded-none p-3 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
              <span className="text-[11px] uppercase font-mono font-semibold text-zinc-400 tracking-wider">
                TACTICAL TOPOLOGY MESH (CLICK NODE TO INSPECT)
              </span>
              <span className="text-[10px] font-mono text-zinc-500">
                ACTIVE C2 HUB: HQ-01
              </span>
            </div>

            {/* Embedded Interactive 2D Network Mesh */}
            <NetworkMesh className="h-[360px]" />

            {/* Quick Dispatch Composer */}
            <form onSubmit={handleQuickSend} className="pt-2 border-t border-zinc-800 flex items-center space-x-2">
              <select
                value={quickTarget}
                onChange={(e) => setQuickTarget(e.target.value as TeamId)}
                className="bg-zinc-950 border border-zinc-800 rounded-none px-2 py-1 text-xs text-zinc-300 font-mono focus:outline-hidden focus:border-zinc-500 cursor-pointer"
              >
                {teams.map((t) => (
                  <option key={t} value={t} className="bg-zinc-950 text-zinc-200">
                    TARGET: {t}
                  </option>
                ))}
              </select>

              <input
                type="text"
                placeholder="Dispatch tactical order or message payload..."
                value={quickContent}
                onChange={(e) => setQuickContent(e.target.value)}
                className="flex-1 bg-zinc-950 border border-zinc-800 rounded-none px-2.5 py-1 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-hidden focus:border-zinc-500 font-mono"
              />

              <button
                type="submit"
                className="bg-zinc-100 text-zinc-950 hover:bg-zinc-300 text-xs font-mono font-semibold px-3 py-1 rounded-none transition-none cursor-pointer shrink-0"
              >
                TRANSMIT
              </button>
            </form>
          </div>
        </div>

        {/* Right (4 Cols): Node Inspector Drawer (if selected) or Incident Stream */}
        <div className="lg:col-span-4 flex flex-col space-y-3">
          {selectedNodeId ? (
            <NodeInspectorDrawer onClose={() => setSelectedNodeId(null)} />
          ) : (
            <div className="bg-[#0c0c0e] border border-zinc-800 rounded-none p-3 flex flex-col h-[435px]">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
                <span className="text-[11px] uppercase font-mono font-semibold text-zinc-400 tracking-wider">
                  INCIDENT STREAM
                </span>
                <span className="text-[10px] font-mono text-zinc-500 tabular-nums">
                  {filteredEvents.length} EVENTS
                </span>
              </div>

              <div className="flex-1 overflow-y-auto divide-y divide-zinc-800/60 text-xs mt-1">
                {filteredEvents.length === 0 ? (
                  <div className="py-4 text-center text-zinc-600 font-mono text-[11px]">
                    NO EVENTS MATCH QUERY
                  </div>
                ) : (
                  filteredEvents.map((ev) => (
                    <div key={ev.id} className="py-2 flex items-start space-x-2">
                      <span className="text-zinc-500 font-mono text-[10px] shrink-0 tabular-nums">
                        [{ev.timestamp}]
                      </span>
                      <span
                        className={`leading-snug font-mono text-[11px] ${
                          ev.severity === 'critical'
                            ? 'text-rose-400'
                            : ev.severity === 'caution'
                            ? 'text-amber-400'
                            : 'text-zinc-300'
                        }`}
                      >
                        {ev.text}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 2. Bento Row 2: Node Diagnostics (7 Cols) + Flat Link Matrix (5 Cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* Left (7 Cols): Node Diagnostics Table with Zebra Striping and Harsh Borders */}
        <div className="lg:col-span-7 bg-[#0c0c0e] border border-zinc-800 rounded-none p-3">
          <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
            <span className="text-[11px] uppercase font-mono font-semibold text-zinc-400 tracking-wider">
              NODE TELEMETRY AUDIT
            </span>
            <span className="text-[10px] font-mono text-zinc-500 tabular-nums">
              {filteredNodes.filter((n) => n.status === 'ONLINE').length}/{filteredNodes.length} ACTIVE
            </span>
          </div>

          <div className="overflow-x-auto mt-1">
            <table className="w-full text-left text-xs border-collapse font-mono">
              <thead>
                <tr className="text-zinc-500 text-[10px] border-b border-zinc-800">
                  <th className="py-1.5 px-2 font-semibold">NODE</th>
                  <th className="py-1.5 px-2 font-semibold">STATUS</th>
                  <th className="py-1.5 px-2 font-semibold">LOSS</th>
                  <th className="py-1.5 px-2 font-semibold">PING</th>
                  <th className="py-1.5 px-2 font-semibold">RSSI</th>
                  {userRole === 'instructor' && <th className="py-1.5 px-2 text-right font-semibold">ACTIONS</th>}
                </tr>
              </thead>
              <tbody>
                {filteredNodes.map((node) => {
                  const isOnline = node.status === 'ONLINE';
                  const isDegraded = node.status === 'DEGRADED';
                  const isCut = node.status === 'CUT';

                  return (
                    <tr
                      key={node.team}
                      onClick={() => setSelectedNodeId(node.team)}
                      className="border-b border-zinc-800 even:bg-zinc-900/20 hover:bg-zinc-800/40 transition-none cursor-pointer"
                    >
                      <td className="py-2 px-2 font-semibold text-zinc-200">
                        {node.team}
                      </td>

                      {/* Status: Sharp square pip + text */}
                      <td className="py-2 px-2">
                        <div className="flex items-center space-x-1.5">
                          <span
                            className={`w-1.5 h-1.5 rounded-none ${
                              isOnline ? 'bg-emerald-500' : isDegraded ? 'bg-amber-500' : 'bg-rose-500'
                            }`}
                          />
                          <span
                            className={`text-xs ${
                              isCut ? 'text-rose-400' : isDegraded ? 'text-amber-400' : 'text-zinc-400'
                            }`}
                          >
                            {node.status}
                          </span>
                        </div>
                      </td>

                      <td className={`py-2 px-2 tabular-nums ${isCut ? 'text-rose-400 font-semibold' : isDegraded ? 'text-amber-400' : 'text-zinc-400'}`}>
                        {node.packetLossPercent}%
                      </td>

                      <td className="py-2 px-2 text-zinc-300 tabular-nums">
                        {isCut ? 'TIMEOUT' : `${node.latencyMs}ms`}
                      </td>

                      <td className="py-2 px-2 text-zinc-400 tabular-nums">
                        {node.signalStrengthDbm} dBm
                      </td>

                      {userRole === 'instructor' && (
                        <td className="py-2 px-2 text-right">
                          <div className="inline-flex items-center space-x-1" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => setRadioStatus(node.team, 'ONLINE')}
                              className="text-zinc-400 hover:text-zinc-950 hover:bg-zinc-100 text-[10px] px-1.5 py-0.5 rounded-none border border-zinc-800 transition-none cursor-pointer"
                            >
                              NOMINAL
                            </button>
                            <button
                              onClick={() => setRadioStatus(node.team, 'DEGRADED')}
                              className="text-zinc-400 hover:text-zinc-950 hover:bg-amber-400 text-[10px] px-1.5 py-0.5 rounded-none border border-zinc-800 transition-none cursor-pointer"
                            >
                              DEGRADE
                            </button>
                            <button
                              onClick={() => setRadioStatus(node.team, 'CUT')}
                              className="text-zinc-400 hover:text-zinc-950 hover:bg-rose-500 text-[10px] px-1.5 py-0.5 rounded-none border border-zinc-800 transition-none cursor-pointer"
                            >
                              SEVER
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right (5 Cols): Flat Link Matrix with border-collapse and zebra striping */}
        <div className="lg:col-span-5 bg-[#0c0c0e] border border-zinc-800 rounded-none p-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
              <span className="text-[11px] uppercase font-mono font-semibold text-zinc-400 tracking-wider">
                LINK MATRIX (4x4 MESH)
              </span>
              <span className="text-[10px] font-mono text-zinc-500">RF CHANNELS</span>
            </div>

            <div className="overflow-x-auto mt-1">
              <table className="w-full text-center border-collapse font-mono text-xs">
                <thead>
                  <tr className="text-zinc-500 text-[10px] border-b border-zinc-800">
                    <th className="py-1.5 px-2 text-left font-semibold">FROM \ TO</th>
                    {teams.map((t) => (
                      <th key={t} className="py-1.5 px-2 font-semibold text-zinc-400">
                        {t}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {teams.map((from) => (
                    <tr key={from} className="border-b border-zinc-800 even:bg-zinc-900/20 hover:bg-zinc-800/30 transition-none">
                      <td className="py-2 px-2 text-left font-semibold text-zinc-300">
                        {from}
                      </td>
                      {teams.map((to) => {
                        const m = getLinkMetrics(from, to);
                        if (m.status === 'self') {
                          return (
                            <td key={to} className="py-2 px-2 text-zinc-700">
                              —
                            </td>
                          );
                        }
                        return (
                          <td key={to} className="py-2 px-2">
                            <div className="flex flex-col items-center">
                              <span className={`font-semibold tabular-nums text-xs ${
                                m.status === 'cut' ? 'text-rose-400' : m.status === 'degraded' ? 'text-amber-400' : 'text-zinc-200'
                              }`}>
                                {m.latency}
                              </span>
                              <span className="text-[9px] text-zinc-500 tabular-nums">
                                {m.loss}
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
          </div>

          <div className="pt-2 border-t border-zinc-800 text-[10px] font-mono text-zinc-500 flex justify-between">
            <span>TOPOLOGY: 90° ORTHOGONAL</span>
            <span className="tabular-nums">JITTER: &lt;3ms</span>
          </div>
        </div>
      </div>

      {/* 3. Bento Row 3: Adversarial Intel Injection (Flat Monochrome Control) */}
      {userRole === 'instructor' && (
        <div className="bg-[#0c0c0e] border border-zinc-800 rounded-none p-3">
          <div className="flex items-center justify-between pb-2 border-b border-zinc-800 mb-2">
            <span className="text-[11px] uppercase font-mono font-semibold text-zinc-400 tracking-wider">
              ADVERSARIAL INTEL INJECTION (EW ENGINE)
            </span>
            <span className="text-[10px] font-mono text-zinc-500">SIMULATION ENGINE</span>
          </div>

          <form onSubmit={handleInject} className="flex flex-wrap items-center gap-2">
            <select
              value={injectTarget}
              onChange={(e) => setInjectTarget(e.target.value as TeamId)}
              className="bg-zinc-950 border border-zinc-800 rounded-none px-2 py-1 text-xs text-zinc-200 font-mono focus:outline-hidden focus:border-zinc-500"
            >
              <option value="BRAVO" className="bg-zinc-950">Target: BRAVO</option>
              <option value="ALPHA" className="bg-zinc-950">Target: ALPHA</option>
              <option value="CHARLIE" className="bg-zinc-950">Target: CHARLIE</option>
            </select>

            <input
              type="text"
              value={injectPayload}
              onChange={(e) => setInjectPayload(e.target.value)}
              className="flex-1 min-w-[260px] bg-zinc-950 border border-zinc-800 rounded-none px-2.5 py-1 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-hidden focus:border-zinc-500 font-mono"
            />

            <button
              type="submit"
              className="bg-zinc-100 text-zinc-950 hover:bg-zinc-300 text-xs font-mono font-semibold px-3 py-1 rounded-none transition-none cursor-pointer"
            >
              INJECT ANOMALY
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
