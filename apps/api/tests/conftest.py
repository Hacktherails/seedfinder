import pytest
from fastapi.testclient import TestClient

from trainscanner import transitous
from trainscanner.config import settings
from trainscanner.main import app


@pytest.fixture(autouse=True)
def isolated_settings(monkeypatch, tmp_path):
    """Tests never read the developer's .env secrets nor hit external APIs (Stripe included)."""
    monkeypatch.setattr(settings, "eco_db_path", tmp_path / "eco.sqlite3")
    monkeypatch.setattr(transitous, "CACHE_DIR", tmp_path / "cache")  # never write into the committed cache
    monkeypatch.setattr(settings, "offline_demo", False)
    monkeypatch.setattr(settings, "stripe_secret_key", None)
    monkeypatch.setattr(settings, "stripe_webhook_secret", None)
    monkeypatch.setattr(settings, "vite_stripe_publishable_key", None)


@pytest.fixture
def client():
    return TestClient(app)
