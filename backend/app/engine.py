"""
PS-248 Tactical Communication Engine
Simulates realistic transmission latency, packet loss, information freshness decay,
and causal decision lag across tactical squad channels.
"""
from typing import Dict, Any, List
import time
import random

class CommunicationEngine:
    def __init__(self):
        self.radios: Dict[str, str] = {
            "HQ": "ONLINE",
            "ALPHA": "ONLINE",
            "BRAVO": "ONLINE",
            "CHARLIE": "DEGRADED"
        }
        self.node_diagnostics: Dict[str, Dict[str, Any]] = {
            "HQ": {
                "label": "HQ Command",
                "role": "Central Tactical C2 Hub",
                "latency_ms": 14,
                "packet_loss_percent": 1.2,
                "status": "ONLINE"
            },
            "ALPHA": {
                "label": "Team Alpha",
                "role": "Forward Reconnaissance",
                "latency_ms": 22,
                "packet_loss_percent": 2.4,
                "status": "ONLINE"
            },
            "BRAVO": {
                "label": "Team Bravo",
                "role": "Main Assault Element",
                "latency_ms": 35,
                "packet_loss_percent": 4.1,
                "status": "ONLINE"
            },
            "CHARLIE": {
                "label": "Team Charlie",
                "role": "Heavy Fire Support",
                "latency_ms": 110,
                "packet_loss_percent": 18.5,
                "status": "DEGRADED"
            }
        }
        self.data_freshness_index: float = 88.0
        self.messages: List[Dict[str, Any]] = []
        self.aar_events: List[Dict[str, Any]] = []

    def set_radio_status(self, team: str, status: str) -> Dict[str, Any]:
        """Update radio channel state and recompute network metrics."""
        team = team.upper()
        if team not in self.radios:
            raise ValueError(f"Unknown team: {team}")
        
        self.radios[team] = status
        self.node_diagnostics[team]["status"] = status

        if status == "CUT":
            self.node_diagnostics[team]["latency_ms"] = 999
            self.node_diagnostics[team]["packet_loss_percent"] = 100.0
        elif status == "DEGRADED":
            self.node_diagnostics[team]["latency_ms"] = random.randint(95, 140)
            self.node_diagnostics[team]["packet_loss_percent"] = round(random.uniform(12.0, 24.0), 1)
        else:
            self.node_diagnostics[team]["latency_ms"] = random.randint(14, 28)
            self.node_diagnostics[team]["packet_loss_percent"] = round(random.uniform(0.5, 3.0), 1)

        self._recompute_global_freshness()
        return {
            "team": team,
            "status": status,
            "node": self.node_diagnostics[team],
            "global_freshness": self.data_freshness_index
        }

    def dispatch_message(self, sender: str, receiver: str, content: str, priority: str = "NORMAL") -> Dict[str, Any]:
        """Dispatch a message with realistic channel delay or drop."""
        sender_status = self.radios.get(sender, "ONLINE")
        receiver_status = self.radios.get(receiver, "ONLINE")

        is_severed = sender_status == "CUT" or receiver_status == "CUT"
        is_degraded = sender_status == "DEGRADED" or receiver_status == "DEGRADED"

        if is_severed:
            status = "dropped"
            delay = 0.0
            quality = 0.0
        elif is_degraded:
            status = "delivered" if random.random() > 0.3 else "dropped"
            delay = round(random.uniform(4.5, 9.2), 1)
            quality = round(random.uniform(40.0, 65.0), 1)
        else:
            status = "delivered"
            delay = round(random.uniform(0.8, 2.2), 1)
            quality = round(random.uniform(90.0, 99.0), 1)

        msg = {
            "id": f"msg-{int(time.time() * 1000)}",
            "timestamp": time.strftime("%H:%M:%S"),
            "sender": sender,
            "receiver": receiver,
            "content": content,
            "priority": priority,
            "delay_seconds": delay,
            "freshness_percent": quality,
            "status": status
        }
        self.messages.insert(0, msg)
        return msg

    def inject_false_intel(self, target: str, report: str, conflict_prob: float = 75.0) -> Dict[str, Any]:
        """Inject conflicting recon report and calculate causal information decay."""
        penalty = (conflict_prob / 100.0) * 35.0
        self.data_freshness_index = max(15.0, round(self.data_freshness_index - penalty, 1))

        event = {
            "id": f"ev-{int(time.time() * 1000)}",
            "timestamp": time.strftime("%H:%M:%S"),
            "type": "conflict_injected",
            "target": target,
            "report": report,
            "conflict_probability": conflict_prob,
            "freshness_after": self.data_freshness_index,
            "causal_decision_lag": round(0.5 + (100.0 - self.data_freshness_index) / 25.0, 1)
        }
        self.aar_events.insert(0, event)
        return event

    def _recompute_global_freshness(self):
        """Calculate aggregate information freshness index based on active links."""
        cut_count = sum(1 for s in self.radios.values() if s == "CUT")
        degraded_count = sum(1 for s in self.radios.values() if s == "DEGRADED")

        base = 98.0 - (cut_count * 25.0) - (degraded_count * 12.0)
        self.data_freshness_index = max(10.0, round(base, 1))

    def get_overview(self) -> Dict[str, Any]:
        """Return comprehensive system health state."""
        return {
            "radios": self.radios,
            "nodes": self.node_diagnostics,
            "data_freshness_index": self.data_freshness_index,
            "decision_lag_sec": round(0.5 + (100.0 - self.data_freshness_index) / 25.0, 1),
            "total_messages": len(self.messages),
            "dropped_count": sum(1 for m in self.messages if m["status"] == "dropped")
        }
