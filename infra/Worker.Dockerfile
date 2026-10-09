FROM python:3.12-slim-bookworm
COPY --from=ghcr.io/astral-sh/uv:0.11.2 /uv /uvx /bin/
RUN apt-get update && apt-get install -y --no-install-recommends libsndfile1 libgomp1 ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV UV_LINK_MODE=copy UV_COMPILE_BYTECODE=1 PYTHONPATH=/app/worker PYTHONUNBUFFERED=1
COPY worker/pyproject.toml worker/uv.lock ./worker/
RUN --mount=type=cache,target=/root/.cache/uv uv sync --project worker --locked --no-dev
COPY worker/csi_worker ./worker/csi_worker
COPY server/src/main/resources/agent ./server/src/main/resources/agent
COPY scripts/provision-models.py scripts/cleanup-demo.py ./scripts/
ENV PATH=/app/worker/.venv/bin:$PATH MODEL_ROOT=/app/.models WHISPER_MODEL=/app/.models/whisper-small SPEAKER_MODEL=/app/.models/ecapa HF_HUB_DISABLE_TELEMETRY=1
CMD ["python", "-m", "csi_worker.main"]
