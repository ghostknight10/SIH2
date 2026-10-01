"""Player/instructor WebSocket (pipeline steps 4 and 6).

Connect to  ws://HOST/ws/{session_id}?token=<JWT from /login>

The socket is accepted first and then closed with an application code when something
is wrong, so browser clients can tell the reasons apart (a rejected handshake would
only show up as a generic 1006):

    4401  missing/invalid/expired token or unknown user
    4404  unknown session
    4403  session has ended
    4000  replaced by a newer connection from the same user
"""
import json
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from ..actions import handle_client_message
from ..security import TokenError, decode_access_token
from ..sessions import (CLOSE_FORBIDDEN, CLOSE_NOT_FOUND, CLOSE_UNAUTHORIZED, SessionClosed)

log = logging.getLogger("sih.ws")
router = APIRouter()


@router.websocket("/ws/{session_id}")
async def session_socket(websocket: WebSocket, session_id: str, token: str | None = None):
    app = websocket.app
    await websocket.accept()

    # 1. authenticate
    try:
        claims = decode_access_token(token or "", app.state.settings)
    except TokenError:
        await websocket.close(code=CLOSE_UNAUTHORIZED, reason="Invalid or expired token")
        return
    user = app.state.db.get_user(claims.user_id)
    if user is None or user["username"] != claims.username:
        await websocket.close(code=CLOSE_UNAUTHORIZED, reason="Unknown user")
        return

    # 2. find the session
    manager = app.state.manager
    state = manager.get(session_id)
    if state is None:
        await websocket.close(code=CLOSE_NOT_FOUND, reason="Session not found")
        return

    # 3. register the connection (assigns a team to players)
    try:
        conn = await manager.connect(state, user, websocket)
    except SessionClosed:
        await websocket.close(code=CLOSE_FORBIDDEN, reason="Session has ended")
        return

    # 4. serve
    try:
        snapshot = manager.snapshot_for(state, conn)
        await websocket.send_json(snapshot)
        conn.ready = True
        manager.log(state, "snapshot_sent", conn.username, {
            "clock_s": state.clock_s, "units": snapshot["units"], "status": state.status,
        })
        await manager.flush_reconnect(state, conn)
        while True:
            try:
                msg = await websocket.receive_json()
            except json.JSONDecodeError:
                await websocket.send_json({"type": "error", "code": "bad_json",
                                           "detail": "Messages must be valid JSON"})
                continue
            reply = handle_client_message(manager, state, conn, msg)
            if reply is not None:
                await websocket.send_json(reply)
    except (WebSocketDisconnect, RuntimeError):
        pass
    finally:
        manager.disconnect(state, conn)
