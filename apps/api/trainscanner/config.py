"""Runtime settings. Every path is resolved from this file so uvicorn works from any cwd."""

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

PKG_DIR = Path(__file__).resolve().parent
REPO_ROOT = PKG_DIR.parents[2]
DATA_DIR = PKG_DIR / "data"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=REPO_ROOT / ".env", extra="ignore")

    offline_demo: bool = False
    cors_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]

    stripe_secret_key: str | None = None
    stripe_webhook_secret: str | None = None


settings = Settings()
