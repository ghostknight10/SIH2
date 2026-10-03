import { create } from 'zustand';
import type { 
  UserRole, 
  TeamId, 
  RadioStatus, 
  TacticalMessage, 
  TacticalUnit,
  DecisionTimelineItem, 
  EventFeedItem 
} from '../services/types';

export type ActiveTab = 'live' | 'map' | 'comms' | 'control' | 'aar';
export type TimeRange = '15m' | '1h' | 'live';

export interface NodeDiagnostic {
  team: TeamId;
  label: string;
  role: string;
  status: RadioStatus;
  packetsSent: number;
  packetsReceived: number;
  packetLossPercent: number;
  latencyMs: number;
  lastContact: string;
  hardwareTemp: number; // e.g. 42C
  signalStrengthDbm: number; // e.g. -68 dBm
}

interface TacticalState {
  // Theme
  theme: 'light' | 'dark';

  // Backend Connectivity
  isBackendConnected: boolean;
  setIsBackendConnected: (connected: boolean) => void;

  // Navigation & Role
  activeTab: ActiveTab;
  userRole: UserRole;
  playerTeam: TeamId;
  
  // Session Telemetry
  sessionName: string;
  missionClock: string;
  clockSeconds: number;
  isRunning: boolean;
  
  // High-Level Diagnostics
  globalReliability: number;
  avgNetworkLatencyMs: number;
  dataFreshnessIndex: number;
  activeLinksCount: number;
  totalTransmissions: number;
  droppedCount: number;

  // Deltas for metrics strip
  reliabilityDelta: string;
  latencyDelta: string;
  freshnessDelta: string;
  transmissionsDelta: string;

  // Sparkline rolling histories
  reliabilityHistory: number[];
  latencyHistory: number[];
  freshnessHistory: number[];
  transmissionHistory: number[];

  // Tactical Units on Map
  units: TacticalUnit[];
  selectedUnitId: string | null;

  // Utility Toolbar & Selection State
  selectedNodeId: TeamId | null;
  timeRange: TimeRange;
  autoRefresh: boolean;
  globalSearch: string;
  scenarioVersion: number;

  // Nodes & Comms State
  nodeDiagnostics: Record<TeamId, NodeDiagnostic>;
  radios: Record<TeamId, RadioStatus>;
  messages: TacticalMessage[];
  events: EventFeedItem[];
  aarTimeline: DecisionTimelineItem[];
  
  // Actions
  setTheme: (theme: 'light' | 'dark') => void;
  toggleTheme: () => void;
  setActiveTab: (tab: ActiveTab) => void;
  setUserRole: (role: UserRole) => void;
  setPlayerTeam: (team: TeamId) => void;
  setSelectedNodeId: (id: TeamId | null) => void;
  setSelectedUnitId: (id: string | null) => void;
  setTimeRange: (range: TimeRange) => void;
  toggleAutoRefresh: () => void;
  setGlobalSearch: (q: string) => void;
  toggleClock: () => void;
  tickClock: () => void;
  
  // Diagnostic Actions
  setRadioStatus: (team: TeamId, status: RadioStatus) => void;
  cycleRadioStatus: (team: TeamId) => void;
  sendMessage: (msg: Omit<TacticalMessage, 'id' | 'timestamp' | 'status'>) => void;
  injectConflictingIntel: (target: TeamId, report: string, conflictProbability?: number) => void;
  logPlayerDecision: (orderText: string) => void;
  resetScenario: () => void;
}

