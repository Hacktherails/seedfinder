"""Thin client for Transitous (https://transitous.org), the open pan-European MOTIS journey planner."""

import math
from functools import lru_cache

import httpx

BASE = "https://api.transitous.org/api"
HEADERS = {"User-Agent": "trainscanner-hackathon/0.1"}
# Trains only (walking between stations is added by the planner itself)
RAIL_MODES = "HIGHSPEED_RAIL,LONG_DISTANCE,NIGHT_RAIL,REGIONAL_RAIL,SUBURBAN"

_client = httpx.Client(base_url=BASE, headers=HEADERS, timeout=20)


@lru_cache(maxsize=512)
def geocode(text: str) -> list[dict]:
    r = _client.get("/v1/geocode", params={"text": text, "type": "STOP"})
    r.raise_for_status()
    return r.json()


@lru_cache(maxsize=256)
def plan(
    from_place: str,
    to_place: str,
    time_iso: str,
    max_transfers: int = 4,
    n: int = 8,
) -> list[dict]:
    """from/to are Transitous stop ids or "lat,lon" (then any station within walking reach is used)."""
    r = _client.get(
        "/v1/plan",
        params={
            "fromPlace": from_place,
            "toPlace": to_place,
            "time": time_iso,
            "transitModes": RAIL_MODES,
            "numItineraries": n,
            "maxTransfers": max_transfers,
            "searchWindow": 6 * 3600,
        },
    )
    r.raise_for_status()
    return r.json().get("itineraries", [])


def decode_polyline(points: str, precision: int = 7) -> list[list[float]]:
    """Google encoded polyline → [[lon, lat], …]."""
    coords, idx, lat, lon, factor = [], 0, 0, 0, 10**precision
    while idx < len(points):
        for is_lon in (False, True):
            shift = result = 0
            while True:
                b = ord(points[idx]) - 63
                idx += 1
                result |= (b & 0x1F) << shift
                shift += 5
                if b < 0x20:
                    break
            delta = ~(result >> 1) if result & 1 else result >> 1
            if is_lon:
                lon += delta
            else:
                lat += delta
        coords.append([round(lon / factor, 5), round(lat / factor, 5)])
    return coords


def haversine_km(a: list[float], b: list[float]) -> float:
    lon1, lat1, lon2, lat2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    h = math.sin((lat2 - lat1) / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin((lon2 - lon1) / 2) ** 2
    return 6371 * 2 * math.asin(math.sqrt(h))


def path_length_km(path: list[list[float]]) -> float:
    return sum(haversine_km(path[i], path[i + 1]) for i in range(len(path) - 1))


def simplify(path: list[list[float]], min_km: float = 0.4) -> list[list[float]]:
    """Drop points closer than min_km to the previous kept point (keeps the endpoints)."""
    if len(path) < 3:
        return path
    out = [path[0]]
    for p in path[1:-1]:
        if haversine_km(out[-1], p) >= min_km:
            out.append(p)
    out.append(path[-1])
    return out
