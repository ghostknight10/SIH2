export type UserRole = 'instructor' | 'player';

export type TeamId = 'ALPHA' | 'BRAVO' | 'CHARLIE' | 'HQ';

export type RadioStatus = 'ONLINE' | 'DEGRADED' | 'CUT';

export type MessagePriority = 'URGENT' | 'HIGH' | 'NORMAL' | 'LOW';

export interface TacticalMessage {
  id: string;
  timestamp: string; // e.g. "14:22:01"
  sender: TeamId;
  receiver: TeamId;
  content: string;
  priority: MessagePriority;
  delaySeconds: number;
  freshnessPercent: number; // 0 - 100
  confidencePercent: number; // 0 - 100
  status: 'delivered' | 'in_transit' | 'dropped';
  isConflicted?: boolean;
  isFake?: boolean;
}

export interface TacticalUnit {
  id: string;
  callsign: string;
  team: TeamId;
  type: 'infantry' | 'recon' | 'armor' | 'hq' | 'hostile';
  x: number; // 0 - 100% of map width
  y: number; // 0 - 100% of map height
  heading: number; // 0 - 360 deg
  speedKmh: number;
  lastReportSecondsAgo: number;
  stale: boolean;
  uncertaintyRadius: number; // in pixels
}

export interface DecisionTimelineItem {
  id: string;
  timestamp: string;
  category: 'radio' | 'report' | 'conflict' | 'decision';
  title: string;
  detail: string;
  infoQualityPercent?: number;
  statusBadge?: string;
  isCritical?: boolean;
}

export interface EventFeedItem {
  id: string;
  timestamp: string;
  type: 'radio_change' | 'msg_delivered' | 'msg_dropped' | 'conflict_injected' | 'decision_logged';
  text: string;
  severity: 'normal' | 'caution' | 'critical';
}
