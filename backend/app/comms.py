"""Message routing (pipeline steps 6 and 8): resolve recipients, apply the degradation
policy per recipient, log every decision, and queue survivors for delivery.

Delivery itself (step 9) is a background task that pops `state.delivery_heap`.
Heap entries are `(deliver_at, seq, Delivery)`; `seq` breaks ties so Delivery objects
are never compared.
"""
import heapq
from typing import TYPE_CHECKING

from .degradation import Delivery, Message, decide

if TYPE_CHECKING:  # avoid a runtime import cycle with sessions.py
    from .sessions import SessionManager, SessionState


def new_message(state: "SessionState", *, source: str, sender: str, sender_team: str | None,
                to_teams, content: str, alt_content: str | None = None,
                conflict_prob: float | None = None, sent_clock: float | None = None,
                priority: str = "NORMAL") -> Message:
    state.message_counter += 1
    return Message(
        id=f"m{state.message_counter}", source=source, sender=sender, sender_team=sender_team,
        to_teams=tuple(to_teams), content=content,
        sent_clock=state.clock.now() if sent_clock is None else sent_clock,
        alt_content=alt_content, conflict_prob=conflict_prob, priority=priority,
    )


def recipients_for(state: "SessionState", to_teams, exclude: str | None = None) -> list[tuple[str, str]]:
    """(username, team) for every assigned player on the target teams, minus the sender.

    Uses assignments rather than live connections, so a player who is briefly offline
    still has messages queued for them.
    """
    teams = set(to_teams)
    return sorted((u, t) for u, t in state.assignments.items() if t in teams and u != exclude)


def route_message(manager: "SessionManager", state: "SessionState", message: Message) -> list[Delivery]:
    recipients = recipients_for(state, message.to_teams, exclude=message.sender)
    manager.log(state, "message_sent", message.sender, {
        "message_id": message.id,
        "source": message.source,
        "sender_team": message.sender_team,
        "to_teams": list(message.to_teams),
        "recipients": [u for u, _ in recipients],
        "content": message.content,
        "priority": message.priority,
        "has_alt_content": message.alt_content is not None,
        "clock_s": message.sent_clock,
    })

    deliveries = []
    for username, team in recipients:
        d = decide(state.policy, message, username, team, state.radio_up, state.rng)
        deliveries.append(d)
        if d.outcome == "dropped":
            manager.log(state, "message_dropped", username, {
                "message_id": message.id, "recipient_team": team, "reason": d.reason,
                "priority": message.priority,
                "clock_s": message.sent_clock,
            })
            continue
        state.delivery_seq += 1
        heapq.heappush(state.delivery_heap, (d.deliver_at, state.delivery_seq, d))
        manager.log(state, "message_scheduled", username, {
            "message_id": message.id, "recipient_team": team, "delay_s": d.delay_s,
            "deliver_at_clock": d.deliver_at, "tampered": d.tampered,
            "priority": d.priority,
            "content_shown": d.content, "clock_s": message.sent_clock,
        })
    if state.delivery is not None:
        state.delivery.notify()
    return deliveries
