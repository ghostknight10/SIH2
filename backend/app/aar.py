"""After-action review generation (pipeline step 15)."""
import html
import json
from typing import Any


def _clock(event: dict) -> float:
    p = event.get("payload") or {}
    for key in ("clock_s", "sent_clock", "deliver_at_clock", "delivered_clock"):
        if isinstance(p.get(key), (int, float)):
            return float(p[key])
    return 0.0



def assignments_from_events(events: list[dict]) -> dict[str, str]:
    """Reconstruct username -> team from the durable event log.

    This makes AAR generation independent of the in-memory SessionState, so a
    completed session can still be reviewed after the API process restarts.
    """
    assignments: dict[str, str] = {}
    for event in sorted(events, key=lambda e: (e.get("ts", 0), e.get("id", 0))):
        payload = event.get("payload") or {}
        if event.get("type") == "session_started":
            initial = payload.get("assignments") or {}
            if isinstance(initial, dict):
                assignments.update({str(k): str(v) for k, v in initial.items()})
        elif event.get("type") == "player_assigned":
            username = event.get("actor")
            team = payload.get("team")
            if username and team:
                assignments[str(username)] = str(team)
    return assignments

def build_aar(events: list[dict], assignments: dict[str, str], scenario: dict | None = None) -> dict:
    events = sorted(events, key=lambda e: (_clock(e), e.get("ts", 0), e.get("id", 0)))
    leaders = sorted(assignments)
    timelines: dict[str, list[dict[str, Any]]] = {u: [] for u in leaders}
    world_history: list[tuple[float, dict]] = []
    comm: dict[str, dict[str, Any]] = {}
    recent_info: dict[str, list[dict]] = {u: [] for u in leaders}

    for e in events:
        p = e.get("payload") or {}
        if isinstance(p.get("true_world"), dict):
            world_history.append((_clock(e), p["true_world"]))

    def world_at(clock: float):
        latest = None
        for t, world in world_history:
            if t <= clock + 1e-9:
                latest = world
            else:
                break
        return latest

    def link_key(sender_team: str | None, recipient_team: str | None) -> str:
        return f"{sender_team or 'INSTRUCTOR'} -> {recipient_team or 'UNKNOWN'}"

    for e in events:
        typ = e["type"]
        p = e.get("payload") or {}
        clock = _clock(e)
        actor = e.get("actor")
        if typ in ("message_sent", "message_scheduled", "message_delivered", "message_dropped"):
            if typ in ("message_delivered", "message_dropped"):
                key = link_key(p.get("sender_team"), p.get("recipient_team"))
                bucket = comm.setdefault(key, {"sent": 0, "delivered": 0, "dropped": 0, "delay_total": 0.0, "stale": 0, "tampered": 0, "by_priority": {}})
                priority = p.get("priority", "NORMAL")
                bp = bucket["by_priority"].setdefault(priority, {"delivered": 0, "dropped": 0})
                if typ == "message_delivered":
                    bucket["delivered"] += 1
                    bucket["delay_total"] += float(p.get("delivery_delay_s") or 0.0)
                    iq = p.get("information_quality") or {}
                    bucket["stale"] += int(iq.get("status") == "STALE")
                    bucket["tampered"] += int(bool(p.get("tampered")))
                    bp["delivered"] += 1
                else:
                    bucket["dropped"] += 1
                    bp["dropped"] += 1

        if typ == "message_delivered" and actor in timelines:
            iq = p.get("information_quality") or {}
            item = {
                "clock_s": clock, "kind": "message_received", "message_id": p.get("message_id"),
                "from": p.get("sender"), "content": p.get("content"),
                "tampered": bool(p.get("tampered")), "sent_clock": p.get("sent_clock"),
                "scheduled_deliver_at": p.get("deliver_at_clock"),
                "delivery_delay_s": p.get("delivery_delay_s"), "priority": p.get("priority", "NORMAL"),
                "information_quality": iq, "what_was_true": world_at(clock),
            }
            timelines[actor].append(item)
            recent_info[actor].append(item)
            recent_info[actor] = recent_info[actor][-5:]
        elif typ == "message_dropped" and actor in timelines:
            timelines[actor].append({
                "clock_s": clock, "kind": "message_dropped", "message_id": p.get("message_id"),
                "reason": p.get("reason"), "priority": p.get("priority", "NORMAL"),
                "what_was_true": world_at(clock),
            })
        elif typ == "state_update_sent" and actor in timelines:
            timelines[actor].append({
                "clock_s": clock, "kind": "state_update", "reason": p.get("reason"),
                "units": p.get("units", []), "what_was_true": world_at(clock),
            })
        elif typ == "order_issued" and actor in timelines:
            preceding = recent_info.get(actor, [])
            source = preceding[-1] if preceding and preceding[-1]["clock_s"] <= clock else None
            timelines[actor].append({
                "clock_s": clock, "kind": "order_issued", "order_id": p.get("order_id"),
                "unit_id": p.get("unit_id"), "action": p.get("action"), "target": p.get("target"),
                "decision_context": {
                    "based_on_message_id": source.get("message_id") if source else None,
                    "source_priority": source.get("priority") if source else None,
                    "source_quality": source.get("information_quality") if source else None,
                    "source_age_s": round(clock - source["clock_s"], 3) if source else None,
                },
                "what_was_true": p.get("true_world") or world_at(clock),
            })
        elif typ == "snapshot_sent" and actor in timelines:
            timelines[actor].append({
                "clock_s": clock, "kind": "snapshot", "units": p.get("units", []),
                "what_was_true": world_at(clock),
            })
        elif typ == "client_connected" and actor in timelines:
            timelines[actor].append({"clock_s": clock, "kind": "connected", "team": p.get("team")})
        elif typ == "client_disconnected" and actor in timelines:
            timelines[actor].append({"clock_s": clock, "kind": "disconnected", "team": p.get("team")})

    delivered = delayed = dropped = tampered = 0
    for items in timelines.values():
        for item in items:
            if item["kind"] == "message_received":
                delivered += 1
                delayed += int((item.get("delivery_delay_s") or 0) > 0)
                tampered += int(item.get("tampered", False))
            elif item["kind"] == "message_dropped":
                dropped += 1

    communication = {}
    bottleneck = None
    for key, bucket in comm.items():
        total = bucket["delivered"] + bucket["dropped"]
        bucket["sent"] = total
        loss = bucket["dropped"] / total if total else 0.0
        avg_delay = bucket["delay_total"] / bucket["delivered"] if bucket["delivered"] else 0.0
        communication[key] = {
            **bucket,
            "loss_rate": round(loss, 3),
            "reliability": round(1.0 - loss, 3),
            "avg_delay_s": round(avg_delay, 3),
        }
        score = loss * 100.0 + min(avg_delay, 30.0) + bucket["stale"] * 5 + bucket["tampered"] * 10
        if total and (bottleneck is None or score > bottleneck["score"]):
            bottleneck = {"link": key, "score": round(score, 3), "loss_rate": round(loss, 3),
                          "avg_delay_s": round(avg_delay, 3), "stale_messages": bucket["stale"],
                          "tampered_messages": bucket["tampered"]}

    return {
        "summary": {"leaders": len(leaders), "delivered_messages": delivered,
                     "delayed_messages": delayed, "dropped_messages": dropped,
                     "tampered_messages": tampered},
        "communication_analysis": {
            "links": communication,
            "bottleneck": bottleneck,
        },
        "leaders": [{"username": u, "team": assignments[u], "timeline": timelines[u]} for u in leaders],
        "scenario": scenario or {},
    }


