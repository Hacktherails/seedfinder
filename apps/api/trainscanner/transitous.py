"""Thin client for Transitous (https://transitous.org), the open pan-European MOTIS journey planner.

Demo safety net: ``scripts/warm_cache.py`` records answers to ``data/cache`` (committed). When the network
is down, or ``OFFLINE_DEMO=true``, answers are replayed from that cache: journeys are shifted to the requested
date and station search falls back to the hubs of ``data/network.json``.
"""

import hashlib
import json
import logging
import math
import re
import unicodedata
from collections.abc import Callable
from datetime import date, datetime, timedelta
from functools import lru_cache
from pathlib import Path

import httpx

from .config import DATA_DIR, settings

log = logging.getLogger(__name__)

BASE = "https://api.transitous.org/api"
HEADERS = {"User-Agent": "trainscanner-hackathon/0.1"}
# Trains only (walking between stations is added by the planner itself)
RAIL_MODES = "HIGHSPEED_RAIL,LONG_DISTANCE,NIGHT_RAIL,REGIONAL_RAIL,SUBURBAN"
CACHE_DIR = DATA_DIR / "cache"

_client = httpx.Client(base_url=BASE, headers=HEADERS, timeout=httpx.Timeout(15, connect=4))


def cache_key(kind: str, *key: object) -> str:
    digest = hashlib.sha256(json.dumps(key, default=str).encode()).hexdigest()[:16]
    return f"{kind}/{digest}"


# Live answers go to this hook when set (scripts/warm_cache.py records them to disk). The API never writes
# files, and never opens one while serving a request: the cache is loaded into memory in one go.
RECORDER: Callable[[str, dict], None] | None = None
_loaded: dict[Path, dict[str, dict]] = {}


def _cache() -> dict[str, dict]:
    """Every cached answer, read once from CACHE_DIR (no request input involved), keyed by cache_key()."""
    if CACHE_DIR not in _loaded:
        store: dict[str, dict] = {}
        for f in sorted(CACHE_DIR.glob("*/*.json")) if CACHE_DIR.is_dir() else []:
            try:
                store[f"{f.parent.name}/{f.stem}"] = json.loads(f.read_text())
            except (OSError, ValueError) as e:
                log.warning("skipping unreadable cache file %s: %s", f.name, e)
        _loaded[CACHE_DIR] = store
    return _loaded[CACHE_DIR]


def _record(key: str, payload: dict) -> None:
    if RECORDER:
        RECORDER(key, payload)


_ISO = re.compile(r"^\d{4}-\d{2}-\d{2}T")


def _shift_dates(obj: object, days: int) -> object:
    """Move every ISO timestamp in a Transitous answer by `days` (replaying a cached plan on another date)."""
    if isinstance(obj, dict):
        return {k: _shift_dates(v, days) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_shift_dates(v, days) for v in obj]
    if isinstance(obj, str) and days and _ISO.match(obj):
        try:
            t = datetime.fromisoformat(obj.replace("Z", "+00:00")) + timedelta(days=days)
        except ValueError:
            return obj
        return t.isoformat().replace("+00:00", "Z")
    return obj


_LEG_KEYS = (
    "mode",
    "duration",
    "startTime",
    "endTime",
    "agencyName",
    "displayName",
    "routeShortName",
    "tripId",
)
_STOP_KEYS = ("name", "stopId", "lat", "lon", "tz", "departure", "arrival")


def _slim(its: list[dict]) -> list[dict]:
    """Keep only what the API reads, with a 400 m track (as displayed), so the committed cache stays small."""
    out = []
    for it in its:
        legs = []
        for lg in it["legs"]:
            geo = lg["legGeometry"]
            path = simplify(decode_polyline(geo["points"], geo.get("precision", 7)), min_km=0.4)
            legs.append(
                {k: lg[k] for k in _LEG_KEYS if k in lg}
                | {p: {k: lg[p][k] for k in _STOP_KEYS if k in lg[p]} for p in ("from", "to")}
                | {"legGeometry": {"points": encode_polyline(path, 5), "precision": 5}}
            )
        out.append(
            {k: it[k] for k in ("duration", "startTime", "endTime", "transfers") if k in it} | {"legs": legs}
        )
    return out


_FOLD = str.maketrans({"ø": "o", "æ": "ae", "ß": "ss", "ł": "l", "đ": "d"})


def _fold(s: str) -> str:
    """'København' → 'kobenhavn', 'Zürich' → 'zurich': offline search ignores accents."""
    s = unicodedata.normalize("NFD", s.lower().translate(_FOLD))
    return "".join(c for c in s if not unicodedata.combining(c)).strip()


@lru_cache(maxsize=1)
def _hubs() -> list[dict]:
    return json.loads((DATA_DIR / "network.json").read_text())["hubs"]


def _hub_matches(text: str) -> list[dict]:
    hubs = _hubs()
    q = _fold(text)
    return [
        {
            "type": "STOP",
            "id": h["id"],
            "name": h["name"],
            "country": h.get("country"),
            "lat": h["lat"],
            "lon": h["lon"],
            "modes": ["HIGHSPEED_RAIL", "LONG_DISTANCE"],
            "importance": 1,
        }
        for h in hubs
        if q in _fold(h["name"]) or q == (h.get("country") or "").lower()
    ]


@lru_cache(maxsize=512)
def geocode(text: str) -> list[dict]:
    key = cache_key("geocode", text.strip().lower())
    if not settings.offline_demo:
        try:
            r = _client.get("/v1/geocode", params={"text": text, "type": "STOP"})
            r.raise_for_status()
            hits = r.json()
            _record(key, {"hits": hits})
            return hits
        except httpx.HTTPError as e:
            log.warning("geocode offline (%s), using cache", e)
    return _cache().get(key, {}).get("hits") or _hub_matches(text)


@lru_cache(maxsize=256)
def plan(
    from_place: str,
    to_place: str,
    time_iso: str,
    max_transfers: int = 4,
    n: int = 8,
) -> list[dict]:
    """from/to are Transitous stop ids or "lat,lon" (then any station within walking reach is used)."""
    key = cache_key("plan", from_place, to_place, max_transfers, n)
    if not settings.offline_demo:
        try:
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
            its = r.json().get("itineraries", [])
            if its:
                _record(key, {"time": time_iso, "itineraries": _slim(its)})
            return its
        except httpx.HTTPError as e:
            log.warning("plan offline (%s), using cache", e)
    cached = _cache().get(key)
    if not cached:
        raise RuntimeError("offline and this trip is not in the demo cache")
    days = (date.fromisoformat(time_iso[:10]) - date.fromisoformat(cached["time"][:10])).days
    return _shift_dates(cached["itineraries"], days)  # type: ignore[return-value]


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


def encode_polyline(path: list[list[float]], precision: int = 5) -> str:
    """[[lon, lat], …] → Google encoded polyline (inverse of decode_polyline)."""
    out, plat, plon, factor = [], 0, 0, 10**precision

    def enc(v: int) -> str:
        v = ~(v << 1) if v < 0 else v << 1
        chunk = ""
        while v >= 0x20:
            chunk += chr((0x20 | (v & 0x1F)) + 63)
            v >>= 5
        return chunk + chr(v + 63)

    for lon, lat in path:
        la, lo = round(lat * factor), round(lon * factor)
        out.append(enc(la - plat) + enc(lo - plon))
        plat, plon = la, lo
    return "".join(out)


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
