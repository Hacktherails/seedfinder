from datetime import date as Date
from datetime import datetime

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from .. import pricing, transitous
from ..models import Journey, JourneySearch, Leg, Station, Stop

router = APIRouter(prefix="/api", tags=["journeys"])

# Priced journeys kept server-side so checkout never trusts a price from the browser.
JOURNEYS: dict[str, Journey] = {}


def _ts(iso: str) -> datetime:
    return datetime.fromisoformat(iso.replace("Z", "+00:00"))


def _stop(p: dict, key: str) -> Stop:
    return Stop(
        id=p.get("stopId"), name=p["name"], lat=p["lat"], lon=p["lon"], time=p.get(key) or "", tz=p.get("tz")
    )


class Fare(BaseModel):
    party: dict[str, int]
    travel_class: int

    @property
    def key(self) -> str:
        return f"{self.travel_class}:" + ",".join(f"{k}{n}" for k, n in sorted(self.party.items()) if n)


def _leg(raw: dict, fare: Fare) -> Leg:
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
        price_cents=pricing.leg_price_cents(
            mode, operator, km, dep, raw.get("tripId", "") + mode, fare.party, fare.travel_class
        ),
        co2_g=pricing.leg_co2_g(mode, km),
        path=transitous.simplify(path),
    )


def _journey(raw: dict, plane_km: float, fare: Fare) -> Journey:
    legs = [_leg(lg, fare) for lg in raw["legs"]]
    # Drop zero-length access walks at the ends, keep transfers in the middle
    while legs and legs[0].mode == "WALK":
        legs.pop(0)
    while legs and legs[-1].mode == "WALK":
        legs.pop()
    transit = [lg for lg in legs if lg.mode != "WALK"]
    ops = list(dict.fromkeys(lg.operator for lg in transit if lg.operator))
    key = "|".join(f"{lg.line}@{lg.origin.time}" for lg in transit)
    # The fare is part of the id: the same train for another party is another priced offer.
    jid = f"j{abs(hash(key + fare.key)) % 10**10}"
    return Journey(
        id=jid,
        departure=legs[0].origin.time,
        arrival=legs[-1].destination.time,
        duration_s=int((_ts(legs[-1].destination.time) - _ts(legs[0].origin.time)).total_seconds()),
        transfers=max(0, len(transit) - 1),
        price_cents=sum(lg.price_cents for lg in legs),
        co2_g=sum(lg.co2_g for lg in legs),
        co2_plane_g=int(plane_km * 1.1 * pricing.CO2_PLANE_PER_KM),
        operators=ops,
        tags=[],
        legs=legs,
        travellers=sum(fare.party.values()),
        travel_class=fare.travel_class,
    )


def _place(stop_id: str, near: str | None) -> str:
    """`near` = "lat,lon": search from any station around it (Transitous walks between them)."""
    if near is None:
        return stop_id
    try:
        lat, lon = (float(x) for x in near.split(","))
    except ValueError as e:
        raise HTTPException(422, "near must be 'lat,lon'") from e
    return f"{lat},{lon}"


@router.get("/journeys")
def search_journeys(
    origin: str = Query(alias="from"),
    destination: str = Query(alias="to"),
    date: Date | None = None,
    max_transfers: int = Query(4, ge=0, le=4),
    adults: int = Query(1, ge=0, le=9),
    youths: int = Query(0, ge=0, le=9),
    seniors: int = Query(0, ge=0, le=9),
    children: int = Query(0, ge=0, le=9),
    travel_class: int = Query(2, ge=1, le=2),
    from_near: str | None = None,
    to_near: str | None = None,
) -> JourneySearch:
    party = {"adults": adults, "youths": youths, "seniors": seniors, "children": children}
    if not sum(party.values()):
        raise HTTPException(422, "at least one traveller")
    fare = Fare(party=party, travel_class=travel_class)

    when = (date or Date.today()).isoformat() + "T05:00:00Z"
    places = _place(origin, from_near), _place(destination, to_near)
    try:
        raw = transitous.plan(*places, when, max_transfers)
    except Exception as e:
        raise HTTPException(502, f"journey planner unavailable: {e}") from e
    raw = [it for it in raw if any(lg["mode"] != "WALK" for lg in it["legs"])]
    if not raw:
        raise HTTPException(404, "no connection found with these options")

    # Name the ends after the first/last vehicle stop: a coordinate search starts at "START".
    transit = [lg for lg in raw[0]["legs"] if lg["mode"] != "WALK"]
    first, last = transit[0]["from"], transit[-1]["to"]
    o = Station(id=origin, name=first["name"], lat=first["lat"], lon=first["lon"])
    d = Station(id=destination, name=last["name"], lat=last["lat"], lon=last["lon"])
    plane_km = transitous.haversine_km([o.lon, o.lat], [d.lon, d.lat])

    journeys: dict[str, Journey] = {}
    for it in raw:
        j = _journey(it, plane_km, fare)
        journeys.setdefault(j.id, j)
    js = sorted(journeys.values(), key=lambda j: j.departure)
    if js:
        min(js, key=lambda j: j.price_cents).tags.append("cheapest")
        min(js, key=lambda j: j.duration_s).tags.append("fastest")
        min(js, key=lambda j: j.co2_g).tags.append("greenest")
    JOURNEYS.update({j.id: j for j in js})
    return JourneySearch(origin=o, destination=d, journeys=js)
