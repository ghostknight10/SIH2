"""Password hashing and JWT helpers (pipeline step 2)."""
import hashlib
import hmac
import os
import time
from dataclasses import dataclass

import jwt

from .config import Settings

_N, _R, _P = 2**14, 8, 1


class TokenError(Exception):
    """Raised when a token is missing claims, malformed, tampered with, or expired."""


@dataclass(frozen=True)
class TokenClaims:
    user_id: int
    username: str
    role: str


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, n=_N, r=_R, p=_P, dklen=32)
    return f"scrypt${salt.hex()}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        scheme, salt_hex, hash_hex = stored.split("$")
        if scheme != "scrypt":
            return False
        salt, expected = bytes.fromhex(salt_hex), bytes.fromhex(hash_hex)
    except ValueError:
        return False
    digest = hashlib.scrypt(password.encode(), salt=salt, n=_N, r=_R, p=_P, dklen=len(expected))
    return hmac.compare_digest(digest, expected)


def create_access_token(user: dict, settings: Settings, now: float | None = None) -> str:
    issued = int(time.time() if now is None else now)
    payload = {
        "sub": user["username"],
        "uid": user["id"],
        "role": user["role"],
        "iat": issued,
        "exp": issued + settings.token_ttl_minutes * 60,
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str, settings: Settings) -> TokenClaims:
    try:
        data = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        return TokenClaims(user_id=int(data["uid"]), username=str(data["sub"]), role=str(data["role"]))
    except (jwt.PyJWTError, KeyError, ValueError, TypeError) as exc:
        raise TokenError(str(exc)) from exc
