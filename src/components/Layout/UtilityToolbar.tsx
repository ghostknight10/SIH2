import React from 'react';
import { 
  ReloadIcon, 
  DownloadIcon, 
  MagnifyingGlassIcon,
  ChevronDownIcon
} from '@radix-ui/react-icons';
import { useTacticalStore } from '@/store/tacticalStore';
import type { TimeRange } from '@/store/tacticalStore';

export const UtilityToolbar: React.FC = () => {
  const {
    timeRange,
    setTimeRange,
    autoRefresh,
    toggleAutoRefresh,
    globalSearch,
    setGlobalSearch,
    nodeDiagnostics,
    messages,
    aarTimeline,
  } = useTacticalStore();

  const handleExportCSV = () => {
    // Generate tactical CSV bundle
    const rows = [
      ['SECTION', 'ID', 'TIMESTAMP', 'SOURCE', 'TARGET', 'STATUS_OR_METRIC', 'DETAILS'],
      // Nodes
      ...Object.values(nodeDiagnostics).map((n) => [
        'NODE',
        n.team,
        'CURRENT',
        n.team,
        'MESH',
        n.status,
        `Latency:${n.latencyMs}ms Loss:${n.packetLossPercent}% Temp:${n.hardwareTemp}C RSSI:${n.signalStrengthDbm}dBm`,
      ]),
      // Messages
      ...messages.map((m) => [
        'DISPATCH',
        m.id,
        m.timestamp,
        m.sender,
        m.receiver,
        m.status,
        `Priority:${m.priority} Delay:${m.delaySeconds}s Freshness:${m.freshnessPercent}% Content:"${m.content.replace(/"/g, '""')}"`,
      ]),
      // Timeline
      ...aarTimeline.map((t) => [
        'TIMELINE',
        t.id,
        t.timestamp,
        t.category,
        t.statusBadge || 'N/A',
        t.infoQualityPercent ? `${t.infoQualityPercent}%` : 'N/A',
        `Title:"${t.title.replace(/"/g, '""')}" Detail:"${t.detail.replace(/"/g, '""')}"`,
      ]),
    ];

    const csvContent =
      rows.map((e) => e.map((val) => `"${val}"`).join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `PS248_TELEMETRY_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full border-b border-zinc-800 bg-[#0c0c0e] rounded-none text-xs font-mono">
      <div className="max-w-7xl mx-auto px-4 py-2 flex flex-wrap items-center justify-between gap-3">
        {/* Left: Quick Search Bar */}
        <div className="flex items-center space-x-2 flex-1 max-w-sm min-w-[200px]">
          <div className="relative w-full">
            <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-zinc-500">
              <MagnifyingGlassIcon className="w-3.5 h-3.5" />
            </span>
            <input
              type="text"
              placeholder="SEARCH TELEMETRY / NODES / LOGS..."
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 pl-8 pr-2.5 py-1 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-hidden focus:border-zinc-500 rounded-none transition-none"
            />
          </div>
        </div>

        {/* Right: Controls & Actions */}
        <div className="flex items-center space-x-2">
          {/* Time Range Selector */}
          <div className="relative inline-flex items-center">
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as TimeRange)}
              className="appearance-none bg-zinc-950 border border-zinc-800 pl-2.5 pr-7 py-1 text-xs text-zinc-300 font-mono rounded-none focus:outline-hidden focus:border-zinc-500 cursor-pointer transition-none hover:border-zinc-700"
            >
              <option value="live" className="bg-white text-slate-900 dark:bg-zinc-950 dark:text-zinc-200">Live (Realtime)</option>
              <option value="15m" className="bg-white text-slate-900 dark:bg-zinc-950 dark:text-zinc-200">Last 15 mins</option>
              <option value="1h" className="bg-white text-slate-900 dark:bg-zinc-950 dark:text-zinc-200">Last 1 hour</option>
            </select>
            <ChevronDownIcon className="w-3.5 h-3.5 text-zinc-500 absolute right-2 pointer-events-none" />
          </div>

          {/* Auto Refresh Toggle */}
          <button
            type="button"
            onClick={toggleAutoRefresh}
            className={`flex items-center space-x-1.5 px-2.5 py-1 border rounded-none transition-none cursor-pointer ${
              autoRefresh
                ? 'bg-zinc-900 border-zinc-700 text-zinc-200 hover:bg-zinc-100 hover:text-zinc-950'
                : 'bg-zinc-950 border-zinc-800 text-zinc-500 hover:bg-zinc-900 hover:text-zinc-300'
            }`}
            title={autoRefresh ? 'Auto-refresh active (Click to pause)' : 'Auto-refresh paused (Click to resume)'}
          >
            <ReloadIcon
              className={`w-3 h-3 ${autoRefresh ? 'animate-spin' : ''}`}
              style={{ animationDuration: '3s' }}
            />
            <span className="text-[11px] uppercase tracking-wider font-mono">
              {autoRefresh ? 'AUTO: ON' : 'AUTO: OFF'}
            </span>
          </button>

          {/* Export CSV Button */}
          <button
            type="button"
            onClick={handleExportCSV}
            className="flex items-center space-x-1.5 px-2.5 py-1 bg-zinc-900 border border-zinc-800 text-zinc-300 hover:bg-zinc-100 hover:text-zinc-950 rounded-none transition-none cursor-pointer font-mono"
            title="Export Telemetry Log as CSV"
          >
            <DownloadIcon className="w-3 h-3" />
            <span className="text-[11px] uppercase tracking-wider">
              EXPORT CSV
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
