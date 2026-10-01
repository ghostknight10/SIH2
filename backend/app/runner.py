"""Scenario runner (pipeline step 5): fires timed scenario events on the session clock.

`tick` is synchronous and deterministic (it only looks at the session clock), so it can
be unit-tested without sleeping. `start` wraps it in a background asyncio task that
polls every `tick_s` seconds and exits once every event has fired.
Events of kind "report" become messages that go through the same degradation path
as player messages. Other kinds are logged as skipped until they are implemented.
"""
import asyncio
import contextlib
import logging
from typing import TYPE_CHECKING

from .comms import new_message, recipients_for, route_message

if TYPE_CHECKING:
    from .sessions import SessionManager, SessionState

log = logging.getLogger("sih.runner")


class ScenarioRunner:
    def __init__(self, manager: "SessionManager", tick_s: float = 0.2):
        self.manager = manager
        self.tick_s = tick_s

    def tick(self, state: "SessionState") -> int:
        """Fire every event whose time has come. Returns how many were fired."""
        if state.status != "running" or state.paused:
            return 0
        events = state.scenario.events
        now = state.clock.now()
        fired = 0
        while state.next_event_idx < len(events) and events[state.next_event_idx]["at"] <= now:
            index = state.next_event_idx
            state.next_event_idx += 1  # advance first: a failing event is never retried
            self._fire(state, index, events[index])
            fired += 1
        return fired

    def _fire(self, state: "SessionState", index: int, event: dict) -> None:
        kind = event["kind"]
        if kind != "report":
            self.manager.log(state, "scenario_event_skipped", "scenario",
                             {"index": index, "kind": kind, "reason": "unsupported kind"})
            return
        recipients = recipients_for(state, event["to"])
        self.manager.log(state, "scenario_event_fired", "scenario", {
            "index": index, "at": event["at"], "kind": kind, "to": event["to"],
            "recipients": [u for u, _ in recipients],
        })
        message = new_message(
            state, source="scenario", sender="scenario", sender_team=None,
            to_teams=event["to"], content=event["text"], alt_content=event.get("alt_text"),
            conflict_prob=event.get("conflict_prob"), sent_clock=float(event["at"]),
        )
        route_message(self.manager, state, message)

    # ---- background task ---------------------------------------------------
    def start(self, state: "SessionState") -> None:
        if state.runner_task is None or state.runner_task.done():
            state.runner_task = asyncio.create_task(self._loop(state), name=f"runner-{state.id}")

    async def _loop(self, state: "SessionState") -> None:
        while state.next_event_idx < len(state.scenario.events) and state.status != "ended":
            try:
                self.tick(state)
            except Exception:
                log.exception("scenario tick failed in session %s", state.id)
            await asyncio.sleep(self.tick_s)

    async def stop(self, state: "SessionState") -> None:
        task, state.runner_task = state.runner_task, None
        if task is not None and not task.done():
            task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await task
