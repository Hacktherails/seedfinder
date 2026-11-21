import logging
import time

import stripe
from fastapi import APIRouter, HTTPException, Query, Request

from .. import eco, ledger
from ..config import settings
from ..models import Account, CheckoutRequest, CheckoutResponse, Journey, Order, Quote
from .journeys import JOURNEYS

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["checkout"])

CHECKOUT_TTL_S = 31 * 60  # Stripe's minimum is 30 min; abandoned sessions expire and release held points


def _journey(journey_id: str) -> Journey:
    j = JOURNEYS.get(journey_id)
    if not j:
        raise HTTPException(404, "journey expired, search again")
    return j


def _account(account_id: str | None) -> Account | None:
    if not account_id:
        return None
    acc = ledger.get_account(account_id)
    if not acc:
        raise HTTPException(404, "unknown account, sign in again")
    return acc


def _quote(j: Journey, acc: Account | None, use_points: bool) -> Quote:
    balance = acc.points if acc else 0
    max_points = eco.max_redeemable_points(j, balance) if acc else 0
    used = max_points if use_points else 0
    discount = used * eco.POINT_VALUE_CENTS
    return Quote(
        journey_id=j.id,
        subtotal_cents=j.price_cents,
        discount_cents=discount,
        total_cents=j.price_cents - discount,
        currency=j.currency,
        points_used=used,
        points_earned=j.eco_points if acc else 0,
        max_points=max_points,
        balance=balance,
    )


@router.get("/checkout/quote")
def quote(journey_id: str, account_id: str | None = None, use_points: bool = Query(default=False)) -> Quote:
    return _quote(_journey(journey_id), _account(account_id), use_points)


@router.post("/checkout")
def checkout(body: CheckoutRequest, request: Request) -> CheckoutResponse:
    j = _journey(body.journey_id)
    acc = _account(body.account_id)
    q = _quote(j, acc, body.use_points)
    try:
        order_id = ledger.create_order(
            acc.id if acc else None,
            j.id,
            q.points_used,
            q.points_earned,
            q.total_cents,
            eco.co2_saved_g(j) if acc else 0,
        )
    except ledger.InsufficientPoints as e:
        raise HTTPException(409, "not enough ECO points") from e

    origin = request.headers.get("origin") or "http://localhost:5173"
    success = f"{origin}/?paid={j.id}&order={order_id}"
    if not settings.stripe_secret_key:
        return CheckoutResponse(order_id=order_id, url=success, demo=True, quote=q)

    try:
        params: dict = {
            "api_key": settings.stripe_secret_key,
            "mode": "payment",
            "line_items": [
                {
                    "quantity": 1,
                    "price_data": {
                        "currency": j.currency.lower(),
                        "unit_amount": lg.price_cents,
                        "product_data": {
                            "name": f"{lg.origin.name} → {lg.destination.name}",
                            "description": " · ".join(x for x in (lg.operator, lg.line) if x)
                            or "Train ticket",
                        },
                    },
                }
                for lg in j.legs
                if lg.price_cents > 0
            ],
            "metadata": {"journey_id": j.id, "order_id": order_id},
            "payment_intent_data": {"metadata": {"journey_id": j.id, "order_id": order_id}},
            "expires_at": int(time.time()) + CHECKOUT_TTL_S,
        }
        if acc:
            params["customer_email"] = acc.email
        if q.discount_cents:
            coupon = stripe.Coupon.create(
                api_key=settings.stripe_secret_key,
                amount_off=q.discount_cents,
                currency=j.currency.lower(),
                duration="once",
                max_redemptions=1,
                name=f"ECO points ({q.points_used} pts)"[:40],
                metadata={"order_id": order_id},
            )
            params["discounts"] = [{"coupon": coupon.id}]
        if body.embedded:
            params |= {"ui_mode": "embedded_page", "redirect_on_completion": "never"}
        else:
            params |= {"success_url": success, "cancel_url": f"{origin}/?cancelled={order_id}"}
        session = stripe.checkout.Session.create(**params)
    except stripe.StripeError as e:
        ledger.cancel(order_id)  # give the held points back
        log.warning("checkout session failed: %s", e)
        raise HTTPException(502, f"payment provider error: {e.user_message or e}") from e

    ledger.attach_session(order_id, session.id)
    return CheckoutResponse(
        order_id=order_id,
        url=session.url,
        client_secret=session.client_secret,
        demo=False,
        quote=q,
    )


def _order_or_404(order_id: str) -> Order:
    order = ledger.get_order(order_id)
    if not order:
        raise HTTPException(404, "unknown order")
    return order


@router.post("/orders/{order_id}/confirm")
def confirm(order_id: str) -> Order:
    """Called when the traveller comes back from Checkout. Never trusts the browser: asks Stripe."""
    order = _order_or_404(order_id)
    if order.status == "paid":
        return order
    if not settings.stripe_secret_key:  # demo mode: no payment provider, the order is paid by definition
        return ledger.mark_paid(order_id) or order
    session_id = ledger.order_session_id(order_id)
    if not session_id:
        raise HTTPException(409, "no payment for this order")
    session = stripe.checkout.Session.retrieve(session_id, api_key=settings.stripe_secret_key)
    if session.payment_status != "paid":
        raise HTTPException(402, "payment not completed")
    return ledger.mark_paid(order_id) or order


@router.post("/orders/{order_id}/cancel")
def cancel(order_id: str) -> Order:
    """Traveller closed Checkout: expire the session so it cannot be paid, then release held points."""
    order = _order_or_404(order_id)
    if order.status != "pending":
        return order
    session_id = ledger.order_session_id(order_id)
    if settings.stripe_secret_key and session_id:
        try:
            stripe.checkout.Session.expire(session_id, api_key=settings.stripe_secret_key)
        except stripe.StripeError as e:
            # Already complete (paid in the meantime) or already expired: let Stripe's state decide.
            session = stripe.checkout.Session.retrieve(session_id, api_key=settings.stripe_secret_key)
            if session.payment_status == "paid":
                return ledger.mark_paid(order_id) or order
            log.info("expire %s: %s", session_id, e)
    return ledger.cancel(order_id) or order
