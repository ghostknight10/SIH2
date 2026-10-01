"""FastAPI dependencies: current user and role checks (pipeline step 2)."""
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .security import TokenError, decode_access_token

_bearer = HTTPBearer(auto_error=False)
_UNAUTH = {"WWW-Authenticate": "Bearer"}


def get_current_user(request: Request,
                     creds: HTTPAuthorizationCredentials | None = Depends(_bearer)) -> dict:
    if creds is None:
        raise HTTPException(401, "Not authenticated", headers=_UNAUTH)
    try:
        claims = decode_access_token(creds.credentials, request.app.state.settings)
    except TokenError:
        raise HTTPException(401, "Invalid or expired token", headers=_UNAUTH)
    user = request.app.state.db.get_user(claims.user_id)
    if user is None or user["username"] != claims.username:
        raise HTTPException(401, "Unknown user", headers=_UNAUTH)
    return user


def require_instructor(user: dict = Depends(get_current_user)) -> dict:
    if user["role"] != "instructor":
        raise HTTPException(403, "Instructor role required")
    return user
