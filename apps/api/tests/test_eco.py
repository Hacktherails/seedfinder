import pytest

from trainscanner import eco, ledger
from trainscanner.models import Journey, Leg, Stop
from trainscanner.routes.journeys import JOURNEYS


def _journey(jid="jeco", price=10_000, co2=15_000, plane_km=880) -> Journey:
    stop = Stop(name="X", lat=0, lon=0, time="2026-11-22T08:00:00Z")
    leg = Leg(
        mode="HIGHSPEED_RAIL",
        operator="DB",
        line="ICE 1",
        origin=stop,
        destination=stop,
        duration_s=3600,
        distance_km=900,
        price_cents=price,
        co2_g=co2,
        path=[],
    )
    j = Journey(
        id=jid,
        departure=stop.time,
        arrival=stop.time,
        duration_s=3600,
        transfers=0,
        price_cents=price,
        co2_g=co2,
        co2_plane_g=int(plane_km * eco.PLANE_DETOUR * 246),
        operators=["DB"],
        tags=[],
        legs=[leg],
    )
    j.green = eco.is_green(j)
    j.eco_points = eco.points_earned(j)
    return j


@pytest.fixture
def journey():
    j = _journey()
    JOURNEYS[j.id] = j
    yield j
    JOURNEYS.pop(j.id, None)


def test_points_proportional_to_co2_saved():
    j = _journey(price=100_000)  # budget not binding
    assert j.green
    assert j.eco_points == (j.co2_plane_g - j.co2_g) // 1000


def test_points_capped_by_commission_budget():
    j = _journey(price=2_000)  # €20 fare: 7 % × 50 % = 70 points max
    assert j.eco_points == 70
    assert j.eco_points * eco.POINT_VALUE_CENTS <= j.price_cents * eco.COMMISSION_RATE


def test_short_or_dirty_trips_are_not_green():
    assert not eco.is_green(_journey(plane_km=80))  # nobody flies 80 km
    assert not eco.is_green(_journey(co2=200_000))  # more than 25 % of the flight's CO₂
    assert _journey(plane_km=80).eco_points == 0


def test_redeem_capped_at_share_of_order():
    j = _journey(price=10_000)
    assert eco.max_redeemable_points(j, 10_000) == 3_000
    assert eco.max_redeemable_points(j, 200) == 200
    assert eco.max_redeemable_points(j, eco.MIN_REDEEM_POINTS - 1) == 0


def test_sign_in_is_idempotent_and_gives_welcome_bonus(client):
    a = client.post("/api/account", json={"email": "Ada@Example.com "}).json()
    b = client.post("/api/account", json={"email": "ada@example.com"}).json()
    assert a["id"] == b["id"] and a["points"] == 100
    assert client.get(f"/api/account/{a['id']}").json()["email"] == "ada@example.com"
    assert client.post("/api/account", json={"email": "nope"}).status_code == 422


def test_full_loop_earn_then_spend_demo_mode(client, journey):
    acc = client.post("/api/account", json={"email": "ada@example.com"}).json()

    q = client.get("/api/checkout/quote", params={"journey_id": journey.id, "account_id": acc["id"]}).json()
    assert q["points_earned"] == journey.eco_points and q["points_used"] == 0 and q["max_points"] == 100

    # 1st trip, pay full price, earn points
    r = client.post("/api/checkout", json={"journey_id": journey.id, "account_id": acc["id"]}).json()
    assert r["demo"] and r["quote"]["total_cents"] == journey.price_cents
    order = client.post(f"/api/orders/{r['order_id']}/confirm").json()
    assert order["status"] == "paid"
    balance = 100 + journey.eco_points
    assert order["account"]["points"] == balance and order["account"]["trips"] == 1

    # confirm twice never double-credits
    assert client.post(f"/api/orders/{r['order_id']}/confirm").json()["account"]["points"] == balance

    # 2nd trip, spend points
    r = client.post(
        "/api/checkout", json={"journey_id": journey.id, "account_id": acc["id"], "use_points": True}
    ).json()
    used = r["quote"]["points_used"]
    assert used == balance and r["quote"]["total_cents"] == journey.price_cents - used
    assert client.get(f"/api/account/{acc['id']}").json()["points"] == 0  # held
    order = client.post(f"/api/orders/{r['order_id']}/confirm").json()
    assert order["account"]["points"] == journey.eco_points


def test_cancel_releases_held_points(client, journey):
    acc = client.post("/api/account", json={"email": "ada@example.com"}).json()
    r = client.post(
        "/api/checkout", json={"journey_id": journey.id, "account_id": acc["id"], "use_points": True}
    ).json()
    assert client.get(f"/api/account/{acc['id']}").json()["points"] == 0
    assert client.post(f"/api/orders/{r['order_id']}/cancel").json()["status"] == "cancelled"
    assert client.get(f"/api/account/{acc['id']}").json()["points"] == 100
    # cancelling twice does not mint points
    client.post(f"/api/orders/{r['order_id']}/cancel")
    assert client.get(f"/api/account/{acc['id']}").json()["points"] == 100


def test_points_cannot_be_spent_twice():
    acc = ledger.sign_in("ada@example.com")
    ledger.create_order(acc.id, "j1", 100, 0, 1000, 0)
    with pytest.raises(ledger.InsufficientPoints):
        ledger.create_order(acc.id, "j1", 100, 0, 1000, 0)


def test_guest_checkout_earns_nothing(client, journey):
    r = client.post("/api/checkout", json={"journey_id": journey.id, "use_points": True}).json()
    assert r["quote"]["points_used"] == 0 and r["quote"]["points_earned"] == 0
    assert client.post(f"/api/orders/{r['order_id']}/confirm").json()["status"] == "paid"
