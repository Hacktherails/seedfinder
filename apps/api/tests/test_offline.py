"""Demo safety net: Transitous answers are replayed from the disk cache when the network is down."""

import httpx
import pytest

from trainscanner import transitous
from trainscanner.config import settings

_GEO = transitous.encode_polyline([[4.3366, 50.8357], [2.3553, 48.8809]], 5)
IT = [
    {
        "legs": [
            {
                "mode": "HIGHSPEED_RAIL",
                "startTime": "2026-12-01T08:00:00Z",
                "from": {
                    "name": "Bruxelles-Midi",
                    "lat": 50.8357,
                    "lon": 4.3366,
                    "departure": "2026-12-01T08:00:00Z",
                },
                "to": {
                    "name": "Paris Nord",
                    "lat": 48.8809,
                    "lon": 2.3553,
                    "arrival": "2026-12-01T09:30:00Z",
                },
                "legGeometry": {"points": _GEO, "precision": 5},
            }
        ]
    }
]


class _Ok:
    def __init__(self, payload):
        self._payload = payload

    def raise_for_status(self):
        pass

    def json(self):
        return self._payload


@pytest.fixture(autouse=True)
def fresh_lru():
    transitous.plan.cache_clear()
    transitous.geocode.cache_clear()
    yield
    transitous.plan.cache_clear()
    transitous.geocode.cache_clear()


def _down(*a, **k):
    raise httpx.ConnectError("no wifi")


def test_plan_replays_cache_shifted_to_requested_date(monkeypatch):
    monkeypatch.setattr(transitous._client, "get", lambda *a, **k: _Ok({"itineraries": IT}))
    assert transitous.plan("A", "B", "2026-12-01T05:00:00Z") == IT  # online: cached on disk
    transitous.plan.cache_clear()

    monkeypatch.setattr(transitous._client, "get", _down)
    its = transitous.plan("A", "B", "2026-12-03T05:00:00Z")
    assert its[0]["legs"][0]["startTime"] == "2026-12-03T08:00:00Z"
    assert its[0]["legs"][0]["from"]["departure"] == "2026-12-03T08:00:00Z"
    assert its[0]["legs"][0]["to"]["arrival"] == "2026-12-03T09:30:00Z"


def test_offline_demo_flag_never_calls_network(monkeypatch):
    monkeypatch.setattr(transitous._client, "get", lambda *a, **k: _Ok({"itineraries": IT}))
    transitous.plan("A", "B", "2026-12-01T05:00:00Z")
    transitous.plan.cache_clear()
    monkeypatch.setattr(settings, "offline_demo", True)
    monkeypatch.setattr(transitous._client, "get", lambda *a, **k: pytest.fail("network called"))
    assert transitous.plan("A", "B", "2026-12-01T05:00:00Z") == IT


def test_uncached_trip_offline_is_a_readable_error(client, monkeypatch):
    monkeypatch.setattr(transitous._client, "get", _down)
    r = client.get("/api/journeys", params={"from": "X", "to": "Y", "date": "2026-12-01"})
    assert r.status_code == 502 and "demo cache" in r.json()["detail"]


def test_station_search_falls_back_to_hubs(client, monkeypatch):
    monkeypatch.setattr(transitous._client, "get", _down)
    names = [s["name"] for s in client.get("/api/stations", params={"q": "ber"}).json()]
    assert "Berlin Hbf" in names
    assert [s["name"] for s in client.get("/api/stations", params={"q": "kobenh"}).json()] == ["København H"]
    assert "Zürich HB" in [s["name"] for s in client.get("/api/stations", params={"q": "zurich"}).json()]


DEMO_TRIPS = [  # landing page default + suggested trips (apps/web/src/App.tsx)
    ["Bruxelles-Midi", "Berlin Hbf"],
    ["Bruxelles-Midi", "Köln Hbf", "Berlin Hbf", "Praha hlavní nádraží"],
    ["Paris Gare de Lyon", "Zürich HB", "Milano Centrale"],
    ["Amsterdam Centraal", "Hamburg Hbf", "København H"],
]


@pytest.mark.parametrize("stops", DEMO_TRIPS, ids=lambda s: " → ".join(s))
def test_demo_trips_work_without_wifi(client, monkeypatch, stops):
    """Every segment of the demo trips is in the committed cache and searchable fully offline."""
    import json

    monkeypatch.setattr(transitous, "CACHE_DIR", transitous.DATA_DIR / "cache")  # the committed one
    monkeypatch.setattr(settings, "offline_demo", True)
    monkeypatch.setattr(transitous._client, "get", lambda *a, **k: pytest.fail("network called"))
    hubs = {
        h["name"]: h["id"] for h in json.loads((transitous.DATA_DIR / "network.json").read_text())["hubs"]
    }
    for a, b in zip(stops, stops[1:], strict=False):
        r = client.get("/api/journeys", params={"from": hubs[a], "to": hubs[b], "date": "2027-01-15"})
        assert r.status_code == 200, f"{a} → {b}: {r.text}"
        js = r.json()["journeys"]
        assert js and js[0]["departure"].startswith("2027-01-15")
