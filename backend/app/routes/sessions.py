"""Scenarios and session creation (pipeline step 3).

These handlers are `async` on purpose: they touch the in-memory session registry, which
must only be mutated from the event loop (sync handlers run in a thread pool).
"""
from fastapi import APIRouter, Depends, HTTPException, Request

from ..deps import get_current_user, require_instructor
from ..schemas import SessionCreate
from ..sessions import InvalidAssignment, InvalidTransition, UnknownScenario

router = APIRouter(tags=["sessions"])


@router.get("/scenarios")
async def list_scenarios(request: Request, _: dict = Depends(require_instructor)):
    return [
        {
            "id": s.id,
            "name": s.name,
            "description": s.description,
            "teams": [{"id": t.id, "name": t.name, "side": t.side} for t in s.teams],
        }
        for s in request.app.state.scenarios.values()
    ]


@router.post("/sessions", status_code=201)
async def create_session(body: SessionCreate, request: Request,
                         instructor: dict = Depends(require_instructor)):
    manager = request.app.state.manager
    try:
        state = manager.create(body.scenario_id, instructor, body.assignments, body.seed)
    except UnknownScenario:
        raise HTTPException(404, f"Unknown scenario {body.scenario_id!r}")
    except InvalidAssignment as exc:
        raise HTTPException(422, str(exc))
    data = manager.summary(state, detailed=True)
    data["ws_path"] = f"/ws/{state.id}"
    return data


@router.get("/sessions")
async def list_sessions(request: Request, user: dict = Depends(get_current_user)):
    manager = request.app.state.manager
    detailed = user["role"] == "instructor"
    return [manager.summary(s, detailed) for s in manager.all() if s.status != "ended"]


@router.get("/sessions/{session_id}")
async def get_session(session_id: str, request: Request, user: dict = Depends(get_current_user)):
    manager = request.app.state.manager
    state = manager.get(session_id)
    if state is None:
        raise HTTPException(404, "Session not found")
    return manager.summary(state, detailed=user["role"] == "instructor")


@router.post("/sessions/{session_id}/start")
async def start_session(session_id: str, request: Request,
                        instructor: dict = Depends(require_instructor)):
    """Start the clock and the scenario runner. Players can only send once it is running."""
    manager = request.app.state.manager
    state = manager.get(session_id)
    if state is None:
        raise HTTPException(404, "Session not found")
    try:
        await manager.start_session(state, instructor)
    except InvalidTransition as exc:
        raise HTTPException(409, str(exc))
    return manager.summary(state, detailed=True)
