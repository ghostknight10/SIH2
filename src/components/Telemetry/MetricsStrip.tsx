import React from 'react';
import { useTacticalStore } from '@/store/tacticalStore';
import { Sparkline } from './Sparkline';

export const MetricsStrip: React.FC = () => {
  const {
    globalReliability,
    avgNetworkLatencyMs,
    dataFreshnessIndex,
    totalTransmissions,
    droppedCount,
    reliabilityHistory,
    latencyHistory,
    freshnessHistory,
    transmissionHistory,
    timeRange,
  } = useTacticalStore();

  const isRelNominal = globalReliability >= 90;
  const isLatNominal = avgNetworkLatencyMs < 80;
  const isFreshNominal = dataFreshnessIndex >= 70;

  return (
    <div className="w-full border-b border-zinc-800 bg-[#09090b] rounded-none">
      <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 divide-x divide-zinc-800">
        {/* 1. Global Reliability */}
        <div className="p-2.5 sm:p-3 flex items-center justify-between gap-3 rounded-none">
          <div className="space-y-0.5 min-w-0">
            <div className="flex items-center space-x-1.5">
              <span
                className={`w-1.5 h-1.5 rounded-none ${
                  isRelNominal ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
              />
              <span className="text-[10px] uppercase font-mono font-semibold text-zinc-400 tracking-wider">
                Reliability ({timeRange.toUpperCase()})
              </span>
            </div>
            <div className="flex items-baseline space-x-1.5">
              <span className="text-xl sm:text-2xl font-mono font-semibold text-zinc-100 tabular-nums tracking-tight">
                {globalReliability}%
              </span>
              <span className="text-[10px] font-mono text-zinc-500">
                {isRelNominal ? 'NOMINAL' : 'DEGRADED'}
              </span>
            </div>
          </div>
          <div className="shrink-0">
            <Sparkline
              data={reliabilityHistory}
              width={88}
              height={28}
              color={isRelNominal ? '#10b981' : '#f59e0b'}
            />
          </div>
        </div>

        {/* 2. Network Latency */}
        <div className="p-2.5 sm:p-3 flex items-center justify-between gap-3 rounded-none">
          <div className="space-y-0.5 min-w-0">
            <div className="flex items-center space-x-1.5">
              <span
                className={`w-1.5 h-1.5 rounded-none ${
                  isLatNominal ? 'bg-emerald-500' : 'bg-red-500'
                }`}
              />
              <span className="text-[10px] uppercase font-mono font-semibold text-zinc-400 tracking-wider">
                Avg Latency ({timeRange.toUpperCase()})
              </span>
            </div>
            <div className="flex items-baseline space-x-1">
              <span className="text-xl sm:text-2xl font-mono font-semibold text-zinc-100 tabular-nums tracking-tight">
                {avgNetworkLatencyMs}
              </span>
              <span className="text-xs font-mono text-zinc-500">ms</span>
              <span className="text-[10px] font-mono text-zinc-500 ml-1">
                ±2ms
              </span>
            </div>
          </div>
          <div className="shrink-0">
            <Sparkline
              data={latencyHistory}
              width={88}
              height={28}
              color={isLatNominal ? '#10b981' : '#ef4444'}
            />
          </div>
        </div>

        {/* 3. Data Freshness */}
        <div className="p-2.5 sm:p-3 flex items-center justify-between gap-3 rounded-none">
          <div className="space-y-0.5 min-w-0">
            <div className="flex items-center space-x-1.5">
              <span
                className={`w-1.5 h-1.5 rounded-none ${
                  isFreshNominal ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
              />
              <span className="text-[10px] uppercase font-mono font-semibold text-zinc-400 tracking-wider">
                Freshness ({timeRange.toUpperCase()})
              </span>
            </div>
            <div className="flex items-baseline space-x-1.5">
              <span className="text-xl sm:text-2xl font-mono font-semibold text-zinc-100 tabular-nums tracking-tight">
                {dataFreshnessIndex}%
              </span>
              <span className="text-[10px] font-mono text-zinc-500">
                DECAY 0.2%
              </span>
            </div>
          </div>
          <div className="shrink-0">
            <Sparkline
              data={freshnessHistory}
              width={88}
              height={28}
              color={isFreshNominal ? '#10b981' : '#f59e0b'}
            />
          </div>
        </div>

        {/* 4. Transmissions & Loss */}
        <div className="p-2.5 sm:p-3 flex items-center justify-between gap-3 rounded-none">
          <div className="space-y-0.5 min-w-0">
            <div className="flex items-center space-x-1.5">
              <span className="w-1.5 h-1.5 rounded-none bg-zinc-400" />
              <span className="text-[10px] uppercase font-mono font-semibold text-zinc-400 tracking-wider">
                Transmissions ({timeRange.toUpperCase()})
              </span>
            </div>
            <div className="flex items-baseline space-x-1.5">
              <span className="text-xl sm:text-2xl font-mono font-semibold text-zinc-100 tabular-nums tracking-tight">
                {totalTransmissions}
              </span>
              <span className="text-[10px] font-mono text-zinc-500">
                {droppedCount} DROPPED
              </span>
            </div>
          </div>
          <div className="shrink-0">
            <Sparkline
              data={transmissionHistory}
              width={88}
              height={28}
              color="#e4e4e7"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
