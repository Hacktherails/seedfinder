import pytest
from fastapi.testclient import TestClient

from trainscanner.config import settings
from trainscanner.main import app


@pytest.fixture(autouse=True)
def isolated_settings(monkeypatch):
    """Tests never read the developer's .env secrets nor hit external APIs (Stripe included)."""
    monkeypatch.setattr(settings, "offline_demo", False)
    monkeypatch.setattr(settings, "stripe_secret_key", None)
    monkeypatch.setattr(settings, "stripe_webhook_secret", None)


@pytest.fixture
def client():
    return TestClient(app)
