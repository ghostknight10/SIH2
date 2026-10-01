# Degraded-comms training simulator — backend

Python 3.10+ / FastAPI / WebSockets / SQLite.

This repository implements the SIH 2026 PS 248 backend pipeline. Steps 1–8 are the
original MVP; steps 9–15 are implemented here.

## Run locally

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
export SIH_JWT_SECRET="$(python -c 'import secrets; print(secrets.token_hex(32))')"
uvicorn app.main:app --reload
```

Docs: `http://localhost:8000/docs`

Run all tests:

```bash
python -m unittest discover -s tests -v
```

Demo users are seeded on an empty database: `instructor`, `player1` … `player5`.
Their shared development password comes from `SIH_SEED_PASSWORD` (default `demo123`).

## Pipeline status

1. Startup — config, SQLite, seed users, scenario validation.
2. Auth — JWT, player/instructor roles.
3. Session creation — scenario state, assignments, seed.
4. Player connect — filtered WebSocket snapshots.
5. Scenario runner — session clock and timed scenario reports.
6. Player actions — messages/orders over WebSocket.
7. True world state — accepted orders immediately update unit intent.
8. Degradation — per-recipient loss, delay and conflicting versions.
9. **Delivery scheduler — complete.** Background task sleeps until due messages,
   sends them to live sockets, logs actual delivery time, and holds due messages for
   offline players.
10. **Filtered state updates — complete.** State changes are broadcast through the
    same visibility boundary as snapshots; players never receive enemy/raw world state.
11. **Instructor controls — complete.** Pause/resume, radio cut/restore with optional
    auto-restore, report injection, and session end are available through REST.
12. **Event logging — complete for MVP.** All application events go through one
    central logger; events are immediately durable in SQLite and also queued behind a
    single async drain interface so the storage layer can later be swapped for a
    batched/Postgres writer without changing callers.
13. **Reconnect — complete.** A new connection gets a fresh filtered snapshot first,
    then any messages that became due while the player was offline.
14. **End session — complete.** Runner/scheduler stop, pending state is preserved in
    the log, session status becomes ended, and clients receive the final status.
15. **AAR — complete.** JSON and HTML AAR endpoints build per-leader timelines from
    the event log, including what was delivered/dropped/delayed/tampered and the true
    world state known at each logged decision point. PDF export is intentionally left
    out of this MVP.

## REST API added in steps 9–15

All instructor-control routes require an instructor JWT.

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/sessions/{id}/pause` | Freeze scenario clock and delivery scheduler |
| POST | `/sessions/{id}/resume` | Resume clock/scheduler |
| POST | `/sessions/{id}/teams/{team}/radio` | Cut/restore a team's radio; optional `restore_after_s` |
| POST | `/sessions/{id}/inject` | Inject a real/fake instructor report through degradation |
| POST | `/sessions/{id}/end` | End a session and stop background tasks |
| GET | `/sessions/{id}/events` | Instructor-only raw append-only event log |
| GET | `/sessions/{id}/aar` | Instructor-only structured AAR |
| GET | `/sessions/{id}/aar.html` | Instructor-only rendered AAR |

### Radio example

```json
POST /sessions/abcd1234/teams/alpha/radio
{
  "up": false,
  "restore_after_s": 15
}
```

### Inject example

```json
POST /sessions/abcd1234/inject
{
  "to": ["bravo"],
  "text": "Contact reported on the eastern road.",
  "alt_text": "Eastern road reported clear.",
  "conflict_prob": 0.5,
  "fake": true
}
```

The injected report uses the same per-recipient degradation path as a normal player
or scenario report.

## WebSocket protocol

Connect with:

`ws://HOST/ws/{session_id}?token=JWT`

### Server → player

- `snapshot` — initial filtered state.
- `status` — running/paused/ended changes.
- `state_update` — filtered unit state updates; players also get their own team's
  `radio_up` flag.
- `message` — a message that survived degradation and was actually delivered.

A delivered message looks like:

```json
{
  "type": "message",
  "message_id": "m4",
  "from": "player1",
  "from_team": "alpha",
  "content": "Move north",
  "sent_clock": 10.0,
  "scheduled_deliver_at": 23.2,
  "delivered_clock": 23.4,
  "delay_s": 13.2,
  "tampered": false
}
```

### Client → server

```json
{"type":"message","to":["bravo"],"text":"Move north","ref":1}
{"type":"order","unit_id":"alpha_1","action":"move","lat":34.2,"lon":77.6,"ref":2}
{"type":"order","unit_id":"alpha_1","action":"hold"}
{"type":"ping"}
```

Acknowledgements never reveal whether a message was dropped or delayed.

## Important visibility rule

The server keeps a true world state in memory. Players receive only their allowed
friendly view. Instructor snapshots contain the full world, including enemy units,
all radio flags and roster information. The AAR is generated from the instructor-side
log rather than exposing the raw state to players.

## Docker

```bash
docker compose up --build
```

SQLite data is persisted in the `sih-data` Docker volume. Set `SIH_JWT_SECRET` and
`SIH_SEED_PASSWORD` in the environment for non-demo use.

A small client smoke test is provided at `scripts/simulate_clients.py`.

## Current scope / intentional MVP limits

- Unit movement is not simulated continuously; an order changes the unit's intent,
  while its position remains the scenario position. This is the existing step-7
  contract.
- State-update degradation is not artificially delayed; message degradation is the
  core communications feature.
- PDF AAR export is not included; HTML is ready for browser print-to-PDF.
- SQLite is appropriate for the hackathon MVP. The event logger is isolated so the
  storage implementation can be replaced later.
