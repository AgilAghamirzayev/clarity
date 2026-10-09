"""Create private credentials for a single-server deployment without overwriting them."""

import argparse
import os
import re
import secrets
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument("domain", help="Public hostname, for example demo.example.com")
args = parser.parse_args()
if (
    not re.fullmatch(r"[a-zA-Z0-9](?:[a-zA-Z0-9.-]*[a-zA-Z0-9])?", args.domain)
    or "." not in args.domain
):
    raise SystemExit("Use a hostname without a scheme, port or path.")
path = Path(__file__).resolve().parents[1] / ".env.vps"
if path.exists():
    raise SystemExit(".env.vps already exists. Existing credentials were kept.")
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
    APP_DOMAIN=args.domain,
    S3_ACCESS_KEY="clarity-storage",
    COOKIE_SECURE="true",
    BOOTSTRAP_EMAIL="admin@csi.local",
    DEMO_MAX_WORKSPACES="100",
)
with os.fdopen(os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600), "w") as file:
    file.write("".join(f"{key}={value}\n" for key, value in values.items()))
print(
    "Created private .env.vps. Run docker compose --env-file .env.vps -f compose.vps.yml up -d --build."
)
