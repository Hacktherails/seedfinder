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
    green: bool = False  # eligible to earn and spend ECO points
    eco_points: int = 0  # ECO points this ticket earns


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


class PublicConfig(BaseModel):
    stripe_publishable_key: str | None = None


class EcoProgram(BaseModel):
    point_value_cents: int
    grams_per_point: int
    commission_rate: float
    reward_budget_share: float
    max_discount_share: float
    min_redeem_points: int
    green_max_co2_ratio: float
    min_flight_km: int


class Account(BaseModel):
    id: str  # demo bearer token: no password, whoever holds the id owns the points
    email: str
    points: int
    co2_saved_g: int
    trips: int


class SignInRequest(BaseModel):
    email: str


class Quote(BaseModel):
    """What the traveller pays for a basket, ECO points included. Computed server-side only."""

    subtotal_cents: int
    discount_cents: int
    total_cents: int
    currency: str = "EUR"
    points_used: int
    points_earned: int
    max_points: int  # most points this basket could use
    balance: int  # account balance before this order


class BasketRequest(BaseModel):
    journey_ids: list[str] = Field(min_length=1, max_length=10)
    account_id: str | None = None
    use_points: bool = False


class Basket(BaseModel):
    journeys: list[Journey]
    total_cents: int  # before ECO points; quote.total_cents is what gets charged
    currency: str = "EUR"
    co2_g: int
    co2_plane_g: int
    quote: Quote


class CheckoutRequest(BasketRequest):
    embedded: bool = True  # Stripe Embedded Checkout inside the app; False = redirect to the hosted page


class CheckoutResponse(BaseModel):
    order_id: str
    url: str | None = None  # hosted Checkout page, or the success URL in demo mode
    client_secret: str | None = None  # Embedded Checkout
    demo: bool
    quote: Quote


class Order(BaseModel):
    id: str
    journey_ids: list[str]
    status: str  # pending | paid | cancelled
    points_used: int
    points_earned: int
    total_cents: int
    co2_saved_g: int
    account: Account | None = None
