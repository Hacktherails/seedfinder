"""ECO points: earned on green tickets pro rata to the CO₂ saved vs flying, spent on future green tickets.

Unit economics (why the programme pays for itself):

- We earn a distribution commission of ``COMMISSION_RATE`` on every fare we sell (rail resellers get 3–10 %).
- Points are a liability booked when they are earned. Each order may hand out at most ``REWARD_BUDGET_SHARE``
  of its own commission in points, so every order stays profitable at earn time, whatever the CO₂ figure.
- 1 point = ``POINT_VALUE_CENTS`` when spent. Spending only consumes value that a past order already funded,
  and a single order can be discounted by at most ``MAX_DISCOUNT_SHARE`` so the cash part still covers the
  fare we owe the operator for most of the ticket.
- Unspent points (breakage, typically 20–30 % in travel loyalty) are pure margin.

All amounts are integers in minor units (cents). The frontend never computes any of this.
"""

from .models import EcoProgram, Journey
from .pricing import CO2_PLANE_PER_KM

POINT_VALUE_CENTS = 1  # 100 points = €1
GRAMS_PER_POINT = 1000  # 1 point per kg of CO₂ kept out of the sky
COMMISSION_RATE = 0.07
REWARD_BUDGET_SHARE = 0.5  # at most half our commission goes back to the traveller as points
MAX_DISCOUNT_SHARE = 0.30  # points can pay for at most 30 % of an order
MIN_REDEEM_POINTS = 50
GREEN_MAX_CO2_RATIO = 0.25  # green = at most a quarter of the CO₂ of the equivalent flight
MIN_FLIGHT_KM = 150  # below this nobody would fly, so there is no flight to "avoid"
PLANE_DETOUR = 1.1  # must match the factor used for Journey.co2_plane_g


def co2_saved_g(j: Journey) -> int:
    return max(0, j.co2_plane_g - j.co2_g)


def is_green(j: Journey) -> bool:
    flight_km = j.co2_plane_g / (PLANE_DETOUR * CO2_PLANE_PER_KM)
    return flight_km >= MIN_FLIGHT_KM and j.co2_g <= GREEN_MAX_CO2_RATIO * j.co2_plane_g


def reward_budget_points(price_cents: int) -> int:
    return int(price_cents * COMMISSION_RATE * REWARD_BUDGET_SHARE / POINT_VALUE_CENTS)


def points_earned(j: Journey) -> int:
    """Proportional to the CO₂ saved, capped by what the order's own commission can fund."""
    if not is_green(j):
        return 0
    return min(co2_saved_g(j) // GRAMS_PER_POINT, reward_budget_points(j.price_cents))


def max_redeemable_points(journeys: list[Journey], balance: int) -> int:
    """Points only pay for the green part of a basket, up to MAX_DISCOUNT_SHARE of it."""
    green_cents = sum(j.price_cents for j in journeys if is_green(j))
    if not green_cents or balance < MIN_REDEEM_POINTS:
        return 0
    cap = int(green_cents * MAX_DISCOUNT_SHARE) // POINT_VALUE_CENTS
    return max(0, min(balance, cap))


def program() -> EcoProgram:
    return EcoProgram(
        point_value_cents=POINT_VALUE_CENTS,
        grams_per_point=GRAMS_PER_POINT,
        commission_rate=COMMISSION_RATE,
        reward_budget_share=REWARD_BUDGET_SHARE,
        max_discount_share=MAX_DISCOUNT_SHARE,
        min_redeem_points=MIN_REDEEM_POINTS,
        green_max_co2_ratio=GREEN_MAX_CO2_RATIO,
        min_flight_km=MIN_FLIGHT_KM,
    )
