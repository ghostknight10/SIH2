"""Request/response models for the REST API."""
from typing import Literal

from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    username: str
    role: str
    display_name: str


class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=40)
    password: str = Field(min_length=6, max_length=128)
    role: Literal["player", "instructor"] = "player"
    display_name: str | None = Field(default=None, max_length=80)


class UserOut(BaseModel):
    id: int
    username: str
    role: str
    display_name: str


class SessionCreate(BaseModel):
    scenario_id: str
    # username -> team id. Anyone left out is auto-assigned when they connect.
    assignments: dict[str, str] = Field(default_factory=dict)
    # Fixes the random draws (loss, delay, conflicts) so a run can be replayed exactly.
    seed: int | None = Field(default=None, ge=0, lt=2**32)


class RadioCommand(BaseModel):
    up: bool
    restore_after_s: float | None = Field(default=None, gt=0, le=3600)


class InjectReport(BaseModel):
    to: list[str] = Field(min_length=1)
    text: str = Field(min_length=1, max_length=500)
    alt_text: str | None = Field(default=None, max_length=500)
    conflict_prob: float | None = Field(default=None, ge=0, le=1)
    fake: bool = False
