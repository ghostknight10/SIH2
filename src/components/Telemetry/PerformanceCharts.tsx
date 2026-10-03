import React, { useState } from 'react';
import { useTacticalStore } from '@/store/tacticalStore';
import type { TeamId } from '@/services/types';

interface PerformanceChartsProps {
  compact?: boolean;
  className?: string;
  onExpand?: () => void;
}

type TelemetryViewMode = 'overlay' | 'teams' | 'latency' | 'reliability';

export const PerformanceCharts: React.FC<PerformanceChartsProps> = ({
  compact = false,
  className = '',
  onExpand,
}) => {
  const {
    avgNetworkLatencyMs,
    globalReliability,
    dataFreshnessIndex,
    latencyHistory,
    reliabilityHistory,
    freshnessHistory,
    timeRange,
    setTimeRange,
    radios,
    nodeDiagnostics,
    selectedNodeId,
    setSelectedNodeId,
    cycleRadioStatus,
  } = useTacticalStore();

  const [viewMode, setViewMode] = useState<TelemetryViewMode>('overlay');
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  // Precision telemetry trace colors
  const TEAM_COLORS: Record<TeamId, { stroke: string; label: string; tag: string }> = {
    HQ: {
      stroke: '#0284c7', // Deep Sky Blue
      label: 'Headquarters',
      tag: 'HQ',
    },
    ALPHA: {
      stroke: '#059669', // Emerald
      label: 'Team Alpha',
      tag: 'ALP',
    },
    BRAVO: {
      stroke: '#d97706', // Amber
      label: 'Team Bravo',
      tag: 'BRV',
    },
    CHARLIE: {
      stroke: '#dc2626', // Crimson
      label: 'Team Charlie',
      tag: 'CHA',
    },
  };

  const teams: TeamId[] = ['HQ', 'ALPHA', 'BRAVO', 'CHARLIE'];

  // Calculate per-team synthetic history traces matching their live latencies and state
  const totalPoints = Math.max(latencyHistory.length, 10);
  const teamTraces: Record<TeamId, number[]> = {
    HQ: latencyHistory.map((v, i) => Math.max(10, Math.round(v * 0.32 + Math.sin(i) * 2))),
    ALPHA: latencyHistory.map((v, i) => Math.max(16, Math.round(v * 0.54 + Math.cos(i) * 3))),
    BRAVO: latencyHistory.map((v, i) => {
      const isDeg = radios.BRAVO === 'DEGRADED';
      const isCut = radios.BRAVO === 'CUT';
      const base = isCut ? 240 : isDeg ? 110 : v * 0.85;
      return Math.max(22, Math.round(base + Math.sin(i * 1.5) * 4));
    }),
    CHARLIE: latencyHistory.map((_, i) => {
      const isDeg = radios.CHARLIE === 'DEGRADED';
      const isCut = radios.CHARLIE === 'CUT';
      const base = isCut ? 280 : isDeg ? 182 : 45;
      return Math.max(30, Math.round(base + (i % 2 === 0 ? 8 : -6)));
    }),
  };

  // Chart dimensions
  const width = 680;
  const height = compact ? 230 : 270;
  const padding = { top: 25, right: 45, bottom: 35, left: 45 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  // Latency Y-scale: 0 to 200ms
  const maxLat = Math.max(120, ...latencyHistory, ...teamTraces.CHARLIE);
  const yLatMax = Math.ceil(maxLat / 40) * 40;

  const getX = (idx: number, len: number) => {
    if (len <= 1) return padding.left;
    return padding.left + (idx / (len - 1)) * chartW;
  };

  const getYLat = (val: number) => {
    const clamped = Math.max(0, Math.min(yLatMax, val));
    return padding.top + chartH - (clamped / yLatMax) * chartH;
  };

  const getYRel = (pct: number) => {
    const clamped = Math.max(0, Math.min(100, pct));
    return padding.top + chartH - (clamped / 100) * chartH;
  };

  // Generate paths
  const latPoints = latencyHistory.map((v, i) => `${getX(i, latencyHistory.length)},${getYLat(v)}`).join(' ');
  const relPoints = reliabilityHistory.map((v, i) => `${getX(i, reliabilityHistory.length)},${getYRel(v)}`).join(' ');

  // Latency area polygon
  const latArea = latencyHistory.length > 0
    ? `${getX(0, latencyHistory.length)},${padding.top + chartH} ${latPoints} ${getX(
        latencyHistory.length - 1,
        latencyHistory.length
      )},${padding.top + chartH}`
    : '';

  // Active hover scrub values
  const activeIdx = hoverIndex !== null ? hoverIndex : latencyHistory.length - 1;
  const scrubLatency = latencyHistory[activeIdx] ?? avgNetworkLatencyMs;
  const scrubReliability = reliabilityHistory[activeIdx] ?? globalReliability;
  const scrubFreshness = freshnessHistory[activeIdx] ?? dataFreshnessIndex;

  // Delta relative to 20ms baseline
  const deltaMs = scrubLatency - 20;

  const severedTeams = teams.filter((t) => radios[t] === 'CUT');
  const degradedTeams = teams.filter((t) => radios[t] === 'DEGRADED');
  const decisionLagSec = (0.5 + (scrubLatency / 45)).toFixed(1);

  const handleSvgMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const svgX = (mouseX / rect.width) * width;
    const relX = Math.max(0, Math.min(chartW, svgX - padding.left));
    const idx = Math.round((relX / chartW) * (totalPoints - 1));
    setHoverIndex(idx);
  };

  return (
    <div
      className={`border border-slate-300 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 rounded-none flex flex-col font-sans select-none shadow-[0_1px_3px_rgba(0,0,0,0.06)] dark:shadow-none ${className}`}
    >
      {/* 1. Telemetry HUD Top Header (Datadog / Grafana style) */}
      <div className="px-3.5 py-2 border-b border-slate-200 dark:border-zinc-800/80 bg-slate-50/80 dark:bg-zinc-950/70 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-mono">
            <span className="w-2 h-2 bg-emerald-500 animate-pulse inline-block" />
            <span className="font-bold text-slate-900 dark:text-zinc-100 tracking-wider text-[11px] uppercase">
              Network Performance & SLA
            </span>
          </div>

          <span className="text-slate-300 dark:text-zinc-700 hidden sm:inline">|</span>

          {/* Live Scrubber Readout */}
          <div className="flex items-center gap-2 font-mono text-[11px]">
            <span className="text-slate-600 dark:text-zinc-400">RTT:</span>
            <span className="font-bold text-sky-700 dark:text-sky-400 tabular-nums">
              {scrubLatency}ms
            </span>
            <span
              className={`text-[10px] px-1 py-0.2 font-semibold ${
                deltaMs <= 5
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                  : deltaMs <= 25
                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                  : 'bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-300 dark:border-rose-800'
              }`}
            >
              {deltaMs > 0 ? `+${deltaMs}ms` : `${deltaMs}ms`}
            </span>

            <span className="text-slate-300 dark:text-zinc-700">·</span>
            <span className="text-slate-600 dark:text-zinc-400">DELIVERY:</span>
            <span className="font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
              {scrubReliability}%
            </span>

            <span className="text-slate-300 dark:text-zinc-700 hidden md:inline">·</span>
            <span className="text-slate-600 dark:text-zinc-400 hidden md:inline">FRESHNESS:</span>
            <span className="font-bold text-indigo-700 dark:text-indigo-400 tabular-nums hidden md:inline">
              {scrubFreshness}%
            </span>
          </div>
        </div>

        {/* View Mode Switcher (Segmented pill buttons) */}
        <div className="flex items-center gap-2">
          <div className="inline-flex border border-slate-300 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-0.5 text-[11px]">
            <button
              type="button"
              onClick={() => setViewMode('overlay')}
              className={`px-2 py-0.5 cursor-pointer font-medium transition-colors ${
                viewMode === 'overlay'
                  ? 'bg-slate-900 text-white dark:bg-zinc-800 dark:text-zinc-100 font-semibold'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
              }`}
            >
              Overview
            </button>
            <button
              type="button"
              onClick={() => setViewMode('teams')}
              className={`px-2 py-0.5 cursor-pointer font-medium transition-colors ${
                viewMode === 'teams'
                  ? 'bg-slate-900 text-white dark:bg-zinc-800 dark:text-zinc-100 font-semibold'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
              }`}
            >
              By Squad
            </button>
            <button
              type="button"
              onClick={() => setViewMode('latency')}
              className={`px-2 py-0.5 cursor-pointer font-medium transition-colors ${
                viewMode === 'latency'
                  ? 'bg-slate-900 text-white dark:bg-zinc-800 dark:text-zinc-100 font-semibold'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
              }`}
            >
              Latency Only
            </button>
          </div>

          {!compact && (
            <div className="hidden sm:inline-flex border border-slate-300 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-0.5 text-[11px] font-mono">
              {(['live', '15m', '1h'] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setTimeRange(r)}
                  className={`px-2 py-0.5 uppercase cursor-pointer ${
                    timeRange === r
                      ? 'bg-slate-900 text-white dark:bg-zinc-800 dark:text-zinc-100 font-semibold'
                      : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          )}

          {compact && onExpand && (
            <button
              type="button"
              onClick={onExpand}
              className="text-[11px] font-mono text-slate-700 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-zinc-100 underline cursor-pointer px-1"
            >
              Full view →
            </button>
          )}
        </div>
      </div>

      {/* 2. Interactive SVG Telemetry Trace Canvas */}
      <div className="relative flex-1 p-2 min-h-[175px] flex items-center justify-center bg-white dark:bg-zinc-900/20">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-full cursor-crosshair"
          preserveAspectRatio="none"
          onMouseMove={handleSvgMouseMove}
          onMouseLeave={() => setHoverIndex(null)}
        >
          <defs>
            <pattern id="telemetry-grid" width="30" height="20" patternUnits="userSpaceOnUse">
              <line x1="0" y1="20" x2="30" y2="20" stroke="currentColor" className="text-slate-100 dark:text-zinc-800/40" strokeWidth="0.5" />
              <line x1="30" y1="0" x2="30" y2="20" stroke="currentColor" className="text-slate-100 dark:text-zinc-800/40" strokeWidth="0.5" />
            </pattern>
          </defs>

          {/* Grid background */}
          <rect
            x={padding.left}
            y={padding.top}
            width={chartW}
            height={chartH}
            fill="url(#telemetry-grid)"
          />

          {/* Horizontal Major Threshold Gridlines */}
          {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
            const yPos = padding.top + chartH - pct * chartH;
            const latVal = Math.round(pct * yLatMax);
            const relVal = Math.round(pct * 100);

            return (
              <g key={i}>
                <line
                  x1={padding.left}
                  y1={yPos}
                  x2={width - padding.right}
                  y2={yPos}
                  stroke="currentColor"
                  className="text-slate-200 dark:text-zinc-800/80"
                  strokeWidth="0.75"
                  strokeDasharray={i === 0 ? 'none' : '4 3'}
                />
                {/* Left Y Axis: Latency ms */}
                {(viewMode === 'overlay' || viewMode === 'latency' || viewMode === 'teams') && (
                  <text
                    x={padding.left - 6}
                    y={yPos + 3.5}
                    textAnchor="end"
                    className="text-[9.5px] font-mono fill-slate-500 dark:fill-zinc-500 font-medium"
                  >
                    {latVal}ms
                  </text>
                )}
                {/* Right Y Axis: Delivery % */}
                {(viewMode === 'overlay' || viewMode === 'reliability') && (
                  <text
                    x={width - padding.right + 6}
                    y={yPos + 3.5}
                    textAnchor="start"
                    className="text-[9.5px] font-mono fill-emerald-700 dark:fill-emerald-400 font-medium"
                  >
                    {relVal}%
                  </text>
                )}
              </g>
            );
          })}

          {/* 90% SLA Reference Line */}
          {(viewMode === 'overlay' || viewMode === 'reliability') && (
            <g>
              <line
                x1={padding.left}
                y1={getYRel(90)}
                x2={width - padding.right}
                y2={getYRel(90)}
                stroke="#059669"
                strokeWidth="1"
                strokeDasharray="2 4"
                opacity="0.7"
              />
              <text
                x={width - padding.right - 4}
                y={getYRel(90) - 3}
                textAnchor="end"
                className="text-[8.5px] font-mono fill-emerald-700 dark:fill-emerald-400 font-medium"
              >
                90% SLA TARGET
              </text>
            </g>
          )}

          {/* MODE: OVERLAY (Latency + Delivery) */}
          {viewMode === 'overlay' && (
            <>
              <polygon points={latArea} className="fill-sky-500/10 dark:fill-sky-400/10" />

              {/* Delivery Rate Trace (Green) */}
              <polyline
                points={relPoints}
                fill="none"
                stroke="#059669"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Latency Trace (Blue) */}
              <polyline
                points={latPoints}
                fill="none"
                stroke="#0284c7"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </>
          )}

          {/* MODE: LATENCY ONLY */}
          {viewMode === 'latency' && (
            <>
              <polygon points={latArea} className="fill-sky-500/10 dark:fill-sky-400/10" />
              <polyline
                points={latPoints}
                fill="none"
                stroke="#0284c7"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </>
          )}

          {/* MODE: RELIABILITY ONLY */}
          {viewMode === 'reliability' && (
            <polyline
              points={relPoints}
              fill="none"
              stroke="#059669"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* MODE: ALL CHANNELS COMPARATIVE TRACES */}
          {viewMode === 'teams' && (
            <>
              {teams.map((t) => {
                const trace = teamTraces[t];
                const tracePoints = trace.map((v, i) => `${getX(i, trace.length)},${getYLat(v)}`).join(' ');
                const isCut = radios[t] === 'CUT';

                return (
                  <g key={t}>
                    <polyline
                      points={tracePoints}
                      fill="none"
                      stroke={TEAM_COLORS[t].stroke}
                      strokeWidth={t === 'CHARLIE' && radios.CHARLIE === 'DEGRADED' ? '2.5' : '1.75'}
                      strokeDasharray={isCut ? '4 3' : 'none'}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </g>
                );
              })}
            </>
          )}

          {/* Hover Crosshair Scrubber Line */}
          {hoverIndex !== null && (
            <g>
              <line
                x1={getX(hoverIndex, totalPoints)}
                y1={padding.top}
                x2={getX(hoverIndex, totalPoints)}
                y2={padding.top + chartH}
                stroke="currentColor"
                className="text-slate-900 dark:text-zinc-100"
                strokeWidth="1.25"
                strokeDasharray="3 2"
              />

              {viewMode === 'overlay' && (
                <>
                  <circle
                    cx={getX(hoverIndex, totalPoints)}
                    cy={getYLat(latencyHistory[hoverIndex] ?? avgNetworkLatencyMs)}
                    r="4"
                    fill="#0284c7"
                    stroke="#ffffff"
                    strokeWidth="1.5"
                  />
                  <circle
                    cx={getX(hoverIndex, totalPoints)}
                    cy={getYRel(reliabilityHistory[hoverIndex] ?? globalReliability)}
                    r="4"
                    fill="#059669"
                    stroke="#ffffff"
                    strokeWidth="1.5"
                  />
                </>
              )}

              {viewMode === 'teams' && (
                <>
                  {teams.map((t) => (
                    <circle
                      key={t}
                      cx={getX(hoverIndex, totalPoints)}
                      cy={getYLat(teamTraces[t][hoverIndex] ?? 30)}
                      r="3.5"
                      fill={TEAM_COLORS[t].stroke}
                      stroke="#ffffff"
                      strokeWidth="1"
                    />
                  ))}
                </>
              )}
            </g>
          )}

          {/* X Axis Time Labels */}
          <text x={padding.left} y={height - 6} className="text-[9.5px] font-mono fill-slate-500 dark:fill-zinc-500 font-medium">
            -30s
          </text>
          <text x={padding.left + chartW / 2} y={height - 6} textAnchor="middle" className="text-[9.5px] font-mono fill-slate-500 dark:fill-zinc-500 font-medium">
            Rolling Window (30s)
          </text>
          <text x={width - padding.right} y={height - 6} textAnchor="end" className="text-[9.5px] font-mono fill-slate-500 dark:fill-zinc-500 font-medium">
            NOW
          </text>
        </svg>

        {/* Legend Overlay in Corner */}
        <div className="absolute bottom-3 left-4 flex items-center gap-3 text-[10px] font-mono bg-white/95 dark:bg-zinc-950/90 px-2.5 py-1 border border-slate-300 dark:border-zinc-800 shadow-sm">
          {viewMode === 'overlay' && (
            <>
              <span className="flex items-center gap-1.5 text-sky-800 dark:text-sky-400 font-semibold">
                <span className="w-2.5 h-1 bg-sky-600 inline-block" /> Ping (ms)
              </span>
              <span className="flex items-center gap-1.5 text-emerald-800 dark:text-emerald-400 font-semibold">
                <span className="w-2.5 h-1 bg-emerald-600 inline-block" /> Delivery (%)
              </span>
            </>
          )}
          {viewMode === 'teams' && (
            <>
              {teams.map((t) => (
                <span key={t} className="flex items-center gap-1 font-semibold" style={{ color: TEAM_COLORS[t].stroke }}>
                  <span className="w-2 h-1 inline-block" style={{ backgroundColor: TEAM_COLORS[t].stroke }} />
                  {TEAM_COLORS[t].tag}
                </span>
              ))}
            </>
          )}
        </div>
      </div>

      {compact ? (
        /* Compact Status Bar (Datadog NOC Pattern) */
        <div className="px-3.5 py-2 border-t border-slate-200 dark:border-zinc-800/80 bg-slate-50/70 dark:bg-zinc-950/50 flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
          <div className="flex items-center gap-3">
            {teams.map((t) => {
              const status = radios[t];
              const isCut = status === 'CUT';
              const isDeg = status === 'DEGRADED';
              const latency = isCut ? 'TIMEOUT' : `${nodeDiagnostics[t]?.latencyMs || 20}ms`;

              return (
                <div key={t} className="flex items-center gap-1.5">
                  <span
                    className={`w-1.5 h-1.5 inline-block ${
                      isCut ? 'bg-rose-500' : isDeg ? 'bg-amber-500' : 'bg-emerald-500'
                    }`}
                  />
                  <span className="font-semibold text-slate-700 dark:text-zinc-300">
                    {t}:
                  </span>
                  <span
                    className={`tabular-nums ${
                      isCut
                        ? 'text-rose-600 dark:text-rose-400 font-semibold'
                        : isDeg
                        ? 'text-amber-600 dark:text-amber-400 font-semibold'
                        : 'text-slate-600 dark:text-zinc-400'
                    }`}
                  >
                    {latency}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-zinc-400">
            <span>SLA Target: 90%</span>
            <span>·</span>
            <span>Freshness: {dataFreshnessIndex}%</span>
          </div>
        </div>
      ) : (
        /* Full Expanded View: Operational Impact Banner + Detailed Squad Cards */
        <>
          <div
            className={`px-3.5 py-1.5 border-t border-b text-[11px] font-mono flex items-center justify-between ${
              severedTeams.length > 0
                ? 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/60'
                : degradedTeams.length > 0
                ? 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/60'
                : 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-900/40'
            }`}
          >
            <div className="flex items-center gap-2">
              <span
                className={`w-1.5 h-1.5 inline-block ${
                  severedTeams.length > 0
                    ? 'bg-rose-500 animate-pulse'
                    : degradedTeams.length > 0
                    ? 'bg-amber-500'
                    : 'bg-emerald-500'
                }`}
              />
              <span className="font-semibold">
                {severedTeams.length > 0
                  ? `CRITICAL BOTTLENECK: Link Severed to ${severedTeams.map((t) => TEAM_COLORS[t].tag).join(', ')}`
                  : degradedTeams.length > 0
                  ? `DEGRADATION ALERT: High Jitter & Latency on ${degradedTeams.map((t) => TEAM_COLORS[t].tag).join(', ')}`
                  : 'SYSTEM NOMINAL: All 4 Squad Channels Synchronized'}
              </span>
              <span className="hidden sm:inline text-slate-400 dark:text-zinc-600">|</span>
              <span className="hidden sm:inline text-slate-700 dark:text-zinc-300">
                Causal Impact: Decision Lag +{decisionLagSec}s · Freshness {dataFreshnessIndex}%
              </span>
            </div>
            <span className="text-[10px] opacity-75 hidden md:inline">
              {severedTeams.length > 0 ? 'Operating on degraded tactical picture' : 'Nominal command loop'}
            </span>
          </div>

          <div className="px-3.5 py-2.5 bg-slate-100/60 dark:bg-zinc-950/50">
            <div className="flex items-center justify-between text-[11px] font-mono mb-2">
              <span className="font-semibold uppercase tracking-wider text-slate-700 dark:text-zinc-300 text-[10px]">
                Squad Channel Health & Tactical Telemetry
              </span>
              <span className="text-[10px] text-slate-500 dark:text-zinc-500">
                Click status pill to cycle link state · Click squad to inspect
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              {teams.map((team) => {
                const status = radios[team];
                const node = nodeDiagnostics[team];
                const isCut = status === 'CUT';
                const isDeg = status === 'DEGRADED';
                const isSelected = selectedNodeId === team;

                return (
                  <div
                    key={team}
                    onClick={() => setSelectedNodeId(isSelected ? null : team)}
                    className={`p-2 border transition-all cursor-pointer ${
                      isSelected
                        ? 'border-sky-500 bg-sky-50/50 dark:border-sky-500 dark:bg-sky-950/30'
                        : 'border-slate-300 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 hover:border-slate-400 dark:hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span
                          className="w-2 h-2 shrink-0"
                          style={{ backgroundColor: TEAM_COLORS[team].stroke }}
                        />
                        <span className="font-semibold text-slate-900 dark:text-zinc-100 text-xs truncate">
                          {TEAM_COLORS[team].label}
                        </span>
                      </div>

                      <button
                        type="button"
                        title="Click to cycle channel state"
                        onClick={(e) => {
                          e.stopPropagation();
                          cycleRadioStatus(team);
                        }}
                        className={`text-[9.5px] font-mono px-1.5 py-0.5 border font-semibold cursor-pointer uppercase transition-colors ${
                          isCut
                            ? 'border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-300 hover:bg-rose-100'
                            : isDeg
                            ? 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300 hover:bg-amber-100'
                            : 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 hover:bg-emerald-100'
                        }`}
                      >
                        {isCut ? 'Severed' : isDeg ? 'Degraded' : 'Online'}
                      </button>
                    </div>

                    <div className="text-[10px] text-slate-500 dark:text-zinc-400 truncate mb-2">
                      {node?.role || 'Tactical Unit'}
                    </div>

                    <div className="grid grid-cols-2 gap-1 text-[11px] font-mono pt-1.5 border-t border-slate-100 dark:border-zinc-800/80">
                      <div>
                        <span className="text-[9.5px] text-slate-400 dark:text-zinc-500 block uppercase">
                          Latency
                        </span>
                        <span
                          className={`font-semibold tabular-nums ${
                            isCut
                              ? 'text-rose-600 dark:text-rose-400'
                              : isDeg
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-slate-800 dark:text-zinc-200'
                          }`}
                        >
                          {isCut ? 'TIMEOUT' : `${node?.latencyMs || 20}ms`}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[9.5px] text-slate-400 dark:text-zinc-500 block uppercase">
                          Packet Loss
                        </span>
                        <span
                          className={`font-semibold tabular-nums ${
                            isCut
                              ? 'text-rose-600 dark:text-rose-400'
                              : (node?.packetLossPercent || 0) > 10
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-slate-800 dark:text-zinc-200'
                          }`}
                        >
                          {isCut ? '100%' : `${node?.packetLossPercent || 0}%`}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
