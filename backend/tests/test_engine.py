"""Tests for pipeline steps 5-8: clock, degradation, routing, player actions, runner.

No FastAPI needed. Run from backend/:   python -m unittest discover -s tests -v
"""
import asyncio
import json
import random
import tempfile
import unittest
from pathlib import Path

from app.actions import MAX_TEXT, handle_client_message
from app.clock import ClockError, SessionClock
from app.comms import new_message, recipients_for, route_message
from app.config import BASE_DIR
from app.db import Database
from app.degradation import (DROP_RANDOM, DROP_RECIPIENT_RADIO, DROP_SENDER_RADIO,
                             DegradationPolicy, Message, decide)
from app.scenario import ScenarioError, load_scenarios, parse_scenario
from app.seed import seed_users
from app.sessions import InvalidTransition, SessionManager
from test_core import FakeWebSocket, make_settings


class FakeTime:
    def __init__(self):
        self.t = 100.0

    def __call__(self):
        return self.t


def msg(**over):
    base = dict(id="m1", source="player", sender="player1", sender_team="alpha",
                to_teams=("bravo",), content="hello", sent_clock=10.0)
    base.update(over)
    return Message(**base)


class ClockTests(unittest.TestCase):
    def test_start_pause_resume(self):
        ft = FakeTime()
        c = SessionClock(ft)
        self.assertEqual((c.now(), c.started, c.paused), (0.0, False, False))
        c.start()
        ft.t += 5
        self.assertEqual(c.now(), 5.0)
        c.pause()
        ft.t += 100                      # frozen while paused
        self.assertEqual((c.now(), c.paused), (5.0, True))
        c.resume()
        ft.t += 2
        self.assertEqual((c.now(), c.paused), (7.0, False))
        c.pause(); c.pause(); c.resume(); c.resume()   # idempotent
        self.assertEqual(c.now(), 7.0)

    def test_cannot_start_twice(self):
        c = SessionClock(FakeTime())
        c.start()
        with self.assertRaises(ClockError):
            c.start()


class DegradationTests(unittest.TestCase):
    def setUp(self):
        self.up = {"alpha": True, "bravo": True}
        self.rng = random.Random(1)

    def test_radio_cut_drops_before_any_roll(self):
        p = DegradationPolicy(drop_prob=0.0)
        before = random.Random(1).getstate()
        d = decide(p, msg(), "player2", "bravo", {"alpha": False, "bravo": True}, self.rng)
        self.assertEqual((d.outcome, d.reason), ("dropped", DROP_SENDER_RADIO))
        d = decide(p, msg(), "player2", "bravo", {"alpha": True, "bravo": False}, self.rng)
        self.assertEqual((d.outcome, d.reason), ("dropped", DROP_RECIPIENT_RADIO))
        self.assertEqual(self.rng.getstate(), before)   # no randomness consumed

    def test_scenario_message_ignores_sender_radio(self):
        m = msg(source="scenario", sender="scenario", sender_team=None)
        d = decide(DegradationPolicy(drop_prob=0.0), m, "player2", "bravo", {"alpha": False, "bravo": True}, self.rng)
        self.assertEqual(d.outcome, "scheduled")

    def test_random_loss_extremes(self):
        always = decide(DegradationPolicy(drop_prob=1.0), msg(), "p", "bravo", self.up, self.rng)
        self.assertEqual((always.outcome, always.reason), ("dropped", DROP_RANDOM))
        for _ in range(200):
            self.assertEqual(decide(DegradationPolicy(drop_prob=0.0), msg(), "p", "bravo", self.up, self.rng).outcome,
                             "scheduled")

    def test_delay_within_bounds_and_deliver_at(self):
        p = DegradationPolicy(drop_prob=0.0, min_delay_s=5, max_delay_s=30)
        delays = []
        for _ in range(300):
            d = decide(p, msg(sent_clock=10.0), "p", "bravo", self.up, self.rng)
            self.assertTrue(5 <= d.delay_s <= 30)
            self.assertAlmostEqual(d.deliver_at, 10.0 + d.delay_s)
            delays.append(d.delay_s)
        self.assertGreater(max(delays) - min(delays), 10)  # actually varies

    def test_same_seed_same_decisions(self):
        def run(seed):
            r, p = random.Random(seed), DegradationPolicy(drop_prob=0.3)
            return [(d.outcome, d.delay_s) for d in
                    (decide(p, msg(), "p", "bravo", self.up, r) for _ in range(50))]
        self.assertEqual(run(7), run(7))
        self.assertNotEqual(run(7), run(8))

    def test_tampering(self):
        p = DegradationPolicy(drop_prob=0.0, conflict_prob=0.0)
        no_alt = decide(DegradationPolicy(drop_prob=0.0, conflict_prob=1.0), msg(), "p", "bravo", self.up, self.rng)
        self.assertFalse(no_alt.tampered)                              # nothing to swap in
        alt = msg(alt_content="CONFLICT")
        self.assertFalse(decide(p, alt, "p", "bravo", self.up, self.rng).tampered)   # policy says 0
        forced = decide(p, msg(alt_content="CONFLICT", conflict_prob=1.0), "p", "bravo", self.up, self.rng)
        self.assertEqual((forced.tampered, forced.content), (True, "CONFLICT"))      # message overrides policy
        never = decide(DegradationPolicy(drop_prob=0.0, conflict_prob=1.0),
                       msg(alt_content="CONFLICT", conflict_prob=0.0), "p", "bravo", self.up, self.rng)
        self.assertEqual((never.tampered, never.content), (False, "hello"))

    def test_policy_validation(self):
        for bad in (dict(drop_prob=1.5), dict(conflict_prob=-0.1),
                    dict(min_delay_s=10, max_delay_s=5), dict(min_delay_s=-1)):
            with self.assertRaises(ValueError):
                DegradationPolicy(**bad)


