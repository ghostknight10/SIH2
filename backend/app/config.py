"""Runtime configuration (pipeline step 1). Everything comes from environment variables."""
import logging
import os
from dataclasses import dataclass
from pathlib import Path

log = logging.getLogger("sih.config")

BASE_DIR = Path(__file__).resolve().parent.parent
DEV_SECRET = "dev-only-change-me"


@dataclass(frozen=True)
class Settings:
    db_path: str
    scenario_dir: Path
    jwt_secret: str
    jwt_algorithm: str
    token_ttl_minutes: int
    cors_origins: tuple[str, ...]
    seed_password: str


def load_settings(env=None) -> Settings:
    env = os.environ if env is None else env
    secret = env.get("SIH_JWT_SECRET", DEV_SECRET)
    if secret == DEV_SECRET:
        log.warning("SIH_JWT_SECRET is not set; using an insecure development secret")
    origins = env.get("SIH_CORS_ORIGINS", "http://localhost:5173,http://localhost:3000")
    return Settings(
        db_path=env.get("SIH_DB_PATH", str(BASE_DIR / "sih.db")),
        scenario_dir=Path(env.get("SIH_SCENARIO_DIR", str(BASE_DIR / "scenarios"))),
        jwt_secret=secret,
        jwt_algorithm="HS256",
        token_ttl_minutes=int(env.get("SIH_TOKEN_TTL_MIN", "480")),
        cors_origins=tuple(o.strip() for o in origins.split(",") if o.strip()),
        seed_password=env.get("SIH_SEED_PASSWORD", "demo123"),
    )
