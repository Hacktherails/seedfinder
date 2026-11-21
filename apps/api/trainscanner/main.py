"""FastAPI entrypoint — router wiring only. Run: uv run uvicorn trainscanner.main:app --reload"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .routes import checkout, journeys, network, stations

app = FastAPI(title="Train Scanner API", version="0.1.0")
app.add_middleware(
    CORSMiddleware, allow_origins=settings.cors_origins, allow_methods=["*"], allow_headers=["*"]
)


@app.get("/api/health", tags=["meta"])
def health() -> dict[str, str | bool]:
    return {
        "status": "ok",
        "offline_demo": settings.offline_demo,
        "stripe_configured": bool(settings.stripe_secret_key),
    }


for r in (stations, journeys, network, checkout):
    app.include_router(r.router)
