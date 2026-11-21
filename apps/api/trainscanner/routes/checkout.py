import stripe
from fastapi import APIRouter, HTTPException, Request

from ..config import settings
from ..models import Basket, BasketRequest, CheckoutRequest, CheckoutResponse, Journey, Stay
from .journeys import JOURNEYS
from .stays import STAYS

router = APIRouter(prefix="/api", tags=["checkout"])

CLASS_LABEL = {1: "1st class", 2: "2nd class"}


def _lookup(ids: list[str]) -> list[Journey]:
    js = [JOURNEYS.get(i) for i in ids]
    if not all(js):
        raise HTTPException(404, "journey expired, search again")
    return js  # type: ignore[return-value]


def _stays(ids: list[str]) -> list[Stay]:
    ss = [STAYS.get(i) for i in ids]
    if not all(ss):
        raise HTTPException(404, "stay expired, search again")
    return ss  # type: ignore[return-value]


@router.post("/basket")
def basket(body: BasketRequest) -> Basket:
    js = _lookup(body.journey_ids)
    ss = _stays(body.stay_ids)
    return Basket(
        journeys=js,
        stays=ss,
        total_cents=sum(j.price_cents for j in js) + sum(s.price_cents for s in ss),
        co2_g=sum(j.co2_g for j in js),
        co2_plane_g=sum(j.co2_plane_g for j in js),
    )


def _item(name: str, description: str, cents: int) -> dict:
    return {
        "quantity": 1,
        "price_data": {
            "currency": "eur",
            "unit_amount": cents,
            "product_data": {"name": name, "description": description},
        },
    }


@router.post("/checkout")
def checkout(body: CheckoutRequest, request: Request) -> CheckoutResponse:
    js = _lookup(body.journey_ids)
    ss = _stays(body.stay_ids)
    ids = ",".join(body.journey_ids)
    origin = request.headers.get("origin") or "http://localhost:5173"
    success = f"{origin}/?paid={ids}"
    if not settings.stripe_secret_key:
        return CheckoutResponse(url=success, demo=True)

    # One line per ticket (each leg is a separate operator ticket) and one per stay, all in one payment.
    items = [
        _item(
            f"{lg.origin.name} → {lg.destination.name}",
            " · ".join(
                x
                for x in (lg.operator, lg.line, f"{j.travellers} traveller(s)", CLASS_LABEL[j.travel_class])
                if x
            ),
            lg.price_cents,
        )
        for j in js
        for lg in j.legs
        if lg.price_cents > 0
    ] + [
        _item(s.name, f"{s.nights} night(s) from {s.checkin} · {s.guests} guest(s)", s.price_cents)
        for s in ss
    ]
    try:
        session = stripe.checkout.Session.create(
            api_key=settings.stripe_secret_key,
            mode="payment",
            line_items=items,
            success_url=success,
            cancel_url=f"{origin}/",
            metadata={"journey_ids": ids, "stay_ids": ",".join(body.stay_ids)},
        )
    except stripe.StripeError as e:
        raise HTTPException(502, f"payment provider error: {e.user_message or type(e).__name__}") from e
    return CheckoutResponse(url=session.url or success, demo=False)
