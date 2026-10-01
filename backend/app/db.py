"""SQLite storage: users, sessions and the append-only events table.

A new connection is opened per call, which is plenty for an MVP and avoids sharing
connections across threads. The `events` table is append-only by convention: nothing
in the codebase updates or deletes rows in it.
"""
import json
import sqlite3
import time
from contextlib import contextmanager

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL CHECK (role IN ('player', 'instructor')),
    display_name  TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
    id          TEXT PRIMARY KEY,
    scenario_id TEXT NOT NULL,
    created_by  INTEGER NOT NULL REFERENCES users(id),
    status      TEXT NOT NULL,
    created_at  REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS events (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    type       TEXT NOT NULL,
    actor      TEXT,
    ts         REAL NOT NULL,
    payload    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_session_ts ON events(session_id, ts, id);
"""


class DuplicateUser(Exception):
    pass


class Database:
    def __init__(self, path: str):
        self.path = path

    @contextmanager
    def connect(self):
        conn = sqlite3.connect(self.path, timeout=10)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

    def init(self) -> None:
        with self.connect() as conn:
            conn.execute("PRAGMA journal_mode = WAL")
            conn.executescript(SCHEMA)

    # ---- users -------------------------------------------------------------
    def count_users(self) -> int:
        with self.connect() as conn:
            return conn.execute("SELECT COUNT(*) FROM users").fetchone()[0]

    def create_user(self, username: str, password_hash: str, role: str, display_name: str) -> dict:
        try:
            with self.connect() as conn:
                cur = conn.execute(
                    "INSERT INTO users (username, password_hash, role, display_name) VALUES (?, ?, ?, ?)",
                    (username, password_hash, role, display_name),
                )
                user_id = cur.lastrowid
        except sqlite3.IntegrityError as exc:
            raise DuplicateUser(username) from exc
        return {"id": user_id, "username": username, "role": role, "display_name": display_name}

    def get_user_by_username(self, username: str) -> dict | None:
        with self.connect() as conn:
            row = conn.execute("SELECT * FROM users WHERE username = ?", (username,)).fetchone()
        return dict(row) if row else None

    def get_user(self, user_id: int) -> dict | None:
        with self.connect() as conn:
            row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        return dict(row) if row else None

    # ---- sessions ----------------------------------------------------------
    def get_session(self, session_id: str) -> dict | None:
        with self.connect() as conn:
            row = conn.execute("SELECT * FROM sessions WHERE id = ?", (session_id,)).fetchone()
        return dict(row) if row else None

    def insert_session(self, session_id: str, scenario_id: str, created_by: int,
                       status: str, created_at: float) -> None:
        with self.connect() as conn:
            conn.execute(
                "INSERT INTO sessions (id, scenario_id, created_by, status, created_at) VALUES (?, ?, ?, ?, ?)",
                (session_id, scenario_id, created_by, status, created_at),
            )

    def update_session_status(self, session_id: str, status: str) -> None:
        with self.connect() as conn:
            conn.execute("UPDATE sessions SET status = ? WHERE id = ?", (status, session_id))

    def list_sessions(self) -> list[dict]:
        with self.connect() as conn:
            rows = conn.execute("SELECT * FROM sessions ORDER BY created_at DESC").fetchall()
        return [dict(r) for r in rows]

    # ---- events (append-only) ----------------------------------------------
    def insert_event(self, session_id: str, type: str, actor: str | None,
                     payload: dict, ts: float | None = None) -> int:
        ts = time.time() if ts is None else ts
        with self.connect() as conn:
            cur = conn.execute(
                "INSERT INTO events (session_id, type, actor, ts, payload) VALUES (?, ?, ?, ?, ?)",
                (session_id, type, actor, ts, json.dumps(payload, default=str)),
            )
            return cur.lastrowid

    def get_events(self, session_id: str) -> list[dict]:
        with self.connect() as conn:
            rows = conn.execute(
                "SELECT * FROM events WHERE session_id = ? ORDER BY ts, id", (session_id,)
            ).fetchall()
        out = []
        for r in rows:
            d = dict(r)
            d["payload"] = json.loads(d["payload"])
            out.append(d)
        return out
