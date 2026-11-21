def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok", "offline_demo": False, "stripe_configured": False}


def test_public_config_exposes_only_publishable_key(client, monkeypatch):
    from trainscanner.config import settings

    monkeypatch.setattr(settings, "vite_stripe_publishable_key", "pk_test_x")
    monkeypatch.setattr(settings, "stripe_secret_key", "sk_test_secret")
    assert client.get("/api/config").json() == {"stripe_publishable_key": "pk_test_x"}


def test_unknown_api_route_is_404_not_spa(client):
    assert client.get("/api/nope").status_code == 404
