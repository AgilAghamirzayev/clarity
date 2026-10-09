import os
from uuid import uuid4

import pytest
from csi_worker.activities import persist
from csi_worker.storage import database
from psycopg.types.json import Jsonb

pytestmark = pytest.mark.skipif(
    os.environ.get("CSI_INTEGRATION_TESTS") != "true", reason="Requires the local PostgreSQL platform"
)


def test_clustering_is_tenant_scoped_and_replay_is_idempotent(monkeypatch):
    tenant, other, call = str(uuid4()), str(uuid4()), str(uuid4())
    event = dict(id=str(uuid4()), tenant=tenant, resource=call, generation=1)
    analysis = {
        "model": "test-model",
        "promptVersion": "test",
        "issues": [
            {
                "title": "Payment error",
                "category": "Payments",
                "priority": "High",
                "description": "Payment failed",
                "evidence": [0, 1],
                "proposedAction": "Inspect decline log",
                "expectedOutcome": "Fewer failures",
            }
        ],
    }
    with database(tenant) as conn:
        conn.execute(
            "insert into tenants(id,slug) values (%s,%s),(%s,%s)",
            (tenant, "test-" + tenant, other, "test-" + other),
        )
        conn.execute(
            "insert into calls(id,tenant_id,import_key,audio_key,sha256,content_type,metadata,analysis) values (%s,%s,%s,'test','hash','audio/wav','{}',%s)",
            (call, tenant, call, Jsonb(analysis)),
        )
    monkeypatch.setattr("csi_worker.analysis.embed", lambda text: [0.1] * 768)
    row = {"status": "PROCESSING", "analysis": analysis}
    persist(event, row)
    persist(event, row)
    with database(tenant) as conn:
        assert conn.execute("select count(*) as n from issues").fetchone()["n"] == 1
        assert conn.execute("select count(*) as n from recommendations").fetchone()["n"] == 1
        assert (
            conn.execute("select mentions from call_issues where call_id=%s", (call,)).fetchone()["mentions"]
            == 2
        )
        assert (
            conn.execute("select status from calls where id=%s", (call,)).fetchone()["status"] == "COMPLETED"
        )
    with database(other) as conn:
        assert conn.execute("select count(*) as n from issues").fetchone()["n"] == 0


def test_external_delivery_retry_reuses_persisted_identity(monkeypatch):
    from csi_worker.integrations import deliver

    tenant, issue, rec, decision, integration, event_id = [str(uuid4()) for _ in range(6)]
    with database(tenant) as conn:
        conn.execute("insert into tenants(id,slug) values (%s,%s)", (tenant, "test-" + tenant))
        conn.execute(
            "insert into issues(id,tenant_id,data,centroid,model) values (%s,%s,%s,%s::vector,%s)",
            (issue, tenant, Jsonb({"id": issue}), str([0.1] * 768), "test"),
        )
        conn.execute(
            "insert into recommendations(id,tenant_id,issue_id,data) values (%s,%s,%s,%s)",
            (
                rec,
                tenant,
                issue,
                Jsonb({"id": rec, "title": "Synthetic payment issue", "proposedAction": "Inspect logs"}),
            ),
        )
        conn.execute(
            "insert into decisions(id,tenant_id,recommendation_id,data,version) values (%s,%s,%s,%s,1)",
            (decision, tenant, rec, Jsonb({"status": "Approved"})),
        )
        conn.execute(
            "insert into integrations(id,tenant_id,kind,enabled,config) values (%s,%s,'crm',true,%s)",
            (integration, tenant, Jsonb({"endpoint": "https://example.com"})),
        )
    monkeypatch.setenv("CSI_INTEGRATION_" + integration.replace("-", "_") + "_TOKEN", "synthetic-test-secret")
    attempts = []

    def send(*args):
        attempts.append(args[3])
        if len(attempts) == 1:
            raise TimeoutError("Simulated network failure")
        return "test-external-1"

    monkeypatch.setattr("csi_worker.integrations.send", send)
    event = {
        "id": event_id,
        "tenant": tenant,
        "resource": decision,
        "type": "decision.approved",
        "generation": 1,
    }
    with pytest.raises(RuntimeError):
        deliver(event)
    deliver(event)
    deliver(event)
    assert len(attempts) == 2 and attempts[0] == attempts[1]
    with database(tenant) as conn:
        row = conn.execute("select status,attempts,external_id from deliveries").fetchone()
        assert row == {"status": "SENT", "attempts": 2, "external_id": "test-external-1"}


def test_stage_measurements_record_failures_retries_and_tenant_isolation(monkeypatch):
    from types import SimpleNamespace

    from csi_worker.activities import safe_stage
    from temporalio.exceptions import ApplicationError

    tenant, other, call = str(uuid4()), str(uuid4()), str(uuid4())
    event = dict(tenant=tenant, resource=call, generation=1)
    with database(tenant) as conn:
        conn.execute(
            "insert into tenants(id,slug) values (%s,%s),(%s,%s)",
            (tenant, "metrics-" + tenant, other, "metrics-" + other),
        )
        conn.execute(
            "insert into calls(id,tenant_id,import_key,audio_key,sha256,content_type,metadata) values(%s,%s,%s,'test','hash','audio/wav','{}')",
            (call, tenant, call),
        )
    monkeypatch.setattr("csi_worker.activities.activity.info", lambda: SimpleNamespace(attempt=1))

    def fail(event, row):
        raise RuntimeError("Private transcript must not appear in error_code")

    with pytest.raises(ApplicationError):
        safe_stage("analysis", fail, event)
    monkeypatch.setattr("csi_worker.activities.activity.info", lambda: SimpleNamespace(attempt=2))
    safe_stage("analysis", lambda event, row: None, event)
    with database(tenant) as conn:
        rows = conn.execute(
            "select attempt,status,error_code,elapsed_ms from call_stage_attempts order by attempt"
        ).fetchall()
        assert [r["status"] for r in rows] == ["FAILED", "SUCCEEDED"]
        assert rows[0]["error_code"] == "ANALYSIS_FAILED"
        assert all(r["elapsed_ms"] >= 0 for r in rows)
    with database(other) as conn:
        assert conn.execute("select count(*) as n from call_stage_attempts").fetchone()["n"] == 0
