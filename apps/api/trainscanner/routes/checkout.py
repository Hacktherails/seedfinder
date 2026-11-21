import stripe
from fastapi import APIRouter, HTTPException, Request

from ..config import settings
from ..models import CheckoutRequest, CheckoutResponse
from .journeys import JOURNEYS

router = APIRouter(prefix="/api", tags=["checkout"])


@router.post("/checkout")
def checkout(body: CheckoutRequest, request: Request) -> CheckoutResponse:
    j = JOURNEYS.get(body.journey_id)
    if not j:
        raise HTTPException(404, "journey expired, search again")
    origin = request.headers.get("origin") or "http://localhost:5173"
    success = f"{origin}/?paid={j.id}"
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
        for lg in j.legs
        if lg.price_cents > 0
    ]
    session = stripe.checkout.Session.create(
        api_key=settings.stripe_secret_key,
        mode="payment",
        line_items=items,
        success_url=success,
        cancel_url=f"{origin}/",
        metadata={"journey_id": j.id},
    )
    return CheckoutResponse(url=session.url or success, demo=False)
