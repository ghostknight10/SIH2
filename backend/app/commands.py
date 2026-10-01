"""Instructor controls (pipeline steps 11 and 14).

The command layer keeps the REST and WebSocket control surfaces on the same state
transitions.  It intentionally contains no FastAPI code so it is easy to test.
"""
import asyncio
import contextlib
import time
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .sessions import SessionManager, SessionState


class CommandError(Exception):
    pass


class UnknownTeam(CommandError):
    pass


async def pause_session(manager: "SessionManager", state: "SessionState", actor: dict) -> None:
    if state.status != "running":
        raise CommandError(f"Session is {state.status}; only a running session can be paused")
    before = state.clock_s
    state.clock.pause()
    state.status = "paused"
    if state.delivery is not None:
        state.delivery.notify()
    manager.log(state, "session_status_changed", actor["username"], {
        "from": "running", "to": "paused", "clock_s": state.clock_s,
    })
    await manager.broadcast(state, {
        "type": "status", "status": "paused", "paused": True,
        "clock_s": state.clock_s, "server_time": time.time(),
    })


async def resume_session(manager: "SessionManager", state: "SessionState", actor: dict) -> None:
    if state.status != "paused":
        raise CommandError(f"Session is {state.status}; only a paused session can be resumed")
    state.clock.resume()
    state.status = "running"
    if state.delivery is not None:
        state.delivery.notify()
    manager.log(state, "session_status_changed", actor["username"], {
        "from": "paused", "to": "running", "clock_s": state.clock_s,
    })
    await manager.broadcast(state, {
        "type": "status", "status": "running", "paused": False,
        "clock_s": state.clock_s, "server_time": time.time(),
    })


async def set_radio(manager: "SessionManager", state: "SessionState", actor: dict,
                    team_id: str, up: bool, restore_after_s: float | None = None) -> None:
    if team_id not in state.radio_up:
        raise UnknownTeam(team_id)
    if restore_after_s is not None and restore_after_s <= 0:
        raise CommandError("restore_after_s must be greater than 0")

    task = state.radio_restore_tasks.pop(team_id, None)
    if task is not None:
        task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await task

    state.radio_up[team_id] = bool(up)
    manager.log(state, "radio_status_changed", actor["username"], {
        "team": team_id, "up": bool(up), "restore_after_s": restore_after_s,
        "clock_s": state.clock_s,
    })
    await manager.broadcast_filtered_state(state, reason="radio_status_changed")

    if not up and restore_after_s is not None:
        task = asyncio.create_task(
            _auto_restore(manager, state, actor["username"], team_id, restore_after_s),
            name=f"radio-restore-{state.id}-{team_id}",
        )
        state.radio_restore_tasks[team_id] = task


async def _auto_restore(manager, state, actor: str, team_id: str, delay: float) -> None:
    try:
        await asyncio.sleep(delay)
        if state.status == "ended" or state.radio_up.get(team_id, True):
            return
        state.radio_up[team_id] = True
        manager.log(state, "radio_status_changed", actor, {
            "team": team_id, "up": True, "auto": True, "clock_s": state.clock_s,
        })
        await manager.broadcast_filtered_state(state, reason="radio_auto_restored")
    except asyncio.CancelledError:
        raise
    finally:
        if state.radio_restore_tasks.get(team_id) is asyncio.current_task():
            state.radio_restore_tasks.pop(team_id, None)


async def end_session(manager: "SessionManager", state: "SessionState", actor: dict) -> None:
    if state.status == "ended":
        raise CommandError("Session is already ended")
    previous = state.status
    if state.clock.running:
        state.clock.pause()
    state.status = "ended"
    await manager.runner.stop(state)
    if state.delivery is not None:
        await state.delivery.stop()
    for task in list(state.state_broadcast_tasks):
        task.cancel()
    for task in list(state.state_broadcast_tasks):
        with contextlib.suppress(asyncio.CancelledError):
            await task
    state.state_broadcast_tasks.clear()
    for team, task in list(state.radio_restore_tasks.items()):
        task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await task
        state.radio_restore_tasks.pop(team, None)
    manager.log(state, "session_status_changed", actor["username"], {
        "from": previous, "to": "ended", "clock_s": state.clock_s,
    })
    manager.db.update_session_status(state.id, "ended")
    manager.log(state, "session_ended", actor["username"], {
        "clock_s": state.clock_s,
        "undelivered": manager.pending_delivery_count(state),
    })
    await manager.broadcast(state, {
        "type": "status", "status": "ended", "paused": False,
        "clock_s": state.clock_s, "server_time": time.time(),
    })
