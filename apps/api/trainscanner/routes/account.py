from fastapi import APIRouter, HTTPException

from .. import eco, ledger
from ..models import Account, EcoProgram, SignInRequest

router = APIRouter(prefix="/api", tags=["eco"])


@router.post("/account")
def sign_in(body: SignInRequest) -> Account:
    """Demo sign-in: email only, creates the account on first use (with the welcome bonus)."""
    email = body.email.strip()
    if "@" not in email or len(email) > 254:
        raise HTTPException(422, "enter a valid email")
    return ledger.sign_in(email)


@router.get("/account/{account_id}")
def get_account(account_id: str) -> Account:
    acc = ledger.get_account(account_id)
    if not acc:
        raise HTTPException(404, "unknown account")
    return acc


@router.get("/eco/program")
def program() -> EcoProgram:
    return eco.program()