const INITIAL_NODES: Record<TeamId, NodeDiagnostic> = {
  HQ: {
    team: 'HQ',
    label: 'HQ Command',
    role: 'Central Tactical C2 Hub',
    status: 'ONLINE',
    packetsSent: 142,
    packetsReceived: 139,
    packetLossPercent: 2.1,
    latencyMs: 14,
    lastContact: 'Just now',
    hardwareTemp: 38,
    signalStrengthDbm: -54,
  },
  ALPHA: {
    team: 'ALPHA',
    label: 'Alpha Recon',
    role: 'Forward Reconnaissance Unit',
    status: 'ONLINE',
    packetsSent: 88,
    packetsReceived: 85,
    packetLossPercent: 3.4,
    latencyMs: 24,
    lastContact: '4s ago',
    hardwareTemp: 44,
    signalStrengthDbm: -62,
  },
  BRAVO: {
    team: 'BRAVO',
    label: 'Bravo Vanguard',
    role: 'Direct Assault & Patrol',
    status: 'ONLINE',
    packetsSent: 64,
    packetsReceived: 61,
    packetLossPercent: 4.7,
    latencyMs: 38,
    lastContact: '6s ago',
    hardwareTemp: 47,
    signalStrengthDbm: -71,
  },
  CHARLIE: {
    team: 'CHARLIE',
    label: 'Charlie Support',
    role: 'Heavy Weapons & Logistics',
    status: 'DEGRADED',
    packetsSent: 42,
    packetsReceived: 31,
    packetLossPercent: 26.2,
    latencyMs: 182,
    lastContact: '34s ago',
    hardwareTemp: 52,
    signalStrengthDbm: -88,
  },
};

const INITIAL_UNITS: TacticalUnit[] = [
  {
    id: 'unit-hq',
    callsign: 'HQ-COMMAND',
    team: 'HQ',
    type: 'hq',
    x: 22,
    y: 74,
    heading: 35,
    speedKmh: 0,
    lastReportSecondsAgo: 0,
    stale: false,
    uncertaintyRadius: 18,
  },
  {
    id: 'unit-alpha',
    callsign: 'ALPHA-RECON',
    team: 'ALPHA',
    type: 'recon',
    x: 48,
    y: 34,
    heading: 65,
    speedKmh: 24,
    lastReportSecondsAgo: 4,
    stale: false,
    uncertaintyRadius: 20,
  },
  {
    id: 'unit-bravo',
    callsign: 'BRAVO-VANGUARD',
    team: 'BRAVO',
    type: 'infantry',
    x: 72,
    y: 50,
    heading: 310,
    speedKmh: 12,
    lastReportSecondsAgo: 6,
    stale: false,
    uncertaintyRadius: 22,
  },
  {
    id: 'unit-charlie',
    callsign: 'CHARLIE-SUPPORT',
    team: 'CHARLIE',
    type: 'armor',
    x: 36,
    y: 62,
    heading: 90,
    speedKmh: 8,
    lastReportSecondsAgo: 34,
    stale: true,
    uncertaintyRadius: 60, // Initially DEGRADED
  },
  {
    id: 'unit-hostile-01',
    callsign: 'HOSTILE SCOUT',
    team: 'ALPHA',
    type: 'hostile',
    x: 82,
    y: 26,
    heading: 190,
    speedKmh: 36,
    lastReportSecondsAgo: 58,
    stale: true,
    uncertaintyRadius: 75,
  },
];

const INITIAL_MESSAGES: TacticalMessage[] = [
  {
    id: 'msg-01',
    timestamp: '14:21:40',
    sender: 'ALPHA',
    receiver: 'BRAVO',
    content: 'Recon checkpoint 44-Bravo reached. Sector visually clear, establishing observation post.',
    priority: 'NORMAL',
    delaySeconds: 1.8,
    freshnessPercent: 98,
    confidencePercent: 96,
    status: 'delivered',
  },
  {
    id: 'msg-02',
    timestamp: '14:24:12',
    sender: 'ALPHA',
    receiver: 'BRAVO',
    content: 'Hostile scout vehicle spotted moving south along Eastern Corridor. Requesting Bravo verify flank.',
    priority: 'URGENT',
    delaySeconds: 4.9,
    freshnessPercent: 84,
    confidencePercent: 88,
    status: 'delivered',
  },
  {
    id: 'msg-03',
    timestamp: '14:27:05',
    sender: 'CHARLIE',
    receiver: 'ALPHA',
    content: 'Severe RF interference detected on secondary UHF band. Transmissions encountering packet degradation.',
    priority: 'HIGH',
    delaySeconds: 8.6,
    freshnessPercent: 54,
    confidencePercent: 62,
    status: 'delivered',
  },
];

