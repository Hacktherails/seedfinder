"""Thin client for Transitous (https://transitous.org), the open pan-European MOTIS journey planner.

Demo safety net: every successful answer is written to ``data/cache`` (committed). When the network is down,
or ``OFFLINE_DEMO=true``, answers are replayed from that cache: journeys are shifted to the requested date and
station search falls back to the hubs of ``data/network.json``. Fill the cache with
``scripts/warm_cache.py``.
"""

import hashlib
import json
import logging
import math
import re
import unicodedata
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


def _cache_key(kind: str, *key: object) -> str:
    digest = hashlib.sha256(json.dumps(key, default=str).encode()).hexdigest()[:16]
    return f"{kind}/{digest}"


_index: dict[Path, dict[str, Path]] = {}


def _cache_files() -> dict[str, Path]:
    """Cached answers by key, listed once from disk. Reads only ever open paths from this listing, never a
    path built from request input (no file inclusion)."""
    if CACHE_DIR not in _index:
        files = CACHE_DIR.glob("*/*.json") if CACHE_DIR.is_dir() else []
        _index[CACHE_DIR] = {f"{p.parent.name}/{p.stem}": p for p in files}
    return _index[CACHE_DIR]


def _write(key: str, payload: dict) -> None:
    kind, digest = key.split("/")
    path = CACHE_DIR / kind / f"{digest}.json"  # digest is hex from sha256, kind a constant
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(payload, ensure_ascii=False))
        _cache_files()[key] = path
    except OSError as e:  # read-only filesystem in production: caching is best effort
        log.debug("cache write failed: %s", e)


def _read(key: str) -> dict | None:
    path = _cache_files().get(key)
    if path is None:
        return None
    try:
        return json.loads(path.read_text())
    except (OSError, ValueError):
        return None


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
    key = _cache_key("geocode", text.strip().lower())
    if not settings.offline_demo:
        try:
            r = _client.get("/v1/geocode", params={"text": text, "type": "STOP"})
            r.raise_for_status()
            hits = r.json()
            _write(key, {"hits": hits})
            return hits
        except httpx.HTTPError as e:
            log.warning("geocode offline (%s), using cache", e)
    cached = _read(key)
    return (cached or {}).get("hits") or _hub_matches(text)


@lru_cache(maxsize=256)
def plan(
    from_place: str,
    to_place: str,
    time_iso: str,
    max_transfers: int = 4,
    n: int = 8,
) -> list[dict]:
    """from/to are Transitous stop ids or "lat,lon" (then any station within walking reach is used)."""
    key = _cache_key("plan", from_place, to_place, max_transfers, n)
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
                _write(key, {"time": time_iso, "itineraries": _slim(its)})
            return its
        except httpx.HTTPError as e:
            log.warning("plan offline (%s), using cache", e)
    cached = _read(key)
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
