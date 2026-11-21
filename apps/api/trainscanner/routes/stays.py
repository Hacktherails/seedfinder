import hashlib
from datetime import date as Date

from fastapi import APIRouter, Query

from .. import pricing
from ..models import Stay

router = APIRouter(prefix="/api", tags=["stays"])

# Priced stays kept server-side so checkout never trusts a price from the browser.
STAYS: dict[str, Stay] = {}


@router.get("/stays")
def search_stays(
    checkin: Date,
    city: str = Query(min_length=1),
    lat: float = Query(ge=-90, le=90),
    lon: float = Query(ge=-180, le=180),
    nights: int = Query(ge=1, le=14),
    guests: int = Query(1, ge=1, le=9),
) -> list[Stay]:
    """Simulated stay offers near a stopover station (no open accommodation API)."""
    out = []
    for kind, label, per_night, total in pricing.stay_offers(city, checkin.isoformat(), nights, guests):
        key = f"{city}|{kind}|{checkin}|{nights}|{guests}"
        sid = "s" + hashlib.sha256(key.encode()).hexdigest()[:10]
        out.append(
            Stay(
                id=sid,
                kind=kind,
                name=f"{label} · {city}",
                city=city,
                lat=lat,
                lon=lon,
                checkin=checkin.isoformat(),
                nights=nights,
                guests=guests,
                per_night_cents=per_night,
                price_cents=total,
            )
        )
    STAYS.update({s.id: s for s in out})
    return out
