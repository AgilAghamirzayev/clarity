"""Exercise the real API pipeline using a synthetic recording supplied by the caller."""

import argparse
import json
import os
import time
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

import httpx

parser = argparse.ArgumentParser()
parser.add_argument("audio", type=Path, help="A synthetic recording, never a private customer file")
args = parser.parse_args()
base = os.environ.get("CSI_API_URL", "http://127.0.0.1:8086") + "/api/v1"
with httpx.Client(base_url=base, timeout=30, trust_env=False) as client:

    def write(path, **kwargs):
        csrf = client.get("/auth/csrf").json()
        headers = kwargs.pop("headers", {})
        headers[csrf["headerName"]] = csrf["token"]
        return client.post(path, headers=headers, **kwargs)

    login = write(
        "/auth/login",
        json={
            "tenant": os.environ["BOOTSTRAP_TENANT"],
            "email": os.environ["BOOTSTRAP_EMAIL"],
            "password": os.environ["BOOTSTRAP_PASSWORD"],
        },
    )
    assert login.status_code == 200, f"Login failed: {login.status_code}"
    key = str(uuid4())
    metadata = {
        "title": "Card payment declined at checkout",
        "sample": True,
        "customerId": "synthetic-smoke-customer",
        "agent": "Payments support",
        "department": "Payments",
        "recordedAt": datetime.now(timezone.utc).isoformat(),
        "language": "en",
        "speakers": 1,
        "customerChannel": None,
    }

    def upload():
        with args.audio.open("rb") as audio:
            return write(
                "/calls/import",
                headers={"Idempotency-Key": key},
                files={
                    "metadata": ("metadata.json", json.dumps(metadata), "application/json"),
                    "audio": ("smoke.wav", audio, "audio/wav"),
                },
            )

    first = upload()
    assert first.status_code == 202, f"Import failed: {first.status_code}"
    call_id = first.json()["id"]
    replay = upload()
    assert replay.status_code == 200 and replay.json()["id"] == call_id
    print(f"Imported {call_id}; replay reused the same call.", flush=True)
    deadline = time.monotonic() + 600
    last = None
    while time.monotonic() < deadline:
        record = client.get("/calls/" + call_id).json()
        state = (record["status"], record["stage"])
        if state != last:
            print("Processing:", *state, flush=True)
            last = state
        if record["status"] == "FAILED":
            raise AssertionError(f"Pipeline failed: {record['error_code']}")
        if record["status"] == "COMPLETED":
            break
        time.sleep(3)
    else:
        raise AssertionError("Pipeline timed out after ten minutes")
    workspace = client.get("/workspace").json()
    call = next(c for c in workspace["conversations"] if c["id"] == call_id)
    assert call["transcript"] and call["summary"] and call["issueId"]
    rec = next(r for r in workspace["recommendations"] if r["issueId"] == call["issueId"])
    # This smoke test must never send a partner message.
    integrations = client.get("/integrations").json()
    assert not any(i["enabled"] for i in integrations), (
        "Disable test-tenant integrations before running review smoke"
    )
    review = write(
        "/recommendations/" + rec["id"] + "/decisions",
        json={
            "action": "Approved",
            "owner": "Synthetic QA",
            "rationale": "Synthetic smoke test confirms the reported payment evidence.",
        },
    )
    if review.status_code == 409:
        decision = next(d for d in workspace["decisions"] if d["recommendationId"] == rec["id"])
    else:
        assert review.status_code == 200, f"Review failed: {review.status_code}"
        decision = review.json()
    if decision["status"] == "Approved":
        decision = write(
            "/recommendations/" + rec["id"] + "/advance", json={"version": decision["version"]}
        ).json()
    if decision["status"] == "In progress":
        decision = write(
            "/recommendations/" + rec["id"] + "/advance", json={"version": decision["version"]}
        ).json()
    assert decision["status"] == "Completed"
    outcome = client.get("/decisions/" + decision["id"] + "/outcomes").json()
    assert outcome["causal"] is False
    assert client.get("/calls/" + call_id + "/audio").status_code == 200
    print(
        "PASS: audio import, idempotency, local pipeline, evidence, review, lifecycle, outcome and audio authorization.",
        flush=True,
    )
