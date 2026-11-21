"""Build apps/api/trainscanner/data/network.json: European hubs + real rail geometry between them (Transitous).

Run: cd apps/api && uv run python ../../scripts/build_network.py
"""

import json
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "apps/api"))

from trainscanner import transitous  # noqa: E402
from trainscanner.config import DATA_DIR  # noqa: E402

HUBS = {
    "AMS": "Amsterdam Centraal", "RTD": "Rotterdam Centraal", "BRU": "Bruxelles-Midi", "ANR": "Antwerpen-Centraal",
    "LGG": "Liège-Guillemins", "LUX": "Luxembourg", "LIL": "Lille Europe", "LON": "London St Pancras",
    "PAR": "Paris Gare de Lyon", "PNO": "Paris Nord", "PES": "Paris Est", "LYS": "Lyon Part-Dieu",
    "MRS": "Marseille Saint-Charles", "SXB": "Strasbourg", "CGN": "Köln Hbf", "FRA": "Frankfurt (Main) Hbf",
    "BER": "Berlin Hbf", "HAM": "Hamburg Hbf", "MUC": "München Hbf", "STR": "Stuttgart Hbf",
    "ZRH": "Zürich HB", "BSL": "Basel SBB", "GVA": "Genève", "MIL": "Milano Centrale", "TRN": "Torino Porta Nuova",
    "VCE": "Venezia Santa Lucia", "FLR": "Firenze Santa Maria Novella", "ROM": "Roma Termini",
    "VIE": "Wien Hbf", "PRG": "Praha hlavní nádraží", "BCN": "Barcelona Sants", "MAD": "Madrid Puerta de Atocha",
    "CPH": "København H",
}
EDGES = [
    ("AMS", "RTD"), ("RTD", "ANR"), ("ANR", "BRU"), ("BRU", "PNO"), ("BRU", "LGG"), ("LGG", "CGN"),
    ("BRU", "LIL"), ("LIL", "LON"), ("LIL", "PNO"), ("BRU", "LUX"), ("LUX", "SXB"), ("PES", "SXB"),
    ("SXB", "STR"), ("PAR", "LYS"), ("LYS", "MRS"), ("LYS", "GVA"), ("LYS", "TRN"), ("TRN", "MIL"),
    ("MRS", "BCN"), ("BCN", "MAD"), ("PAR", "BCN"), ("CGN", "FRA"), ("FRA", "STR"), ("STR", "MUC"),
    ("FRA", "BER"), ("HAM", "BER"), ("CGN", "HAM"), ("HAM", "CPH"), ("BER", "PRG"), ("PRG", "VIE"),
    ("MUC", "VIE"), ("MUC", "VCE"), ("FRA", "BSL"), ("BSL", "ZRH"), ("PES", "BSL"), ("ZRH", "MIL"),
    ("GVA", "MIL"), ("MIL", "VCE"), ("MIL", "FLR"), ("FLR", "ROM"), ("AMS", "CGN"), ("ZRH", "MUC"),
]


def geocode(code_name):
    code, name = code_name
    hit = next(h for h in transitous.geocode(name) if h["type"] == "STOP")
    return code, {"id": hit["id"], "name": name, "country": hit.get("country"), "lat": hit["lat"], "lon": hit["lon"]}


def corridor(edge, hubs):
    a, b = edge
    key = (hubs[a]["id"], hubs[b]["id"])
    if key in EXISTING:
        return {"origin": a, "destination": b, "path": EXISTING[key]}
    time.sleep(3)  # Transitous is a community service: stay well under its rate limit
    try:
        its = transitous.plan(hubs[a]["id"], hubs[b]["id"], "2026-11-25T07:00:00Z", n=3)
        it = min(its, key=lambda i: (len([lg for lg in i["legs"] if lg["mode"] != "WALK"]), i["duration"]))
        path = []
        for lg in it["legs"]:
            if lg["mode"] != "WALK":
                g = lg["legGeometry"]
                path += transitous.decode_polyline(g["points"], g.get("precision", 7))
        path = transitous.simplify(path, 1.0)
    except Exception as e:  # fall back to a straight line
        print("fallback", a, b, e)
        path = [[hubs[a]["lon"], hubs[a]["lat"]], [hubs[b]["lon"], hubs[b]["lat"]]]
    return {"origin": a, "destination": b, "path": path}


# Reuse corridors that already have real geometry (more than a straight segment)
_old = DATA_DIR / "network.json"
EXISTING = {}
if _old.exists():
    for c in json.loads(_old.read_text())["corridors"]:
        if len(c["path"]) > 2:
            EXISTING[(c["origin"], c["destination"])] = c["path"]

with ThreadPoolExecutor(4) as ex:
    hubs = dict(ex.map(geocode, HUBS.items()))
corridors = [corridor(e, hubs) for e in EDGES]

DATA_DIR.mkdir(exist_ok=True)
out = {"hubs": [{**h, "id": code} | {"id": h["id"]} for code, h in hubs.items()], "corridors": corridors}
for c in out["corridors"]:
    c["origin"], c["destination"] = hubs[c["origin"]]["id"], hubs[c["destination"]]["id"]
(DATA_DIR / "network.json").write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")))
print(len(out["hubs"]), "hubs,", len(corridors), "corridors,", sum(len(c["path"]) for c in corridors), "points")
