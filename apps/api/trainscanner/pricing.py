"""Simulated fares and CO₂. No open pan-European fare API exists, so prices are a stable, believable model."""

import hashlib
from datetime import datetime

# € per km by mode
BASE_RATE = {
    "HIGHSPEED_RAIL": 0.13,
    "LONG_DISTANCE": 0.10,
    "NIGHT_RAIL": 0.09,
    "REGIONAL_FAST_RAIL": 0.09,
    "REGIONAL_RAIL": 0.08,
    "RAIL": 0.09,
    "SUBURBAN": 0.08,
}

RAIL_MODES = {
    "HIGHSPEED_RAIL",
    "LONG_DISTANCE",
    "NIGHT_RAIL",
    "REGIONAL_FAST_RAIL",
    "REGIONAL_RAIL",
    "RAIL",
    "SUBURBAN",
}

# Fare share per traveller type (adult = full fare)
TRAVELLER_FACTOR = {"adults": 1.0, "youths": 0.75, "seniors": 0.7, "children": 0.5}
FIRST_CLASS_FACTOR = 1.6

# Operator multipliers (substring match on agency name, lowercase)
OPERATOR_FACTOR = {
    "eurostar": 1.5,
    "ouigo": 0.45,
    "flix": 0.5,
    "italo": 0.8,
    "iryo": 0.7,
    "trenitalia": 0.95,
    "renfe": 0.9,
    "sncf": 1.05,
    "db": 1.1,
    "deutsche bahn": 1.1,
    "öbb": 0.95,
    "sbb": 1.4,
    "ns": 1.0,
    "sncb": 0.85,
}

# g CO₂e per passenger-km
CO2_PER_KM = {
    "HIGHSPEED_RAIL": 5,
    "LONG_DISTANCE": 14,
    "NIGHT_RAIL": 18,
    "REGIONAL_FAST_RAIL": 22,
    "REGIONAL_RAIL": 28,
    "RAIL": 20,
    "BUS": 30,
    "SUBURBAN": 6,
}
CO2_PLANE_PER_KM = 246


def _jitter(key: str) -> float:
    """Deterministic 0.85–1.15 factor so prices are stable per train."""
    h = int(hashlib.sha256(key.encode()).hexdigest()[:8], 16)
    return 0.85 + (h % 3000) / 10000


def operator_factor(operator: str | None) -> float:
    name = (operator or "").lower()
    for k, f in OPERATOR_FACTOR.items():
        if k in name:
            return f
    return 1.0


def party_factor(party: dict[str, int]) -> float:
    return sum(TRAVELLER_FACTOR[k] * n for k, n in party.items())


def leg_price_cents(
    mode: str,
    operator: str | None,
    km: float,
    departure: datetime,
    trip_key: str,
    party: dict[str, int] | None = None,
    travel_class: int = 2,
) -> int:
    """Total fare for the whole party on this leg."""
    party = party or {"adults": 1}
    if mode not in BASE_RATE:
        return 0
    rate = BASE_RATE[mode] * operator_factor(operator)
    hour = departure.hour
    peak = 1.25 if hour in (6, 7, 8, 16, 17, 18) else 1.0
    days_ahead = max(0, (departure.date() - datetime.now(departure.tzinfo).date()).days)
    early = 0.7 if days_ahead > 30 else 0.85 if days_ahead > 7 else 1.0
    euros = max(5.0, km * rate * peak * early * _jitter(trip_key))
    if travel_class == 1 and mode in RAIL_MODES:
        euros *= FIRST_CLASS_FACTOR
    single = int(round(euros * 100 / 10) * 10 - 1)  # €xx.x9 looks like a real fare
    return int(round(single * party_factor(party)))


def leg_co2_g(mode: str, km: float) -> int:
    return int(km * CO2_PER_KM.get(mode, 0))


# Stays at stopovers: (kind, label, € per night per room, guests per room)
STAY_KINDS = [
    ("hostel", "Hostel", 38.0, 1),
    ("hotel", "City hotel", 96.0, 2),
    ("boutique", "Boutique hotel", 165.0, 2),
]


def stay_offers(city: str, checkin: str, nights: int, guests: int) -> list[tuple[str, str, int, int]]:
    """[(kind, label, per_night_cents, total_cents)] for the party, stable per city and date."""
    out = []
    for kind, label, rate, per_room in STAY_KINDS:
        rooms = -(-guests // per_room)
        night = int(round(rate * rooms * _jitter(f"{city}|{kind}|{checkin}"))) * 100 - 1  # €xx.99
        out.append((kind, label, night, night * nights))
    return out
