"""Application entry point. Run with:  uvicorn app.main:app --reload

Pipeline step 1 (startup) happens in `lifespan`: open the DB, seed demo users,
load and validate scenarios, create the SessionManager.
"""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from .config import Settings, load_settings
from .db import Database
from .routes import auth, control, sessions, ws
from .scenario import load_scenarios
from .seed import seed_users
from .sessions import SessionManager

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("sih.main")


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or load_settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        db = Database(settings.db_path)
        db.init()
        seed_users(db, settings)
        scenarios = load_scenarios(settings.scenario_dir)  # fails fast on a bad file
        app.state.db = db
        app.state.scenarios = scenarios
        app.state.manager = SessionManager(db, scenarios)
        log.info("Started: %d scenario(s) loaded, db at %s", len(scenarios), settings.db_path)
        yield
        await app.state.manager.shutdown()

    app = FastAPI(title="Degraded-Comms Training Simulator", version="0.2.0", lifespan=lifespan)
    app.state.settings = settings
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(settings.cors_origins),
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(auth.router)
    app.include_router(sessions.router)
    app.include_router(control.router)
    app.include_router(ws.router)

    @app.get("/health")
    async def health(request: Request):
        return {"status": "ok", "scenarios": len(request.app.state.scenarios)}

    return app


app = create_app()
