import json
from functools import lru_cache

from fastapi import APIRouter

from ..config import DATA_DIR
from ..models import Network

router = APIRouter(prefix="/api", tags=["network"])


@lru_cache
def _network() -> Network:
    path = DATA_DIR / "network.json"
    if not path.exists():
        return Network(hubs=[], corridors=[])
    return Network.model_validate(json.loads(path.read_text()))


@router.get("/network")
def network() -> Network:
    """Pre-built hub-to-hub corridors (real rail geometry) for the idle map."""
    return _network()