def render_html(aar: dict) -> str:
    s = aar["summary"]
    parts = [
        "<!doctype html><html><head><meta charset='utf-8'><title>After Action Review</title>",
        "<style>body{font-family:system-ui,sans-serif;max-width:1100px;margin:2rem auto;padding:0 1rem}"
        "table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:.5rem;text-align:left}"
        ".badge{display:inline-block;padding:.25rem .5rem;margin-right:.4rem;border:1px solid #ccc;border-radius:6px}"
        "pre{white-space:pre-wrap}</style></head><body><h1>After-Action Review</h1>",
        f"<p><span class='badge'>Delivered: {s['delivered_messages']}</span>"
        f"<span class='badge'>Delayed: {s['delayed_messages']}</span>"
        f"<span class='badge'>Dropped: {s['dropped_messages']}</span>"
        f"<span class='badge'>Tampered: {s['tampered_messages']}</span></p>",
    ]
    ca = aar.get("communication_analysis", {})
    parts.append("<h2>Communication Analysis</h2>")
    bottleneck = ca.get("bottleneck")
    if bottleneck:
        parts.append(f"<p><strong>Detected bottleneck:</strong> {html.escape(str(bottleneck.get('link')))} — loss {bottleneck.get('loss_rate', 0):.1%}, average delay {bottleneck.get('avg_delay_s', 0):.1f}s, stale {bottleneck.get('stale_messages', 0)}</p>")
    parts.append("<table><tr><th>Link</th><th>Reliability</th><th>Avg delay</th><th>Stale</th><th>Tampered</th></tr>")
    for link, data in ca.get("links", {}).items():
        parts.append(f"<tr><td>{html.escape(link)}</td><td>{data.get('reliability', 0):.1%}</td><td>{data.get('avg_delay_s', 0):.1f}s</td><td>{data.get('stale', 0)}</td><td>{data.get('tampered', 0)}</td></tr>")
    parts.append("</table>")
    for leader in aar["leaders"]:
        parts.append(f"<h2>{html.escape(leader['username'])} — {html.escape(leader['team'])}</h2>")
        parts.append("<table><tr><th>Clock</th><th>Event</th><th>Details</th><th>True state</th></tr>")
        for item in leader["timeline"]:
            details = {k: v for k, v in item.items() if k not in ("clock_s", "kind", "what_was_true")}
            parts.append("<tr>"
                         f"<td>T+{item['clock_s']:.1f}s</td>"
                         f"<td>{html.escape(str(item['kind']))}</td>"
                         f"<td><pre>{html.escape(json.dumps(details, indent=2, default=str))}</pre></td>"
                         f"<td><pre>{html.escape(json.dumps(item.get('what_was_true'), indent=2, default=str))}</pre></td>"
                         "</tr>")
        parts.append("</table>")
    parts.append("</body></html>")
    return "".join(parts)
