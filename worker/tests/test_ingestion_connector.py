import importlib.util
import json
from pathlib import Path

import httpx
import pytest

spec = importlib.util.spec_from_file_location(
    "ingest_recordings", Path(__file__).resolve().parents[2] / "scripts/ingest-recordings.py"
)
connector = importlib.util.module_from_spec(spec)
spec.loader.exec_module(connector)


def test_connector_saves_receipt_only_after_acceptance_and_reuses_event_key(tmp_path, monkeypatch):
    (tmp_path / "call.wav").write_bytes(b"RIFF0000WAVE")
    manifest = tmp_path / "call.ready.json"
    manifest.write_text(
        json.dumps(
            {"eventId": "recorder-event-17", "audioFile": "call.wav", "metadata": {"agent": "Support"}}
        )
    )
    calls = []
    original = httpx.Client

    def handle(request):
        calls.append(request)
        if len(calls) == 1:
            return httpx.Response(503)
        return httpx.Response(202, json={"id": "call-id", "status": "QUEUED"})

    monkeypatch.setattr(
        connector.httpx, "Client", lambda **kw: original(**kw, transport=httpx.MockTransport(handle))
    )
    with pytest.raises(httpx.HTTPStatusError):
        connector.send_recording(manifest, "https://example.test/api/v1/ingestion/recordings", "test-only")
    assert not (tmp_path / ".clarity-receipts").exists()
    assert (
        connector.send_recording(manifest, "https://example.test/api/v1/ingestion/recordings", "test-only")
        == "accepted"
    )
    assert (
        connector.send_recording(manifest, "https://example.test/api/v1/ingestion/recordings", "test-only")
        == "already_sent"
    )
    assert len(calls) == 2
    assert calls[0].headers["Idempotency-Key"] == calls[1].headers["Idempotency-Key"]


def test_connector_refuses_paths_outside_recording_folder(tmp_path):
    manifest = tmp_path / "call.ready.json"
    manifest.write_text(json.dumps({"eventId": "event", "audioFile": "../private.wav", "metadata": {}}))
    with pytest.raises(ValueError, match="inside the watched folder"):
        connector.send_recording(manifest, "https://example.test/api/v1/ingestion/recordings", "test-only")
