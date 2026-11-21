import pytest

from trainscanner import transitous


def _enc(v: int) -> str:
    v = ~(v << 1) if v < 0 else v << 1
    out = ""
    while v >= 0x20:
        out += chr((0x20 | (v & 0x1F)) + 63)
        v >>= 5
    return out + chr(v + 63)


def _polyline(pts: list[tuple[float, float]]) -> str:
    """Encode [(lat, lon)] with precision 7."""
    out, plat, plon = "", 0, 0
    for lat, lon in pts:
        la, lo = round(lat * 1e7), round(lon * 1e7)
        out += _enc(la - plat) + _enc(lo - plon)
        plat, plon = la, lo
    return out


def _itinerary(mode: str, hour: int, trip: str) -> dict:
    a = {"name": "Brussels-Midi", "lat": 50.8357, "lon": 4.3366, "tz": "Europe/Brussels"}
    b = {"name": "Paris Nord", "lat": 48.8809, "lon": 2.3553, "tz": "Europe/Paris"}
    return {
        "legs": [
            {
                "mode": mode,
                "agencyName": "SNCF",
                "displayName": "TGV 1",
                "from": {**a, "departure": f"2026-12-01T{hour:02d}:00:00Z"},
                "to": {**b, "arrival": f"2026-12-01T{hour + 2:02d}:00:00Z"},
                "startTime": f"2026-12-01T{hour:02d}:00:00Z",
                "duration": 7200,
                "tripId": trip,
                "legGeometry": {
                    "points": _polyline([(a["lat"], a["lon"]), (b["lat"], b["lon"])]),
                    "precision": 7,
                },
            }
        ]
    }


@pytest.fixture
def fake_plan(monkeypatch):
    its = [_itinerary("HIGHSPEED_RAIL", 8, "t1"), _itinerary("NIGHT_RAIL", 20, "t2")]
    monkeypatch.setattr(transitous, "plan", lambda *a, **k: its)


def _search(client):
    r = client.get("/api/journeys", params={"from": "A", "to": "B", "date": "2026-12-01"})
    assert r.status_code == 200
    return r.json()["journeys"]


def test_polyline_helper_roundtrips():
    assert transitous.decode_polyline(_polyline([(50.8357, 4.3366)]), 7) == [[4.3366, 50.8357]]


def test_journeys_priced_and_tagged(client, fake_plan):
    js = _search(client)
    assert len(js) == 2
    assert all(j["price_cents"] > 0 for j in js)
    assert any(j["tags"] for j in js)


def test_night_rail_mode_kept(client, fake_plan):
    assert any(lg["mode"] == "NIGHT_RAIL" for j in _search(client) for lg in j["legs"])


def test_basket_total_and_unknown(client, fake_plan):
    js = _search(client)
    ids = [j["id"] for j in js]
    r = client.post("/api/basket", json={"journey_ids": ids})
    assert r.status_code == 200
    assert r.json()["total_cents"] == sum(j["price_cents"] for j in js)
    assert client.post("/api/basket", json={"journey_ids": ["nope"]}).status_code == 404


def test_checkout_demo_lists_ids(client, fake_plan):
    ids = [j["id"] for j in _search(client)]
    r = client.post("/api/checkout", json={"journey_ids": ids})
    assert r.status_code == 200
    body = r.json()
    assert body["demo"] is True
    assert f"paid={ids[0]},{ids[1]}&order=" in body["url"]