const INITIAL_TIMELINE: DecisionTimelineItem[] = [
  {
    id: 'tl-1',
    timestamp: '14:21:00',
    category: 'report',
    title: 'Initial Recon Telemetry Received',
    detail: 'Alpha squad delivers confirmed hostile vehicle coordinates with high signal confidence (98%).',
    infoQualityPercent: 98,
    statusBadge: 'VERIFIED',
  },
  {
    id: 'tl-2',
    timestamp: '14:24:15',
    category: 'radio',
    title: 'Radio Link Degradation Occurred',
    detail: 'Electronic warfare / signal jamming drops Bravo link packet delivery from 96% to 41%. Latency surges.',
    statusBadge: 'EW INTERFERENCE',
    isCritical: true,
  },
  {
    id: 'tl-3',
    timestamp: '14:27:08',
    category: 'conflict',
    title: 'Contradictory Intel Injected',
    detail: 'Unverified dispatch claims Eastern Corridor is clear. Information freshness plummets to 42%.',
    infoQualityPercent: 42,
    statusBadge: 'SPOOFED INTEL',
    isCritical: true,
  },
  {
    id: 'tl-4',
    timestamp: '14:30:45',
    category: 'decision',
    title: 'Operational Advance Order Executed',
    detail: 'Player issues movement order into sector based on stale & conflicted intelligence.',
    infoQualityPercent: 42,
    statusBadge: 'HIGH RISK DECISION',
    isCritical: true,
  },
];

const INITIAL_EVENTS: EventFeedItem[] = [
  {
    id: 'ev-1',
    timestamp: '14:20:00',
    type: 'radio_change',
    text: 'Simulation initialized: Diagnostic telemetry monitor online.',
    severity: 'normal',
  },
  {
    id: 'ev-2',
    timestamp: '14:24:15',
    type: 'msg_delivered',
    text: 'URGENT dispatch delivered Alpha -> Bravo (+4.9s latency).',
    severity: 'caution',
  },
  {
    id: 'ev-3',
    timestamp: '14:27:08',
    type: 'radio_change',
    text: 'Charlie node reported high packet loss (26.2%). Status: DEGRADED.',
    severity: 'caution',
  },
];

const appendHistory = (arr: number[], val: number, maxLen = 16): number[] => {
  return [...arr.slice(1 - maxLen), val];
};

const RANGE_HISTORIES: Record<TimeRange, {
  reliability: number[];
  latency: number[];
  freshness: number[];
  transmissions: number[];
}> = {
  live: {
    reliability: [94.5, 94.2, 94.0, 93.8, 93.5, 94.1, 93.9, 93.6, 93.7, 93.6],
    latency: [42, 43, 45, 44, 46, 48, 47, 45, 47, 46],
    freshness: [86, 85, 84, 83, 85, 82, 81, 83, 82, 82],
    transmissions: [10, 11, 12, 13, 14, 15, 16, 17, 18, 18],
  },
  '15m': {
    reliability: [98.2, 97.9, 97.5, 96.8, 96.0, 95.4, 95.1, 94.8, 94.2, 93.9, 93.6, 93.6],
    latency: [22, 24, 25, 28, 31, 35, 38, 42, 44, 45, 47, 46],
    freshness: [98, 96, 95, 92, 90, 88, 86, 85, 84, 83, 82, 82],
    transmissions: [2, 4, 5, 7, 9, 11, 12, 14, 15, 16, 17, 18],
  },
  '1h': {
    reliability: [99.5, 99.1, 98.8, 98.4, 98.0, 97.5, 96.8, 95.9, 95.2, 94.6, 94.0, 93.6],
    latency: [18, 19, 21, 23, 24, 26, 30, 34, 38, 42, 45, 46],
    freshness: [100, 99, 97, 95, 93, 91, 89, 87, 85, 84, 83, 82],
    transmissions: [1, 2, 3, 5, 6, 8, 10, 12, 14, 15, 17, 18],
  },
};

let idSeq = 0;
const generateId = (prefix: string) => `${prefix}-${Date.now()}-${++idSeq}`;

