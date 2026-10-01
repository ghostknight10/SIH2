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


def build_aar(events: list[dict], assignments: dict[str, str], scenario: dict | None = None) -> dict:
    events = sorted(events, key=lambda e: (_clock(e), e.get("ts", 0), e.get("id", 0)))
    leaders = sorted(assignments)
    timelines: dict[str, list[dict[str, Any]]] = {u: [] for u in leaders}
    world_history: list[tuple[float, dict]] = []

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

    for e in events:
        typ = e["type"]
        p = e.get("payload") or {}
        clock = _clock(e)
        actor = e.get("actor")
        if typ == "message_delivered" and actor in timelines:
            timelines[actor].append({
                "clock_s": clock, "kind": "message_received", "message_id": p.get("message_id"),
                "from": p.get("sender"), "content": p.get("content"),
                "tampered": bool(p.get("tampered")), "sent_clock": p.get("sent_clock"),
                "scheduled_deliver_at": p.get("deliver_at_clock"),
                "delivery_delay_s": p.get("delivery_delay_s"), "what_was_true": world_at(clock),
            })
        elif typ == "message_dropped" and actor in timelines:
            timelines[actor].append({
                "clock_s": clock, "kind": "message_dropped", "message_id": p.get("message_id"),
                "reason": p.get("reason"), "what_was_true": world_at(clock),
            })
        elif typ == "state_update_sent" and actor in timelines:
            timelines[actor].append({
                "clock_s": clock, "kind": "state_update", "reason": p.get("reason"),
                "units": p.get("units", []), "what_was_true": world_at(clock),
            })
        elif typ == "order_issued" and actor in timelines:
            timelines[actor].append({
                "clock_s": clock, "kind": "order_issued", "order_id": p.get("order_id"),
                "unit_id": p.get("unit_id"), "action": p.get("action"), "target": p.get("target"),
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

    return {
        "summary": {"leaders": len(leaders), "delivered_messages": delivered,
                     "delayed_messages": delayed, "dropped_messages": dropped,
                     "tampered_messages": tampered},
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
