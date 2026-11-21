"""API models — source of truth for apps/web/src/api/types.ts."""

from pydantic import BaseModel, Field


class Station(BaseModel):
    id: str
    name: str
    country: str | None = None
    lat: float
    lon: float


class Stop(BaseModel):
    id: str | None = None  # Transitous stopId, usable as from/to in /api/journeys
    name: str
    lat: float
    lon: float
    time: str  # ISO 8601, UTC
    tz: str | None = None


class Leg(BaseModel):
    mode: str  # HIGHSPEED_RAIL, LONG_DISTANCE, REGIONAL_RAIL, NIGHT_RAIL, SUBURBAN, WALK…
    operator: str | None
    line: str | None
    origin: Stop
    destination: Stop
    duration_s: int
    distance_km: float
    price_cents: int  # for the whole party
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
    travellers: int = 1
    travel_class: int = 2


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


class Stay(BaseModel):
    id: str
    kind: str  # hostel | hotel | boutique
    name: str
    city: str
    lat: float
    lon: float
    checkin: str  # ISO date
    nights: int
    guests: int
    per_night_cents: int
    price_cents: int  # all nights, all rooms
    currency: str = "EUR"


class BasketRequest(BaseModel):
    journey_ids: list[str] = Field(min_length=1, max_length=10)
    stay_ids: list[str] = Field(default_factory=list, max_length=10)


class Basket(BaseModel):
    journeys: list[Journey]
    stays: list[Stay] = []
    total_cents: int
    currency: str = "EUR"
    co2_g: int
    co2_plane_g: int


class CheckoutRequest(BaseModel):
    journey_ids: list[str] = Field(min_length=1, max_length=10)
    stay_ids: list[str] = Field(default_factory=list, max_length=10)


class CheckoutResponse(BaseModel):
    url: str
    demo: bool
