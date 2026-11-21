from datetime import date as Date
from datetime import datetime

from fastapi import APIRouter, HTTPException, Query

from .. import eco, pricing, transitous
from ..models import Journey, JourneySearch, Leg, Station, Stop

router = APIRouter(prefix="/api", tags=["journeys"])

# Priced journeys kept server-side so checkout never trusts a price from the browser.
JOURNEYS: dict[str, Journey] = {}


def _ts(iso: str) -> datetime:
    return datetime.fromisoformat(iso.replace("Z", "+00:00"))


def _stop(p: dict, key: str) -> Stop:
    return Stop(name=p["name"], lat=p["lat"], lon=p["lon"], time=p.get(key) or "", tz=p.get("tz"))


def _leg(raw: dict) -> Leg:
    path = transitous.decode_polyline(raw["legGeometry"]["points"], raw["legGeometry"].get("precision", 7))
    km = transitous.path_length_km(path)
    dep = datetime.fromisoformat(raw["startTime"].replace("Z", "+00:00"))
    mode = raw["mode"]
    operator = raw.get("agencyName")
    return Leg(
        mode=mode,
        operator=operator,
        line=raw.get("displayName") or raw.get("routeShortName"),
        origin=_stop(raw["from"], "departure"),
        destination=_stop(raw["to"], "arrival"),
        duration_s=raw["duration"],
        distance_km=round(km, 1),
        price_cents=pricing.leg_price_cents(mode, operator, km, dep, raw.get("tripId", "") + mode),
        co2_g=pricing.leg_co2_g(mode, km),
        path=transitous.simplify(path),
    )


def _journey(raw: dict, plane_km: float) -> Journey:
    legs = [_leg(lg) for lg in raw["legs"]]
    # Drop zero-length access walks at the ends, keep transfers in the middle
    while legs and legs[0].mode == "WALK":
        legs.pop(0)
    while legs and legs[-1].mode == "WALK":
        legs.pop()
    transit = [lg for lg in legs if lg.mode != "WALK"]
    ops = list(dict.fromkeys(lg.operator for lg in transit if lg.operator))
    key = "|".join(f"{lg.line}@{lg.origin.time}" for lg in transit)
    jid = f"j{abs(hash(key)) % 10**10}"
    j = Journey(
        id=jid,
        departure=legs[0].origin.time,
        arrival=legs[-1].destination.time,
        duration_s=int((_ts(legs[-1].destination.time) - _ts(legs[0].origin.time)).total_seconds()),
        transfers=max(0, len(transit) - 1),
        price_cents=sum(lg.price_cents for lg in legs),
        co2_g=sum(lg.co2_g for lg in legs),
        co2_plane_g=int(plane_km * eco.PLANE_DETOUR * pricing.CO2_PLANE_PER_KM),
        operators=ops,
        tags=[],
        legs=legs,
    )
    j.green = eco.is_green(j)
    j.eco_points = eco.points_earned(j)
    return j


@router.get("/journeys")
def search_journeys(
    origin: str = Query(alias="from"), destination: str = Query(alias="to"), date: Date | None = None
) -> JourneySearch:
    when = (date or Date.today()).isoformat() + "T05:00:00Z"
    try:
        raw = transitous.plan(origin, destination, when)
    except Exception as e:
        raise HTTPException(502, f"journey planner unavailable: {e}") from e
    if not raw:
        raise HTTPException(404, "no train connection found")

    first, last = raw[0]["legs"][0]["from"], raw[0]["legs"][-1]["to"]
    o = Station(id=origin, name=first["name"], lat=first["lat"], lon=first["lon"])
    d = Station(id=destination, name=last["name"], lat=last["lat"], lon=last["lon"])
    plane_km = transitous.haversine_km([o.lon, o.lat], [d.lon, d.lat])

    journeys: dict[str, Journey] = {}
    for it in raw:
        if not any(lg["mode"] != "WALK" for lg in it["legs"]):
            continue
        j = _journey(it, plane_km)
        journeys.setdefault(j.id, j)
    js = sorted(journeys.values(), key=lambda j: j.departure)
    if js:
        min(js, key=lambda j: j.price_cents).tags.append("cheapest")
        min(js, key=lambda j: j.duration_s).tags.append("fastest")
        min(js, key=lambda j: j.co2_g).tags.append("greenest")
    JOURNEYS.update({j.id: j for j in js})
    return JourneySearch(origin=o, destination=d, journeys=js)