class EngineBase(unittest.IsolatedAsyncioTestCase):
    """A manager with a fake monotonic clock and a started session."""
    scenarios_dir = BASE_DIR / "scenarios"
    tick_s = 0.2

    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        s = make_settings(self._tmp.name)
        self.db = Database(s.db_path)
        self.db.init()
        seed_users(self.db, s)
        self.ft = FakeTime()
        self.manager = SessionManager(self.db, load_scenarios(self.scenarios_dir),
                                      time_source=self.ft, tick_s=self.tick_s)
        self.instructor = self.db.get_user_by_username("instructor")
        self.p = {i: self.db.get_user_by_username(f"player{i}") for i in range(1, 6)}

    async def make_session(self, assignments=None, seed=42, start=True, scenario="ambush_north"):
        st = self.manager.create(scenario, self.instructor, assignments, seed=seed)
        if start:
            await self.manager.start_session(st, self.instructor)
        return st

    async def teardown_session(self, st):
        await self.manager.runner.stop(st)

    def types(self, st, *only):
        ev = [e["type"] for e in self.db.get_events(st.id)]
        return [t for t in ev if t in only] if only else ev

    def events(self, st, type):
        return [e for e in self.db.get_events(st.id) if e["type"] == type]


class RoutingTests(EngineBase):
    async def test_recipients_exclude_sender_and_use_assignments(self):
        st = await self.make_session({"player1": "alpha", "player2": "alpha", "player3": "bravo"})
        self.assertEqual(recipients_for(st, ("alpha",), exclude="player1"), [("player2", "alpha")])
        self.assertEqual(recipients_for(st, ("alpha", "bravo")),
                         [("player1", "alpha"), ("player2", "alpha"), ("player3", "bravo")])
        self.assertEqual(recipients_for(st, ("charlie",)), [])
        await self.teardown_session(st)

    async def test_route_logs_every_decision_and_queues_survivors(self):
        st = await self.make_session({"player1": "alpha", "player2": "bravo", "player3": "bravo",
                                      "player4": "charlie"})
        st.policy = DegradationPolicy(drop_prob=0.0, min_delay_s=5, max_delay_s=30)
        st.radio_up["charlie"] = False   # player4 can't receive
        m = new_message(st, source="player", sender="player1", sender_team="alpha",
                        to_teams=("bravo", "charlie"), content="advance")
        out = route_message(self.manager, st, m)
        self.assertEqual({d.recipient: d.outcome for d in out},
                         {"player2": "scheduled", "player3": "scheduled", "player4": "dropped"})
        self.assertEqual(len(st.delivery_heap), 2)
        times = [t for t, _, _ in st.delivery_heap]
        self.assertEqual(min(times), st.delivery_heap[0][0])            # heap property: root is earliest
        self.assertNotEqual(out[0].delay_s, out[1].delay_s)             # independent per recipient
        sent = self.events(st, "message_sent")[0]
        self.assertEqual(sent["payload"]["recipients"], ["player2", "player3", "player4"])
        self.assertEqual(sent["actor"], "player1")
        self.assertEqual(len(self.events(st, "message_scheduled")), 2)
        dropped = self.events(st, "message_dropped")
        self.assertEqual([(e["actor"], e["payload"]["reason"]) for e in dropped],
                         [("player4", DROP_RECIPIENT_RADIO)])
        await self.teardown_session(st)

    async def test_sender_radio_cut_drops_everything(self):
        st = await self.make_session({"player1": "alpha", "player2": "bravo"})
        st.radio_up["alpha"] = False
        m = new_message(st, source="player", sender="player1", sender_team="alpha",
                        to_teams=("bravo",), content="x")
        route_message(self.manager, st, m)
        self.assertEqual(st.delivery_heap, [])
        self.assertEqual(self.events(st, "message_dropped")[0]["payload"]["reason"], DROP_SENDER_RADIO)
        await self.teardown_session(st)

    async def test_same_seed_reproduces_decisions(self):
        async def run():
            st = await self.make_session({"player1": "alpha", "player2": "bravo", "player3": "charlie"}, seed=99)
            st.policy = DegradationPolicy(drop_prob=0.4)
            outs = []
            for _ in range(20):
                m = new_message(st, source="player", sender="player1", sender_team="alpha",
                                to_teams=("bravo", "charlie"), content="x")
                outs += [(d.outcome, d.delay_s) for d in route_message(self.manager, st, m)]
            await self.teardown_session(st)
            return outs
        self.assertEqual(await run(), await run())

    async def test_seed_is_logged(self):
        st = await self.make_session(seed=1234, start=False)
        self.assertEqual(self.events(st, "session_started")[0]["payload"]["seed"], 1234)
        st2 = await self.make_session(start=False, seed=None)
        self.assertIsInstance(st2.seed, int)


