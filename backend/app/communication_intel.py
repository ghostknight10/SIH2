"""Domain-specific communication intelligence for the training simulator.

These helpers are deterministic and deliberately small: they turn raw delivery
conditions into information-quality signals that a player/instructor UI can show.
"""
from __future__ import annotations

import math
from typing import Literal

Priority = Literal["URGENT", "HIGH", "NORMAL", "LOW"]

PRIORITY_DROP_MULTIPLIER = {
    "URGENT": 0.25,
    "HIGH": 0.50,
    "NORMAL": 1.00,
    "LOW": 1.50,
}
PRIORITY_DELAY_MULTIPLIER = {
    "URGENT": 0.60,
    "HIGH": 0.80,
    "NORMAL": 1.00,
    "LOW": 1.40,
}
PRIORITY_CONFIDENCE_MULTIPLIER = {
    "URGENT": 1.00,
    "HIGH": 0.98,
    "NORMAL": 0.95,
    "LOW": 0.90,
}


def normalize_priority(value: str | None) -> Priority:
    value = (value or "NORMAL").upper()
    if value not in PRIORITY_DROP_MULTIPLIER:
        raise ValueError("priority must be URGENT, HIGH, NORMAL, or LOW")
    return value  # type: ignore[return-value]


def information_quality(*, delay_s: float, priority: str, tampered: bool,
                        max_delay_s: float) -> dict:
    """Return a deterministic freshness/confidence signal for delivered information."""
    delay = max(0.0, float(delay_s or 0.0))
    horizon = max(1.0, float(max_delay_s or 1.0))
    freshness = math.exp(-delay / max(5.0, horizon))
    confidence = freshness * PRIORITY_CONFIDENCE_MULTIPLIER[normalize_priority(priority)]
    if tampered:
        confidence *= 0.55
    confidence = max(0.0, min(1.0, confidence))
    stale = delay >= min(15.0, horizon * 0.75)
    return {
        "age_s": round(delay, 3),
        "freshness": round(freshness, 3),
        "confidence": round(confidence, 3),
        "status": "STALE" if stale else "FRESH",
    }
