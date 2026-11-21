import stripe
from fastapi import APIRouter, HTTPException, Request

from ..config import settings
from ..models import Basket, BasketRequest, CheckoutRequest, CheckoutResponse, Journey
from .journeys import JOURNEYS

router = APIRouter(prefix="/api", tags=["checkout"])


def _lookup(ids: list[str]) -> list[Journey]:
    js = [JOURNEYS.get(i) for i in ids]
    if not all(js):
        raise HTTPException(404, "journey expired, search again")
    return js  # type: ignore[return-value]


@router.post("/basket")
def basket(body: BasketRequest) -> Basket:
    js = _lookup(body.journey_ids)
    return Basket(
        journeys=js,
        total_cents=sum(j.price_cents for j in js),
        co2_g=sum(j.co2_g for j in js),
        co2_plane_g=sum(j.co2_plane_g for j in js),
    )


@router.post("/checkout")
def checkout(body: CheckoutRequest, request: Request) -> CheckoutResponse:
    js = _lookup(body.journey_ids)
    ids = ",".join(body.journey_ids)
    origin = request.headers.get("origin") or "http://localhost:5173"
    success = f"{origin}/?paid={ids}"
    if not settings.stripe_secret_key:
        return CheckoutResponse(url=success, demo=True)

    items = [
        {
            "quantity": 1,
            "price_data": {
                "currency": "eur",
                "unit_amount": lg.price_cents,
                "product_data": {
                    "name": f"{lg.origin.name} → {lg.destination.name}",
                    "description": " · ".join(x for x in (lg.operator, lg.line) if x),
                },
            },
        }
        for j in js
        for lg in j.legs
        if lg.price_cents > 0
    ]
    session = stripe.checkout.Session.create(
        api_key=settings.stripe_secret_key,
        mode="payment",
        line_items=items,
        success_url=success,
        cancel_url=f"{origin}/",
        metadata={"journey_ids": ids},
    )
    return CheckoutResponse(url=session.url or success, demo=False)