class ActionTests(EngineBase):
    async def asyncSetUp(self):
        self.st = await self.make_session({"player1": "alpha", "player2": "bravo", "player3": "bravo"})
        self.c1 = await self.manager.connect(self.st, self.p[1], FakeWebSocket())
        self.ci = await self.manager.connect(self.st, self.instructor, FakeWebSocket())
        self.st.policy = DegradationPolicy(drop_prob=0.0)
        self.addAsyncCleanup(self.teardown_session, self.st)

    def send(self, conn, payload):
        return handle_client_message(self.manager, self.st, conn, payload)

    async def test_ping_and_unsupported(self):
        self.assertEqual(self.send(self.c1, {"type": "ping", "ref": "r1"})["ref"], "r1")
        r = self.send(self.c1, {"type": "dance"})
        self.assertEqual(r["code"], "unsupported")
        for junk in ("text", 5, None, [1]):
            self.assertEqual(self.send(self.c1, junk)["code"], "unsupported")

    async def test_ref_is_only_echoed_when_scalar(self):
        self.assertEqual(self.send(self.c1, {"type": "dance", "ref": 7})["ref"], 7)
        self.assertIsNone(self.send(self.c1, {"type": "dance", "ref": {"x": 1}})["ref"])
        self.assertIsNone(self.send(self.c1, {"type": "dance", "ref": True})["ref"])

    async def test_message_flow(self):
        r = self.send(self.c1, {"type": "message", "to": ["bravo"], "text": "  Moving north  ", "ref": 1})
        self.assertEqual((r["type"], r["kind"], r["id"], r["ref"]), ("ack", "message", "m1", 1))
        sent = self.events(self.st, "message_sent")[0]
        self.assertEqual(sent["payload"]["content"], "Moving north")
        self.assertEqual(sent["payload"]["recipients"], ["player2", "player3"])
        self.assertEqual(len(self.st.delivery_heap), 2)
        r2 = self.send(self.c1, {"type": "message", "to": "all", "text": "all stations"})
        self.assertEqual(r2["id"], "m2")
        self.assertEqual(self.events(self.st, "message_sent")[1]["payload"]["to_teams"],
                         ["alpha", "bravo", "charlie"])

    async def test_dropped_message_is_acked_like_any_other(self):
        self.st.radio_up["alpha"] = False
        r = self.send(self.c1, {"type": "message", "to": ["bravo"], "text": "hi"})
        self.assertEqual((r["type"], r["kind"]), ("ack", "message"))   # sender isn't told
        self.assertEqual(self.st.delivery_heap, [])
        self.assertEqual(len(self.events(self.st, "message_dropped")), 2)

    async def test_message_validation(self):
        bad = [
            {"type": "message", "to": ["bravo"]},
            {"type": "message", "to": ["bravo"], "text": "   "},
            {"type": "message", "to": ["bravo"], "text": 5},
            {"type": "message", "to": ["bravo"], "text": "x" * (MAX_TEXT + 1)},
            {"type": "message", "text": "hi"},
            {"type": "message", "to": [], "text": "hi"},
            {"type": "message", "to": "bravo", "text": "hi"},
            {"type": "message", "to": [1], "text": "hi"},
            {"type": "message", "to": ["opfor"], "text": "hi"},    # enemy team
            {"type": "message", "to": ["zulu"], "text": "hi"},
        ]
        for payload in bad:
            self.assertEqual(self.send(self.c1, payload)["code"], "invalid", payload)
        self.assertEqual(self.events(self.st, "message_sent"), [])   # nothing leaked into the log
        ok = self.send(self.c1, {"type": "message", "to": ["bravo"], "text": "x" * MAX_TEXT})
        self.assertEqual(ok["type"], "ack")

    async def test_instructor_cannot_send_player_actions(self):
        self.assertEqual(self.send(self.ci, {"type": "message", "to": "all", "text": "hi"})["code"], "forbidden")
        self.assertEqual(self.send(self.ci, {"type": "order", "unit_id": "alpha_1", "action": "hold"})["code"], "forbidden")

    async def test_not_running_and_paused(self):
        self.st.clock.pause()
        self.assertEqual(self.send(self.c1, {"type": "message", "to": "all", "text": "hi"})["code"], "paused")
        self.assertEqual(self.send(self.c1, {"type": "ping"})["type"], "pong")   # ping still works
        self.st.clock.resume()
        self.st.status = "ended"
        self.assertEqual(self.send(self.c1, {"type": "order", "unit_id": "alpha_1", "action": "hold"})["code"], "not_running")

    async def test_move_order_updates_true_state_and_logs(self):
        self.ft.t += 12
        r = self.send(self.c1, {"type": "order", "unit_id": "alpha_1", "action": "move", "lat": 34.2, "lon": 77.6, "ref": "o"})
        self.assertEqual((r["type"], r["kind"], r["id"], r["unit_id"], r["clock_s"]), ("ack", "order", "o1", "alpha_1", 12.0))
        u = self.st.units["alpha_1"]
        self.assertEqual(u.intent["target"], {"lat": 34.2, "lon": 77.6})
        self.assertEqual((u.lat, u.lon), (34.1520, 77.5780))        # no movement simulation yet
        ev = self.events(self.st, "order_issued")[0]
        self.assertEqual(ev["actor"], "player1")
        self.assertIsNone(ev["payload"]["previous_intent"])
        self.send(self.c1, {"type": "order", "unit_id": "alpha_1", "action": "hold"})
        self.assertEqual(self.st.units["alpha_1"].intent["action"], "hold")
        self.assertEqual(self.events(self.st, "order_issued")[1]["payload"]["previous_intent"]["order_id"], "o1")
        self.assertEqual(self.st.delivery_heap, [])                  # orders don't create messages

    async def test_order_validation(self):
        bad = [
            {"unit_id": "bravo_1", "action": "hold"},          # someone else's unit
            {"unit_id": "opfor_1", "action": "hold"},          # enemy unit
            {"unit_id": "nope", "action": "hold"},
            {"unit_id": 5, "action": "hold"},
            {"action": "hold"},
            {"unit_id": "alpha_1", "action": "fly"},
            {"unit_id": "alpha_1", "action": "move"},
            {"unit_id": "alpha_1", "action": "move", "lat": "34", "lon": 77},
            {"unit_id": "alpha_1", "action": "move", "lat": 95, "lon": 77},
            {"unit_id": "alpha_1", "action": "move", "lat": 34, "lon": True},
        ]
        replies = [self.send(self.c1, {"type": "order", **p}) for p in bad]
        self.assertTrue(all(r["code"] == "invalid" for r in replies), replies)
        # identical wording for "not yours" and "doesn't exist" so enemy ids can't be probed
        self.assertEqual(replies[0]["detail"], replies[2]["detail"])
        self.assertEqual(self.events(self.st, "order_issued"), [])
        self.assertIsNone(self.st.units["alpha_1"].intent)

    async def test_snapshot_intent_visibility(self):
        self.send(self.c1, {"type": "order", "unit_id": "alpha_1", "action": "hold"})
        c2 = await self.manager.connect(self.st, self.p[2], FakeWebSocket())   # bravo
        mine = {u["id"]: u for u in self.manager.snapshot_for(self.st, self.c1)["units"]}
        theirs = {u["id"]: u for u in self.manager.snapshot_for(self.st, c2)["units"]}
        inst = {u["id"]: u for u in self.manager.snapshot_for(self.st, self.ci)["units"]}
        self.assertIn("intent", mine["alpha_1"])
        self.assertNotIn("intent", theirs["alpha_1"])     # other team can't see the order
        self.assertIn("intent", theirs["bravo_1"])
        self.assertEqual(inst["alpha_1"]["intent"]["action"], "hold")
        self.assertIn("intent", inst["opfor_1"])


