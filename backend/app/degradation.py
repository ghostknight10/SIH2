"""Communication degradation policy (pipeline step 8). Pure logic, no I/O.

For every (message, recipient) pair `decide` returns a `Delivery` describing what will
happen: dropped (and why), or scheduled for `deliver_at` (scenario-clock seconds),
possibly with tampered content. Each recipient gets independent rolls, so two teams
can see different information at different times.

Order of checks:
  1. sender's or recipient's radio is cut          -> dropped
  2. random loss (policy.drop_prob)                -> dropped
  3. delay uniform(min_delay_s, max_delay_s)
  4. conflicting version, only if the message carries `alt_content`
     (probability: message.conflict_prob, else policy.conflict_prob)
"""
import random
from dataclasses import dataclass
from typing import Mapping


@dataclass
class DegradationPolicy:
    drop_prob: float = 0.10
    min_delay_s: float = 5.0
    max_delay_s: float = 30.0
    conflict_prob: float = 0.0

    def __post_init__(self):
        for name in ("drop_prob", "conflict_prob"):
            v = getattr(self, name)
            if not 0.0 <= v <= 1.0:
                raise ValueError(f"{name} must be between 0 and 1")
        if self.min_delay_s < 0 or self.max_delay_s < self.min_delay_s:
            raise ValueError("need 0 <= min_delay_s <= max_delay_s")


@dataclass(frozen=True)
class Message:
    id: str
    source: str                      # "player" | "scenario" | "instructor"
    sender: str                      # username, or "scenario"
    sender_team: str | None          # None for scenario/instructor messages
    to_teams: tuple[str, ...]
    content: str
    sent_clock: float                # scenario seconds when it was sent
    alt_content: str | None = None   # conflicting version, if one exists
    conflict_prob: float | None = None


@dataclass(frozen=True)
class Delivery:
    message: Message
    recipient: str
    recipient_team: str
    outcome: str                     # "scheduled" | "dropped"
    reason: str | None = None        # why it was dropped
    delay_s: float | None = None
    deliver_at: float | None = None  # scenario-clock seconds
    content: str = ""                # what the recipient will be shown
    tampered: bool = False


DROP_SENDER_RADIO = "sender_radio_down"
DROP_RECIPIENT_RADIO = "recipient_radio_down"
DROP_RANDOM = "random_loss"


def decide(policy: DegradationPolicy, message: Message, recipient: str, recipient_team: str,
           radio_up: Mapping[str, bool], rng: random.Random, sent_clock: float | None = None) -> Delivery:
    sent = message.sent_clock if sent_clock is None else sent_clock

    def dropped(reason: str) -> Delivery:
        return Delivery(message, recipient, recipient_team, "dropped", reason=reason)

    if message.sender_team is not None and not radio_up.get(message.sender_team, True):
        return dropped(DROP_SENDER_RADIO)
    if not radio_up.get(recipient_team, True):
        return dropped(DROP_RECIPIENT_RADIO)
    if rng.random() < policy.drop_prob:
        return dropped(DROP_RANDOM)

    delay = rng.uniform(policy.min_delay_s, policy.max_delay_s)
    content, tampered = message.content, False
    if message.alt_content is not None:
        p = policy.conflict_prob if message.conflict_prob is None else message.conflict_prob
        if rng.random() < p:
            content, tampered = message.alt_content, True
    return Delivery(message, recipient, recipient_team, "scheduled", delay_s=delay,
                    deliver_at=sent + delay, content=content, tampered=tampered)
