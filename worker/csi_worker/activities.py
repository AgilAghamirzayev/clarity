import os
import tempfile
import time
from uuid import UUID, uuid4, uuid5

from psycopg.types.json import Jsonb
from temporalio import activity
from temporalio.exceptions import ApplicationError

from .grouping import should_merge
from .storage import bucket, database, objects


def safe_stage(name, operation, event):
    started = time.perf_counter()
    attempt = activity.info().attempt
    recorded = False
    try:
        with database(event["tenant"]) as conn:
            row = conn.execute("select * from calls where id=%s", (event["resource"],)).fetchone()
            if not row or row["generation"] != event["generation"]:
                raise ValueError("STALE_CALL_GENERATION")
            conn.execute(
                "update calls set status='PROCESSING',stage=%s,attempts=attempts+1,updated_at=now() where id=%s and status<>'COMPLETED'",
                (name, event["resource"]),
            )
            conn.execute(
                "insert into call_stage_attempts(tenant_id,call_id,generation,stage,attempt,status) "
                "values (%s,%s,%s,%s,%s,'RUNNING') on conflict do nothing",
                (event["tenant"], event["resource"], event["generation"], name, attempt),
            )
        recorded = True
        operation(event, row)
        finish_stage(event, name, attempt, started, "SUCCEEDED")
    except Exception:
        if recorded:
            try:
                finish_stage(event, name, attempt, started, "FAILED")
            except Exception:
                pass  # The RUNNING measurement remains visible if the database is unavailable.
        # Provider exceptions may contain transcript fragments. Keep them out of workflow history.
        raise ApplicationError(f"{name.upper()}_FAILED", type=f"{name.upper()}_FAILED") from None


def finish_stage(event, name, attempt, started, status):
    with database(event["tenant"]) as conn:
        conn.execute(
            "update call_stage_attempts set finished_at=clock_timestamp(),elapsed_ms=%s,status=%s,error_code=%s "
            "where call_id=%s and generation=%s and stage=%s and attempt=%s",
            (
                (time.perf_counter() - started) * 1000,
                status,
                name.upper() + "_FAILED" if status == "FAILED" else None,
                event["resource"],
                event["generation"],
                name,
                attempt,
            ),
        )


@activity.defn
def transcribe_call(event):
    def run(event, row):
        if row["transcript"] is not None:
            return
        from .privacy import redact_segments
        from .speech import transcribe

        with tempfile.TemporaryDirectory(prefix="csi-audio-") as directory:
            path = os.path.join(directory, "recording")
            objects().download_file(bucket(), row["audio_key"], path)
            result = transcribe(path, row["metadata"])
            result["segments"] = redact_segments(result["segments"])
            with database(event["tenant"]) as conn:
                conn.execute(
                    "update calls set transcript=%s,updated_at=now() where id=%s and generation=%s",
                    (Jsonb(result), event["resource"], event["generation"]),
                )

    safe_stage("transcription", run, event)


@activity.defn
def analyze_call(event):
    def run(event, row):
        if row["analysis"] is not None:
            return
        from .analysis import analyze
        from .privacy import redact

        result = analyze(
            row["transcript"]["segments"],
            row["metadata"].get("analysisProfile"),
            role_attribution=row["transcript"].get("roleAttribution", "unknown"),
        )
        result["summary"] = redact(result["summary"])
        for finding in result["issues"]:
            for key in ["title", "description", "proposedAction", "expectedOutcome"]:
                finding[key] = redact(finding[key])
        with database(event["tenant"]) as conn:
            conn.execute(
                "update calls set analysis=%s,updated_at=now() where id=%s and generation=%s",
                (Jsonb(result), event["resource"], event["generation"]),
            )

    safe_stage("analysis", run, event)


