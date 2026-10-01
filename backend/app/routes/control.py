"""Instructor controls, session end and AAR endpoints (steps 11-15)."""
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import HTMLResponse

from ..aar import render_html
from ..commands import CommandError, UnknownTeam, end_session, pause_session, resume_session, set_radio
from ..comms import new_message, route_message
from ..deps import require_instructor
from ..schemas import InjectReport, RadioCommand

router = APIRouter(tags=["instructor"])


def _state(request: Request, session_id: str):
    state = request.app.state.manager.get(session_id)
    if state is None:
        raise HTTPException(404, "Session not found")
    return state


@router.post("/sessions/{session_id}/pause")
async def pause(session_id: str, request: Request, instructor: dict = Depends(require_instructor)):
    state = _state(request, session_id)
    try:
        await pause_session(request.app.state.manager, state, instructor)
    except CommandError as exc:
        raise HTTPException(409, str(exc))
    await request.app.state.manager.flush_events()
    return request.app.state.manager.summary(state, detailed=True)


@router.post("/sessions/{session_id}/resume")
async def resume(session_id: str, request: Request, instructor: dict = Depends(require_instructor)):
    state = _state(request, session_id)
    try:
        await resume_session(request.app.state.manager, state, instructor)
    except CommandError as exc:
        raise HTTPException(409, str(exc))
    await request.app.state.manager.flush_events()
    return request.app.state.manager.summary(state, detailed=True)


@router.post("/sessions/{session_id}/teams/{team_id}/radio")
async def radio(session_id: str, team_id: str, body: RadioCommand, request: Request,
                instructor: dict = Depends(require_instructor)):
    state = _state(request, session_id)
    try:
        await set_radio(request.app.state.manager, state, instructor, team_id, body.up, body.restore_after_s)
    except UnknownTeam:
        raise HTTPException(404, f"Unknown team {team_id!r}")
    except CommandError as exc:
        raise HTTPException(409, str(exc))
    await request.app.state.manager.flush_events()
    return {"team": team_id, "up": state.radio_up[team_id], "clock_s": state.clock_s,
            "radio": dict(state.radio_up)}


@router.post("/sessions/{session_id}/inject")
async def inject(session_id: str, body: InjectReport, request: Request,
                 instructor: dict = Depends(require_instructor)):
    state = _state(request, session_id)
    if state.status != "running":
        raise HTTPException(409, f"Session is {state.status}; injected reports require a running session")
    friendly = set(state.scenario.friendly_team_ids)
    if any(team not in friendly for team in body.to):
        raise HTTPException(422, "All recipients must be friendly team ids")
    manager = request.app.state.manager
    message = new_message(
        state, source="instructor", sender=instructor["username"], sender_team=None,
        to_teams=tuple(dict.fromkeys(body.to)), content=body.text.strip(),
        alt_content=body.alt_text, conflict_prob=body.conflict_prob, priority=body.priority,
    )
    manager.log(state, "instructor_report_injected", instructor["username"], {
        "message_id": message.id, "to": list(message.to_teams), "fake": body.fake,
        "priority": message.priority,
        "clock_s": message.sent_clock,
    })
    route_message(manager, state, message)
    await manager.flush_events()
    return {"message_id": message.id, "clock_s": message.sent_clock, "fake": body.fake,
            "priority": message.priority,
            "pending_deliveries": manager.pending_delivery_count(state)}


@router.post("/sessions/{session_id}/end")
async def end(session_id: str, request: Request, instructor: dict = Depends(require_instructor)):
    state = _state(request, session_id)
    try:
        await end_session(request.app.state.manager, state, instructor)
    except CommandError as exc:
        raise HTTPException(409, str(exc))
    await request.app.state.manager.flush_events()
    return request.app.state.manager.summary(state, detailed=True)


@router.get("/sessions/{session_id}/events")
def events(session_id: str, request: Request, _: dict = Depends(require_instructor)):
    if request.app.state.db.get_session(session_id) is None:
        raise HTTPException(404, "Session not found")
    return request.app.state.db.get_events(session_id)


@router.get("/sessions/{session_id}/aar")
def aar(session_id: str, request: Request, _: dict = Depends(require_instructor)):
    manager = request.app.state.manager
    state = manager.get(session_id)
    report = manager.build_aar(state) if state is not None else manager.build_aar_from_db(session_id)
    if report is None:
        raise HTTPException(404, "Session not found")
    return report


@router.get("/sessions/{session_id}/aar.html", response_class=HTMLResponse)
def aar_html(session_id: str, request: Request, _: dict = Depends(require_instructor)):
    manager = request.app.state.manager
    state = manager.get(session_id)
    report = manager.build_aar(state) if state is not None else manager.build_aar_from_db(session_id)
    if report is None:
        raise HTTPException(404, "Session not found")
    return HTMLResponse(render_html(report))
