# Person C handoff — Data, logging, AAR, scenarios and deployment

This package contains the completed Person-A simulation/backend work plus the Person-C
integration layer.

## C owns

1. **Authentication and persistence**
   - SQLite schema: `users`, `sessions`, append-only `events`.
   - Passwords use `scrypt`; login returns JWTs with `player`/`instructor` roles.
   - Demo users are seeded only when the users table is empty.

2. **Event logging**
   - All simulation actions write structured events through `EventWriter`.
   - Event rows are append-only and indexed by `(session_id, ts, id)`.
   - Events include actor, wall-clock timestamp and scenario-clock information in payloads.

3. **AAR**
   - `GET /sessions/{id}/aar` returns structured JSON.
   - `GET /sessions/{id}/aar.html` returns the rendered report.
   - AAR timelines are reconstructed from durable events, including what each leader saw
     and the true world state available at that decision point.
   - AAR endpoints still work for a completed session after an API restart because the
     assignment information is reconstructed from the event log.
   - `python scripts/export_aar.py SESSION_ID --db sih.db --out aar_export` exports files.

4. **Scenarios**
   - JSON files live in `scenarios/` and are strictly validated at startup.
   - Run `python scripts/validate_scenarios.py` before committing a new scenario.

5. **Deployment**
   - `Dockerfile` builds the API image.
   - `docker-compose.yml` persists SQLite under a named Docker volume and exposes port 8000.
   - `.env.example` documents the required environment variables.

## Integration boundary with Person A

Do not rewrite the session engine, degradation policy or delivery scheduler. Person A emits
structured events; C persists and reports them. The API contracts remain the shared boundary.

## Integration boundary with Person B

Frontend uses:

- REST: `http://HOST:8000`
- Swagger: `http://HOST:8000/docs`
- WebSocket: `ws://HOST:8000/ws/{session_id}?token={JWT}`

## Local validation

```bash
python scripts/validate_scenarios.py
python -m unittest discover -s tests -v
```

## Docker

```bash
cp .env.example .env
# replace SIH_JWT_SECRET with a long random value
docker compose up --build
```

The API is available at `http://localhost:8000`.

## MVP persistence boundary

Live session state, sockets, delivery queues and background tasks remain in memory. The DB
is the durable audit/session metadata store. A process restart does not resume an active
simulation, but completed-session events and AARs remain recoverable from SQLite.