def persist(event, row):
    from .analysis import embed

    if row["status"] == "COMPLETED":
        return
    findings = row["analysis"]["issues"]
    vectors = [embed(f["title"] + ": " + f["description"]) for f in findings]
    model = os.environ.get("EMBEDDING_MODEL", "nomic-embed-text:latest")
    with database(event["tenant"]) as conn:
        # Serialize clustering for one tenant to avoid duplicate clusters under concurrent workers.
        conn.execute("select pg_advisory_xact_lock(hashtextextended(%s,0))", (event["tenant"],))
        current = conn.execute(
            "select status,generation from calls where id=%s for update", (event["resource"],)
        ).fetchone()
        if current["status"] == "COMPLETED" or current["generation"] != event["generation"]:
            return
        for finding, vector in zip(findings, vectors):
            nearest = conn.execute(
                "select id,centroid <=> %s::vector as distance from issues where model=%s order by centroid <=> %s::vector limit 1",
                (str(vector), model, str(vector)),
            ).fetchone()
            new_issue = not nearest or not should_merge(nearest["distance"])
            issue_id = uuid4() if new_issue else nearest["id"]
            if new_issue:
                issue = dict(
                    id=str(issue_id),
                    title=finding["title"],
                    category=finding["category"],
                    priority=finding["priority"],
                    description=finding["description"],
                    hypothesis="Cause requires investigation of the cited evidence.",
                    owner="Unassigned",
                )
                conn.execute(
                    "insert into issues(id,tenant_id,data,centroid,model) values (%s,%s,%s,%s::vector,%s)",
                    (issue_id, event["tenant"], Jsonb(issue), str(vector), model),
                )
            prior = conn.execute(
                "select evidence from call_issues where call_id=%s and issue_id=%s",
                (event["resource"], issue_id),
            ).fetchone()
            indices = sorted(set(finding["evidence"] + (prior["evidence"]["indices"] if prior else [])))
            conn.execute(
                "insert into call_issues(tenant_id,call_id,issue_id,mentions,evidence) values (%s,%s,%s,%s,%s) on conflict(tenant_id,call_id,issue_id) do update set mentions=excluded.mentions,evidence=excluded.evidence",
                (event["tenant"], event["resource"], issue_id, len(indices), Jsonb({"indices": indices})),
            )
            if new_issue:
                recommendation_id = uuid4()
                recommendation = dict(
                    id=str(recommendation_id),
                    issueId=str(issue_id),
                    title=f"Investigate {finding['title']}",
                    description=finding["description"],
                    proposedAction=finding["proposedAction"],
                    expectedOutcome=finding["expectedOutcome"],
                    priority=finding["priority"],
                    effort="Requires review",
                    evidenceCallId=event["resource"],
                    evidenceSegments=indices,
                    model=row["analysis"]["model"],
                    promptVersion=row["analysis"]["promptVersion"],
                    profileVersion=row["analysis"].get("profileVersion", 0),
                    providerId=row["analysis"].get("providerId", "local"),
                )
                conn.execute(
                    "insert into recommendations(id,tenant_id,issue_id,data) values (%s,%s,%s,%s)",
                    (recommendation_id, event["tenant"], issue_id, Jsonb(recommendation)),
                )
                conn.execute(
                    "insert into notifications(id,tenant_id,title,resource) values (%s,%s,%s,%s)",
                    (uuid4(), event["tenant"], "New evidence-backed recommendation", str(recommendation_id)),
                )
        conn.execute(
            "update calls set status='COMPLETED',stage='complete',error_code=null,updated_at=now() where id=%s",
            (event["resource"],),
        )
        conn.execute(
            "insert into audit(tenant_id,actor,action,resource) values (%s,'local-worker','call.completed',%s)",
            (event["tenant"], event["resource"]),
        )


@activity.defn
def cluster_call(event):
    safe_stage("clustering", persist, event)


@activity.defn
def fail_call(event):
    with database(event["tenant"]) as conn:
        conn.execute(
            "update calls set status='FAILED',error_code=upper(stage)||'_FAILED',updated_at=now() where id=%s and generation=%s and status<>'COMPLETED'",
            (event["resource"], event["generation"]),
        )
        conn.execute(
            "insert into notifications(id,tenant_id,title,resource) values (%s,%s,'Call processing failed. Retry is available.',%s) on conflict(id) do nothing",
            (uuid5(UUID(event["id"]), "failure"), event["tenant"], event["resource"]),
        )


@activity.defn
def deliver_event(event):
    from .integrations import deliver

    try:
        deliver(event)
    except Exception:
        raise ApplicationError("INTEGRATION_DELIVERY_FAILED", type="INTEGRATION_DELIVERY_FAILED") from None


@activity.defn
def fail_delivery(event):
    with database(event["tenant"]) as conn:
        conn.execute(
            "update deliveries set status='FAILED',updated_at=now() where event_id=%s and status='RETRYING'",
            (event["id"],),
        )
