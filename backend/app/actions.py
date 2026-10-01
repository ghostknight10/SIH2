"""Handling messages that arrive from clients over the WebSocket (pipeline steps 6-7).

`handle_client_message` is a plain synchronous function (no awaits), so each message
is validated, applied and logged atomically with respect to the event loop. It returns
the reply to send back to that client, or None.

Clients may attach a `ref` (string or int) to any message; it is echoed in the reply.
Replies never reveal degradation: a message whose radio is cut is acknowledged like
any other (the drop shows up only in the log / after-action report).
"""
import time
from typing import TYPE_CHECKING

from .comms import new_message, route_message

if TYPE_CHECKING:
    from .sessions import Connection, SessionManager, SessionState

MAX_TEXT = 500
ORDER_ACTIONS = ("move", "hold")


def _number(v, lo, hi):
    return (not isinstance(v, bool)) and isinstance(v, (int, float)) and lo <= v <= hi


def handle_client_message(manager: "SessionManager", state: "SessionState",
                          conn: "Connection", msg) -> dict | None:
    kind = msg.get("type") if isinstance(msg, dict) else None
    ref = msg.get("ref") if isinstance(msg, dict) else None
    if not isinstance(ref, (str, int)) or isinstance(ref, bool):
        ref = None

    def err(code: str, detail: str) -> dict:
        return {"type": "error", "code": code, "detail": detail, "ref": ref}

    if kind == "ping":
        return {"type": "pong", "server_time": time.time(), "ref": ref}
    if kind not in ("message", "order"):
        return err("unsupported", f"Unsupported message type: {kind!r}")
    if conn.role != "player":
        return err("forbidden", "Only players can send messages and orders")
    if state.status != "running":
        return err("not_running", f"Session is {state.status}")
    if state.paused:
        return err("paused", "Session is paused")

    if kind == "message":
        return _handle_message(manager, state, conn, msg, ref, err)
    return _handle_order(manager, state, conn, msg, ref, err)


def _handle_message(manager, state, conn, msg, ref, err) -> dict:
    text = msg.get("text")
    if not isinstance(text, str) or not text.strip():
        return err("invalid", "'text' must be a non-empty string")
    text = text.strip()
    if len(text) > MAX_TEXT:
        return err("invalid", f"'text' is longer than {MAX_TEXT} characters")

    friendly = state.scenario.friendly_team_ids
    to = msg.get("to")
    if to == "all":
        teams = friendly
    elif isinstance(to, list) and to and all(isinstance(t, str) for t in to):
        teams = tuple(dict.fromkeys(to))  # de-duplicate, keep order
        unknown = [t for t in teams if t not in friendly]
        if unknown:
            return err("invalid", f"Unknown team(s): {', '.join(unknown)}")
    else:
        return err("invalid", "'to' must be \"all\" or a non-empty list of team ids")

    message = new_message(state, source="player", sender=conn.username, sender_team=conn.team,
                          to_teams=teams, content=text)
    route_message(manager, state, message)
    return {"type": "ack", "kind": "message", "id": message.id,
            "sent_clock": message.sent_clock, "ref": ref}


def _handle_order(manager, state, conn, msg, ref, err) -> dict:
    unit = state.units.get(msg.get("unit_id")) if isinstance(msg.get("unit_id"), str) else None
    # Same answer for "doesn't exist" and "not yours" so players can't probe enemy unit ids.
    if unit is None or unit.team != conn.team:
        return err("invalid", "No such unit on your team")
    action = msg.get("action")
    if action not in ORDER_ACTIONS:
        return err("invalid", f"'action' must be one of {list(ORDER_ACTIONS)}")
    target = None
    if action == "move":
        lat, lon = msg.get("lat"), msg.get("lon")
        if not (_number(lat, -90, 90) and _number(lon, -180, 180)):
            return err("invalid", "'move' needs numeric 'lat' (-90..90) and 'lon' (-180..180)")
        target = {"lat": float(lat), "lon": float(lon)}

    # Step 7: ground truth changes immediately.
    state.order_counter += 1
    order_id = f"o{state.order_counter}"
    now = state.clock.now()
    previous = unit.intent
    unit.intent = {"order_id": order_id, "action": action, "target": target,
                   "issued_by": conn.username, "issued_clock": now}
    manager.log(state, "order_issued", conn.username, {
        "order_id": order_id, "unit_id": unit.id, "team": conn.team, "action": action,
        "target": target, "previous_intent": previous, "clock_s": now,
    })
    return {"type": "ack", "kind": "order", "id": order_id, "unit_id": unit.id,
            "clock_s": now, "ref": ref}
