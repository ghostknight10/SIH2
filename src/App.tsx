import React, { useEffect } from 'react';
import { useTacticalStore } from '@/store/tacticalStore';
import { TopBar } from '@/components/Layout/TopBar';
import { Sidebar } from '@/components/Layout/Sidebar';
import { LiveScreen } from '@/components/Screens/LiveScreen';
import { MapScreen } from '@/components/Screens/MapScreen';
import { CommsScreen } from '@/components/Screens/CommsScreen';
import { ControlScreen } from '@/components/Screens/ControlScreen';
import { AARScreen } from '@/components/Screens/AARScreen';

export const App: React.FC = () => {
  const { activeTab, tickClock, globalReliability, avgNetworkLatencyMs, theme } = useTacticalStore();

  // Sync theme with HTML document element for Tailwind dark: classes
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', theme === 'dark');
    }
  }, [theme]);

  // Clock tick interval
  useEffect(() => {
    const timer = setInterval(() => {
      tickClock();
    }, 1000);
    return () => clearInterval(timer);
  }, [tickClock]);

  return (
    <div className={`h-screen w-screen flex flex-col font-sans overflow-hidden select-none ${
      theme === 'dark' ? 'dark bg-[#09090b] text-zinc-100' : 'bg-slate-100 text-slate-900'
    }`}>
      {/* 1. Fixed 48px Top Navigation Bar */}
      <TopBar />

      {/* 2. Main Content Area: Fixed Sidebar + Viewport */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Navigation Sidebar */}
        <Sidebar />

        {/* Dynamic Screen Viewport */}
        <main
          data-screen={activeTab}
          data-testid={`screen-${activeTab}`}
          className="flex-1 overflow-y-auto bg-slate-100 dark:bg-[#09090b]"
        >
          {activeTab === 'live' && <LiveScreen />}
          {activeTab === 'map' && <MapScreen />}
          {activeTab === 'comms' && <CommsScreen />}
          {activeTab === 'control' && <ControlScreen />}
          {activeTab === 'aar' && <AARScreen />}
        </main>
      </div>

      {/* 3. Simple, Minimal Footer Status Bar */}
      <footer className="h-6 border-t border-slate-200 dark:border-zinc-800/60 bg-white dark:bg-zinc-950 px-4 flex items-center justify-between text-[11px] font-mono text-slate-500 dark:text-zinc-500 shrink-0">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-slate-700 dark:text-zinc-300 font-sans">
            <span className="w-1.5 h-1.5 bg-emerald-500" />
            <span>Network Operational</span>
          </span>
          <span className="text-slate-300 dark:text-zinc-700">·</span>
          <span>Sync Active</span>
          <span className="text-slate-300 dark:text-zinc-700 hidden sm:inline">·</span>
          <span className="hidden sm:inline">4 Channels Connected</span>
        </div>

        <div className="flex items-center gap-3 text-slate-600 dark:text-zinc-400">
          <span className="tabular-nums">
            Ping: {avgNetworkLatencyMs}ms (Reliability: {globalReliability}%)
          </span>
        </div>
      </footer>
    </div>
  );
};

export default App;
