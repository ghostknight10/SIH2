import React from 'react';
import { Play, Pause, RotateCcw, Sun, Moon } from 'lucide-react';
import { useTacticalStore } from '@/store/tacticalStore';

export const TopBar: React.FC = () => {
  const {
    sessionName,
    missionClock,
    isRunning,
    toggleClock,
    resetScenario,
    userRole,
    setUserRole,
    radios,
    theme,
    toggleTheme,
  } = useTacticalStore();

  const anySevered = Object.values(radios).some((s) => s === 'CUT');
  const anyDegraded = Object.values(radios).some((s) => s === 'DEGRADED');

  return (
    <header className="h-12 border-b border-slate-200 dark:border-zinc-800/60 bg-white dark:bg-zinc-950 flex items-center shrink-0 z-40 select-none">
      <div className="w-full px-4 flex items-center justify-between text-xs">
        {/* Left: App Title & Session Name */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 bg-emerald-600 shrink-0" />
            <span className="font-semibold text-sm text-slate-900 dark:text-zinc-100 tracking-tight">
              Telemetry Hub
            </span>
          </div>
          <span className="text-slate-300 dark:text-zinc-700">/</span>
          <span className="text-slate-500 dark:text-zinc-400 font-mono text-[11px] hidden sm:inline">
            {sessionName}
          </span>
        </div>

        {/* Right: Network Status, Clock, Role, Theme Toggle & Reset */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          {/* Health indicator */}
          <div className="flex items-center gap-1.5 font-mono text-[11px]">
            <span
              className={`w-2 h-2 ${
                anySevered ? 'bg-rose-500' : anyDegraded ? 'bg-amber-500' : 'bg-emerald-500'
              }`}
            />
            <span className="text-slate-700 dark:text-zinc-300 hidden md:inline font-sans">
              {anySevered ? 'Channel Offline' : anyDegraded ? 'Channel Slow' : 'All Channels Good'}
            </span>
          </div>

          <span className="text-slate-200 dark:text-zinc-800 hidden sm:inline">|</span>

          {/* Clock Pause/Play Button */}
          <button
            type="button"
            data-testid="session-clock-btn"
            onClick={toggleClock}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono tabular-nums border border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700 bg-slate-50 dark:bg-zinc-900/60 text-slate-800 dark:text-zinc-200 cursor-pointer"
            title={isRunning ? 'Pause clock' : 'Resume clock'}
          >
            {isRunning ? (
              <Pause className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <Play className="w-3 h-3 text-amber-600 dark:text-amber-400" />
            )}
            <span>{missionClock}</span>
          </button>

          {/* Light / Dark Mode Toggle */}
          <button
            type="button"
            data-testid="theme-toggle-btn"
            onClick={toggleTheme}
            className="flex items-center gap-1.5 px-2 py-1 text-xs border border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700 bg-slate-50 dark:bg-zinc-900/60 text-slate-700 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-zinc-100 cursor-pointer"
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? (
              <>
                <Sun className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline text-[11px] font-sans">Light</span>
              </>
            ) : (
              <>
                <Moon className="w-3.5 h-3.5 text-slate-600" />
                <span className="hidden sm:inline text-[11px] font-sans">Dark</span>
              </>
            )}
          </button>

          {/* Active Role Segmented Switch */}
          <div className="flex items-center border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/40 p-0.5 text-[11px]">
            <button
              type="button"
              data-testid="role-instructor"
              onClick={() => setUserRole('instructor')}
              className={`px-2 py-0.5 cursor-pointer transition-colors ${
                userRole === 'instructor'
                  ? 'bg-slate-900 text-white dark:bg-zinc-800 dark:text-zinc-100 font-medium'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
              }`}
            >
              ADMIN
            </button>
            <button
              type="button"
              data-testid="role-player"
              onClick={() => setUserRole('player')}
              className={`px-2 py-0.5 cursor-pointer transition-colors ${
                userRole === 'player'
                  ? 'bg-slate-900 text-white dark:bg-zinc-800 dark:text-zinc-100 font-medium'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
              }`}
            >
              OPERATOR
            </button>
          </div>

          {/* Reset Button */}
          <button
            type="button"
            data-testid="reset-scenario-btn"
            onClick={resetScenario}
            className="flex items-center gap-1 px-2 py-1 text-xs border border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700 text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100 bg-white dark:bg-zinc-900 hover:bg-slate-50 dark:hover:bg-zinc-800 cursor-pointer transition-colors font-mono"
            title="Reset scenario to initial state"
          >
            <RotateCcw className="w-3 h-3" />
            <span className="hidden sm:inline">Reset</span>
          </button>
        </div>
      </div>
    </header>
  );
};
