"""Live session state and orchestration for the training simulator.

The SessionState remains the single source of truth.  Steps 9-15 add the delivery
scheduler, filtered state updates, instructor controls, queued event logging,
reconnect-safe delivery, session termination and AAR support around that state.
"""
import asyncio
import logging
import random
import secrets
import time
import uuid
from dataclasses import asdict, dataclass, field
from typing import Any, Callable

from .aar import assignments_from_events, build_aar
from .clock import SessionClock
from .communication_intel import information_quality
from .db import Database
from .degradation import DegradationPolicy
from .delivery import DeliveryScheduler
from .eventlog import EventWriter
from .runner import ScenarioRunner
from .scenario import Scenario, Unit

log = logging.getLogger("sih.sessions")

CLOSE_REPLACED = 4000
CLOSE_UNAUTHORIZED = 4401
CLOSE_FORBIDDEN = 4403
CLOSE_NOT_FOUND = 4404

STATUSES = ("created", "running", "paused", "ended")


class SessionManagerError(Exception):
    pass


class UnknownScenario(SessionManagerError):
    pass


class InvalidAssignment(SessionManagerError):
    pass


class SessionClosed(SessionManagerError):
    pass


class InvalidTransition(SessionManagerError):
    pass


@dataclass
class UnitState:
    id: str
    name: str
    team: str
    kind: str
    lat: float
    lon: float
    intent: dict | None = None

    @classmethod
    def from_unit(cls, u: Unit) -> "UnitState":
        return cls(u.id, u.name, u.team, u.kind, u.lat, u.lon)

    def to_dict(self, include_intent: bool = False) -> dict:
        d = asdict(self)
        if not include_intent:
            d.pop("intent")
        return d


@dataclass
class Connection:
    user_id: int
    username: str
    role: str
    team: str | None
    websocket: Any
    connected_at: float
    send_lock: asyncio.Lock = field(default_factory=asyncio.Lock)
    ready: bool = False


@dataclass
class SessionState:
    id: str
    scenario: Scenario
    created_by: str
    created_at: float
    units: dict[str, UnitState]
    radio_up: dict[str, bool]
    assignments: dict[str, str]
    status: str = "created"
    clock: SessionClock = field(default_factory=SessionClock)
    seed: int = 0
    rng: random.Random = field(default_factory=random.Random)
    policy: DegradationPolicy = field(default_factory=DegradationPolicy)
    delivery_heap: list = field(default_factory=list)
    offline_deliveries: dict[str, list] = field(default_factory=dict)
    connections: dict[int, Connection] = field(default_factory=dict)
    next_event_idx: int = 0
    message_counter: int = 0
    order_counter: int = 0
    delivery_seq: int = 0
    runner_task: asyncio.Task | None = None
    delivery: DeliveryScheduler | None = None
    radio_restore_tasks: dict[str, asyncio.Task] = field(default_factory=dict)
    state_broadcast_tasks: set[asyncio.Task] = field(default_factory=set)

    @property
    def clock_s(self) -> float:
        return self.clock.now()

    @property
    def paused(self) -> bool:
        return self.clock.paused


