import React, { useState } from 'react';
import { Play, Pause, RotateCcw, AlertCircle, Radio, ShieldAlert } from 'lucide-react';
import { useTacticalStore } from '@/store/tacticalStore';
import type { TeamId, RadioStatus } from '@/services/types';

export const ControlScreen: React.FC = () => {
  const {
    missionClock,
    clockSeconds,
    isRunning,
    toggleClock,
    resetScenario,
    radios,
    setRadioStatus,
    injectConflictingIntel,
    logPlayerDecision,
    nodeDiagnostics,
    playerTeam,
    globalReliability,
    avgNetworkLatencyMs,
    dataFreshnessIndex,
  } = useTacticalStore();

  // Radio quick control team
  const [selectedRadioTeam, setSelectedRadioTeam] = useState<TeamId>('BRAVO');

  // Event injection state
  const [targetTeam, setTargetTeam] = useState<TeamId>('BRAVO');
  const [intelReport, setIntelReport] = useState(
    'Eastern corridor confirmed clear. Scout neutralized by friendly support.'
  );
  const [conflictProbability, setConflictProbability] = useState(75);
  const [decisionOrder, setDecisionOrder] = useState(
    'Advance vanguard forces into Eastern Corridor at maximum speed.'
  );

  const teams: TeamId[] = ['HQ', 'ALPHA', 'BRAVO', 'CHARLIE'];

  const presets = [
    {
      title: 'False Corridor Clearance',
      text: 'Eastern corridor confirmed clear. Scout neutralized by friendly support.',
    },
    {
      title: 'Fabricated Obstacle Warning',
      text: 'Hazard detected on road bearing 045 degrees. Immediate detour to Sector Alpha required.',
    },
    {
      title: 'Unverified Depot Status',
      text: 'Secondary supply depot Bravo-4 is fully operational and awaiting arrival.',
    },
  ];

  const handleInject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!intelReport.trim()) return;
    injectConflictingIntel(targetTeam, intelReport.trim(), conflictProbability);
  };

  const handleCommitDecision = (e: React.FormEvent) => {
    e.preventDefault();
    if (!decisionOrder.trim()) return;
    logPlayerDecision(decisionOrder.trim());
    setDecisionOrder('');
  };

  const activeRadioStatus = radios[selectedRadioTeam];

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="pb-3 border-b border-slate-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-slate-900 dark:text-zinc-100 tracking-tight">
              Instructor Control Panel
            </h2>
            <span className="text-[10px] font-mono px-1.5 py-0.5 border border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
              ADMIN ONLY
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
            Simulation controls, radio degradation toggles, and scenario event injection (per Backend specification).
          </p>
        </div>

        {/* Live Simulation KPIs */}
        <div className="flex items-center gap-2 text-xs font-mono">
          <div className="px-2.5 py-1 border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60">
            <span className="text-slate-500 dark:text-zinc-400">Reliability: </span>
            <span className="text-slate-800 dark:text-zinc-200 font-semibold tabular-nums">{globalReliability}%</span>
          </div>
          <div className="px-2.5 py-1 border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60">
            <span className="text-slate-500 dark:text-zinc-400">Ping: </span>
            <span className="text-slate-800 dark:text-zinc-200 font-semibold tabular-nums">{avgNetworkLatencyMs}ms</span>
          </div>
          <div className="px-2.5 py-1 border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60">
            <span className="text-slate-500 dark:text-zinc-400">Quality: </span>
            <span className="text-slate-800 dark:text-zinc-200 font-semibold tabular-nums">{dataFreshnessIndex}%</span>
          </div>
        </div>
      </div>

      {/* 1. Session Controls (README Section 3.1) */}
      <div className="border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 rounded-none p-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-zinc-800 mb-3">
          <span className="text-xs font-semibold uppercase text-slate-700 dark:text-zinc-300 tracking-wider">
            Session Controls
          </span>
          <span className="text-[11px] font-mono text-slate-500 dark:text-zinc-400">
            Elapsed: {clockSeconds}s ({Math.floor(clockSeconds / 60)}m {clockSeconds % 60}s)
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 font-mono text-sm tabular-nums text-slate-800 dark:text-zinc-100">
            <span className="text-slate-400 dark:text-zinc-500 text-xs">CLOCK:</span>
            <span className="font-semibold">{missionClock}</span>
          </div>

          <button
            type="button"
            onClick={toggleClock}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border cursor-pointer font-mono transition-colors rounded-none ${
              isRunning
                ? 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                : 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
            }`}
          >
            {isRunning ? (
              <>
                <Pause className="w-3.5 h-3.5" />
                <span>Pause Session</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" />
                <span>Resume Session</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={resetScenario}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-200 transition-colors cursor-pointer font-mono rounded-none"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-400" />
            <span>Reset to Baseline</span>
          </button>
        </div>
      </div>

      {/* 2. Radio Controls (README Section 3.2: Select Team -> Status -> Cut/Restore/Degrade) */}
      <div className="border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 rounded-none p-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-zinc-800 mb-3">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-slate-600 dark:text-zinc-400" />
            <span className="text-xs font-semibold uppercase text-slate-700 dark:text-zinc-300 tracking-wider">
              Radio Channel Controls
            </span>
          </div>
          <span className="text-[11px] font-mono text-slate-500 dark:text-zinc-400">
            4 Channels Managed
          </span>
        </div>

        {/* Focused Radio Controller as designed in README */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
          <div className="p-3 border border-slate-200 dark:border-zinc-800 bg-slate-50/60 dark:bg-zinc-950/60 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                Quick Radio Action
              </span>
              <span
                className={`text-[11px] font-mono px-2 py-0.5 border ${
                  activeRadioStatus === 'ONLINE'
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400'
                    : activeRadioStatus === 'DEGRADED'
                    ? 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-400'
                    : 'border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-400 font-semibold'
                }`}
              >
                Status: {activeRadioStatus === 'ONLINE' ? '🟢 ONLINE' : activeRadioStatus === 'DEGRADED' ? '🟡 SLOW' : '🔴 CUT'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-500 dark:text-zinc-400 whitespace-nowrap">
                Select Team:
              </label>
              <select
                value={selectedRadioTeam}
                onChange={(e) => setSelectedRadioTeam(e.target.value as TeamId)}
                className="flex-1 px-2.5 py-1 text-xs bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 rounded-none text-slate-800 dark:text-zinc-100 font-mono cursor-pointer focus:outline-none"
              >
                {teams.map((t) => (
                  <option key={t} value={t} className="bg-white text-slate-900 dark:bg-zinc-900 dark:text-zinc-100">
                    {t === 'HQ' ? 'HQ Command' : `Team ${t}`} ({radios[t]})
                  </option>
                ))}
              </select>
            </div>

            {/* Concise 3 actions for selected team */}
            <div className="grid grid-cols-3 gap-2 pt-1">
              <button
                type="button"
                onClick={() => setRadioStatus(selectedRadioTeam, 'ONLINE')}
                className={`py-1.5 text-xs font-medium border cursor-pointer rounded-none transition-colors ${
                  activeRadioStatus === 'ONLINE'
                    ? 'border-emerald-500 bg-emerald-600 text-white'
                    : 'border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800'
                }`}
              >
                Restore (Good)
              </button>
              <button
                type="button"
                onClick={() => setRadioStatus(selectedRadioTeam, 'DEGRADED')}
                className={`py-1.5 text-xs font-medium border cursor-pointer rounded-none transition-colors ${
                  activeRadioStatus === 'DEGRADED'
                    ? 'border-amber-500 bg-amber-500 text-white'
                    : 'border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800'
                }`}
              >
                Degrade (Slow)
              </button>
              <button
                type="button"
                onClick={() => setRadioStatus(selectedRadioTeam, 'CUT')}
                className={`py-1.5 text-xs font-medium border cursor-pointer rounded-none transition-colors ${
                  activeRadioStatus === 'CUT'
                    ? 'border-rose-500 bg-rose-600 text-white'
                    : 'border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800'
                }`}
              >
                Cut (Offline)
              </button>
            </div>
          </div>

          {/* Clean Channel Status Matrix using compact dropdowns */}
          <div className="p-3 border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 space-y-2">
            <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300 block mb-1">
              All Channel States
            </span>

            <div className="space-y-1.5">
              {teams.map((t) => {
                const s = radios[t];
                const node = nodeDiagnostics[t];
                return (
                  <div
                    key={t}
                    className="flex items-center justify-between p-1.5 border border-slate-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-950/40 text-xs font-mono"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-2 h-2 ${
                          s === 'ONLINE' ? 'bg-emerald-500' : s === 'DEGRADED' ? 'bg-amber-500' : 'bg-rose-500'
                        }`}
                      />
                      <span className="font-semibold text-slate-800 dark:text-zinc-200">
                        {t === 'HQ' ? 'HQ' : `Team ${t}`}
                      </span>
                      <span className="text-slate-400 text-[10px]">
                        ({node?.latencyMs || 22}ms)
                      </span>
                    </div>

                    {/* Single dropdown instead of 3 buttons */}
                    <select
                      value={s}
                      onChange={(e) => setRadioStatus(t, e.target.value as RadioStatus)}
                      className="px-2 py-0.5 text-xs bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 rounded-none cursor-pointer focus:outline-none"
                    >
                      <option value="ONLINE" className="bg-white text-slate-900 dark:bg-zinc-900 dark:text-zinc-100">Online</option>
                      <option value="DEGRADED" className="bg-white text-slate-900 dark:bg-zinc-900 dark:text-zinc-100">Degraded</option>
                      <option value="CUT" className="bg-white text-slate-900 dark:bg-zinc-900 dark:text-zinc-100">Cut</option>
                    </select>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Event Injection (Adversarial False Intel per README Section 3.3) */}
      <div className="border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 rounded-none p-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-zinc-800 mb-3">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-500" />
            <span className="text-xs font-semibold uppercase text-slate-800 dark:text-zinc-200 tracking-wider">
              Scenario Event Injection
            </span>
          </div>
          <span className="text-[11px] font-mono text-amber-600 dark:text-amber-400">DISINFORMATION TEST</span>
        </div>

        <form onSubmit={handleInject} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[11px] font-semibold uppercase text-slate-600 dark:text-zinc-400 tracking-wider block mb-1">
                Target Team
              </label>
              <select
                value={targetTeam}
                onChange={(e) => setTargetTeam(e.target.value as TeamId)}
                className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 rounded-none text-slate-800 dark:text-zinc-100 font-mono cursor-pointer focus:outline-none"
              >
                <option value="BRAVO" className="bg-white text-slate-900 dark:bg-zinc-900 dark:text-zinc-100">Team Bravo</option>
                <option value="ALPHA" className="bg-white text-slate-900 dark:bg-zinc-900 dark:text-zinc-100">Team Alpha</option>
                <option value="CHARLIE" className="bg-white text-slate-900 dark:bg-zinc-900 dark:text-zinc-100">Team Charlie</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-semibold uppercase text-slate-600 dark:text-zinc-400 tracking-wider block mb-1">
                Quick Scenario Preset
              </label>
              <select
                onChange={(e) => {
                  if (e.target.value) setIntelReport(e.target.value);
                }}
                className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 rounded-none text-slate-800 dark:text-zinc-100 cursor-pointer focus:outline-none"
              >
                <option value="" className="bg-white text-slate-900 dark:bg-zinc-900 dark:text-zinc-100">Choose preset scenario...</option>
                {presets.map((p) => (
                  <option key={p.title} value={p.text} className="bg-white text-slate-900 dark:bg-zinc-900 dark:text-zinc-100">
                    {p.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-semibold uppercase text-slate-600 dark:text-zinc-400 tracking-wider">
                  Conflict Weight
                </label>
                <span className="text-xs font-mono text-amber-600 dark:text-amber-400 font-medium tabular-nums">
                  {conflictProbability}% Conflict
                </span>
              </div>
              <input
                type="range"
                min="10"
                max="100"
                value={conflictProbability}
                onChange={(e) => setConflictProbability(Number(e.target.value))}
                className="w-full accent-amber-500 cursor-pointer"
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-semibold uppercase text-slate-600 dark:text-zinc-400 tracking-wider block mb-1">
              Injected Report Payload
            </label>
            <textarea
              rows={2}
              value={intelReport}
              onChange={(e) => setIntelReport(e.target.value)}
              className="w-full px-3 py-1.5 text-xs bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 rounded-none text-slate-800 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-slate-500 dark:focus:border-zinc-600 font-mono"
            />
          </div>

          <button
            type="submit"
            className="flex items-center justify-center gap-2 w-full py-2 text-xs font-medium border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40 rounded-none cursor-pointer transition-colors"
          >
            <AlertCircle className="w-3.5 h-3.5" />
            <span>Inject Report to {targetTeam === 'HQ' ? 'HQ' : `Team ${targetTeam}`}</span>
          </button>
        </form>
      </div>

      {/* 4. Log Operational Action (Causal Chain Verification) */}
      <div className="border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 rounded-none p-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-zinc-800 mb-3">
          <span className="text-xs font-semibold uppercase text-slate-800 dark:text-zinc-200 tracking-wider">
            Log Team Directive (Verify Causal Chain)
          </span>
          <span className="text-[11px] font-mono text-slate-500 dark:text-zinc-400">
            Active Team: {playerTeam}
          </span>
        </div>

        <form onSubmit={handleCommitDecision} className="flex gap-2">
          <input
            type="text"
            placeholder="Record team action or movement order based on current info..."
            value={decisionOrder}
            onChange={(e) => setDecisionOrder(e.target.value)}
            className="flex-1 px-3 py-1.5 text-xs bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 rounded-none text-slate-800 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-slate-500 dark:focus:border-zinc-600"
          />
          <button
            type="submit"
            className="px-4 py-1.5 text-xs font-medium border border-slate-300 dark:border-zinc-700 bg-slate-900 dark:bg-zinc-800 hover:bg-slate-800 dark:hover:bg-zinc-700 text-white dark:text-zinc-100 rounded-none cursor-pointer font-mono shrink-0"
          >
            Log Action
          </button>
        </form>
      </div>
    </div>
  );
};
