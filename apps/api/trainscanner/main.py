"""FastAPI entrypoint — router wiring only. Run: uv run uvicorn trainscanner.main:app --reload"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from .config import WEB_DIST, settings
from .models import PublicConfig
from .routes import account, checkout, journeys, network, stations, stripe_webhook

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


@app.get("/api/config", tags=["meta"])
def public_config() -> PublicConfig:
    """Browser-safe settings, so one Docker image works whatever keys the host injects."""
    return PublicConfig(stripe_publishable_key=settings.vite_stripe_publishable_key or None)


for r in (account, stations, journeys, network, checkout, stripe_webhook):
    app.include_router(r.router)


# Production: the same process serves the built frontend (single origin, no CORS, one service to deploy).
if WEB_DIST.is_dir():
    _root = WEB_DIST.resolve()

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str) -> FileResponse:
        if path.startswith("api/"):
            raise HTTPException(404, "not found")
        f = (_root / path).resolve()
        if path and f.is_file() and f.is_relative_to(_root):
            return FileResponse(f)
        return FileResponse(_root / "index.html")
