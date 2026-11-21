"""Fill apps/api/trainscanner/data/cache with the demo trips, so the demo survives a WiFi drop.

Run (online) from the repo root:  cd apps/api && uv run python ../../scripts/warm_cache.py
Then commit apps/api/trainscanner/data/cache. Offline (or OFFLINE_DEMO=true) the API replays these answers,
shifted to whatever date is searched.

Each trip is cached under the ids the UI can send: the hub id (map click, landing page) and the id of the
first station-search hit for the city name (typed search).
"""

import json
import sys
import time
from datetime import date, timedelta

from fastapi.testclient import TestClient

from trainscanner import transitous
from trainscanner.config import DATA_DIR
from trainscanner.main import app


def record(key: str, payload: dict) -> None:
    """Write one live Transitous answer into the committed cache (the API only ever reads it)."""
    kind, digest = key.split("/")
    path = transitous.CACHE_DIR / kind / f"{digest}.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False))

# Both directions are cached (return trips). Includes the stops of the multi-city demo.
ROUTES = [
    ("Bruxelles-Midi", "Berlin Hbf"),
    ("Bruxelles-Midi", "Köln Hbf"),
    ("Köln Hbf", "Berlin Hbf"),
    ("Bruxelles-Midi", "Paris Nord"),
    ("Bruxelles-Midi", "Amsterdam Centraal"),
    ("Bruxelles-Midi", "London St Pancras"),
    ("Paris Nord", "Amsterdam Centraal"),
    ("Paris Nord", "London St Pancras"),
    ("Paris Est", "Berlin Hbf"),
    ("Paris Gare de Lyon", "Milano Centrale"),
    ("Paris Gare de Lyon", "Barcelona Sants"),
    ("Amsterdam Centraal", "Berlin Hbf"),
    ("Berlin Hbf", "Praha hlavní nádraží"),
    ("München Hbf", "Wien Hbf"),
    ("Zürich HB", "Milano Centrale"),
    # Landing page suggested trips (App.tsx CURATED_HOME_TRIPS)
    ("Paris Gare de Lyon", "Zürich HB"),
    ("Amsterdam Centraal", "Hamburg Hbf"),
    ("Hamburg Hbf", "København H"),
]

# Names people type in the station box (geocode answers are cached per text).
SEARCHES = [
    "Bruxelles", "Brussels", "Bruxelles-Midi", "Berlin", "Berlin Hbf", "Paris", "Paris Nord", "Amsterdam",
    "London", "Londres", "Köln", "Cologne", "Milano", "Milan", "Barcelona", "Praha", "Prague", "München",
    "Munich", "Wien", "Vienna", "Zürich", "Lyon", "Marseille", "Frankfurt", "Hamburg", "Roma", "Rome",
]


def main() -> int:
    transitous.RECORDER = record
    client = TestClient(app)
    hubs = {h["name"]: h for h in json.loads((DATA_DIR / "network.json").read_text())["hubs"]}
    when = (date.today() + timedelta(days=1)).isoformat()

    for q in SEARCHES:
        r = client.get("/api/stations", params={"q": q})
        print(f"stations {q!r}: {r.status_code} {len(r.json()) if r.is_success else r.text[:80]}")

    def typed_id(name: str) -> str | None:
        city = name.replace("-", " ").split()[0]
        r = client.get("/api/stations", params={"q": city})
        return r.json()[0]["id"] if r.is_success and r.json() else None

    failures = 0
    for a, b in ROUTES:
        for o, d in ((a, b), (b, a)):
            pairs = {(hubs[o]["id"], hubs[d]["id"])}
            if (ti := typed_id(o)) and (td := typed_id(d)):
                pairs.add((ti, td))
            for fid, tid in pairs:
                r = client.get("/api/journeys", params={"from": fid, "to": tid, "date": when})
                ok = r.status_code == 200
                failures += not ok
                n = len(r.json()["journeys"]) if ok else r.text[:80]
                print(f"journeys {o} → {d} [{fid[:24]}…]: {r.status_code} {n}")
                time.sleep(0.5)  # be gentle with the public Transitous instance
    print(f"done, {failures} failure(s)")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
