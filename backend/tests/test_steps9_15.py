"""Tests for backend pipeline steps 9-15."""
import asyncio
import unittest

from app.actions import handle_client_message
from app.aar import render_html
from app.comms import new_message, route_message
from app.degradation import DegradationPolicy
from app.commands import CommandError, end_session, pause_session, resume_session, set_radio
from app.sessions import SessionManager
from app.scenario import load_scenarios
from app.config import BASE_DIR
from app.db import Database
from app.seed import seed_users
from test_core import FakeWebSocket, make_settings


class FakeTime:
    def __init__(self):
        self.t = 100.0

    def __call__(self):
        return self.t


class Step9To15Tests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        import tempfile
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        s = make_settings(self.tmp.name)
        self.db = Database(s.db_path)
        self.db.init()
        seed_users(self.db, s)
        self.ft = FakeTime()
        self.manager = SessionManager(self.db, load_scenarios(BASE_DIR / "scenarios"),
                                      time_source=self.ft, tick_s=0.02)
        self.instructor = self.db.get_user_by_username("instructor")
        self.p1 = self.db.get_user_by_username("player1")
        self.p2 = self.db.get_user_by_username("player2")

    async def asyncTearDown(self):
        await self.manager.shutdown()

    async def session(self):
        st = self.manager.create("ambush_north", self.instructor,
                                 {"player1": "alpha", "player2": "bravo"}, seed=3)
        await self.manager.start_session(st, self.instructor)
        return st

    async def test_step9_delivers_due_message_and_logs_actual_time(self):
        st = await self.session()
        w1, w2 = FakeWebSocket(), FakeWebSocket()
        c1 = await self.manager.connect(st, self.p1, w1)
        c2 = await self.manager.connect(st, self.p2, w2)
        c1.ready = c2.ready = True
        st.policy = DegradationPolicy(drop_prob=0, min_delay_s=5, max_delay_s=5)
        r = handle_client_message(self.manager, st, c1,
                                   {"type": "message", "to": ["bravo"], "text": "hello"})
        self.assertEqual(r["type"], "ack")
        self.assertEqual(len(w2.sent), 0)
        self.ft.t += 5
        st.delivery.notify()
        await asyncio.sleep(0.03)
        delivered = [x for x in w2.sent if x.get("type") == "message"]
        self.assertEqual(len(delivered), 1)
        self.assertEqual(delivered[0]["content"], "hello")
        events = [e for e in self.db.get_events(st.id) if e["type"] == "message_delivered"]
        self.assertEqual(len(events), 1)
        self.assertEqual(events[0]["actor"], "player2")
        self.assertGreaterEqual(events[0]["payload"]["delivered_clock"], 5.0)

    async def test_step13_offline_delivery_is_held_until_reconnect(self):
        st = await self.session()
        w1, w2 = FakeWebSocket(), FakeWebSocket()
        c1 = await self.manager.connect(st, self.p1, w1)
        c2 = await self.manager.connect(st, self.p2, w2)
        c1.ready = c2.ready = True
        self.manager.disconnect(st, c2)
        st.policy = DegradationPolicy(drop_prob=0, min_delay_s=2, max_delay_s=2)
        route_message(self.manager, st, new_message(st, source="player", sender="player1",
                                                     sender_team="alpha", to_teams=("bravo",), content="while offline"))
        self.ft.t += 2
        st.delivery.notify()
        await asyncio.sleep(0.03)
        self.assertEqual(len(st.offline_deliveries["player2"]), 1)
        w3 = FakeWebSocket()
        c3 = await self.manager.connect(st, self.p2, w3)
        snapshot = self.manager.snapshot_for(st, c3)
        w3.sent.append(snapshot)
        c3.ready = True
        await self.manager.flush_reconnect(st, c3)
        self.assertEqual(w3.sent[0]["type"], "snapshot")
        self.assertEqual(w3.sent[1]["type"], "message")
        self.assertEqual(w3.sent[1]["content"], "while offline")

    async def test_step10_state_updates_are_filtered(self):
        st = await self.session()
        wa, wb, wi = FakeWebSocket(), FakeWebSocket(), FakeWebSocket()
        ca = await self.manager.connect(st, self.p1, wa)
        cb = await self.manager.connect(st, self.p2, wb)
        ci = await self.manager.connect(st, self.instructor, wi)
        ca.ready = cb.ready = ci.ready = True
        st.units["alpha_1"].intent = {"action": "hold", "order_id": "o1"}
        await self.manager.broadcast_filtered_state(st, reason="test")
        ua = [x for x in wa.sent if x["type"] == "state_update"][-1]
        ub = [x for x in wb.sent if x["type"] == "state_update"][-1]
        ui = [x for x in wi.sent if x["type"] == "state_update"][-1]
        self.assertIn("intent", next(u for u in ua["units"] if u["id"] == "alpha_1"))
        self.assertNotIn("intent", next(u for u in ub["units"] if u["id"] == "alpha_1"))
        self.assertEqual(len(ui["units"]), 7)

    async def test_step11_controls_pause_resume_radio_and_auto_restore(self):
        st = await self.session()
        await pause_session(self.manager, st, self.instructor)
        self.assertEqual(st.status, "paused")
        with self.assertRaises(CommandError):
            await pause_session(self.manager, st, self.instructor)
        await resume_session(self.manager, st, self.instructor)
        self.assertEqual(st.status, "running")
        await set_radio(self.manager, st, self.instructor, "alpha", False, restore_after_s=0.02)
        self.assertFalse(st.radio_up["alpha"])
        await asyncio.sleep(0.05)
        self.assertTrue(st.radio_up["alpha"])

    async def test_step14_end_stops_background_tasks_and_marks_db(self):
        st = await self.session()
        await end_session(self.manager, st, self.instructor)
        self.assertEqual(st.status, "ended")
        self.assertIsNone(st.runner_task)
        self.assertTrue(st.delivery is None or st.delivery.task is None)
        row = [r for r in self.db.list_sessions() if r["id"] == st.id][0]
        self.assertEqual(row["status"], "ended")
        self.assertIn("session_ended", [e["type"] for e in self.db.get_events(st.id)])

    async def test_step15_aar_contains_decisions_and_html(self):
        st = await self.session()
        wa, wb = FakeWebSocket(), FakeWebSocket()
        ca = await self.manager.connect(st, self.p1, wa)
        cb = await self.manager.connect(st, self.p2, wb)
        ca.ready = cb.ready = True
        st.policy = DegradationPolicy(drop_prob=0, min_delay_s=0, max_delay_s=0)
        handle_client_message(self.manager, st, ca,
                              {"type": "order", "unit_id": "alpha_1", "action": "hold"})
        route_message(self.manager, st, new_message(st, source="player", sender="player1",
                                                     sender_team="alpha", to_teams=("bravo",), content="report"))
        st.delivery.notify()
        await asyncio.sleep(0.03)
        aar = self.manager.build_aar(st)
        leader1 = next(x for x in aar["leaders"] if x["username"] == "player1")
        leader2 = next(x for x in aar["leaders"] if x["username"] == "player2")
        self.assertTrue(any(x["kind"] == "order_issued" for x in leader1["timeline"]))
        self.assertTrue(any(x["kind"] == "message_received" for x in leader2["timeline"]))
        html = render_html(aar)
        self.assertIn("After-Action Review", html)
        self.assertIn("player1", html)


if __name__ == "__main__":
    unittest.main()
