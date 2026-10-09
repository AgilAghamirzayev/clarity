import asyncio
import os
from pathlib import Path

import httpx
import psycopg


def heartbeat():
    ready = all(
        Path(os.environ.get(key, "missing-model")).is_dir() for key in ["WHISPER_MODEL", "SPEAKER_MODEL"]
    )
    try:
        with httpx.Client(timeout=5, trust_env=False) as client:
            models = client.get(os.environ.get("OLLAMA_URL", "http://127.0.0.1:11434") + "/api/tags")
            models.raise_for_status()
            names = {item["name"] for item in models.json()["models"]}
            ready = ready and all(
                name in names
                for name in [
                    os.environ.get("LLM_MODEL", "qwen3:4b-instruct"),
                    os.environ.get("EMBEDDING_MODEL", "nomic-embed-text:latest"),
                ]
            )
    except Exception:
        ready = False
    with psycopg.connect(
        os.environ.get("DATABASE_URL", "postgresql://csi_app@localhost:5546/csi"),
        password=os.environ["DB_APP_PASSWORD"],
    ) as conn:
        conn.execute(
            "insert into service_heartbeats(service,ready) values ('local-ai',%s) on conflict(service) do update set ready=excluded.ready,updated_at=now()",
            (ready,),
        )


async def report_health():
    while True:
        try:
            await asyncio.to_thread(heartbeat)
        except Exception:
            pass
        await asyncio.sleep(30)
