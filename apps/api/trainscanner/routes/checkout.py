import logging
import time

import stripe
from fastapi import APIRouter, HTTPException, Request

from .. import eco, ledger
from ..config import settings
from ..models import (
    Account,
    Basket,
    BasketRequest,
    CheckoutRequest,
    CheckoutResponse,
    Journey,
    Order,
    Quote,
    Stay,
)
from .journeys import JOURNEYS
from .stays import STAYS

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["checkout"])

CHECKOUT_TTL_S = 31 * 60  # Stripe's minimum is 30 min; abandoned sessions expire and release held points
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


def _account(account_id: str | None) -> Account | None:
    if not account_id:
        return None
    acc = ledger.get_account(account_id)
    if not acc:
        raise HTTPException(404, "unknown account, sign in again")
    return acc


def _quote(js: list[Journey], ss: list[Stay], acc: Account | None, use_points: bool) -> Quote:
    """Stays are charged but neither earn nor take ECO points: those only apply to green tickets."""
    subtotal = sum(j.price_cents for j in js) + sum(s.price_cents for s in ss)
    balance = acc.points if acc else 0
    max_points = eco.max_redeemable_points(js, balance) if acc else 0
    used = max_points if use_points else 0
    discount = used * eco.POINT_VALUE_CENTS
    return Quote(
        subtotal_cents=subtotal,
        discount_cents=discount,
        total_cents=subtotal - discount,
        currency=js[0].currency,
        points_used=used,
        points_earned=sum(j.eco_points for j in js) if acc else 0,
        max_points=max_points,
        balance=balance,
    )


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
        quote=_quote(js, ss, _account(body.account_id), body.use_points),
    )


def _item(name: str, description: str, cents: int, currency: str) -> dict:
    return {
        "quantity": 1,
        "price_data": {
            "currency": currency.lower(),
            "unit_amount": cents,
            "product_data": {"name": name, "description": description},
        },
    }


@router.post("/checkout")
def checkout(body: CheckoutRequest, request: Request) -> CheckoutResponse:
    js = _lookup(body.journey_ids)
    ss = _stays(body.stay_ids)
    acc = _account(body.account_id)
    q = _quote(js, ss, acc, body.use_points)
    try:
        order_id = ledger.create_order(
            acc.id if acc else None,
            body.journey_ids,
            q.points_used,
            q.points_earned,
            q.total_cents,
            sum(eco.co2_saved_g(j) for j in js) if acc else 0,
        )
    except ledger.InsufficientPoints as e:
        raise HTTPException(409, "not enough ECO points") from e

    ids = ",".join(body.journey_ids)
    meta = {"journey_ids": ids, "stay_ids": ",".join(body.stay_ids), "order_id": order_id}
    origin = request.headers.get("origin") or "http://localhost:5173"
    success = f"{origin}/?paid={ids}&order={order_id}"
    if not settings.stripe_secret_key:
        return CheckoutResponse(order_id=order_id, url=success, demo=True, quote=q)

    try:
        params: dict = {
            "api_key": settings.stripe_secret_key,
            "mode": "payment",
            # One line per ticket (each leg is its own operator ticket) and one per stay, in one payment.
            "line_items": [
                _item(
                    f"{lg.origin.name} → {lg.destination.name}",
                    " · ".join(
                        x
                        for x in (
                            lg.operator,
                            lg.line,
                            f"{j.travellers} traveller(s)",
                            CLASS_LABEL[j.travel_class],
                        )
                        if x
                    ),
                    lg.price_cents,
                    j.currency,
                )
                for j in js
                for lg in j.legs
                if lg.price_cents > 0
            ]
            + [
                _item(
                    s.name,
                    f"{s.nights} night(s) from {s.checkin} · {s.guests} guest(s)",
                    s.price_cents,
                    s.currency,
                )
                for s in ss
            ],
            "metadata": meta,
            "payment_intent_data": {"metadata": meta},
            "expires_at": int(time.time()) + CHECKOUT_TTL_S,
        }
        if acc:
            params["customer_email"] = acc.email
        if q.discount_cents:
            coupon = stripe.Coupon.create(
                api_key=settings.stripe_secret_key,
                amount_off=q.discount_cents,
                currency=q.currency.lower(),
                duration="once",
                max_redemptions=1,
                name=f"EcoTokens ({q.points_used})"[:40],
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
