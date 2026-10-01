"""Tests for everything that doesn't need FastAPI: security, scenarios, DB, sessions.

Run from the backend/ folder:   python -m unittest discover -s tests -v
"""
import asyncio
import tempfile
import time
import unittest
from pathlib import Path

from app.config import BASE_DIR, Settings
from app.db import Database, DuplicateUser
from app.scenario import ScenarioError, load_scenarios, parse_scenario
from app.security import (TokenError, create_access_token, decode_access_token,
                          hash_password, verify_password)
from app.seed import seed_users
from app.sessions import (CLOSE_REPLACED, InvalidAssignment, SessionClosed,
                          SessionManager, UnknownScenario)


def make_settings(tmp: str, **over) -> Settings:
    base = dict(db_path=str(Path(tmp) / "t.db"), scenario_dir=BASE_DIR / "scenarios",
                jwt_secret="test-secret", jwt_algorithm="HS256", token_ttl_minutes=5,
                cors_origins=(), seed_password="pw12345")
    base.update(over)
    return Settings(**base)


class FakeWebSocket:
    def __init__(self):
        self.sent, self.closed = [], None

    async def send_json(self, data):
        self.sent.append(data)

    async def close(self, code=1000, reason=None):
        self.closed = (code, reason)


class SecurityTests(unittest.TestCase):
    def test_password_hash_roundtrip(self):
        h = hash_password("hunter22")
        self.assertTrue(verify_password("hunter22", h))
        self.assertFalse(verify_password("hunter23", h))
        self.assertNotEqual(h, hash_password("hunter22"))  # salted

    def test_malformed_hash_is_rejected_not_raised(self):
        for bad in ("", "plain", "scrypt$zz$zz", "md5$aa$bb", "a$b"):
            self.assertFalse(verify_password("x", bad))

    def test_token_roundtrip(self):
        with tempfile.TemporaryDirectory() as tmp:
            s = make_settings(tmp)
            tok = create_access_token({"id": 7, "username": "player1", "role": "player"}, s)
            c = decode_access_token(tok, s)
            self.assertEqual((c.user_id, c.username, c.role), (7, "player1", "player"))

    def test_token_wrong_secret_expired_and_garbage(self):
        with tempfile.TemporaryDirectory() as tmp:
            s = make_settings(tmp)
            user = {"id": 1, "username": "u", "role": "player"}
            tok = create_access_token(user, s)
            with self.assertRaises(TokenError):
                decode_access_token(tok, make_settings(tmp, jwt_secret="other"))
            expired = create_access_token(user, s, now=time.time() - 3600)
            with self.assertRaises(TokenError):
                decode_access_token(expired, s)
            for junk in ("", "abc", "a.b.c"):
                with self.assertRaises(TokenError):
                    decode_access_token(junk, s)


class ScenarioTests(unittest.TestCase):
    def valid(self):
        return {
            "id": "s", "name": "S",
            "teams": [{"id": "a", "name": "A", "side": "friendly"},
                      {"id": "e", "name": "E", "side": "enemy"}],
            "units": [{"id": "u1", "name": "U1", "team": "a", "kind": "x", "lat": 1, "lon": 2}],
        }

    def test_bundled_scenario_loads(self):
        sc = load_scenarios(BASE_DIR / "scenarios")["ambush_north"]
        self.assertEqual(len(sc.teams), 4)
        self.assertEqual(sc.friendly_team_ids, ("alpha", "bravo", "charlie"))
        self.assertEqual(len(sc.units), 7)
        self.assertEqual([e["at"] for e in sc.events], [60, 120, 180])
        self.assertEqual(sc.side_of("opfor"), "enemy")

    def test_minimal_valid(self):
        self.assertEqual(parse_scenario(self.valid()).events, ())

    def test_rejections(self):
        def broken(mutate):
            d = self.valid()
            mutate(d)
            with self.assertRaises(ScenarioError):
                parse_scenario(d)
        broken(lambda d: d["units"][0].update(team="nope"))
        broken(lambda d: d["teams"].__setitem__(0, {"id": "a", "name": "A", "side": "enemy"}))
        broken(lambda d: d["teams"].append({"id": "a", "name": "dup", "side": "friendly"}))
        broken(lambda d: d["units"].append(dict(d["units"][0])))
        broken(lambda d: d["units"][0].update(lat=91))
        broken(lambda d: d["units"][0].update(lat="1"))
        broken(lambda d: d.pop("name"))
        broken(lambda d: d.update(teams=[]))
        broken(lambda d: d.update(events=[{"at": -1, "kind": "k"}]))
        broken(lambda d: d.update(events=[{"at": 1}]))

    def test_load_errors(self):
        with tempfile.TemporaryDirectory() as tmp:
            with self.assertRaises(ScenarioError):
                load_scenarios(tmp)  # empty
            (Path(tmp) / "bad.json").write_text("{not json")
            with self.assertRaises(ScenarioError):
                load_scenarios(tmp)
            with self.assertRaises(ScenarioError):
                load_scenarios(Path(tmp) / "missing")