class SessionManager:
    def __init__(self, db: Database, scenarios: dict[str, Scenario],
                 time_source: Callable[[], float] = time.monotonic, tick_s: float = 0.2):
        self.db = db
        self._scenarios = scenarios
        self._time_source = time_source
        self._sessions: dict[str, SessionState] = {}
        self.runner = ScenarioRunner(self, tick_s=tick_s)
        self.events = EventWriter(db)

    # ---- lookup ------------------------------------------------------------
    def get(self, session_id: str) -> SessionState | None:
        return self._sessions.get(session_id)

    def all(self) -> list[SessionState]:
        return list(self._sessions.values())

    def user_id(self, username: str) -> int | None:
        user = self.db.get_user_by_username(username)
        return user["id"] if user else None

    def connection_for_username(self, state: SessionState, username: str) -> Connection | None:
        return next((c for c in state.connections.values() if c.username == username), None)

    # ---- logging -----------------------------------------------------------
    def log(self, state: SessionState, type: str, actor: str | None, payload: dict) -> None:
        self.events.put(state.id, type, actor, payload)

    async def flush_events(self) -> None:
        await self.events.flush()

    # ---- step 3: session creation -----------------------------------------
    def create(self, scenario_id: str, creator: dict,
               assignments: dict[str, str] | None = None, seed: int | None = None) -> SessionState:
        scenario = self._scenarios.get(scenario_id)
        if scenario is None:
            raise UnknownScenario(scenario_id)
        clean = self._validate_assignments(scenario, assignments or {})
        session_id = self._new_id()
        now = time.time()
        seed = secrets.randbits(32) if seed is None else seed
        state = SessionState(
            id=session_id,
            scenario=scenario,
            created_by=creator["username"],
            created_at=now,
            units={u.id: UnitState.from_unit(u) for u in scenario.units},
            radio_up={t.id: True for t in scenario.teams},
            assignments=dict(clean),
            clock=SessionClock(self._time_source),
            seed=seed,
            rng=random.Random(seed),
        )
        self.db.insert_session(session_id, scenario.id, creator["id"], state.status, now)
        self._sessions[session_id] = state
        self.log(state, "session_started", creator["username"], {
            "scenario_id": scenario.id,
            "assignments": clean,
            "seed": seed,
            "clock_s": 0.0,
            "units": [u.to_dict(include_intent=True) for u in state.units.values()],
            "true_world": self.true_world(state),
            "policy": asdict(state.policy),
        })
        return state

    def _new_id(self) -> str:
        while True:
            sid = uuid.uuid4().hex[:8]
            if sid not in self._sessions:
                return sid

    def _validate_assignments(self, scenario: Scenario, assignments: dict[str, str]) -> dict[str, str]:
        clean: dict[str, str] = {}
        for username, team in assignments.items():
            uname = username.strip().lower()
            user = self.db.get_user_by_username(uname)
            if user is None or user["role"] != "player":
                raise InvalidAssignment(f"{username!r} is not a known player")
            if team not in scenario.friendly_team_ids:
                raise InvalidAssignment(f"{team!r} is not a friendly team in scenario {scenario.id!r}")
            clean[uname] = team
        return clean

    # ---- step 5: start -----------------------------------------------------
    async def start_session(self, state: SessionState, actor: dict) -> None:
        if state.status != "created":
            raise InvalidTransition(f"Session is {state.status}; only a newly created session can be started")
        state.clock.start()
        state.status = "running"
        self.db.update_session_status(state.id, "running")
        self.log(state, "session_status_changed", actor["username"], {
            "from": "created", "to": "running", "clock_s": 0.0,
        })
        self.runner.start(state)
        if state.delivery is None:
            state.delivery = DeliveryScheduler(self, state)
        state.delivery.start()
        await self.broadcast(state, {"type": "status", "status": "running",
                                     "clock_s": state.clock_s, "server_time": time.time()})

    # ---- sending -----------------------------------------------------------
    async def send_json(self, conn: Connection, payload: dict) -> bool:
        try:
            async with conn.send_lock:
                await conn.websocket.send_json(payload)
            return True
        except Exception:
            return False

    async def broadcast(self, state: SessionState, payload: dict) -> None:
        conns = list(state.connections.values())
        results = await asyncio.gather(*(self.send_json(c, payload) for c in conns), return_exceptions=False)
        for conn, ok in zip(conns, results):
            if not ok:
                log.debug("broadcast to %s failed", conn.username)

    async def deliver_one(self, state: SessionState, conn: Connection, delivery) -> bool:
        payload = {
            "type": "message",
            "message_id": delivery.message.id,
            "from": delivery.message.sender,
            "from_team": delivery.message.sender_team,
            "content": delivery.content,
            "sent_clock": delivery.message.sent_clock,
            "scheduled_deliver_at": delivery.deliver_at,
            "delivered_clock": state.clock_s,
            "delay_s": delivery.delay_s,
            "tampered": delivery.tampered,
            "priority": delivery.priority,
            "information_quality": information_quality(
                delay_s=delivery.delay_s or 0.0, priority=delivery.priority,
                tampered=delivery.tampered, max_delay_s=state.policy.max_delay_s,
            ),
        }
        ok = await self.send_json(conn, payload)
        if not ok:
            state.offline_deliveries.setdefault(conn.username, []).append(delivery)
            self.disconnect(state, conn)
            return False
        self.log(state, "message_delivered", conn.username, {
            "message_id": delivery.message.id,
            "sender": delivery.message.sender,
            "sender_team": delivery.message.sender_team,
            "recipient_team": delivery.recipient_team,
            "content": delivery.content,
            "sent_clock": delivery.message.sent_clock,
            "deliver_at_clock": delivery.deliver_at,
            "delivered_clock": state.clock_s,
            "delivery_delay_s": delivery.delay_s,
            "tampered": delivery.tampered,
            "priority": delivery.priority,
            "information_quality": information_quality(
                delay_s=delivery.delay_s or 0.0, priority=delivery.priority,
                tampered=delivery.tampered, max_delay_s=state.policy.max_delay_s,
            ),
        })
        return True

    async def flush_reconnect(self, state: SessionState, conn: Connection) -> None:
        pending = state.offline_deliveries.pop(conn.username, [])
        if not pending:
            return
        # Only due messages can be here. Preserve FIFO order for the same recipient.
        pending.sort(key=lambda d: (d.deliver_at or 0.0, d.message.id))
        remaining = []
        for index, delivery in enumerate(pending):
            if state.status == "ended":
                remaining.extend(pending[index:])
                break
            if not await self.deliver_one(state, conn, delivery):
                remaining.extend(pending[index + 1:])
                break
        if remaining:
            state.offline_deliveries.setdefault(conn.username, []).extend(remaining)

    # ---- step 4: connect / disconnect -------------------------------------
    def assign_team(self, state: SessionState, username: str) -> str:
        existing = state.assignments.get(username)
        if existing:
            return existing
        teams = state.scenario.friendly_team_ids
        counts = {t: 0 for t in teams}
        for t in state.assignments.values():
            counts[t] += 1
        team = min(teams, key=lambda t: counts[t])
        state.assignments[username] = team
        self.log(state, "player_assigned", username, {"team": team, "auto": True, "clock_s": state.clock_s})
        return team

    async def connect(self, state: SessionState, user: dict, websocket: Any) -> Connection:
        if state.status == "ended":
            raise SessionClosed(state.id)
        role = user["role"]
        team = None if role == "instructor" else self.assign_team(state, user["username"])
        conn = Connection(user["id"], user["username"], role, team, websocket, time.time())
        previous = state.connections.get(user["id"])
        state.connections[user["id"]] = conn
        self.log(state, "client_connected", user["username"], {
            "role": role, "team": team, "replaced_previous": previous is not None,
            "clock_s": state.clock_s,
        })
        if previous is not None:
            try:
                await previous.websocket.close(code=CLOSE_REPLACED, reason="Replaced by a newer connection")
            except Exception:
                log.debug("could not close replaced socket for %s", user["username"], exc_info=True)
        return conn

    def disconnect(self, state: SessionState, conn: Connection) -> bool:
        if state.connections.get(conn.user_id) is not conn:
            return False
        del state.connections[conn.user_id]
        self.log(state, "client_disconnected", conn.username, {
            "role": conn.role, "team": conn.team, "clock_s": state.clock_s,
        })
        return True

    # ---- step 10: filtered state ------------------------------------------
    def true_world(self, state: SessionState) -> dict:
        return {
            "clock_s": state.clock_s,
            "units": [u.to_dict(include_intent=True) for u in state.units.values()],
            "radio": dict(state.radio_up),
        }

    def visible_units(self, state: SessionState, conn: Connection) -> list[UnitState]:
        if conn.role == "instructor":
            return list(state.units.values())
        return [u for u in state.units.values()
                if state.scenario.side_of(u.team) == "friendly"]

    def filtered_units(self, state: SessionState, conn: Connection) -> list[dict]:
        return [u.to_dict(include_intent=conn.role == "instructor" or u.team == conn.team)
                for u in self.visible_units(state, conn)]

    async def broadcast_filtered_state(self, state: SessionState, reason: str = "update") -> None:
        conns = list(state.connections.values())
        for conn in conns:
            units = self.filtered_units(state, conn)
            payload = {"type": "state_update", "reason": reason,
                       "clock_s": state.clock_s, "units": units}
            if conn.role == "instructor":
                payload["radio"] = dict(state.radio_up)
            elif conn.team is not None:
                payload["radio_up"] = state.radio_up.get(conn.team, True)
            if await self.send_json(conn, payload):
                self.log(state, "state_update_sent", conn.username, {
                    "reason": reason, "clock_s": state.clock_s, "units": units,
                "radio_up": state.radio_up.get(conn.team, True) if conn.role == "player" else dict(state.radio_up),
                })

    def schedule_state_broadcast(self, state: SessionState, reason: str = "update") -> None:
        if state.status == "ended":
            return
        task = asyncio.create_task(self.broadcast_filtered_state(state, reason),
                                   name=f"state-update-{state.id}")
        state.state_broadcast_tasks.add(task)
        task.add_done_callback(state.state_broadcast_tasks.discard)

    def snapshot_for(self, state: SessionState, conn: Connection) -> dict:
        instructor = conn.role == "instructor"
        teams = [t for t in state.scenario.teams if instructor or t.side == "friendly"]
        snap = {
            "type": "snapshot",
            "session_id": state.id,
            "scenario": {"id": state.scenario.id, "name": state.scenario.name},
            "status": state.status,
            "paused": state.paused,
            "clock_s": state.clock_s,
            "server_time": time.time(),
            "you": {"username": conn.username, "role": conn.role, "team": conn.team},
            "teams": [asdict(t) for t in teams],
            "units": self.filtered_units(state, conn),
        }
        if instructor:
            online = {c.username for c in state.connections.values()}
            snap["radio"] = dict(state.radio_up)
            snap["roster"] = [
                {"username": name, "team": team, "online": name in online}
                for name, team in sorted(state.assignments.items())
            ]
        return snap

    # ---- step 15: AAR ------------------------------------------------------
    def build_aar(self, state: SessionState) -> dict:
        events = self.db.get_events(state.id)
        scenario = {
            "id": state.scenario.id,
            "name": state.scenario.name,
            "description": state.scenario.description,
        }
        return build_aar(events, state.assignments, scenario)

    def build_aar_from_db(self, session_id: str) -> dict | None:
        """Build an AAR from durable DB data when the live session is not in memory."""
        row = self.db.get_session(session_id)
        if row is None:
            return None
        scenario = self._scenarios.get(row["scenario_id"])
        if scenario is None:
            return None
        events = self.db.get_events(session_id)
        assignments = assignments_from_events(events)
        return build_aar(events, assignments, {
            "id": scenario.id,
            "name": scenario.name,
            "description": scenario.description,
        })

    def pending_delivery_count(self, state: SessionState) -> int:
        return len(state.delivery_heap) + sum(len(v) for v in state.offline_deliveries.values())

    # ---- lifecycle ---------------------------------------------------------
    async def shutdown(self) -> None:
        for state in self.all():
            if state.delivery is not None:
                await state.delivery.stop()
            await self.runner.stop(state)
            for task in list(state.state_broadcast_tasks):
                task.cancel()
            for task in list(state.state_broadcast_tasks):
                try:
                    await task
                except asyncio.CancelledError:
                    pass
            state.state_broadcast_tasks.clear()
            for task in list(state.radio_restore_tasks.values()):
                task.cancel()
            for task in list(state.radio_restore_tasks.values()):
                try:
                    await task
                except asyncio.CancelledError:
                    pass
            state.radio_restore_tasks.clear()
            for conn in list(state.connections.values()):
                try:
                    await conn.websocket.close(code=1001, reason="Server shutting down")
                except Exception:
                    pass
            state.connections.clear()
        await self.flush_events()
        await self.events.stop()

    # ---- summary -----------------------------------------------------------
    def summary(self, state: SessionState, detailed: bool = False) -> dict:
        data = {
            "id": state.id,
            "scenario_id": state.scenario.id,
            "scenario_name": state.scenario.name,
            "status": state.status,
            "clock_s": state.clock_s,
            "created_by": state.created_by,
            "created_at": state.created_at,
            "players_online": sum(1 for c in state.connections.values() if c.role == "player"),
            "pending_deliveries": self.pending_delivery_count(state),
        }
        if detailed:
            data["assignments"] = dict(state.assignments)
            data["online"] = sorted(c.username for c in state.connections.values())
            data["radio"] = dict(state.radio_up)
        return data
