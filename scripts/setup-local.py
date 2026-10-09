"""Generate local credentials once. Never overwrite an existing environment."""

import os
import secrets
from pathlib import Path

root = Path(__file__).resolve().parents[1]
path = root / ".env.local"
if path.exists():
    raise SystemExit(".env.local exists; kept existing credentials.")
values = {
    key: secrets.token_urlsafe(32)
    for key in [
        "DB_OWNER_PASSWORD",
        "DB_APP_PASSWORD",
        "S3_SECRET_KEY",
        "TEMPORAL_DB_PASSWORD",
        "BOOTSTRAP_PASSWORD",
    ]
}
values.update(
    S3_ACCESS_KEY="csi-local",
    COOKIE_SECURE="false",
    BOOTSTRAP_TENANT="local",
    BOOTSTRAP_EMAIL="admin@csi.local",
    S3_ENDPOINT="http://localhost:9100",
    S3_BUCKET="csi-audio",
    TEMPORAL_ADDRESS="localhost:17233",
    OLLAMA_URL="http://127.0.0.1:11434",
    LLM_MODEL="qwen3:4b-instruct",
    EMBEDDING_MODEL="nomic-embed-text:latest",
    WHISPER_MODEL=str(root / ".models/whisper-small"),
    SPEAKER_MODEL=str(root / ".models/ecapa"),
    GLINER_MODEL=str(root / ".models/gliner"),
    VITE_DATA_MODE="api",
)
fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
with os.fdopen(fd, "w") as file:
    file.write("".join(f"{key}={value}\n" for key, value in values.items()))
print("Created .env.local with private local credentials. Admin password is BOOTSTRAP_PASSWORD.")
