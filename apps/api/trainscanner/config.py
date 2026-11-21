"""Runtime settings. Every path is resolved from this file so uvicorn works from any cwd."""

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

PKG_DIR = Path(__file__).resolve().parent
REPO_ROOT = PKG_DIR.parents[2]
DATA_DIR = PKG_DIR / "data"
WEB_DIST = REPO_ROOT / "apps" / "web" / "dist"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=REPO_ROOT / ".env", extra="ignore")

    offline_demo: bool = False
    cors_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]

    stripe_secret_key: str | None = None
    stripe_webhook_secret: str | None = None
    # Same variable Vite inlines at build time; also served at runtime by /api/config (deployed image)
    vite_stripe_publishable_key: str | None = None

    # ECO points ledger (SQLite). Demo accounts: email only, no password.
    eco_db_path: Path = REPO_ROOT / ".data" / "eco.sqlite3"
    eco_welcome_points: int = 100


settings = Settings()
