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
    "BUS": 0.05,
}

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


def leg_price_cents(mode: str, operator: str | None, km: float, departure: datetime, trip_key: str) -> int:
    if mode not in BASE_RATE:
        return 0
    rate = BASE_RATE[mode] * operator_factor(operator)
    hour = departure.hour
    peak = 1.25 if hour in (6, 7, 8, 16, 17, 18) else 1.0
    days_ahead = max(0, (departure.date() - datetime.now(departure.tzinfo).date()).days)
    early = 0.7 if days_ahead > 30 else 0.85 if days_ahead > 7 else 1.0
    euros = max(5.0, km * rate * peak * early * _jitter(trip_key))
    return int(round(euros * 100 / 10) * 10 - 1)  # €xx.x9 looks like a real fare


def leg_co2_g(mode: str, km: float) -> int:
    return int(km * CO2_PER_KM.get(mode, 0))
