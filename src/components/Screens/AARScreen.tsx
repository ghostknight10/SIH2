import React from 'react';
import { useTacticalStore } from '@/store/tacticalStore';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import type { TeamId } from '@/services/types';

interface LinkReliability {
  link: string;
  deliveryRate: string;
  avgDelay: string;
  dropped: number;
  status: 'ONLINE' | 'DEGRADED' | 'CUT';
}

export const AARScreen: React.FC = () => {
  const {
    sessionName,
    clockSeconds,
    totalTransmissions,
    droppedCount,
    globalReliability,
    dataFreshnessIndex,
    radios,
    aarTimeline,
    messages,
  } = useTacticalStore();

  const minutes = Math.floor(clockSeconds / 60);
  const seconds = clockSeconds % 60;
  const durationStr = `${minutes}m ${seconds.toString().padStart(2, '0')}s`;

  // Compute Link Reliability Breakdown
  const pairs: [TeamId, TeamId][] = [
    ['HQ', 'ALPHA'],
    ['HQ', 'BRAVO'],
    ['HQ', 'CHARLIE'],
    ['ALPHA', 'BRAVO'],
    ['BRAVO', 'CHARLIE'],
  ];

  const reliabilityData: LinkReliability[] = pairs.map(([from, to]) => {
    const s1 = radios[from];
    const s2 = radios[to];
    const isCut = s1 === 'CUT' || s2 === 'CUT';
    const isDeg = s1 === 'DEGRADED' || s2 === 'DEGRADED';
    const droppedOnLink = messages.filter(
      (m) =>
        m.status === 'dropped' &&
        ((m.sender === from && m.receiver === to) || (m.sender === to && m.receiver === from))
    ).length;
    const baseDropped = isCut ? 2 : (from === 'CHARLIE' || to === 'CHARLIE') ? 1 : 0;

    return {
      link: `${from} ↔ ${to}`,
      deliveryRate: isCut ? '0.0%' : isDeg ? '71.6%' : '98.4%',
      avgDelay: isCut ? 'TIMEOUT' : isDeg ? '184ms' : '22ms',
      dropped: droppedOnLink + baseDropped,
      status: isCut ? 'CUT' : isDeg ? 'DEGRADED' : 'ONLINE',
    };
  });

  const bottlenecks = [
    {
      title: 'Bravo Channel Connection Delay',
      severity: 'High Impact',
      issues: [
        'Packet loss caused transmission delivery rate to fall to 41%.',
        'Average message delay increased by +8.2s, slowing team coordination.',
        'Lack of verification left the team vulnerable to contradictory reports.',
      ],
    },
    {
      title: 'Charlie Support Channel Congestion',
      severity: 'Medium Impact',
      issues: [
        'Intermittent packet loss of 26.2% on backup link.',
        'Delayed updates resulted in a 4-minute decision lag for HQ commanders.',
      ],
    },
    {
      title: 'Action Taken on Unverified Information',
      severity: 'Procedural Issue',
      issues: [
        'Unverified update received stating corridor was clear.',
        'Because link was degraded, the team could not confirm with forward units.',
        'Action was initiated while data quality had dropped to 42%.',
      ],
    },
  ];

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="pb-3 border-b border-slate-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-zinc-100 tracking-tight">
            Session Summary & Performance Review
          </h2>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
            Event chronology, link reliability breakdown, and post-session observations for {sessionName}.
          </p>
        </div>

        <div className="text-xs font-mono text-slate-500 dark:text-zinc-400">
          STATUS: <span className="text-emerald-600 dark:text-emerald-400 font-semibold">REPORT READY</span>
        </div>
      </div>

      {/* 1. Session Summary KPIs Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0 divide-slate-200 dark:divide-zinc-800/60 border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 rounded-none">
        <div className="p-4">
          <div className="text-[11px] font-semibold uppercase text-slate-500 dark:text-zinc-400 tracking-wider mb-1">
            Session Duration
          </div>
          <div className="text-2xl font-mono tabular-nums text-slate-900 dark:text-zinc-100">
            {durationStr}
          </div>
          <div className="text-[11px] font-mono text-slate-500 dark:text-zinc-400 mt-1">
            {clockSeconds}s elapsed time
          </div>
        </div>

        <div className="p-4">
          <div className="text-[11px] font-semibold uppercase text-slate-500 dark:text-zinc-400 tracking-wider mb-1">
            Messages Handled
          </div>
          <div className="text-2xl font-mono tabular-nums text-slate-900 dark:text-zinc-100">
            {totalTransmissions}
          </div>
          <div className="text-[11px] font-mono text-slate-500 dark:text-zinc-400 mt-1">
            {droppedCount} undelivered
          </div>
        </div>

        <div className="p-4">
          <div className="text-[11px] font-semibold uppercase text-slate-500 dark:text-zinc-400 tracking-wider mb-1">
            Final Reliability
          </div>
          <div className="text-2xl font-mono tabular-nums text-slate-900 dark:text-zinc-100">
            {globalReliability}%
          </div>
          <div className="text-[11px] font-mono text-slate-500 dark:text-zinc-400 mt-1">
            {globalReliability >= 90 ? 'Healthy Network' : 'Degraded Channels'}
          </div>
        </div>

        <div className="p-4">
          <div className="text-[11px] font-semibold uppercase text-slate-500 dark:text-zinc-400 tracking-wider mb-1">
            Quality Impact
          </div>
          <div className="text-2xl font-mono tabular-nums text-rose-600 dark:text-rose-400">
            -{Math.max(0, 100 - dataFreshnessIndex)}%
          </div>
          <div className="text-[11px] font-mono text-slate-500 dark:text-zinc-400 mt-1">
            {dataFreshnessIndex < 60 ? 'Impacted by test simulation' : 'Normal quality'}
          </div>
        </div>
      </div>

      {/* 2. Communication Reliability Table */}
      <div className="border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 rounded-none overflow-hidden">
        <div className="p-3 border-b border-slate-200 dark:border-zinc-800/80 bg-slate-50/70 dark:bg-zinc-950/60 flex items-center justify-between text-xs">
          <span className="font-semibold uppercase text-slate-700 dark:text-zinc-300 text-[11px] tracking-wider">
            Channel Reliability Summary
          </span>
          <span className="font-mono text-slate-500 dark:text-zinc-400 text-[11px]">
            5 Channel Links
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse font-mono">
            <thead>
              <tr className="border-b border-slate-200 dark:border-zinc-800 text-slate-500 dark:text-zinc-400 text-[11px] bg-slate-50/50 dark:bg-zinc-950/40">
                <th className="py-2.5 px-3 font-semibold">Channel</th>
                <th className="py-2.5 px-3 font-semibold">Status</th>
                <th className="py-2.5 px-3 font-semibold text-right">Delivery Rate</th>
                <th className="py-2.5 px-3 font-semibold text-right">Avg Response</th>
                <th className="py-2.5 px-3 font-semibold text-right">Dropped</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-900/60">
              {reliabilityData.map((row) => (
                <tr key={row.link} className="hover:bg-slate-50 dark:hover:bg-zinc-900/25 transition-colors">
                  <td className="py-2 px-3 font-semibold text-slate-800 dark:text-zinc-200">
                    {row.link}
                  </td>
                  <td className="py-2 px-3">
                    <span
                      className={`text-[11px] px-1.5 py-0.5 border ${
                        row.status === 'ONLINE'
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400'
                          : row.status === 'DEGRADED'
                          ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-400'
                          : 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-400'
                      }`}
                    >
                      {row.status === 'ONLINE' ? 'Good' : row.status === 'DEGRADED' ? 'Slow' : 'Offline'}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-right text-slate-700 dark:text-zinc-300 tabular-nums">
                    {row.deliveryRate}
                  </td>
                  <td className="py-2 px-3 text-right text-slate-700 dark:text-zinc-300 tabular-nums">
                    {row.avgDelay}
                  </td>
                  <td className="py-2 px-3 text-right text-slate-700 dark:text-zinc-300 tabular-nums">
                    {row.dropped}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. Event & Decision Timeline */}
      <div className="border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 rounded-none p-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-zinc-800 mb-4">
          <div>
            <span className="text-xs font-semibold uppercase text-slate-800 dark:text-zinc-200 tracking-wider">
              Chronological Event & Decision Timeline
            </span>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
              Sequence of channel status changes, reports, and directives executed during the session.
            </p>
          </div>
          <span className="text-[11px] font-mono text-slate-500 dark:text-zinc-400">
            {aarTimeline.length} events
          </span>
        </div>

        {/* Clean vertical line */}
        <div className="relative pl-6 border-l-2 border-slate-200 dark:border-zinc-800 ml-3 space-y-4 my-2">
          {aarTimeline.map((item) => {
            const isCritical = item.isCritical;
            return (
              <div key={item.id} className="relative">
                {/* Node dot on line */}
                <div
                  className={`absolute -left-[31px] top-2 w-2.5 h-2.5 rounded-none ${
                    isCritical
                      ? 'bg-rose-500'
                      : item.category === 'decision'
                      ? 'bg-amber-500'
                      : 'bg-slate-400 dark:bg-zinc-600'
                  }`}
                />

                <div
                  className={`p-3 border rounded-none ${
                    isCritical
                      ? 'border-rose-200 dark:border-rose-900/40 bg-rose-50/40 dark:bg-zinc-950/80'
                      : 'border-slate-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-950/60'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500 dark:text-zinc-400 font-mono tabular-nums text-[11px]">
                        [{item.timestamp}]
                      </span>
                      <span className="text-[10px] uppercase font-mono font-semibold px-1.5 py-0.5 border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 text-slate-700 dark:text-zinc-300">
                        {item.category}
                      </span>
                      <span className="font-semibold text-slate-900 dark:text-zinc-100 text-xs">
                        {item.title}
                      </span>
                    </div>

                    {item.statusBadge && (
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 border ${
                          isCritical
                            ? 'border-rose-300 text-rose-700 bg-rose-50 dark:border-rose-800 dark:text-rose-400 dark:bg-rose-950/40'
                            : 'border-slate-300 text-slate-700 bg-slate-50 dark:border-zinc-700 dark:text-zinc-300 dark:bg-zinc-900'
                        }`}
                      >
                        {item.statusBadge}
                      </span>
                    )}
                  </div>

                  <p className="mt-2 text-xs font-sans text-slate-700 dark:text-zinc-300 leading-relaxed">
                    {item.detail}
                  </p>

                  {item.infoQualityPercent !== undefined && (
                    <div className="mt-2 pt-2 border-t border-slate-100 dark:border-zinc-900 flex items-center gap-2 text-xs font-mono">
                      <span className="text-slate-500 dark:text-zinc-400 text-[11px]">
                        Data Quality:
                      </span>
                      <span className="tabular-nums font-semibold text-slate-800 dark:text-zinc-200">
                        {item.infoQualityPercent}%
                      </span>
                      {item.infoQualityPercent < 50 ? (
                        <span className="text-[10px] px-1.5 py-0.5 border border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-400">
                          Low Confidence
                        </span>
                      ) : (
                        <span className="text-[10px] px-1.5 py-0.5 border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-400">
                          Verified
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. Diagnostic Observations */}
      <div className="border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 rounded-none p-4 space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-slate-600 dark:text-zinc-400" />
            <span className="text-xs font-semibold uppercase text-slate-800 dark:text-zinc-200 tracking-wider">
              Diagnostic Observations & Bottlenecks
            </span>
          </div>
          <span className="text-[11px] font-mono text-slate-500 dark:text-zinc-400">SESSION REVIEW</span>
        </div>

        <div className="space-y-3">
          {bottlenecks.map((bn, idx) => (
            <div
              key={idx}
              className="p-3.5 border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-950/40 rounded-none"
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-semibold text-slate-900 dark:text-zinc-100 text-xs">
                  {bn.title}
                </span>
                <span className="text-[10px] font-mono text-slate-600 dark:text-zinc-400 border border-slate-200 dark:border-zinc-800 px-1.5 py-0.5 bg-white dark:bg-zinc-900">
                  {bn.severity}
                </span>
              </div>
              <ul className="text-xs text-slate-600 dark:text-zinc-300 space-y-1 ml-4 list-disc font-sans leading-relaxed">
                {bn.issues.map((issue, i) => (
                  <li key={i}>{issue}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Post-Mission Recommendation */}
        <div className="p-3 border border-slate-200 dark:border-zinc-800 bg-slate-50/60 dark:bg-zinc-950 rounded-none space-y-1">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase text-emerald-700 dark:text-emerald-400 tracking-wider">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Recommended Actions</span>
          </div>
          <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed font-sans">
            Set up secondary channel redundancy and establish standard verification procedures before committing actions when channel data quality drops below 60%.
          </p>
        </div>
      </div>
    </div>
  );
};
