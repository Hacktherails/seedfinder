# Production image: FastAPI serves the API and the built frontend on $PORT (one service, one origin).
#   docker build -t trainscanner . && docker run --env-file .env -p 8100:8100 trainscanner
# Stripe keys are runtime env vars only: nothing secret is baked into the image.

FROM node:26-slim AS web
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/
RUN npm ci --no-audit --no-fund --loglevel=error
COPY apps/web apps/web
RUN npm run build -w apps/web

FROM ghcr.io/astral-sh/uv:python3.11-bookworm-slim
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy PYTHONUNBUFFERED=1 PORT=8100
WORKDIR /app/apps/api
COPY apps/api/pyproject.toml apps/api/uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project
COPY apps/api/trainscanner trainscanner
COPY --from=web /app/apps/web/dist /app/apps/web/dist
RUN useradd --create-home app && mkdir -p /app/.data && chown app /app/.data
USER app
EXPOSE 8100
CMD ["sh", "-c", "exec .venv/bin/uvicorn trainscanner.main:app --host 0.0.0.0 --port ${PORT} --proxy-headers --forwarded-allow-ips='*'"]