class RunnerTests(EngineBase):
    async def test_start_transitions(self):
        st = await self.make_session({"player1": "alpha"}, start=False)
        w = FakeWebSocket()
        await self.manager.connect(st, self.p[1], w)
        self.assertEqual(handle_client_message(self.manager, st, st.connections[self.p[1]["id"]],
                         {"type": "message", "to": "all", "text": "hi"})["code"], "not_running")
        await self.manager.start_session(st, self.instructor)
        self.assertEqual(st.status, "running")
        self.assertTrue(st.clock.started)
        self.assertEqual(w.sent[-1]["type"], "status")
        self.assertEqual(w.sent[-1]["status"], "running")
        with self.assertRaises(InvalidTransition):
            await self.manager.start_session(st, self.instructor)
        change = self.events(st, "session_status_changed")[0]
        self.assertEqual((change["actor"], change["payload"]["to"]), ("instructor", "running"))
        await self.teardown_session(st)

    async def test_tick_fires_events_at_their_time_exactly_once(self):
        st = await self.make_session({"player1": "alpha", "player2": "bravo", "player3": "charlie"})
        st.policy = DegradationPolicy(drop_prob=0.0)
        r = self.manager.runner
        self.assertEqual(r.tick(st), 0)                       # T+0
        self.ft.t += 59.9
        self.assertEqual(r.tick(st), 0)
        self.ft.t += 0.2                                       # T+60.1: first report (alpha, bravo)
        self.assertEqual(r.tick(st), 1)
        self.assertEqual(r.tick(st), 0)                       # idempotent
        fired = self.events(st, "scenario_event_fired")
        self.assertEqual(len(fired), 1)
        self.assertEqual(fired[0]["payload"]["recipients"], ["player1", "player2"])
        self.assertEqual(len(st.delivery_heap), 2)
        for _, _, d in st.delivery_heap:
            self.assertEqual(d.message.sent_clock, 60.0)       # stamped with the scheduled time
            self.assertGreaterEqual(d.deliver_at, 65.0)
            self.assertLessEqual(d.deliver_at, 90.0)
        self.ft.t += 500                                       # everything else is now due
        self.assertEqual(r.tick(st), 2)
        self.assertEqual(st.next_event_idx, 3)
        self.assertEqual(len(self.events(st, "message_sent")), 3)
        await self.teardown_session(st)

    async def test_no_firing_while_paused(self):
        st = await self.make_session({"player1": "alpha"})
        self.ft.t += 30
        st.clock.pause()
        self.ft.t += 1000
        self.assertEqual(self.manager.runner.tick(st), 0)
        st.clock.resume()
        self.ft.t += 29                                        # 59s of scenario time: still nothing
        self.assertEqual(self.manager.runner.tick(st), 0)
        self.ft.t += 2
        self.assertEqual(self.manager.runner.tick(st), 1)
        await self.teardown_session(st)

    async def test_pause_freezes_pending_deliveries_without_shifting(self):
        st = await self.make_session({"player1": "alpha", "player2": "bravo"})
        st.policy = DegradationPolicy(drop_prob=0.0, min_delay_s=20, max_delay_s=20)
        self.ft.t += 10
        m = new_message(st, source="player", sender="player1", sender_team="alpha",
                        to_teams=("bravo",), content="x")
        route_message(self.manager, st, m)
        deliver_at = st.delivery_heap[0][0]
        self.assertEqual(deliver_at, 30.0)
        st.clock.pause()
        self.ft.t += 600
        st.clock.resume()
        self.assertEqual(st.delivery_heap[0][0], 30.0)         # unchanged
        self.assertEqual(st.clock.now(), 10.0)                  # still 20s away from delivery
        await self.teardown_session(st)

    async def test_conflicting_version_is_chosen_per_recipient(self):
        st = await self.make_session({"player1": "alpha", "player2": "bravo"}, seed=5)
        st.policy = DegradationPolicy(drop_prob=0.0)
        # event at t=120 goes to bravo with alt_text and conflict_prob 0.5; run it on many sessions
        shown = set()
        for seed in range(40):
            s = self.manager.create("ambush_north", self.instructor, {"player2": "bravo"}, seed=seed)
            s.policy = DegradationPolicy(drop_prob=0.0)
            await self.manager.start_session(s, self.instructor)
            s.next_event_idx = 1                                # skip to the t=120 report
            self.ft.t += 121
            self.manager.runner.tick(s)
            shown.add(s.delivery_heap[0][2].content)
            await self.teardown_session(s)
            self.ft.t -= 121
        self.assertEqual(shown, {"Contact reported on the eastern road.",
                                 "Eastern road reported clear; all contact is from the north."})
        await self.teardown_session(st)

    async def test_background_task_fires_events_and_exits(self):
        d = Path(self._tmp.name) / "fast"
        d.mkdir()
        (d / "fast.json").write_text(json.dumps({
            "id": "fast", "name": "Fast",
            "teams": [{"id": "a", "name": "A", "side": "friendly"}],
            "units": [{"id": "u1", "name": "U1", "team": "a", "kind": "x", "lat": 1, "lon": 1}],
            "events": [{"at": 0.1, "kind": "report", "to": ["a"], "text": "first"},
                       {"at": 0.2, "kind": "mystery", "text": "ignored"}],
        }))
        # real clock + fast tick, separate manager
        import time as _t
        mgr = SessionManager(self.db, load_scenarios(d), time_source=_t.monotonic, tick_s=0.02)
        st = mgr.create("fast", self.instructor, {"player1": "a"}, seed=1)
        st.policy = DegradationPolicy(drop_prob=0.0)
        await mgr.start_session(st, self.instructor)
        task = st.runner_task
        self.assertIsNotNone(task)
        await asyncio.wait_for(task, timeout=3)                 # loop ends once all events fired
        self.assertEqual(st.next_event_idx, 2)
        self.assertEqual(len(st.delivery_heap), 1)
        self.assertEqual(len(self.events(st, "scenario_event_skipped")), 1)
        await mgr.shutdown()

    async def test_shutdown_cancels_runner(self):
        st = await self.make_session({"player1": "alpha"})
        task = st.runner_task
        self.assertFalse(task.done())
        await self.manager.shutdown()
        self.assertTrue(task.cancelled() or task.done())
        self.assertIsNone(st.runner_task)

    async def test_tick_errors_do_not_kill_the_loop(self):
        st = await self.make_session({"player1": "alpha"})
        calls = []
        real = self.manager.runner.tick

        def flaky(state):
            calls.append(1)
            if len(calls) == 1:
                raise RuntimeError("boom")
            return real(state)
        self.manager.runner.tick = flaky
        await self.manager.runner.stop(st)
        self.manager.runner.tick_s = 0.01
        self.manager.runner.start(st)
        await asyncio.sleep(0.1)
        self.assertGreater(len(calls), 1)
        self.assertFalse(st.runner_task.done())
        await self.teardown_session(st)


class ScenarioEventValidationTests(unittest.TestCase):
    def base(self, **ev):
        return {"id": "s", "name": "S",
                "teams": [{"id": "a", "name": "A", "side": "friendly"}, {"id": "e", "name": "E", "side": "enemy"}],
                "units": [{"id": "u", "name": "U", "team": "a", "kind": "x", "lat": 0, "lon": 0}],
                "events": [{"at": 1, "kind": "report", "to": ["a"], "text": "t", **ev}]}

    def test_valid_and_optional_fields(self):
        parse_scenario(self.base())
        parse_scenario(self.base(alt_text="other", conflict_prob=0.5))
        parse_scenario(self.base(kind="whatever"))     # unknown kinds are allowed (skipped at runtime)

    def test_rejections(self):
        for ev in (dict(to=["e"]), dict(to=["zzz"]), dict(to=[]), dict(to="a"), dict(text=""),
                   dict(alt_text=""), dict(conflict_prob=1.5), dict(conflict_prob="x")):
            with self.assertRaises(ScenarioError, msg=ev):
                parse_scenario(self.base(**ev))


if __name__ == "__main__":
    unittest.main()
