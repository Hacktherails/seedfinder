"""Seeds ledger (SQLite). Points used by an order are held when checkout opens, so they cannot be spent
twice; they are released if the payment is abandoned. Earned points are credited once, when the payment is
confirmed (webhook or return from Checkout, whichever comes first)."""

import secrets
import sqlite3
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path

from .config import settings
from .models import Account, Order

_SCHEMA = """
CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  points INTEGER NOT NULL DEFAULT 0,
  co2_saved_g INTEGER NOT NULL DEFAULT 0,
  trips INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  account_id TEXT REFERENCES accounts(id),
  journey_id TEXT NOT NULL,
  session_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  points_used INTEGER NOT NULL DEFAULT 0,
  points_earned INTEGER NOT NULL DEFAULT 0,
  total_cents INTEGER NOT NULL,
  co2_saved_g INTEGER NOT NULL DEFAULT 0
);
"""


class InsufficientPoints(Exception):
    pass


@contextmanager
def _db() -> Iterator[sqlite3.Connection]:
    path = Path(settings.eco_db_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path, isolation_level=None, timeout=10)
    conn.row_factory = sqlite3.Row
    try:
        conn.executescript(_SCHEMA)
        conn.execute("BEGIN IMMEDIATE")  # serialise writers: balance checks and updates are atomic
        yield conn
        conn.execute("COMMIT")
    except BaseException:
        conn.execute("ROLLBACK")
        raise
    finally:
        conn.close()


def _account(row: sqlite3.Row | None) -> Account | None:
    return Account(**dict(row)) if row else None


def _order(conn: sqlite3.Connection, row: sqlite3.Row | None) -> Order | None:
    if not row:
        return None
    d = dict(row)
    acc = conn.execute("SELECT * FROM accounts WHERE id = ?", (d["account_id"],)).fetchone()
    return Order(
        id=d["id"],
        journey_ids=d["journey_id"].split(","),  # column keeps its first name: comma-separated ids
        status=d["status"],
        points_used=d["points_used"],
        points_earned=d["points_earned"],
        total_cents=d["total_cents"],
        co2_saved_g=d["co2_saved_g"],
        account=_account(acc),
    )


def sign_in(email: str) -> Account:
    email = email.strip().lower()
    with _db() as c:
        row = c.execute("SELECT * FROM accounts WHERE email = ?", (email,)).fetchone()
        if not row:
            c.execute(
                "INSERT INTO accounts (id, email, points) VALUES (?, ?, ?)",
                ("acc_" + secrets.token_urlsafe(12), email, settings.eco_welcome_points),
            )
            row = c.execute("SELECT * FROM accounts WHERE email = ?", (email,)).fetchone()
        return _account(row)  # type: ignore[return-value]


def get_account(account_id: str) -> Account | None:
    with _db() as c:
        return _account(c.execute("SELECT * FROM accounts WHERE id = ?", (account_id,)).fetchone())


def create_order(
    account_id: str | None,
    journey_ids: list[str],
    points_used: int,
    points_earned: int,
    total_cents: int,
    co2_g: int,
) -> str:
    order_id = "ord_" + secrets.token_urlsafe(12)
    with _db() as c:
        if points_used:
            cur = c.execute(
                "UPDATE accounts SET points = points - ? WHERE id = ? AND points >= ?",
                (points_used, account_id, points_used),
            )
            if cur.rowcount != 1:
                raise InsufficientPoints
        c.execute(
            "INSERT INTO orders (id, account_id, journey_id, points_used, points_earned, total_cents,"
            " co2_saved_g) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (order_id, account_id, ",".join(journey_ids), points_used, points_earned, total_cents, co2_g),
        )
    return order_id


def attach_session(order_id: str, session_id: str) -> None:
    with _db() as c:
        c.execute("UPDATE orders SET session_id = ? WHERE id = ?", (session_id, order_id))


def get_order(order_id: str) -> Order | None:
    with _db() as c:
        return _order(c, c.execute("SELECT * FROM orders WHERE id = ?", (order_id,)).fetchone())


def order_session_id(order_id: str) -> str | None:
    with _db() as c:
        row = c.execute("SELECT session_id FROM orders WHERE id = ?", (order_id,)).fetchone()
        return row["session_id"] if row else None


def mark_paid(order_id: str) -> Order | None:
    """Idempotent: credits earned points only on the pending → paid transition."""
    with _db() as c:
        row = c.execute("SELECT * FROM orders WHERE id = ?", (order_id,)).fetchone()
        if row and row["status"] in ("pending", "cancelled"):
            if row["status"] == "cancelled" and row["points_used"]:
                # Paid after an abandon released the hold (late webhook): take the points again, floor at 0.
                c.execute(
                    "UPDATE accounts SET points = MAX(0, points - ?) WHERE id = ?",
                    (row["points_used"], row["account_id"]),
                )
            c.execute("UPDATE orders SET status = 'paid' WHERE id = ?", (order_id,))
            c.execute(
                "UPDATE accounts SET points = points + ?, co2_saved_g = co2_saved_g + ?, trips = trips + 1"
                " WHERE id = ?",
                (row["points_earned"], row["co2_saved_g"], row["account_id"]),
            )
            row = c.execute("SELECT * FROM orders WHERE id = ?", (order_id,)).fetchone()
        return _order(c, row)


def cancel(order_id: str) -> Order | None:
    """Releases held points of a pending order. No-op once paid or already cancelled."""
    with _db() as c:
        row = c.execute("SELECT * FROM orders WHERE id = ?", (order_id,)).fetchone()
        if row and row["status"] == "pending":
            c.execute("UPDATE orders SET status = 'cancelled' WHERE id = ?", (order_id,))
            if row["points_used"]:
                c.execute(
                    "UPDATE accounts SET points = points + ? WHERE id = ?",
                    (row["points_used"], row["account_id"]),
                )
            row = c.execute("SELECT * FROM orders WHERE id = ?", (order_id,)).fetchone()
        return _order(c, row)
