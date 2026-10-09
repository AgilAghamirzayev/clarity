"""Verify local summary generation from existing, explicitly included sample calls."""

import os
import time
from uuid import uuid4

import httpx

base = os.environ.get("CSI_API_URL", "http://127.0.0.1:8086") + "/api/v1"
with httpx.Client(base_url=base, timeout=30, trust_env=False) as client:

    def post(path, **kwargs):
        csrf = client.get("/auth/csrf").json()
        headers = kwargs.pop("headers", {})
        headers[csrf["headerName"]] = csrf["token"]
        response = client.post(path, headers=headers, **kwargs)
        response.raise_for_status()
        return response.json()

    post(
        "/auth/login",
        json={
            "tenant": os.environ["BOOTSTRAP_TENANT"],
            "email": os.environ["BOOTSTRAP_EMAIL"],
            "password": os.environ["BOOTSTRAP_PASSWORD"],
        },
    )
    key = str(uuid4())
    result = post(
        "/support-summary", headers={"Idempotency-Key": key}, json={"days": 7, "includeSamples": True}
    )
    replay = post(
        "/support-summary", headers={"Idempotency-Key": key}, json={"days": 7, "includeSamples": True}
    )
    assert result["id"] == replay["id"]
    print("Summary queued; repeated request reused the same report.", flush=True)
    deadline = time.monotonic() + 900
    last = None
    while time.monotonic() < deadline:
        response = client.get("/support-summary?days=7&includeSamples=true")
        response.raise_for_status()
        summary = response.json()
        assert summary["id"] == result["id"]
        if summary["status"] != last:
            print("Summary:", summary["status"], flush=True)
            last = summary["status"]
        if summary["status"] == "FAILED":
            raise RuntimeError("Local summary generation failed")
        if summary["status"] == "COMPLETED":
            report = summary["report"]
            available = {call["reference"] for call in summary["snapshot"]["evidence"]}
            assert report["overview"] and report["model"]
            for item in report["strengths"] + report["advice"]:
                assert item["evidenceRefs"] and set(item["evidenceRefs"]).issubset(available)
            print(
                f"PASS: {summary['snapshot']['current']['calls']} calls, {len(report['advice'])} evidence-linked suggestions; areas: {', '.join(sorted({a['area'] for a in report['advice']}))}.",
                flush=True,
            )
            break
        time.sleep(3)
    else:
        raise TimeoutError("Summary is still processing")
