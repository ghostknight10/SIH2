import React, { useState } from 'react';
import { Search, Download, Send } from 'lucide-react';
import { useTacticalStore } from '@/store/tacticalStore';
import { exportTelemetryCSV } from '@/services/csvExport';
import type { TeamId, MessagePriority, RadioStatus } from '@/services/types';

export const CommsScreen: React.FC = () => {
  const {
    radios,
    messages,
    sendMessage,
    globalSearch,
    setGlobalSearch,
    setRadioStatus,
  } = useTacticalStore();

  const [sender, setSender] = useState<TeamId>('ALPHA');
  const [receiver, setReceiver] = useState<TeamId>('BRAVO');
  const [priority, setPriority] = useState<MessagePriority>('NORMAL');
  const [content, setContent] = useState('');

  const teams: TeamId[] = ['HQ', 'ALPHA', 'BRAVO', 'CHARLIE'];

  const getTeamLabel = (t: TeamId): string => {
    if (t === 'HQ') return 'Headquarters';
    if (t === 'ALPHA') return 'Team Alpha';
    if (t === 'BRAVO') return 'Team Bravo';
    if (t === 'CHARLIE') return 'Team Charlie';
    return t;
  };

  const getLinkStatus = (from: TeamId, to: TeamId): { status: RadioStatus; latency: string } => {
    const s1 = radios[from];
    const s2 = radios[to];
    if (s1 === 'CUT' || s2 === 'CUT') return { status: 'CUT', latency: 'Timeout' };
    if (s1 === 'DEGRADED' || s2 === 'DEGRADED') return { status: 'DEGRADED', latency: '184ms' };
    return { status: 'ONLINE', latency: '22ms' };
  };

  const query = globalSearch.trim().toLowerCase();

  const filteredMessages = messages.filter((m) => {
    if (!query) return true;
    return (
      m.content.toLowerCase().includes(query) ||
      m.sender.toLowerCase().includes(query) ||
      m.receiver.toLowerCase().includes(query) ||
      m.priority.toLowerCase().includes(query) ||
      m.status.toLowerCase().includes(query)
    );
  });

  const handleSendDispatch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || sender === receiver) return;

    sendMessage({
      sender,
      receiver,
      content: content.trim(),
      priority,
      delaySeconds: priority === 'URGENT' ? 1.4 : 3.0,
      freshnessPercent: priority === 'URGENT' ? 96 : 88,
      confidencePercent: 92,
    });

    setContent('');
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* 1. Header Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-zinc-800">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-zinc-100 tracking-tight">
            Communications Matrix & Message History
          </h2>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
            Team-to-team channel quality grid and real-time message audit.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search messages..."
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 rounded-none text-slate-800 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-slate-500 dark:focus:border-zinc-600 w-44 sm:w-56 font-mono"
            />
          </div>

          <button
            type="button"
            onClick={exportTelemetryCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-none text-slate-800 dark:text-zinc-200 transition-colors cursor-pointer font-mono shrink-0"
            title="Download full telemetry dataset as CSV"
          >
            <Download className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-400" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* 2. 2D Communication Matrix Grid (as designed in Backend README lines 336-356) */}
      <div className="border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 rounded-none p-4">
        <div className="flex flex-wrap items-center justify-between pb-3 border-b border-slate-200 dark:border-zinc-800 gap-2 mb-3">
          <span className="font-semibold uppercase text-slate-700 dark:text-zinc-300 text-xs tracking-wider">
            Channel Matrix Heatmap (Row → Column)
          </span>

          {/* Matrix Legend from README */}
          <div className="flex items-center gap-3 text-[11px] font-mono">
            <span className="flex items-center gap-1 text-slate-600 dark:text-zinc-400">
              <span className="w-2 h-2 bg-emerald-500 inline-block" /> Healthy (98%)
            </span>
            <span className="flex items-center gap-1 text-slate-600 dark:text-zinc-400">
              <span className="w-2 h-2 bg-amber-500 inline-block" /> Degraded (71%)
            </span>
            <span className="flex items-center gap-1 text-slate-600 dark:text-zinc-400">
              <span className="w-2 h-2 bg-rose-500 inline-block" /> Cut (0%)
            </span>
          </div>
        </div>

        {/* 2D Heatmap Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-center text-xs border-collapse font-mono">
            <thead>
              <tr className="border-b border-slate-200 dark:border-zinc-800 text-slate-500 dark:text-zinc-400 text-[11px] bg-slate-50/50 dark:bg-zinc-950/40">
                <th className="py-2.5 px-3 text-left font-semibold">FROM \ TO</th>
                {teams.map((to) => (
                  <th key={to} className="py-2.5 px-3 font-semibold">
                    {to}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-900/60">
              {teams.map((from) => (
                <tr key={from} className="hover:bg-slate-50 dark:hover:bg-zinc-900/30 transition-colors">
                  <td className="py-2.5 px-3 text-left font-semibold text-slate-800 dark:text-zinc-200 font-sans">
                    {getTeamLabel(from)} ({from})
                  </td>
                  {teams.map((to) => {
                    if (from === to) {
                      return (
                        <td key={to} className="py-2.5 px-3 text-slate-300 dark:text-zinc-700">
                          —
                        </td>
                      );
                    }
                    const { status, latency } = getLinkStatus(from, to);
                    const isCut = status === 'CUT';
                    const isDegraded = status === 'DEGRADED';

                    return (
                      <td key={to} className="py-2.5 px-3">
                        <button
                          type="button"
                          onClick={() => {
                            const next = isCut ? 'ONLINE' : isDegraded ? 'CUT' : 'DEGRADED';
                            setRadioStatus(from, next);
                          }}
                          className={`inline-flex items-center justify-center gap-1.5 px-2 py-1 text-[11px] border cursor-pointer w-24 ${
                            isCut
                              ? 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-400'
                              : isDegraded
                              ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-400'
                              : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400'
                          }`}
                          title={`Click to cycle channel status (${from} -> ${to})`}
                        >
                          <span
                            className={`w-1.5 h-1.5 ${
                              isCut ? 'bg-rose-500' : isDegraded ? 'bg-amber-500' : 'bg-emerald-500'
                            }`}
                          />
                          <span>{latency}</span>
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. Send Message Form */}
      <div className="border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 rounded-none p-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-zinc-800 mb-3">
          <span className="text-xs font-semibold uppercase text-slate-800 dark:text-zinc-200 tracking-wider">
            Send Message
          </span>
          <span className="text-[11px] font-mono text-slate-500 dark:text-zinc-400">Direct Channel Dispatch</span>
        </div>

        <form onSubmit={handleSendDispatch} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[11px] font-semibold uppercase text-slate-600 dark:text-zinc-400 tracking-wider block mb-1">
                From
              </label>
              <select
                value={sender}
                onChange={(e) => {
                  const next = e.target.value as TeamId;
                  setSender(next);
                  if (receiver === next) {
                    const other = teams.find((t) => t !== next) || 'HQ';
                    setReceiver(other);
                  }
                }}
                className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 rounded-none text-slate-800 dark:text-zinc-100 font-mono cursor-pointer focus:outline-none"
              >
                {teams.map((t) => (
                  <option key={t} value={t} className="bg-white text-slate-900 dark:bg-zinc-900 dark:text-zinc-100">
                    {getTeamLabel(t)} ({radios[t] === 'ONLINE' ? 'Good' : radios[t] === 'DEGRADED' ? 'Slow' : 'Offline'})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] font-semibold uppercase text-slate-600 dark:text-zinc-400 tracking-wider block mb-1">
                To
              </label>
              <select
                value={receiver}
                onChange={(e) => setReceiver(e.target.value as TeamId)}
                className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 rounded-none text-slate-800 dark:text-zinc-100 font-mono cursor-pointer focus:outline-none"
              >
                {teams
                  .filter((t) => t !== sender)
                  .map((t) => (
                    <option key={t} value={t} className="bg-white text-slate-900 dark:bg-zinc-900 dark:text-zinc-100">
                      {getTeamLabel(t)} ({radios[t] === 'ONLINE' ? 'Good' : radios[t] === 'DEGRADED' ? 'Slow' : 'Offline'})
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] font-semibold uppercase text-slate-600 dark:text-zinc-400 tracking-wider block mb-1">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as MessagePriority)}
                className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 rounded-none text-slate-800 dark:text-zinc-100 font-mono cursor-pointer focus:outline-none"
              >
                <option value="NORMAL" className="bg-white text-slate-900 dark:bg-zinc-900 dark:text-zinc-100">Normal Priority</option>
                <option value="HIGH" className="bg-white text-slate-900 dark:bg-zinc-900 dark:text-zinc-100">High Priority</option>
                <option value="URGENT" className="bg-white text-slate-900 dark:bg-zinc-900 dark:text-zinc-100">Urgent Priority</option>
              </select>
            </div>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Enter message content..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="flex-1 px-3 py-1.5 text-xs bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 rounded-none text-slate-800 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-slate-500 dark:focus:border-zinc-600"
            />
            <button
              type="submit"
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium border border-slate-300 dark:border-zinc-700 bg-slate-900 dark:bg-zinc-800 text-white dark:text-zinc-100 hover:bg-slate-800 dark:hover:bg-zinc-700 rounded-none cursor-pointer shrink-0"
            >
              <Send className="w-3.5 h-3.5 text-emerald-400" />
              <span>Send</span>
            </button>
          </div>
        </form>
      </div>

      {/* 4. Message History Table */}
      <div className="border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 rounded-none overflow-hidden">
        <div className="p-3 border-b border-slate-200 dark:border-zinc-800/80 bg-slate-50/70 dark:bg-zinc-950/60 flex items-center justify-between text-xs">
          <span className="font-semibold uppercase text-slate-700 dark:text-zinc-300 text-[11px] tracking-wider">
            Message History Log
          </span>
          <span className="font-mono text-slate-500 dark:text-zinc-400 text-[11px]">
            {filteredMessages.length} messages
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse font-mono">
            <thead>
              <tr className="border-b border-slate-200 dark:border-zinc-800 text-slate-500 dark:text-zinc-400 text-[11px] bg-slate-50/50 dark:bg-zinc-950/40">
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
              {filteredMessages.map((msg) => {
                const isDelivered = msg.status === 'delivered';
                return (
                  <tr key={msg.id} className="hover:bg-slate-50 dark:hover:bg-zinc-900/25 transition-colors">
                    <td className="py-2 px-3 text-slate-500 dark:text-zinc-400 tabular-nums whitespace-nowrap">
                      {msg.timestamp}
                    </td>
                    <td className="py-2 px-3 font-semibold text-slate-800 dark:text-zinc-200 whitespace-nowrap">
                      {msg.sender} → {msg.receiver}
                    </td>
                    <td className="py-2 px-3 whitespace-nowrap">
                      <span
                        className={`text-[10px] font-semibold px-1.5 py-0.5 border ${
                          msg.priority === 'URGENT'
                            ? 'border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-400'
                            : msg.priority === 'HIGH'
                            ? 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-400'
                            : 'border-slate-200 bg-slate-100 text-slate-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
                        }`}
                      >
                        {msg.priority}
                      </span>
                    </td>
                    <td className="py-2 px-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`w-1.5 h-1.5 ${
                            isDelivered ? 'bg-emerald-500' : 'bg-rose-500'
                          }`}
                        />
                        <span
                          className={`text-[11px] ${
                            isDelivered ? 'text-slate-700 dark:text-zinc-300' : 'text-rose-600 dark:text-rose-400 font-semibold'
                          }`}
                        >
                          {isDelivered ? 'Delivered' : 'Undelivered'}
                        </span>
                      </div>
                    </td>
                    <td className="py-2 px-3 text-slate-700 dark:text-zinc-300 tabular-nums whitespace-nowrap">
                      {isDelivered ? `+${msg.delaySeconds.toFixed(1)}s` : '—'}
                    </td>
                    <td className="py-2 px-3 text-slate-700 dark:text-zinc-300 tabular-nums whitespace-nowrap">
                      {isDelivered ? `${msg.freshnessPercent}%` : '0%'}
                    </td>
                    <td className="py-2 px-3 font-sans text-slate-800 dark:text-zinc-200 text-xs max-w-md leading-relaxed">
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
