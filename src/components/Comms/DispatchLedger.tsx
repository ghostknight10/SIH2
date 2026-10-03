import React, { useState } from 'react';
import { MagnifyingGlassIcon, PlusIcon, Crosshair2Icon } from '@radix-ui/react-icons';
import { useTacticalStore } from '@/store/tacticalStore';
import type { TeamId, MessagePriority } from '@/services/types';

export const DispatchLedger: React.FC = () => {
  const {
    messages,
    sendMessage,
    logPlayerDecision,
    userRole,
    playerTeam,
    radios,
    globalSearch,
  } = useTacticalStore();

  const [targetTeam, setTargetTeam] = useState<TeamId>('BRAVO');
  const [priority, setPriority] = useState<MessagePriority>('NORMAL');
  const [content, setContent] = useState<string>('');
  const [isDecisionOrder, setIsDecisionOrder] = useState<boolean>(false);
  const [localSearch, setLocalSearch] = useState<string>('');

  const teams: TeamId[] = ['HQ', 'ALPHA', 'BRAVO', 'CHARLIE'];

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    if (isDecisionOrder) {
      logPlayerDecision(content);
      setContent('');
      setIsDecisionOrder(false);
      return;
    }

    const senderTeam = userRole === 'instructor' ? 'HQ' : playerTeam;

    sendMessage({
      sender: senderTeam,
      receiver: targetTeam,
      content,
      priority,
      delaySeconds: priority === 'URGENT' ? 1.6 : 3.2,
      freshnessPercent: priority === 'URGENT' ? 95 : 88,
      confidencePercent: 90,
    });

    setContent('');
  };

  const activeSearch = (globalSearch || localSearch).trim().toLowerCase();

  const filteredMessages = messages.filter((m) => {
    if (!activeSearch) return true;
    return (
      m.content.toLowerCase().includes(activeSearch) ||
      m.sender.toLowerCase().includes(activeSearch) ||
      m.receiver.toLowerCase().includes(activeSearch) ||
      m.priority.toLowerCase().includes(activeSearch)
    );
  });

  return (
    <div className="max-w-7xl mx-auto px-4 py-4 space-y-4 font-mono text-xs">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-800">
        <h2 className="text-[11px] uppercase font-semibold text-zinc-400 tracking-wider">
          TACTICAL TRANSMISSION AUDIT LEDGER
        </h2>

        {/* Minimal Search Input */}
        <div className="relative">
          <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-zinc-500">
            <MagnifyingGlassIcon className="w-3.5 h-3.5" />
          </span>
          <input
            type="text"
            placeholder="Filter ledger dispatches..."
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            className="bg-zinc-950 border border-zinc-800 rounded-none pl-8 pr-3 py-1 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-hidden focus:border-zinc-500 w-60 font-mono transition-none"
          />
        </div>
      </div>

      {/* Dispatch Creator */}
      <div className="bg-[#0c0c0e] border border-zinc-800 rounded-none p-3">
        <div className="flex items-center justify-between pb-2 border-b border-zinc-800 mb-3">
          <span className="text-[11px] uppercase font-semibold text-zinc-400 tracking-wider flex items-center space-x-1.5">
            {isDecisionOrder ? (
              <>
                <Crosshair2Icon className="w-3.5 h-3.5 text-amber-500" />
                <span>OPERATIONAL DECISION DIRECTIVE</span>
              </>
            ) : (
              <>
                <PlusIcon className="w-3.5 h-3.5 text-zinc-400" />
                <span>NEW RADIO TRANSMISSION DISPATCH</span>
              </>
            )}
          </span>
          <button
            type="button"
            onClick={() => setIsDecisionOrder(!isDecisionOrder)}
            className="text-xs text-zinc-400 hover:text-zinc-100 font-mono transition-none cursor-pointer border border-zinc-800 hover:border-zinc-600 px-2 py-0.5 rounded-none bg-zinc-950"
          >
            {isDecisionOrder ? '[SWITCH TO TRANSMISSION]' : '[SWITCH TO DECISION ORDER]'}
          </button>
        </div>

        <form onSubmit={handleSend} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div>
              <label className="block text-[10px] uppercase font-semibold text-zinc-500 tracking-wider mb-1">
                {isDecisionOrder ? 'ISSUING UNIT' : 'TARGET DESTINATION NODE'}
              </label>
              {isDecisionOrder ? (
                <div className="border border-zinc-800 bg-zinc-950 rounded-none px-2.5 py-1 text-xs text-zinc-200 font-mono">
                  {playerTeam} (Local Force)
                </div>
              ) : (
                <select
                  value={targetTeam}
                  onChange={(e) => setTargetTeam(e.target.value as TeamId)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-none px-2.5 py-1 text-xs text-zinc-200 font-mono focus:outline-hidden focus:border-zinc-500 cursor-pointer"
                >
                  {teams.map((t) => (
                    <option key={t} value={t} className="bg-white text-slate-900 dark:bg-zinc-950 dark:text-zinc-200">
                      {t} {radios[t] === 'CUT' ? '(SEVERED)' : radios[t] === 'DEGRADED' ? '(DEGRADED)' : '(ONLINE)'}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {!isDecisionOrder && (
              <div>
                <label className="block text-[10px] uppercase font-semibold text-zinc-500 tracking-wider mb-1">
                  DISPATCH PRIORITY
                </label>
                <div className="flex space-x-1">
                  {(['NORMAL', 'HIGH', 'URGENT'] as MessagePriority[]).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPriority(p)}
                      className={`flex-1 py-1 rounded-none text-xs font-mono transition-none cursor-pointer border ${
                        priority === p
                          ? 'border-zinc-500 bg-zinc-800 text-zinc-100 font-semibold'
                          : 'border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="sm:col-span-1 flex items-end">
              <button
                type="submit"
                className="w-full bg-zinc-100 text-zinc-950 hover:bg-zinc-300 text-xs font-mono font-semibold px-3 py-1.5 rounded-none transition-none cursor-pointer"
              >
                {isDecisionOrder ? 'COMMIT ORDER TO TIMELINE' : 'TRANSMIT PACKET'}
              </button>
            </div>
          </div>

          <div>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={
                isDecisionOrder
                  ? 'Operational directive payload (recorded in causal chain timeline)...'
                  : 'Transmit radio dispatch message...'
              }
              rows={2}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-none px-2.5 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-hidden focus:border-zinc-500 font-mono"
            />
          </div>
        </form>
      </div>

      {/* Dispatches Flat Table (Monochrome zebra-striping, border-collapse) */}
      <div className="border border-zinc-800 bg-[#0c0c0e] rounded-none overflow-x-auto">
        <table className="w-full text-left font-mono text-xs border-collapse">
          <thead>
            <tr className="text-zinc-500 text-[10px] border-b border-zinc-800 bg-zinc-950">
              <th className="py-2 px-2.5 font-semibold">TIME</th>
              <th className="py-2 px-2.5 font-semibold">ROUTE</th>
              <th className="py-2 px-2.5 font-semibold">PRIORITY</th>
              <th className="py-2 px-2.5 font-semibold">DELAY</th>
              <th className="py-2 px-2.5 font-semibold">FRESHNESS</th>
              <th className="py-2 px-2.5 font-semibold">STATUS</th>
              <th className="py-2 px-2.5 font-semibold font-sans">PAYLOAD</th>
            </tr>
          </thead>
          <tbody>
            {filteredMessages.map((m) => {
              const isDropped = m.status === 'dropped';
              const isUrgent = m.priority === 'URGENT';
              const isHigh = m.priority === 'HIGH';

              return (
                <tr
                  key={m.id}
                  className="border-b border-zinc-800 even:bg-zinc-900/20 hover:bg-zinc-800/40 transition-none"
                >
                  <td className="py-2.5 px-2.5 text-zinc-500 whitespace-nowrap tabular-nums">
                    [{m.timestamp}]
                  </td>
                  <td className="py-2.5 px-2.5 whitespace-nowrap text-zinc-200 font-semibold">
                    {m.sender} -&gt; {m.receiver}
                  </td>
                  <td className="py-2.5 px-2.5 whitespace-nowrap">
                    <span
                      className={`text-[11px] font-semibold ${
                        isUrgent ? 'text-rose-400' : isHigh ? 'text-amber-400' : 'text-zinc-400'
                      }`}
                    >
                      {m.priority}
                    </span>
                  </td>
                  <td className="py-2.5 px-2.5 whitespace-nowrap text-zinc-300 tabular-nums">
                    {isDropped ? '—' : `+${m.delaySeconds.toFixed(1)}s`}
                  </td>
                  <td className="py-2.5 px-2.5 whitespace-nowrap tabular-nums text-zinc-300">
                    {isDropped ? '0%' : `${m.freshnessPercent}%`}
                  </td>
                  <td className="py-2.5 px-2.5 whitespace-nowrap">
                    <div className="flex items-center space-x-1.5 font-mono">
                      <span
                        className={`w-1.5 h-1.5 rounded-none ${
                          isDropped ? 'bg-rose-500' : 'bg-emerald-500'
                        }`}
                      />
                      <span
                        className={`text-xs ${
                          isDropped ? 'text-rose-400 font-semibold' : 'text-zinc-300'
                        }`}
                      >
                        {isDropped ? 'DROPPED' : 'DELIVERED'}
                      </span>
                      {m.isFake && (
                        <span className="text-amber-400 text-[10px] font-mono border border-amber-900 bg-amber-950/40 px-1 py-0.5 ml-1">
                          SPOOFED
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-2.5 px-2.5 text-zinc-300 font-sans text-xs max-w-md leading-relaxed">
                    {m.content}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
