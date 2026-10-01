"""Login and user management (pipeline step 2)."""
from fastapi import APIRouter, Depends, HTTPException, Request

from ..db import DuplicateUser
from ..deps import get_current_user, require_instructor
from ..schemas import LoginRequest, TokenResponse, UserCreate, UserOut
from ..security import create_access_token, hash_password, verify_password

router = APIRouter(tags=["auth"])

# Verified against when the username doesn't exist, so response time doesn't leak
# which usernames are real.
_DUMMY_HASH = hash_password("not-a-real-password")


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, request: Request):
    user = request.app.state.db.get_user_by_username(body.username.strip().lower())
    stored = user["password_hash"] if user else _DUMMY_HASH
    ok = verify_password(body.password, stored) and user is not None
    if not ok:
        raise HTTPException(401, "Incorrect username or password")
    token = create_access_token(user, request.app.state.settings)
    return TokenResponse(access_token=token, username=user["username"],
                         role=user["role"], display_name=user["display_name"])


@router.get("/me", response_model=UserOut)
def me(user: dict = Depends(get_current_user)):
    return UserOut(id=user["id"], username=user["username"],
                   role=user["role"], display_name=user["display_name"])


@router.post("/users", response_model=UserOut, status_code=201)
def create_user(body: UserCreate, request: Request, _: dict = Depends(require_instructor)):
    username = body.username.strip().lower()
    try:
        created = request.app.state.db.create_user(
            username, hash_password(body.password), body.role, body.display_name or username)
    except DuplicateUser:
        raise HTTPException(409, "Username already exists")
    return UserOut(**created)