export const useTacticalStore = create<TacticalState>((set, get) => ({
  theme: 'light',
  activeTab: 'live',
  userRole: 'instructor',
  playerTeam: 'ALPHA',
  
  sessionName: 'OP: AMBUSH NORTH',
  missionClock: '14:32:05',
  clockSeconds: 872,
  isRunning: true,
  
  globalReliability: 93.6,
  avgNetworkLatencyMs: 46,
  dataFreshnessIndex: 82,
  activeLinksCount: 3,
  totalTransmissions: 18,
  droppedCount: 2,

  reliabilityDelta: '+2.1%',
  latencyDelta: '+1.2ms',
  freshnessDelta: '-3%',
  transmissionsDelta: '+2',

  reliabilityHistory: [94.5, 94.2, 94.0, 93.8, 93.5, 94.1, 93.9, 93.6, 93.7, 93.6],
  latencyHistory: [42, 43, 45, 44, 46, 48, 47, 45, 47, 46],
  freshnessHistory: [86, 85, 84, 83, 85, 82, 81, 83, 82, 82],
  transmissionHistory: [10, 11, 12, 13, 14, 15, 16, 17, 18, 18],

  units: INITIAL_UNITS,
  selectedUnitId: null,

  selectedNodeId: null,
  timeRange: 'live',
  autoRefresh: true,
  globalSearch: '',
  scenarioVersion: 0,

  nodeDiagnostics: INITIAL_NODES,
  radios: {
    HQ: 'ONLINE',
    ALPHA: 'ONLINE',
    BRAVO: 'ONLINE',
    CHARLIE: 'DEGRADED',
  },
  messages: INITIAL_MESSAGES,
  events: INITIAL_EVENTS,
  aarTimeline: INITIAL_TIMELINE,

  isBackendConnected: false,
  setIsBackendConnected: (connected) => set({ isBackendConnected: connected }),

  setTheme: (theme) => set({ theme }),
  toggleTheme: () => set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),
  setActiveTab: (tab) => set({ activeTab: tab }),
  setUserRole: (role) => set({ userRole: role }),
  setPlayerTeam: (team) => set({ playerTeam: team }),
  setSelectedNodeId: (id) => set({ selectedNodeId: id }),
  setSelectedUnitId: (id) => set({ selectedUnitId: id }),
  setTimeRange: (range) => {
    const hist = RANGE_HISTORIES[range];
    set({
      timeRange: range,
      reliabilityHistory: hist.reliability,
      latencyHistory: hist.latency,
      freshnessHistory: hist.freshness,
      transmissionHistory: hist.transmissions,
    });
  },
  toggleAutoRefresh: () => set((state) => ({ autoRefresh: !state.autoRefresh })),
  setGlobalSearch: (q) => set({ globalSearch: q }),
  
  toggleClock: () => set((state) => ({ isRunning: !state.isRunning })),

  tickClock: () => set((state) => {
    if (!state.isRunning) return state;
    const nextSec = state.clockSeconds + 1;
    // Base wall-clock seconds corresponding to initial clockSeconds = 872 is 14:32:05 (52325s)
    const totalSec = 51453 + nextSec;
    const hh = (Math.floor(totalSec / 3600) % 24).toString().padStart(2, '0');
    const mm = Math.floor((totalSec % 3600) / 60).toString().padStart(2, '0');
    const ss = (totalSec % 60).toString().padStart(2, '0');
    
    // Auto-refresh simulation jitter
    let newLat = state.avgNetworkLatencyMs;
    let newRel = state.globalReliability;
    let newFresh = state.dataFreshnessIndex;
    let newRelHist = state.reliabilityHistory;
    let newLatHist = state.latencyHistory;
    let newFreshHist = state.freshnessHistory;
    let newTxHist = state.transmissionHistory;

    if (state.autoRefresh && nextSec % 3 === 0) {
      const latJitter = Math.floor(Math.random() * 5) - 2; // -2 to +2
      const cutCount = Object.values(state.radios).filter((s) => s === 'CUT').length;
      const degCount = Object.values(state.radios).filter((s) => s === 'DEGRADED').length;
      
      const baseLat = 24 + degCount * 22 + cutCount * 55;
      newLat = Math.max(14, baseLat + latJitter);
      
      const relFluct = (Math.random() * 0.4 - 0.2);
      const baseRel = 100 - cutCount * 25 - degCount * 6.4;
      newRel = Math.min(100, Math.max(20, Math.round((baseRel + relFluct) * 10) / 10));

      const freshFluct = Math.floor(Math.random() * 3) - 1;
      newFresh = Math.min(100, Math.max(15, state.dataFreshnessIndex + freshFluct));

      newRelHist = appendHistory(state.reliabilityHistory, newRel);
      newLatHist = appendHistory(state.latencyHistory, newLat);
      newFreshHist = appendHistory(state.freshnessHistory, newFresh);
      newTxHist = appendHistory(state.transmissionHistory, state.totalTransmissions);
    }

    return {
      clockSeconds: nextSec,
      missionClock: `${hh}:${mm}:${ss}`,
      avgNetworkLatencyMs: newLat,
      globalReliability: newRel,
      dataFreshnessIndex: newFresh,
      reliabilityHistory: newRelHist,
      latencyHistory: newLatHist,
      freshnessHistory: newFreshHist,
      transmissionHistory: newTxHist,
    };
  }),

  setRadioStatus: (team, status) => {
    const timestamp = get().missionClock;
    const node = get().nodeDiagnostics[team];
    if (!node) return;

    const loss = status === 'CUT' ? 100 : status === 'DEGRADED' ? 32 : 3.5;
    const lat = status === 'CUT' ? 9999 : status === 'DEGRADED' ? 195 : 22;

    const updatedNode: NodeDiagnostic = {
      ...node,
      status,
      packetLossPercent: loss,
      latencyMs: lat,
      lastContact: status === 'CUT' ? 'SEVERED' : 'Just now',
    };

    const newEvent: EventFeedItem = {
      id: generateId('ev'),
      timestamp,
      type: 'radio_change',
      text: `Diagnostic event: ${team} link changed to ${status} (Loss: ${loss}%).`,
      severity: status === 'CUT' ? 'critical' : status === 'DEGRADED' ? 'caution' : 'normal',
    };

    // Update map unit uncertainty radii immediately
    const radiusForStatus = (s: RadioStatus) => (s === 'CUT' ? 110 : s === 'DEGRADED' ? 60 : 20);
    const updatedUnits = get().units.map((u) => {
      if (u.team === team && u.type !== 'hostile') {
        return {
          ...u,
          uncertaintyRadius: radiusForStatus(status),
          stale: status !== 'ONLINE',
          lastReportSecondsAgo: status === 'CUT' ? 180 : status === 'DEGRADED' ? 45 : 1,
        };
      }
      return u;
    });

    // Record causal chain timeline milestone
    const timelineEntry: DecisionTimelineItem = {
      id: generateId('tl-radio'),
      timestamp,
      category: 'radio',
      title: `${team} Radio Link ${status === 'CUT' ? 'Severed' : status === 'DEGRADED' ? 'Degraded' : 'Restored'}`,
      detail:
        status === 'CUT'
          ? `Complete carrier loss on ${team} channel. RF packet delivery dropped to 0%, tactical coordinate feed severed.`
          : status === 'DEGRADED'
          ? `Electronic warfare interference on ${team} secondary net. Latency surged to 195ms, packet loss 32%.`
          : `Nominal RF communications re-established with ${team}. Forward telemetry latency restored to <25ms.`,
      statusBadge: status === 'CUT' ? 'SEVERED' : status === 'DEGRADED' ? 'EW INTERFERENCE' : 'NOMINAL',
      isCritical: status !== 'ONLINE',
      infoQualityPercent: status === 'CUT' ? 12 : status === 'DEGRADED' ? 45 : 96,
    };

    const updatedRadios = { ...get().radios, [team]: status };
    const onlineCount = Object.values(updatedRadios).filter((s) => s === 'ONLINE').length;
    const cutCount = Object.values(updatedRadios).filter((s) => s === 'CUT').length;
    const degCount = Object.values(updatedRadios).filter((s) => s === 'DEGRADED').length;

    const newReliability = Math.max(20, Math.round((100 - cutCount * 25 - degCount * 6.4) * 10) / 10);
    const newLatency = Math.max(14, 24 + degCount * 22 + cutCount * 55);
    const fakeMsg = get().messages.find((m) => m.isConflicted || m.isFake);
    const conflictPenalty = fakeMsg ? Math.round((100 - fakeMsg.confidencePercent) * 0.6) : 0;
    const freshness = Math.max(15, 94 - cutCount * 25 - degCount * 12 - conflictPenalty);

    const relDelta = newReliability >= 90 ? '+2.1%' : '-8.4%';
    const latDelta = newLatency > 50 ? '+18ms' : '-4ms';
    const freshDelta = freshness < 70 ? '-14%' : '+1%';

    set((state) => ({
      radios: updatedRadios,
      nodeDiagnostics: {
        ...state.nodeDiagnostics,
        [team]: updatedNode,
      },
      units: updatedUnits,
      activeLinksCount: onlineCount,
      globalReliability: newReliability,
      avgNetworkLatencyMs: newLatency,
      dataFreshnessIndex: freshness,
      reliabilityDelta: relDelta,
      latencyDelta: latDelta,
      freshnessDelta: freshDelta,
      reliabilityHistory: appendHistory(state.reliabilityHistory, newReliability),
      latencyHistory: appendHistory(state.latencyHistory, newLatency),
      freshnessHistory: appendHistory(state.freshnessHistory, freshness),
      events: [newEvent, ...state.events].slice(0, 50),
      aarTimeline: [timelineEntry, ...state.aarTimeline],
    }));
  },

  cycleRadioStatus: (team) => {
    const current = get().radios[team];
    const next: RadioStatus = current === 'ONLINE' ? 'DEGRADED' : current === 'DEGRADED' ? 'CUT' : 'ONLINE';
    get().setRadioStatus(team, next);
  },

  sendMessage: (msg) => {
    if (msg.sender === msg.receiver) return;

    const timestamp = get().missionClock;
    const targetStatus = get().radios[msg.receiver];
    const senderStatus = get().radios[msg.sender];

    const isCut = targetStatus === 'CUT' || senderStatus === 'CUT';
    const isDegraded = targetStatus === 'DEGRADED' || senderStatus === 'DEGRADED';

    if (isCut) {
      const droppedMsg: TacticalMessage = {
        ...msg,
        id: generateId('msg'),
        timestamp,
        status: 'dropped',
        freshnessPercent: 0,
        confidencePercent: 0,
      };

      const droppedEv: EventFeedItem = {
        id: generateId('ev'),
        timestamp,
        type: 'msg_dropped',
        text: `DROPPED: Transmission ${msg.sender} -> ${msg.receiver} failed (${
          senderStatus === 'CUT' ? 'Sender' : 'Target'
        } node severed).`,
        severity: 'critical',
      };

      const nextTotal = get().totalTransmissions + 1;
      const nextDropped = get().droppedCount + 1;

      set((state) => ({
        messages: [droppedMsg, ...state.messages],
        droppedCount: nextDropped,
        totalTransmissions: nextTotal,
        transmissionsDelta: '+1',
        transmissionHistory: appendHistory(state.transmissionHistory, nextTotal),
        events: [droppedEv, ...state.events].slice(0, 50),
      }));
      return;
    }

    const delay = isDegraded ? msg.delaySeconds + 5.5 : msg.delaySeconds;
    const freshness = isDegraded ? Math.max(30, msg.freshnessPercent - 35) : msg.freshnessPercent;

    const newMsg: TacticalMessage = {
      ...msg,
      id: generateId('msg'),
      timestamp,
      delaySeconds: delay,
      freshnessPercent: freshness,
      status: 'delivered',
    };

    const newEv: EventFeedItem = {
      id: generateId('ev'),
      timestamp,
      type: 'msg_delivered',
      text: `DELIVERED: [${msg.priority}] ${msg.sender} -> ${msg.receiver} (+${delay.toFixed(1)}s, ${freshness}% fresh).`,
      severity: msg.priority === 'URGENT' ? 'caution' : 'normal',
    };

    const nextTotal = get().totalTransmissions + 1;

    set((state) => ({
      messages: [newMsg, ...state.messages],
      totalTransmissions: nextTotal,
      transmissionsDelta: '+1',
      transmissionHistory: appendHistory(state.transmissionHistory, nextTotal),
      events: [newEv, ...state.events].slice(0, 50),
    }));
  },

  injectConflictingIntel: (target, report, conflictProbability = 75) => {
    const timestamp = get().missionClock;

    const confidence = Math.max(10, 100 - conflictProbability);
    const freshness = Math.max(15, Math.round(100 - conflictProbability * 0.8));
    const newGlobalFreshness = Math.max(20, Math.round(100 - conflictProbability * 0.75));

    const conflictMsg: TacticalMessage = {
      id: generateId('msg-conflict'),
      timestamp,
      sender: 'HQ',
      receiver: target,
      content: `[DISINFORMATION INJECT] ${report}`,
      priority: 'HIGH',
      delaySeconds: 3.1,
      freshnessPercent: freshness,
      confidencePercent: confidence,
      status: 'delivered',
      isConflicted: true,
      isFake: true,
    };

    const timelineItem: DecisionTimelineItem = {
      id: generateId('tl'),
      timestamp,
      category: 'conflict',
      title: `Conflicting Intel Injected -> ${target}`,
      detail: `Report: "${report}". Conflict weight: ${conflictProbability}%. Freshness dropped to ${freshness}%, confidence: ${confidence}%.`,
      infoQualityPercent: freshness,
      statusBadge: 'INJECTED ANOMALY',
      isCritical: true,
    };

    const ev: EventFeedItem = {
      id: generateId('ev'),
      timestamp,
      type: 'conflict_injected',
      text: `Diagnostic alert: Spoofed intelligence injected targeting ${target} (Conflict: ${conflictProbability}%).`,
      severity: 'caution',
    };

    set((state) => ({
      messages: [conflictMsg, ...state.messages],
      aarTimeline: [timelineItem, ...state.aarTimeline],
      dataFreshnessIndex: newGlobalFreshness,
      freshnessDelta: `-${Math.round(conflictProbability * 0.2)}%`,
      freshnessHistory: appendHistory(state.freshnessHistory, newGlobalFreshness),
      events: [ev, ...state.events].slice(0, 50),
    }));
  },

  logPlayerDecision: (orderText) => {
    const timestamp = get().missionClock;
    const team = get().playerTeam;
    const status = get().radios[team];
    const quality = status === 'CUT' ? 12 : status === 'DEGRADED' ? 42 : 88;

    const item: DecisionTimelineItem = {
      id: generateId('tl-dec'),
      timestamp,
      category: 'decision',
      title: `${team} Order Executed`,
      detail: `Decision: "${orderText}" issued with ${quality}% information reliability.`,
      infoQualityPercent: quality,
      statusBadge: quality < 50 ? 'DEGRADED DECISION' : 'NOMINAL',
      isCritical: quality < 50,
    };

    const ev: EventFeedItem = {
      id: generateId('ev'),
      timestamp,
      type: 'decision_logged',
      text: `Decision logged: ${team} executed order under ${quality}% info confidence.`,
      severity: quality < 50 ? 'critical' : 'normal',
    };

    set((state) => ({
      aarTimeline: [item, ...state.aarTimeline],
      events: [ev, ...state.events].slice(0, 50),
    }));
  },

  resetScenario: () => set((state) => ({
    scenarioVersion: state.scenarioVersion + 1,
    nodeDiagnostics: INITIAL_NODES,
    radios: {
      HQ: 'ONLINE',
      ALPHA: 'ONLINE',
      BRAVO: 'ONLINE',
      CHARLIE: 'DEGRADED',
    },
    units: INITIAL_UNITS,
    selectedUnitId: null,
    messages: INITIAL_MESSAGES,
    events: INITIAL_EVENTS,
    aarTimeline: INITIAL_TIMELINE,
    globalReliability: 93.6,
    avgNetworkLatencyMs: 46,
    dataFreshnessIndex: 82,
    activeLinksCount: 3,
    totalTransmissions: 18,
    droppedCount: 2,
    reliabilityDelta: '+2.1%',
    latencyDelta: '+1.2ms',
    freshnessDelta: '-3%',
    transmissionsDelta: '+2',
    reliabilityHistory: [94.5, 94.2, 94.0, 93.8, 93.5, 94.1, 93.9, 93.6, 93.7, 93.6],
    latencyHistory: [42, 43, 45, 44, 46, 48, 47, 45, 47, 46],
    freshnessHistory: [86, 85, 84, 83, 85, 82, 81, 83, 82, 82],
    transmissionHistory: [10, 11, 12, 13, 14, 15, 16, 17, 18, 18],
    clockSeconds: 872,
    missionClock: '14:32:05',
    selectedNodeId: null,
    globalSearch: '',
    timeRange: 'live',
  })),
}));
