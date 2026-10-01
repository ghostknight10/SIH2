"""Demo accounts, created only when the users table is empty."""
import logging

from .config import Settings
from .db import Database
from .security import hash_password

log = logging.getLogger("sih.seed")


def seed_users(db: Database, settings: Settings, player_count: int = 5) -> bool:
    if db.count_users() > 0:
        return False
    pw = hash_password(settings.seed_password)
    db.create_user("instructor", pw, "instructor", "Instructor")
    for i in range(1, player_count + 1):
        db.create_user(f"player{i}", pw, "player", f"Player {i}")
    log.warning("Seeded demo users: instructor, player1..player%d (shared demo password). "
                "Change SIH_SEED_PASSWORD or create real users before any real use.", player_count)
    return True
