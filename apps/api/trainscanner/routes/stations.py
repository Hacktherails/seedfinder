from fastapi import APIRouter, HTTPException, Query

from .. import transitous
from ..models import Station

router = APIRouter(prefix="/api", tags=["stations"])


@router.get("/stations")
def search_stations(q: str = Query(min_length=2)) -> list[Station]:
    try:
        hits = transitous.geocode(q)
    except Exception as e:  # upstream down → readable error for the UI
        raise HTTPException(502, f"station search unavailable: {e}") from e
    rail = {"HIGHSPEED_RAIL", "LONG_DISTANCE", "NIGHT_RAIL", "REGIONAL_FAST_RAIL", "REGIONAL_RAIL", "RAIL"}
    hits = [h for h in hits if h.get("type") == "STOP" and rail & set(h.get("modes") or [])]
    hits.sort(key=lambda h: -(h.get("importance") or 0))
    out: list[Station] = []
    seen: set[str] = set()
    for h in hits:
        if h["name"].lower() in seen:
            continue
        seen.add(h["name"].lower())
        out.append(Station(id=h["id"], name=h["name"], country=h.get("country"), lat=h["lat"], lon=h["lon"]))
    return out[:8]
