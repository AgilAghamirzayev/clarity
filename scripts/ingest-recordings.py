#!/usr/bin/env python3
"""Forward completed recordings from a watched folder to Clarity's ingestion API."""

import argparse
import hashlib
import json
import os
import time
from pathlib import Path
from urllib.parse import urlparse

import httpx


def send_recording(sidecar: Path, endpoint: str, token: str):
    manifest = json.loads(sidecar.read_text())
    filename = manifest["audioFile"]
    if not isinstance(filename, str) or Path(filename).name != filename:
        raise ValueError("audioFile must be a filename inside the watched folder")
    audio = (sidecar.parent / filename).resolve()
    if audio.parent != sidecar.parent.resolve() or not audio.is_file():
        raise ValueError("Recording is missing or outside the watched folder")
    event = manifest["eventId"]
    if not isinstance(event, str) or not event.strip():
        raise ValueError("eventId must be a stable source event identifier")
    key = hashlib.sha256(event.encode()).hexdigest()
    metadata = manifest["metadata"]
    receipt = sidecar.parent / ".clarity-receipts" / (key + ".json")
    if receipt.exists():
        return "already_sent"
    with (
        audio.open("rb") as stream,
        httpx.Client(timeout=180, follow_redirects=False, trust_env=False) as client,
    ):
        response = client.post(
            endpoint,
            headers={"Authorization": "Bearer " + token, "Idempotency-Key": key},
            files={
                "metadata": ("metadata.json", json.dumps(metadata), "application/json"),
                "audio": (filename, stream, "application/octet-stream"),
            },
        )
        response.raise_for_status()
        result = response.json()
    if not isinstance(result.get("id"), str) or result.get("status") not in {
        "QUEUED",
        "PROCESSING",
        "COMPLETED",
        "FAILED",
    }:
        raise ValueError("Unexpected ingestion response")
    receipt.parent.mkdir(mode=0o700, exist_ok=True)
    temporary = receipt.with_suffix(".tmp")
    temporary.write_text(json.dumps({"id": result["id"], "status": result["status"]}))
    temporary.replace(receipt)
    return "accepted"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("folder", type=Path)
    parser.add_argument(
        "--endpoint", required=True, help="Full /api/v1/ingestion/recordings URL"
    )
    parser.add_argument("--interval", type=int, default=30)
    parser.add_argument("--once", action="store_true")
    args = parser.parse_args()
    url = urlparse(args.endpoint)
    if (
        url.path != "/api/v1/ingestion/recordings"
        or url.query
        or url.fragment
        or url.username
        or not (
            url.scheme == "https"
            or (url.scheme == "http" and url.hostname in {"localhost", "127.0.0.1"})
        )
    ):
        parser.error(
            "Use the HTTPS ingestion endpoint (HTTP is allowed only on localhost)"
        )
    token = os.environ.get("CSI_INGEST_TOKEN")
    if not token:
        parser.error("Set CSI_INGEST_TOKEN in the connector environment")
    if not args.folder.is_dir() or args.interval < 1:
        parser.error("Choose an existing folder and a positive interval")
    while True:
        failed = False
        for sidecar in sorted(args.folder.glob("*.ready.json")):
            try:
                result = send_recording(sidecar, args.endpoint, token)
                if result == "accepted":
                    print("Recording accepted for automatic processing.", flush=True)
            except httpx.HTTPStatusError as error:
                failed = True
                print(
                    f"Ingestion returned HTTP {error.response.status_code}. Check source configuration; receipt not saved.",
                    flush=True,
                )
            except (httpx.HTTPError, ValueError, KeyError, OSError):
                failed = True
                print(
                    "Recording could not be sent. Check the ready manifest, file and connection; retrying on the next scan.",
                    flush=True,
                )
        if args.once:
            raise SystemExit(1 if failed else 0)
        time.sleep(args.interval)


if __name__ == "__main__":
    main()
