import React from 'react';
import { Activity, LineChart, MessageSquare, Sliders, FileText } from 'lucide-react';
import { useTacticalStore, type ActiveTab } from '@/store/tacticalStore';

interface NavItem {
  id: ActiveTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const Sidebar: React.FC = () => {
  const { activeTab, setActiveTab, radios } = useTacticalStore();

  const anySevered = Object.values(radios).some((s) => s === 'CUT');
  const anyDegraded = Object.values(radios).some((s) => s === 'DEGRADED');
  const onlineCount = Object.values(radios).filter((s) => s === 'ONLINE').length;

  const items: NavItem[] = [
    { id: 'live', label: 'Overview', icon: Activity },
    { id: 'map', label: 'Charts', icon: LineChart },
    { id: 'comms', label: 'Messages', icon: MessageSquare },
    { id: 'control', label: 'Controls', icon: Sliders },
    { id: 'aar', label: 'Reports', icon: FileText },
  ];

  return (
    <aside className="w-48 border-r border-slate-200 dark:border-zinc-800/60 bg-slate-50/60 dark:bg-zinc-950 flex flex-col justify-between shrink-0 select-none">
      {/* Navigation Links */}
      <div className="p-2 space-y-0.5">
        <div className="px-3 py-1.5 text-[10px] uppercase font-semibold text-slate-400 dark:text-zinc-500 tracking-wider">
          Navigation
        </div>
        <nav className="space-y-0.5">
          {items.map((item) => {
            const isActive = activeTab === item.id;
            const Icon = item.icon;

            return (
              <button
                key={item.id}
                id={`nav-${item.id}`}
                data-testid={`nav-${item.id}`}
                data-screen={item.id}
                aria-label={item.label}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2 text-xs transition-colors cursor-pointer text-left rounded-none ${
                  isActive
                    ? 'bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 font-semibold border-l-2 border-emerald-500'
                    : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200 hover:bg-slate-100/70 dark:hover:bg-zinc-900/40'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Icon
                    className={`w-3.5 h-3.5 shrink-0 ${
                      isActive
                        ? 'text-slate-900 dark:text-zinc-100'
                        : 'text-slate-400 dark:text-zinc-500'
                    }`}
                  />
                  <span className="truncate">{item.label}</span>
                </div>
                {item.id === 'live' && (
                  <span
                    className={`w-1.5 h-1.5 shrink-0 ${
                      anySevered ? 'bg-rose-500' : anyDegraded ? 'bg-amber-500' : 'bg-emerald-500'
                    }`}
                  />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Sidebar Footer Metadata */}
      <div className="p-3 border-t border-slate-200 dark:border-zinc-800/60 text-xs font-mono space-y-1.5 bg-white/50 dark:bg-zinc-950/60">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-slate-500 dark:text-zinc-500">Channels</span>
          <span className="text-slate-700 dark:text-zinc-300 tabular-nums">
            {onlineCount}/4 online
          </span>
        </div>
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-slate-500 dark:text-zinc-500">Status</span>
          <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-sans">
            <span className="w-1.5 h-1.5 bg-emerald-500" />
            Healthy
          </span>
        </div>
        <div className="pt-1 border-t border-slate-200/80 dark:border-zinc-900 text-[10px] text-slate-400 dark:text-zinc-500 flex items-center justify-between">
          <span>Telemetry Hub</span>
          <span>v2.4</span>
        </div>
      </div>
    </aside>
  );
};