class DatabaseTests(unittest.TestCase):
    def test_users_and_events(self):
        with tempfile.TemporaryDirectory() as tmp:
            db = Database(str(Path(tmp) / "t.db"))
            db.init()
            db.init()  # idempotent
            u = db.create_user("bob", "h", "player", "Bob")
            with self.assertRaises(DuplicateUser):
                db.create_user("bob", "h2", "player", "Bob 2")
            self.assertEqual(db.get_user(u["id"])["username"], "bob")
            self.assertIsNone(db.get_user_by_username("nobody"))
            db.insert_event("s1", "b", "bob", {"n": 2}, ts=2.0)
            db.insert_event("s1", "a", "bob", {"n": 1}, ts=1.0)
            db.insert_event("s2", "z", None, {}, ts=0.5)
            self.assertEqual([e["type"] for e in db.get_events("s1")], ["a", "b"])
            self.assertEqual(db.get_events("s1")[0]["payload"], {"n": 1})

    def test_seed_only_when_empty(self):
        with tempfile.TemporaryDirectory() as tmp:
            s = make_settings(tmp)
            db = Database(s.db_path)
            db.init()
            self.assertTrue(seed_users(db, s))
            self.assertFalse(seed_users(db, s))
            self.assertEqual(db.count_users(), 6)
            self.assertEqual(db.get_user_by_username("instructor")["role"], "instructor")
            self.assertTrue(verify_password("pw12345", db.get_user_by_username("player1")["password_hash"]))


class SessionTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        s = make_settings(self._tmp.name)
        self.db = Database(s.db_path)
        self.db.init()
        seed_users(self.db, s)
        self.manager = SessionManager(self.db, load_scenarios(s.scenario_dir))
        self.instructor = self.db.get_user_by_username("instructor")
        self.p = {i: self.db.get_user_by_username(f"player{i}") for i in range(1, 6)}

    def types(self, state):
        return [e["type"] for e in self.db.get_events(state.id)]

    async def test_create_logs_session_started(self):
        st = self.manager.create("ambush_north", self.instructor, {"Player1": "bravo"})
        self.assertEqual(st.status, "created")
        self.assertEqual(len(st.units), 7)
        self.assertTrue(all(st.radio_up.values()))
        self.assertEqual(st.assignments, {"player1": "bravo"})
        ev = self.db.get_events(st.id)
        self.assertEqual([e["type"] for e in ev], ["session_started"])
        self.assertEqual(ev[0]["actor"], "instructor")
        self.assertEqual(ev[0]["payload"]["assignments"], {"player1": "bravo"})
        self.assertEqual(len(ev[0]["payload"]["units"]), 7)
        self.assertIs(self.manager.get(st.id), st)
        self.assertEqual(len(self.db.list_sessions()), 1)

    async def test_create_rejections(self):
        with self.assertRaises(UnknownScenario):
            self.manager.create("nope", self.instructor)
        for bad in ({"ghost": "alpha"}, {"instructor": "alpha"},
                    {"player1": "opfor"}, {"player1": "zulu"}):
            with self.assertRaises(InvalidAssignment):
                self.manager.create("ambush_north", self.instructor, bad)
        self.assertEqual(self.manager.all(), [])  # nothing half-created

    async def test_auto_assignment_is_balanced(self):
        st = self.manager.create("ambush_north", self.instructor)
        teams = []
        for i in range(1, 5):
            c = await self.manager.connect(st, self.p[i], FakeWebSocket())
            teams.append(c.team)
        self.assertEqual(teams, ["alpha", "bravo", "charlie", "alpha"])
        self.assertEqual(self.types(st).count("player_assigned"), 4)

    async def test_explicit_assignment_is_kept_and_counts_toward_balance(self):
        st = self.manager.create("ambush_north", self.instructor, {"player1": "alpha"})
        c1 = await self.manager.connect(st, self.p[1], FakeWebSocket())
        c2 = await self.manager.connect(st, self.p[2], FakeWebSocket())
        self.assertEqual((c1.team, c2.team), ("alpha", "bravo"))
        self.assertNotIn("player_assigned", [e["type"] for e in self.db.get_events(st.id)
                                             if e["actor"] == "player1"])

    async def test_player_snapshot_hides_enemy_and_instructor_data(self):
        st = self.manager.create("ambush_north", self.instructor)
        pc = await self.manager.connect(st, self.p[1], FakeWebSocket())
        snap = self.manager.snapshot_for(st, pc)
        self.assertEqual(snap["type"], "snapshot")
        self.assertEqual(snap["you"], {"username": "player1", "role": "player", "team": "alpha"})
        ids = {u["id"] for u in snap["units"]}
        self.assertEqual(ids, {"alpha_1", "alpha_2", "bravo_1", "bravo_2", "charlie_1"})
        self.assertNotIn("opfor", {t["id"] for t in snap["teams"]})
        self.assertNotIn("radio", snap)
        self.assertNotIn("roster", snap)

    async def test_instructor_snapshot_is_full(self):
        st = self.manager.create("ambush_north", self.instructor, {"player1": "alpha"})
        await self.manager.connect(st, self.p[1], FakeWebSocket())
        ic = await self.manager.connect(st, self.instructor, FakeWebSocket())
        snap = self.manager.snapshot_for(st, ic)
        self.assertIsNone(snap["you"]["team"])
        self.assertEqual(len(snap["units"]), 7)
        self.assertEqual(len(snap["teams"]), 4)
        self.assertEqual(snap["radio"], {"alpha": True, "bravo": True, "charlie": True, "opfor": True})
        self.assertEqual(snap["roster"], [{"username": "player1", "team": "alpha", "online": True}])

    async def test_reconnect_replaces_old_socket_safely(self):
        st = self.manager.create("ambush_north", self.instructor)
        ws1, ws2 = FakeWebSocket(), FakeWebSocket()
        c1 = await self.manager.connect(st, self.p[1], ws1)
        c2 = await self.manager.connect(st, self.p[1], ws2)
        self.assertEqual(ws1.closed[0], CLOSE_REPLACED)
        self.assertIsNone(ws2.closed)
        self.assertEqual(c1.team, c2.team)
        self.assertIs(st.connections[self.p[1]["id"]], c2)
        # the old handler's cleanup must not evict the new connection
        self.assertFalse(self.manager.disconnect(st, c1))
        self.assertIn(self.p[1]["id"], st.connections)
        self.assertTrue(self.manager.disconnect(st, c2))
        self.assertNotIn(self.p[1]["id"], st.connections)
        self.assertEqual(self.types(st).count("client_disconnected"), 1)
        self.assertTrue([e for e in self.db.get_events(st.id)
                         if e["type"] == "client_connected" and e["payload"]["replaced_previous"]])

    async def test_dead_old_socket_does_not_break_reconnect(self):
        class Dead(FakeWebSocket):
            async def close(self, code=1000, reason=None):
                raise RuntimeError("already closed")
        st = self.manager.create("ambush_north", self.instructor)
        await self.manager.connect(st, self.p[1], Dead())
        c2 = await self.manager.connect(st, self.p[1], FakeWebSocket())
        self.assertIs(st.connections[self.p[1]["id"]], c2)

    async def test_ended_session_refuses_connections(self):
        st = self.manager.create("ambush_north", self.instructor)
        st.status = "ended"
        with self.assertRaises(SessionClosed):
            await self.manager.connect(st, self.p[1], FakeWebSocket())
        self.assertEqual(st.connections, {})

    async def test_summary_detail_levels(self):
        st = self.manager.create("ambush_north", self.instructor)
        await self.manager.connect(st, self.p[1], FakeWebSocket())
        basic, full = self.manager.summary(st), self.manager.summary(st, detailed=True)
        self.assertEqual(basic["players_online"], 1)
        self.assertNotIn("assignments", basic)
        self.assertEqual(full["online"], ["player1"])
        self.assertEqual(full["assignments"], {"player1": "alpha"})

    async def test_shutdown_closes_everything(self):
        st = self.manager.create("ambush_north", self.instructor)
        ws = FakeWebSocket()
        await self.manager.connect(st, self.p[1], ws)
        await self.manager.shutdown()
        self.assertEqual(ws.closed[0], 1001)


if __name__ == "__main__":
    unittest.main()
