"""Stripe webhook receiver. Forward locally with:

stripe listen \
  --events checkout.session.completed,checkout.session.async_payment_succeeded,checkout.session.expired \
  --forward-to localhost:8100/api/stripe/webhook
"""

import logging

import stripe
from fastapi import APIRouter, HTTPException, Request

from .. import ledger
from ..config import settings

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api/stripe", tags=["stripe"])

# journey_id -> Checkout Session id, filled once Stripe confirms the payment.
# In-memory like JOURNEYS: good enough for the demo, reset on restart.
PAID_JOURNEYS: dict[str, str] = {}

_PAID_EVENTS = {"checkout.session.completed", "checkout.session.async_payment_succeeded"}


@router.post("/webhook")
async def stripe_webhook(request: Request) -> dict[str, bool]:
    if not settings.stripe_webhook_secret:
        raise HTTPException(503, "STRIPE_WEBHOOK_SECRET is not configured")

    payload = await request.body()
    try:
        event = stripe.Webhook.construct_event(
            payload, request.headers.get("stripe-signature"), settings.stripe_webhook_secret
        )
    except ValueError as e:
        raise HTTPException(400, "invalid payload") from e
    except stripe.SignatureVerificationError as e:
        raise HTTPException(400, "invalid signature") from e

    if event.type in _PAID_EVENTS:
        session = event.data.object.to_dict()
        meta = session.get("metadata") or {}
        journey_id = meta.get("journey_id")
        # checkout.session.completed also fires for delayed methods (SEPA) before funds arrive.
        if journey_id and session.get("payment_status") == "paid":
            PAID_JOURNEYS[journey_id] = session["id"]
            if meta.get("order_id"):
                ledger.mark_paid(meta["order_id"])  # credits earned ECO points, idempotent
            log.info("journey %s paid (session %s)", journey_id, session["id"])
    elif event.type == "checkout.session.expired":
        order_id = (event.data.object.to_dict().get("metadata") or {}).get("order_id")
        if order_id:
            ledger.cancel(order_id)  # abandoned checkout: release held ECO points

    return {"received": True}
