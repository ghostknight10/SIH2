import React from 'react';
import { useTacticalStore } from '@/store/tacticalStore';

export const DecisionTimeline: React.FC = () => {
  const { aarTimeline, messages, sessionName, globalSearch } = useTacticalStore();

  const total = messages.length;
  const dropped = messages.filter((m) => m.status === 'dropped').length;
  const delivered = total - dropped;
  const reliability = total > 0 ? Math.round((delivered / total) * 100) : 100;

  const searchLower = globalSearch.trim().toLowerCase();
  const filteredTimeline = aarTimeline.filter((item) => {
    if (!searchLower) return true;
    return (
      item.title.toLowerCase().includes(searchLower) ||
      item.detail.toLowerCase().includes(searchLower) ||
      item.category.toLowerCase().includes(searchLower) ||
      (item.statusBadge || '').toLowerCase().includes(searchLower)
    );
  });

  return (
    <div className="max-w-7xl mx-auto px-4 py-3 space-y-3 font-mono text-xs">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
        <h2 className="text-[11px] uppercase font-semibold text-zinc-400 tracking-wider">
          CAUSAL DECISION CHAIN & FORENSIC AUDIT
        </h2>

        <div className="text-xs text-zinc-400 font-mono">
          EXERCISE: <span className="font-semibold text-zinc-200">{sessionName}</span>
        </div>
      </div>

      {/* Primary KPI Metrics Row (Hyper-dense p-3, zero rounded corners) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <div className="bg-[#0c0c0e] border border-zinc-800 rounded-none p-3">
          <div className="text-[10px] uppercase font-semibold text-zinc-500 tracking-wider">
            TRANSMISSIONS
          </div>
          <div className="text-xl font-mono font-semibold text-zinc-50 tracking-tight mt-1 tabular-nums">
            {total}
          </div>
          <div className="text-[10px] font-mono text-zinc-500 mt-0.5">Total Audit Packets</div>
        </div>

        <div className="bg-[#0c0c0e] border border-zinc-800 rounded-none p-3">
          <div className="text-[10px] uppercase font-semibold text-zinc-500 tracking-wider">
            RELIABILITY
          </div>
          <div className="text-xl font-mono font-semibold text-zinc-50 tracking-tight mt-1 tabular-nums">
            {reliability}%
          </div>
          <div className="text-[10px] font-mono text-zinc-500 mt-0.5">{dropped} Dropped Packets</div>
        </div>

        <div className="bg-[#0c0c0e] border border-zinc-800 rounded-none p-3">
          <div className="text-[10px] uppercase font-semibold text-zinc-500 tracking-wider">
            MAX INFO DECAY
          </div>
          <div className="text-xl font-mono font-semibold text-rose-400 tracking-tight mt-1 tabular-nums">
            -56%
          </div>
          <div className="text-[10px] font-mono text-zinc-500 mt-0.5">Post-EW Drop</div>
        </div>

        <div className="bg-[#0c0c0e] border border-zinc-800 rounded-none p-3">
          <div className="text-[10px] uppercase font-semibold text-zinc-500 tracking-wider">
            CRITICAL BOTTLENECK
          </div>
          <div className="text-xl font-mono font-semibold text-amber-400 tracking-tight mt-1">
            BRAVO NET
          </div>
          <div className="text-[10px] font-mono text-zinc-500 mt-0.5">EW Jamming / RF Fade</div>
        </div>
      </div>

      {/* Continuous Vertical Timeline Container */}
      <div className="bg-[#0c0c0e] border border-zinc-800 rounded-none p-3 space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
          <span className="text-[11px] uppercase font-mono font-semibold text-zinc-400 tracking-wider">
            CONTINUOUS VERTICAL TIMELINE AUDIT
          </span>
          <span className="text-[10px] font-mono text-zinc-500 tabular-nums">
            {filteredTimeline.length} MILESTONE NODES
          </span>
        </div>

        {/* Continuous border-l timeline with diamond milestone pips */}
        <div className="relative pl-6 border-l border-zinc-800 ml-4 space-y-3 my-2">
          {filteredTimeline.length === 0 ? (
            <div className="py-4 text-center text-zinc-600 font-mono text-[11px]">
              NO MILESTONES MATCH QUERY
            </div>
          ) : (
            filteredTimeline.map((item) => {
              const isCritical = item.isCritical;
              return (
                <div key={item.id} className="relative group">
                  {/* Rotated diamond pip sitting strictly on border-l line */}
                  <div
                    className={`absolute -left-[28.5px] top-3.5 w-2 h-2 bg-zinc-950 border rotate-45 rounded-none transition-none ${
                      isCritical
                        ? 'border-rose-500 bg-rose-950'
                        : item.category === 'decision'
                        ? 'border-amber-400 bg-amber-950'
                        : 'border-zinc-400 bg-zinc-900'
                    }`}
                  />

                {/* Milestone Content Box */}
                <div
                  className={`p-3 rounded-none border ${
                    isCritical
                      ? 'border-rose-900/60 bg-zinc-950'
                      : 'border-zinc-800/80 bg-zinc-950'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs">
                    <div className="flex items-center space-x-2">
                      <span className="text-zinc-500 tabular-nums font-mono">
                        [{item.timestamp}]
                      </span>
                      <span className="text-zinc-400 text-[10px] uppercase font-semibold border border-zinc-800 px-1 py-0.5 rounded-none bg-zinc-900">
                        {item.category}
                      </span>
                      <span className="font-semibold text-zinc-100 font-mono text-xs">
                        {item.title}
                      </span>
                    </div>

                    {item.statusBadge && (
                      <span
                        className={`text-[10px] font-mono px-1.5 py-0.5 border rounded-none ${
                          isCritical
                            ? 'border-rose-800 text-rose-400 bg-rose-950/40'
                            : 'border-zinc-700 text-zinc-300 bg-zinc-900'
                        }`}
                      >
                        {item.statusBadge}
                      </span>
                    )}
                  </div>

                  <p className="mt-2 text-xs font-sans text-zinc-400 leading-relaxed">
                    {item.detail}
                  </p>

                  {item.infoQualityPercent !== undefined && (
                    <div className="mt-2.5 pt-2 border-t border-zinc-800/80 flex items-center space-x-3 text-xs">
                      <span className="text-zinc-500 font-mono text-[11px]">
                        RESULTING FRESHNESS:
                      </span>
                      <span className="font-mono tabular-nums text-zinc-200 font-semibold">
                        {item.infoQualityPercent}%
                      </span>
                      {item.infoQualityPercent < 50 && (
                        <span className="text-rose-400 text-[10px] font-mono border border-rose-900 px-1 py-0.5 bg-rose-950/30 rounded-none">
                          DEGRADED CONFIDENCE
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
        </div>
      </div>

      {/* Forensic Diagnostic Takeaway */}
      <div className="bg-[#0c0c0e] border border-zinc-800 rounded-none p-3 space-y-1">
        <div className="text-[10px] uppercase font-semibold text-zinc-500 tracking-wider">
          FORENSIC DIAGNOSTIC TAKEAWAY
        </div>
        <p className="text-xs text-zinc-400 leading-relaxed font-sans">
          Link degradation on Bravo channel (+8.2s delay) prevented receipt of enemy position updates. When contradictory unverified reports were received, lack of secondary channel redundancy caused execution of tactical movement under 42% degraded situational awareness.
        </p>
      </div>
    </div>
  );
};
