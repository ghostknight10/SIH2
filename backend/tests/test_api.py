"""End-to-end tests through FastAPI's TestClient (REST + WebSocket).

Needs `pip install -r requirements.txt` (fastapi + httpx). Skipped automatically if
those aren't installed.   Run:  python -m unittest discover -s tests -v
"""
import tempfile
import unittest
from pathlib import Path

try:
    from fastapi.testclient import TestClient
    from starlette.websockets import WebSocketDisconnect
    HAVE_FASTAPI = True
except ImportError:  # pragma: no cover
    HAVE_FASTAPI = False

from app.config import BASE_DIR, Settings


@unittest.skipUnless(HAVE_FASTAPI, "fastapi/httpx not installed")
class ApiTests(unittest.TestCase):
    def setUp(self):
        from app.main import create_app
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        settings = Settings(db_path=str(Path(tmp.name) / "t.db"), scenario_dir=BASE_DIR / "scenarios",
                            jwt_secret="test-secret", jwt_algorithm="HS256", token_ttl_minutes=5,
                            cors_origins=(), seed_password="pw12345")
        self.client = TestClient(create_app(settings))
        self.client.__enter__()  # runs lifespan startup
        self.addCleanup(self.client.__exit__, None, None, None)

    def login(self, username, password="pw12345"):
        r = self.client.post("/login", json={"username": username, "password": password})
        return r

    def auth(self, username):
        tok = self.login(username).json()["access_token"]
        return {"Authorization": f"Bearer {tok}"}

    def make_session(self, **body):
        body.setdefault("scenario_id", "ambush_north")
        r = self.client.post("/sessions", json=body, headers=self.auth("instructor"))
        self.assertEqual(r.status_code, 201, r.text)
        return r.json()

    def test_health(self):
        self.assertEqual(self.client.get("/health").json(), {"status": "ok", "scenarios": 1})

    def test_login(self):
        ok = self.login("Player1")  # case-insensitive username
        self.assertEqual(ok.status_code, 200)
        self.assertEqual(ok.json()["role"], "player")
        self.assertEqual(self.login("player1", "wrong").status_code, 401)
        self.assertEqual(self.login("ghost").status_code, 401)

    def test_me_requires_token(self):
        self.assertEqual(self.client.get("/me").status_code, 401)
        self.assertEqual(self.client.get("/me", headers={"Authorization": "Bearer junk"}).status_code, 401)
        self.assertEqual(self.client.get("/me", headers=self.auth("player2")).json()["username"], "player2")

    def test_user_management_is_instructor_only(self):
        body = {"username": "newbie", "password": "secret1", "role": "player"}
        self.assertEqual(self.client.post("/users", json=body, headers=self.auth("player1")).status_code, 403)
        self.assertEqual(self.client.post("/users", json=body, headers=self.auth("instructor")).status_code, 201)
        self.assertEqual(self.client.post("/users", json=body, headers=self.auth("instructor")).status_code, 409)
        self.assertEqual(self.login("newbie", "secret1").status_code, 200)

    def test_session_creation(self):
        p, i = self.auth("player1"), self.auth("instructor")
        self.assertEqual(self.client.post("/sessions", json={"scenario_id": "ambush_north"}, headers=p).status_code, 403)
        self.assertEqual(self.client.post("/sessions", json={"scenario_id": "nope"}, headers=i).status_code, 404)
        self.assertEqual(self.client.post("/sessions", json={"scenario_id": "ambush_north",
                                                             "assignments": {"player1": "opfor"}}, headers=i).status_code, 422)
        s = self.make_session(assignments={"player1": "bravo"})
        self.assertEqual(s["assignments"], {"player1": "bravo"})
        self.assertEqual(self.client.get(f"/sessions/{s['id']}", headers=p).status_code, 200)
        self.assertNotIn("assignments", self.client.get(f"/sessions/{s['id']}", headers=p).json())
        self.assertEqual(self.client.get("/sessions/zzz", headers=p).status_code, 404)
        self.assertEqual(len(self.client.get("/sessions", headers=p).json()), 1)

    def test_ws_player_gets_filtered_snapshot_and_ping(self):
        s = self.make_session(assignments={"player1": "bravo"})
        tok = self.login("player1").json()["access_token"]
        with self.client.websocket_connect(f"/ws/{s['id']}?token={tok}") as ws:
            snap = ws.receive_json()
            self.assertEqual(snap["type"], "snapshot")
            self.assertEqual(snap["you"]["team"], "bravo")
            self.assertEqual(len(snap["units"]), 5)
            ws.send_json({"type": "ping"})
            self.assertEqual(ws.receive_json()["type"], "pong")
            ws.send_json({"type": "move"})
            self.assertEqual(ws.receive_json()["code"], "unsupported")
            ws.send_text("not json")
            self.assertEqual(ws.receive_json()["code"], "bad_json")

    def test_ws_instructor_sees_everything(self):
        s = self.make_session()
        tok = self.login("instructor").json()["access_token"]
        with self.client.websocket_connect(f"/ws/{s['id']}?token={tok}") as ws:
            snap = ws.receive_json()
            self.assertEqual(len(snap["units"]), 7)
            self.assertIn("radio", snap)

    def test_ws_rejections(self):
        s = self.make_session()
        for url, code in ((f"/ws/{s['id']}?token=bad", 4401), (f"/ws/{s['id']}", 4401)):
            with self.assertRaises(WebSocketDisconnect) as cm:
                with self.client.websocket_connect(url) as ws:
                    ws.receive_json()
            self.assertEqual(cm.exception.code, code)
        tok = self.login("player1").json()["access_token"]
        with self.assertRaises(WebSocketDisconnect) as cm:
            with self.client.websocket_connect(f"/ws/unknown?token={tok}") as ws:
                ws.receive_json()
        self.assertEqual(cm.exception.code, 4404)

    def test_start_session(self):
        s = self.make_session()
        url = f"/sessions/{s['id']}/start"
        self.assertEqual(self.client.post(url, headers=self.auth("player1")).status_code, 403)
        self.assertEqual(self.client.post("/sessions/zzz/start", headers=self.auth("instructor")).status_code, 404)
        r = self.client.post(url, headers=self.auth("instructor"))
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["status"], "running")
        self.assertEqual(self.client.post(url, headers=self.auth("instructor")).status_code, 409)

    def test_ws_messages_and_orders(self):
        s = self.make_session(assignments={"player1": "alpha", "player2": "bravo"}, seed=1)
        tok = self.login("player1").json()["access_token"]
        with self.client.websocket_connect(f"/ws/{s['id']}?token={tok}") as ws:
            ws.receive_json()  # snapshot
            ws.send_json({"type": "message", "to": ["bravo"], "text": "hi", "ref": 1})
            self.assertEqual(ws.receive_json()["code"], "not_running")   # not started yet
            r = self.client.post(f"/sessions/{s['id']}/start", headers=self.auth("instructor"))
            self.assertEqual(r.status_code, 200)
            self.assertEqual(ws.receive_json()["type"], "status")        # broadcast to connected clients
            ws.send_json({"type": "message", "to": ["bravo"], "text": "hi", "ref": 2})
            ack = ws.receive_json()
            self.assertEqual((ack["type"], ack["kind"], ack["ref"]), ("ack", "message", 2))
            ws.send_json({"type": "order", "unit_id": "alpha_1", "action": "move", "lat": 34.2, "lon": 77.6})
            self.assertEqual(ws.receive_json()["kind"], "order")
            ws.send_json({"type": "order", "unit_id": "bravo_1", "action": "hold"})   # not your unit
            self.assertEqual(ws.receive_json()["code"], "invalid")

    def test_session_seed_validation(self):
        i = self.auth("instructor")
        self.assertEqual(self.client.post("/sessions", json={"scenario_id": "ambush_north", "seed": -1}, headers=i).status_code, 422)
        self.assertEqual(self.client.post("/sessions", json={"scenario_id": "ambush_north", "seed": 7}, headers=i).status_code, 201)


if __name__ == "__main__":
    unittest.main()
