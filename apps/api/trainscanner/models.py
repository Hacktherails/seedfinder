"""API models — source of truth for apps/web/src/api/types.ts."""

from pydantic import BaseModel


class Station(BaseModel):
    id: str
    name: str
    country: str | None = None
    lat: float
    lon: float


class Stop(BaseModel):
    name: str
    lat: float
    lon: float
    time: str  # ISO 8601, UTC
    tz: str | None = None


class Leg(BaseModel):
    mode: str  # HIGHSPEED_RAIL, LONG_DISTANCE, REGIONAL_RAIL, NIGHT_RAIL, BUS, WALK…
    operator: str | None
    line: str | None
    origin: Stop
    destination: Stop
    duration_s: int
    distance_km: float
    price_cents: int
    co2_g: int
    path: list[list[float]]  # [[lon, lat], …]


class Journey(BaseModel):
    id: str
    departure: str
    arrival: str
    duration_s: int
    transfers: int
    price_cents: int
    currency: str = "EUR"
    co2_g: int
    co2_plane_g: int
    operators: list[str]
    tags: list[str]  # cheapest | fastest | greenest
    legs: list[Leg]


class JourneySearch(BaseModel):
    origin: Station
    destination: Station
    journeys: list[Journey]


class Corridor(BaseModel):
    origin: str
    destination: str
    path: list[list[float]]


class Network(BaseModel):
    hubs: list[Station]
    corridors: list[Corridor]


class CheckoutRequest(BaseModel):
    journey_id: str


class CheckoutResponse(BaseModel):
    url: str
    demo: bool
