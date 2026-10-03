/**
 * PS-248 Real-time Tactical WebSocket Client
 * Automatically connects to the FastAPI backend if running,
 * and gracefully falls back to the in-browser simulator when offline.
 */
import { useTacticalStore } from '@/store/tacticalStore';
import type { TeamId, RadioStatus, MessagePriority } from './types';

class TacticalWebSocketClient {
  private socket: WebSocket | null = null;
  private reconnectTimer: any = null;
  private wsUrl: string;

  constructor() {
    this.wsUrl = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_WS_URL) || 'ws://127.0.0.1:8000/ws';
  }

  public init() {
    this.connect();
  }

  private connect() {
    if (typeof WebSocket === 'undefined') return;
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    try {
      this.socket = new WebSocket(this.wsUrl);

      this.socket.onopen = () => {
        useTacticalStore.getState().setIsBackendConnected(true);
      };

      this.socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          this.handleIncomingMessage(payload);
        } catch {
          // Ignore invalid JSON frames
        }
      };

      this.socket.onclose = () => {
        useTacticalStore.getState().setIsBackendConnected(false);
        this.scheduleReconnect();
      };

      this.socket.onerror = () => {
        useTacticalStore.getState().setIsBackendConnected(false);
        this.socket?.close();
      };
    } catch {
      useTacticalStore.getState().setIsBackendConnected(false);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 8000);
  }

  private handleIncomingMessage(payload: any) {
    const store = useTacticalStore.getState();

    switch (payload.type) {
      case 'radio_updated':
        if (payload.data?.team && payload.data?.status) {
          store.setRadioStatus(payload.data.team as TeamId, payload.data.status as RadioStatus);
        }
        break;

      case 'message_dispatched':
        if (payload.data) {
          // Sync dispatched message
          store.sendMessage({
            sender: payload.data.sender,
            receiver: payload.data.receiver,
            content: payload.data.content,
            priority: (payload.data.priority || 'NORMAL') as MessagePriority,
            delaySeconds: payload.data.delay_seconds || 1.2,
            freshnessPercent: payload.data.freshness_percent || 90,
            confidencePercent: 95,
          });
        }
        break;

      case 'intel_injected':
        if (payload.data) {
          store.injectConflictingIntel(
            payload.data.target as TeamId,
            payload.data.report,
            payload.data.conflict_probability
          );
        }
        break;

      default:
        break;
    }
  }

  public sendAction(action: string, data: Record<string, any>) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      try {
        this.socket.send(JSON.stringify({ action, ...data }));
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }
}

export const tacticalWs = new TacticalWebSocketClient();
