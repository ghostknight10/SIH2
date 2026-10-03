import React, { useState } from 'react';
import { useTacticalStore } from '@/store/tacticalStore';
import { PerformanceCharts } from '@/components/Telemetry/PerformanceCharts';
import type { TeamId } from '@/services/types';
import { Send, AlertTriangle } from 'lucide-react';

export const LiveScreen: React.FC = () => {
  const {
    globalReliability,
    avgNetworkLatencyMs,
    dataFreshnessIndex,
    totalTransmissions,
    droppedCount,
    reliabilityDelta,
    latencyDelta,
    freshnessDelta,
    transmissionsDelta,
    messages,
    events,
    sendMessage,
    setActiveTab,
    userRole,
    playerTeam,
    radios,
  } = useTacticalStore();

  const sender = userRole === 'instructor' ? 'HQ' : playerTeam;
  const availableTargets: TeamId[] = (['HQ', 'ALPHA', 'BRAVO', 'CHARLIE'] as TeamId[]).filter((t) => t !== sender);

  const [quickTarget, setQuickTarget] = useState<TeamId>(availableTargets[0] || 'BRAVO');
  const [quickMessage, setQuickMessage] = useState('');

  const handleQuickSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickMessage.trim() || sender === quickTarget) return;

    sendMessage({
      sender,
      receiver: quickTarget,
      content: quickMessage.trim(),
      priority: 'NORMAL',
      delaySeconds: 2.2,
      freshnessPercent: 92,
      confidencePercent: 94,
    });
    setQuickMessage('');
  };

  const isStale = dataFreshnessIndex < 50;
  const cutChannels = (['HQ', 'ALPHA', 'BRAVO', 'CHARLIE'] as TeamId[]).filter((t) => radios[t] === 'CUT');
  const degradedChannels = (['HQ', 'ALPHA', 'BRAVO', 'CHARLIE'] as TeamId[]).filter((t) => radios[t] === 'DEGRADED');
  const hasCut = cutChannels.length > 0;
  const hasDegraded = degradedChannels.length > 0;

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-7xl mx-auto">
      {/* 1. Top Metrics Strip (Linear / Vercel Contiguous Bar) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-y lg:divide-y-0 divide-slate-200 dark:divide-zinc-800/80 border border-slate-300 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 rounded-none shadow-[0_1px_3px_rgba(0,0,0,0.05)] dark:shadow-none">
        <div className="p-3.5 sm:p-4">
          <div className="text-[11px] font-semibold uppercase text-slate-500 dark:text-zinc-400 tracking-wider mb-1">
            Network Reliability
          </div>
          <div className="text-2xl font-mono tabular-nums font-semibold text-slate-900 dark:text-zinc-100">
            {globalReliability}%
          </div>
          <div className="text-[11px] font-mono text-slate-500 dark:text-zinc-400 mt-1 flex items-center gap-1.5">
            <span className={reliabilityDelta.startsWith('+') ? 'text-emerald-700 dark:text-emerald-400 font-semibold' : 'text-rose-700 dark:text-rose-400 font-semibold'}>
              {reliabilityDelta}
            </span>
            <span>vs last min</span>
          </div>
        </div>

        <div className="p-3.5 sm:p-4">
          <div className="text-[11px] font-semibold uppercase text-slate-500 dark:text-zinc-400 tracking-wider mb-1">
            Response Ping
          </div>
          <div className="text-2xl font-mono tabular-nums font-semibold text-slate-900 dark:text-zinc-100">
            {avgNetworkLatencyMs}ms
          </div>
          <div className="text-[11px] font-mono text-slate-500 dark:text-zinc-400 mt-1 flex items-center gap-1.5">
            <span className={latencyDelta.startsWith('+') ? 'text-amber-700 dark:text-amber-400 font-semibold' : 'text-emerald-700 dark:text-emerald-400 font-semibold'}>
              {latencyDelta}
            </span>
            <span>vs last min</span>
          </div>
        </div>

        <div className="p-3.5 sm:p-4">
          <div className="text-[11px] font-semibold uppercase text-slate-500 dark:text-zinc-400 tracking-wider mb-1">
            Information Quality
          </div>
          <div className="text-2xl font-mono tabular-nums font-semibold text-slate-900 dark:text-zinc-100">
            {dataFreshnessIndex}%
          </div>
          <div className="text-[11px] font-mono text-slate-500 dark:text-zinc-400 mt-1 flex items-center gap-1.5">
            <span className={freshnessDelta.startsWith('-') ? 'text-rose-700 dark:text-rose-400 font-semibold' : 'text-emerald-700 dark:text-emerald-400 font-semibold'}>
              {freshnessDelta}
            </span>
            <span>{isStale ? 'Stale & Conflicted' : 'Fresh'}</span>
          </div>
        </div>

        <div className="p-3.5 sm:p-4">
          <div className="text-[11px] font-semibold uppercase text-slate-500 dark:text-zinc-400 tracking-wider mb-1">
            Messages Handled
          </div>
          <div className="text-2xl font-mono tabular-nums font-semibold text-slate-900 dark:text-zinc-100">
            {totalTransmissions}
          </div>
          <div className="text-[11px] font-mono text-slate-500 dark:text-zinc-400 mt-1 flex items-center gap-1.5">
            <span className="text-slate-800 dark:text-zinc-200 font-semibold">{transmissionsDelta}</span>
            <span>({droppedCount} dropped)</span>
          </div>
        </div>
      </div>

      {/* Real-time Incident & Operational Health Banner (Cloudflare / Datadog NOC Pattern) */}
      <div
        className={`px-3.5 py-1.5 border text-xs font-mono flex items-center justify-between ${
          hasCut
            ? 'border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300'
            : hasDegraded
            ? 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300'
            : 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300'
        }`}
      >
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 inline-block ${
              hasCut
                ? 'bg-rose-500 animate-pulse'
                : hasDegraded
                ? 'bg-amber-500'
                : 'bg-emerald-500'
            }`}
          />
          <span className="font-semibold">
            {hasCut
              ? `INCIDENT ALERT: Radio link severed to ${cutChannels.join(', ')} · Decision lag +${(0.5 + avgNetworkLatencyMs / 45).toFixed(1)}s`
              : hasDegraded
              ? `DEGRADATION ALERT: High latency on ${degradedChannels.join(', ')} · Telemetry sync delayed`
              : 'SYSTEM STATUS: All 4 tactical channels operational · Telemetry synchronized'}
          </span>
        </div>
        <span className="text-[11px] opacity-75 hidden sm:inline">
          {hasCut ? 'Immediate verification required' : 'Nominal C2 throughput'}
        </span>
      </div>

      {/* 2. Middle Grid: Performance Chart + Information Freshness & Event Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Main Performance Telemetry (8 cols) */}
        <div className="lg:col-span-8 flex flex-col">
          <PerformanceCharts
            compact
            onExpand={() => setActiveTab('map')}
            className="min-h-[290px]"
          />
        </div>

        {/* Right Side Panel: Information Quality + Event Feed (4 cols) */}
        <div className="lg:col-span-4 flex flex-col gap-3">
          {/* Information Quality Indicator (per Backend README specification) */}
          <div className="border border-slate-300 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 rounded-none p-3.5 shrink-0 shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:shadow-none">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="font-semibold uppercase tracking-wider text-slate-700 dark:text-zinc-300 text-[11px]">
                Information Freshness
              </span>
              <span
                className={`font-mono font-bold text-xs px-2 py-0.5 border ${
                  isStale
                    ? 'border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-400'
                    : 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-400'
                }`}
              >
                {isStale ? 'STALE' : 'FRESH'} ({dataFreshnessIndex}%)
              </span>
            </div>

            {/* Quality Progress Bar */}
            <div className="h-2.5 w-full bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700/80 overflow-hidden mb-2">
              <div
                className={`h-full transition-all duration-300 ${
                  isStale ? 'bg-rose-600' : dataFreshnessIndex < 80 ? 'bg-amber-500' : 'bg-emerald-600'
                }`}
                style={{ width: `${dataFreshnessIndex}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] font-mono text-slate-600 dark:text-zinc-400">
              <span>Confidence: {dataFreshnessIndex}%</span>
              <span>Delay Decay: -{Math.max(0, 100 - dataFreshnessIndex)}%</span>
            </div>

            {isStale && (
              <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-zinc-800/80 flex items-center gap-1.5 text-[11px] text-rose-700 dark:text-rose-400 font-medium">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>Conflicting intel reported. Verify before decisions.</span>
              </div>
            )}
          </div>

          {/* Event Feed */}
          <div className="border border-slate-300 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 rounded-none p-3.5 flex flex-col flex-1 overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:shadow-none">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-zinc-800 mb-2">
              <span className="text-[11px] font-semibold uppercase text-slate-700 dark:text-zinc-300 tracking-wider">
                Event Feed
              </span>
              <span className="text-[10px] font-mono text-slate-500 dark:text-zinc-400">
                {events.length} events
              </span>
            </div>

            <div className="flex-1 overflow-y-auto pr-1">
              <div className="relative pl-3.5 border-l border-slate-200 dark:border-zinc-800 ml-1 space-y-2.5 py-1">
                {events.map((ev) => (
                  <div key={ev.id} className="relative text-xs">
                    <div
                      className={`absolute -left-[18px] top-1.5 w-1.5 h-1.5 rounded-none ${
                        ev.severity === 'critical'
                          ? 'bg-rose-500'
                          : ev.severity === 'caution'
                          ? 'bg-amber-500'
                          : 'bg-slate-400 dark:bg-zinc-600'
                      }`}
                    />
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-[10px] font-mono text-slate-500 dark:text-zinc-400 tabular-nums">
                        {ev.timestamp}
                      </span>
                    </div>
                    <p
                      className={`text-xs mt-0.5 leading-snug font-sans ${
                        ev.severity === 'critical'
                          ? 'text-rose-800 dark:text-rose-300 font-medium'
                          : ev.severity === 'caution'
                          ? 'text-amber-800 dark:text-amber-300'
                          : 'text-slate-800 dark:text-zinc-300'
                      }`}
                    >
                      {ev.text}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Message History Ledger with Chip-Based Target Selection (Glitch-Free) */}
      <div className="border border-slate-300 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 rounded-none overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.05)] dark:shadow-none">
        {/* Ledger Toolbar & Message Input */}
        <div className="p-3 border-b border-slate-200 dark:border-zinc-800/80 bg-slate-100/70 dark:bg-zinc-950/70 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase text-slate-800 dark:text-zinc-200 tracking-wider">
              Message History
            </span>
            <span className="text-slate-300 dark:text-zinc-700">/</span>
            <span className="text-[11px] font-mono text-slate-500 dark:text-zinc-400">
              {messages.length} messages
            </span>
          </div>

          {/* Quick inline message composer with Glitch-Free Target Chips */}
          <form onSubmit={handleQuickSend} className="flex flex-wrap items-center gap-2 flex-1 max-w-2xl min-w-[280px]">
            {/* Target Team Chips (Replaces native <select> to prevent Chromium white-on-white popover glitch) */}
            <div className="flex items-center gap-1 border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-0.5">
              <span className="text-[11px] text-slate-500 dark:text-zinc-400 font-mono px-1.5">To:</span>
              {availableTargets.map((t) => {
                const isSelected = quickTarget === t;
                const status = radios[t];
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setQuickTarget(t)}
                    className={`px-2 py-0.5 text-xs font-mono border cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-slate-900 text-white dark:bg-zinc-800 dark:text-zinc-100 font-semibold border-slate-900 dark:border-zinc-600'
                        : 'bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 border-transparent hover:bg-slate-100 dark:hover:bg-zinc-800'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 inline-block mr-1 ${
                        status === 'ONLINE' ? 'bg-emerald-500' : status === 'DEGRADED' ? 'bg-amber-500' : 'bg-rose-500'
                      }`}
                    />
                    {t === 'HQ' ? 'HQ' : `Team ${t}`}
                  </button>
                );
              })}
            </div>

            <input
              type="text"
              placeholder="Type operational dispatch..."
              value={quickMessage}
              onChange={(e) => setQuickMessage(e.target.value)}
              className="flex-1 px-3 py-1 text-xs bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 rounded-none text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-slate-600 dark:focus:border-zinc-500"
            />
            <button
              type="submit"
              className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium border border-slate-300 dark:border-zinc-700 bg-slate-900 dark:bg-zinc-800 text-white dark:text-zinc-100 hover:bg-slate-800 dark:hover:bg-zinc-700 cursor-pointer rounded-none shrink-0"
            >
              <Send className="w-3 h-3 text-emerald-400" />
              <span>Send</span>
            </button>
          </form>
        </div>

        {/* Messages table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse font-mono">
            <thead>
              <tr className="border-b border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 text-[11px] bg-slate-50/80 dark:bg-zinc-950/50">
                <th className="py-2.5 px-3 font-semibold">Time</th>
                <th className="py-2.5 px-3 font-semibold">Route</th>
                <th className="py-2.5 px-3 font-semibold">Priority</th>
                <th className="py-2.5 px-3 font-semibold">Status</th>
                <th className="py-2.5 px-3 font-semibold">Delay</th>
                <th className="py-2.5 px-3 font-semibold">Quality</th>
                <th className="py-2.5 px-3 font-semibold font-sans">Message Content</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-900/60">
              {messages.map((msg) => {
                const isDelivered = msg.status === 'delivered';
                return (
                  <tr
                    key={msg.id}
                    className="hover:bg-slate-50 dark:hover:bg-zinc-900/30 transition-colors"
                  >
                    <td className="py-2.5 px-3 text-slate-500 dark:text-zinc-400 tabular-nums whitespace-nowrap">
                      {msg.timestamp}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-zinc-200 whitespace-nowrap">
                      {msg.sender} → {msg.receiver}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span
                        className={`text-[10px] font-semibold px-1.5 py-0.5 border ${
                          msg.priority === 'URGENT'
                            ? 'border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-400'
                            : msg.priority === 'HIGH'
                            ? 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-400'
                            : 'border-slate-200 bg-slate-100 text-slate-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
                        }`}
                      >
                        {msg.priority}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`w-1.5 h-1.5 ${
                            isDelivered ? 'bg-emerald-500' : 'bg-rose-500'
                          }`}
                        />
                        <span
                          className={`text-[11px] ${
                            isDelivered ? 'text-slate-800 dark:text-zinc-300' : 'text-rose-700 dark:text-rose-400 font-semibold'
                          }`}
                        >
                          {isDelivered ? 'Delivered' : 'Undelivered'}
                        </span>
                        {msg.isFake && (
                          <span className="text-[10px] px-1 py-0.2 border border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300 ml-1">
                            Flagged
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-slate-800 dark:text-zinc-300 tabular-nums whitespace-nowrap">
                      {isDelivered ? `+${msg.delaySeconds.toFixed(1)}s` : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-slate-800 dark:text-zinc-300 tabular-nums whitespace-nowrap">
                      {isDelivered ? `${msg.freshnessPercent}%` : '0%'}
                    </td>
                    <td className="py-2.5 px-3 font-sans text-slate-900 dark:text-zinc-200 text-xs max-w-lg leading-relaxed">
                      {msg.content}
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
