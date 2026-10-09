"""Fresh local API ingestion benchmark. Uses an isolated QA tenant, never approves actions."""

import argparse
import json
import os
import re
import time
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

import httpx
import psycopg
from psycopg.rows import dict_row

from .runtime import ROOT, digest, manifest, resources, write_report


def owner():
    return psycopg.connect(
        os.environ.get("OWNER_DATABASE_URL", "postgresql://csi_owner@localhost:5546/csi"),
        password=os.environ["DB_OWNER_PASSWORD"],
        row_factory=dict_row,
    )


def word_error_rate(reference, hypothesis):
    ref = re.findall(r"\w+", reference.lower())
    hyp = re.findall(r"\w+", hypothesis.lower())
    previous = list(range(len(hyp) + 1))
    for i, a in enumerate(ref, 1):
        current = [i]
        for j, b in enumerate(hyp, 1):
            current.append(min(current[-1] + 1, previous[j] + 1, previous[j - 1] + int(a != b)))
        previous = current
    return dict(referenceWords=len(ref), edits=previous[-1], rate=previous[-1] / len(ref) if ref else None)


def timings(tenant, call):
    with owner() as conn:
        rows = conn.execute(
            "select stage,attempt,started_at,finished_at,elapsed_ms,status,error_code from call_stage_attempts where tenant_id=%s and call_id=%s order by started_at",
            (tenant, call),
        ).fetchall()
        record = conn.execute(
            "select created_at,updated_at,status from calls where tenant_id=%s and id=%s", (tenant, call)
        ).fetchone()
        recs = conn.execute(
            "select count(distinct r.id) as n from recommendations r join call_issues c on r.tenant_id=c.tenant_id and r.issue_id=c.issue_id where c.tenant_id=%s and c.call_id=%s",
            (tenant, str(call)),
        ).fetchone()["n"]
    attempts = {}
    for row in rows:
        attempts[row["stage"]] = max(attempts.get(row["stage"], 0), row["attempt"])
    first = min((r["started_at"] for r in rows), default=None)
    return dict(
        queueSeconds=(first - record["created_at"]).total_seconds() if first else None,
        measuredStageSeconds=sum((r["elapsed_ms"] or 0) / 1000 for r in rows),
        retries=sum(v - 1 for v in attempts.values()),
        failedAttempts=sum(r["status"] == "FAILED" for r in rows),
        stages=[
            {
                **r,
                "started_at": r["started_at"].isoformat(),
                "finished_at": r["finished_at"].isoformat() if r["finished_at"] else None,
            }
            for r in rows
        ],
        recommendations=recs,
    )


def acceptance_checks(case, record, measurement):
    completed = record["status"] == "COMPLETED"
    return dict(
        completed=completed,
        recordingToRecommendation=completed
        and (
            measurement["recommendations"] > 0
            if case.get("expectedIssueIds")
            else not (record.get("analysis") or {}).get("issues", [])
        ),
        speakerMetadataPreserved=bool(record.get("transcript"))
        and all("role" in s and "roleSource" in s for s in record["transcript"]["segments"]),
    )


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--cases", type=Path, default=ROOT / "evaluation/cases/recordings.json")
    parser.add_argument("--repetitions", type=int, default=1)
    parser.add_argument("--timeout", type=int, default=600)
    parser.add_argument("--execute-local", action="store_true", required=True)
    args = parser.parse_args()
    if args.output.exists():
        parser.error("Use a new output path")
    if not 1 <= args.repetitions <= 20:
        parser.error("Repetitions must be 1..20")
    cases = json.loads(args.cases.read_text())
    tenant, user = uuid4(), uuid4()
    slug = "evaluation-" + str(tenant)
    report = dict(
        kind="full-audio-api",
        corpusSHA256=digest(args.cases),
        synthetic=all(c.get("synthetic") is True for c in cases),
        splits=sorted({c["split"] for c in cases}),
        provenance=manifest(),
        results=[],
        tenant=slug,
        execution="Sequential ingestion; max_concurrent_activities=1 in standard worker. No external messaging or review action.",
        audioHashes={c["audio"]: digest(ROOT / c["audio"]) for c in cases},
        semanticMetrics=None,
        limitation="Audio labels require ASR segment alignment and human adjudication. Word error compares masked transcript to reference, not raw ASR. Text-only metrics must not be substituted.",
    )
    report["speechModels"] = {}
    for key in ["WHISPER_MODEL", "SPEAKER_MODEL"]:
        path = Path(os.environ[key])
        report["speechModels"][key] = {
            "directoryName": path.name,
            "files": {
                str(p.relative_to(path)): {"bytes": p.stat().st_size, "sha256": digest(p)}
                for p in sorted(path.rglob("*"))
                if p.is_file() and ".cache" not in p.parts
            },
        }
    write_report(args.output, report)
    source = None
    with httpx.Client(base_url="http://127.0.0.1:8086/api/v1", timeout=60, trust_env=False) as client:

        def write(method, path, **kw):
            csrf = client.get("/auth/csrf").json()
            return client.request(method, path, headers={csrf["headerName"]: csrf["token"]}, **kw)

        def run(case, repeat):
            started = time.perf_counter()
            metadata = {**case["metadata"], "recordedAt": datetime.now(timezone.utc).isoformat()}
            key = str(uuid4())
            with (ROOT / case["audio"]).open("rb") as file:
                response = httpx.post(
                    "http://127.0.0.1:8086/api/v1/ingestion/recordings",
                    headers={"Authorization": "Bearer " + source["token"], "Idempotency-Key": key},
                    files={
                        "metadata": ("metadata.json", json.dumps(metadata), "application/json"),
                        "audio": ("recording.wav", file, "audio/wav"),
                    },
                    timeout=60,
                    trust_env=False,
                )
            response.raise_for_status()
            call = response.json()["id"]
            accepted = time.perf_counter()
            print(case["id"], "accepted", flush=True)
            record = None
            while time.perf_counter() - started < args.timeout:
                response = client.get("/calls/" + call)
                response.raise_for_status()
                record = response.json()
                if record["status"] in {"COMPLETED", "FAILED"}:
                    break
                time.sleep(1)
            measurement = timings(tenant, call)
            # The final activity records its timing immediately after committing COMPLETED.
            if record["status"] == "COMPLETED" and any(
                r["status"] == "RUNNING" for r in measurement["stages"]
            ):
                time.sleep(1)
                measurement = timings(tenant, call)
            result = dict(
                id=case["id"],
                expectedIssueIds=case["expectedIssueIds"],
                expectedIssueCount=len(case["expectedIssueIds"]),
                repetition=repeat,
                callId=call,
                status=record["status"],
                errorCode=record["error_code"],
                uploadSeconds=accepted - started,
                endToEndSeconds=time.perf_counter() - started,
                timings=measurement,
                acceptanceChecks=acceptance_checks(case, record, measurement),
                transcript=record.get("transcript"),
                analysis=record.get("analysis"),
                profile=record["metadata"].get("analysisProfile"),
                resources=resources(),
            )
            if result["transcript"]:
                result["audioSeconds"] = result["transcript"]["duration"]
                result["maskedTranscriptWordError"] = word_error_rate(
                    case["referenceText"], " ".join(s["text"] for s in result["transcript"]["segments"])
                )
            if record["status"] not in {"COMPLETED", "FAILED"}:
                result["status"] = "TIMEOUT"
            print(case["id"], result["status"], round(result["endToEndSeconds"], 2), flush=True)
            return result

        try:
            with owner() as conn:
                conn.execute("insert into tenants(id,slug) values(%s,%s)", (tenant, slug))
                row = conn.execute(
                    "insert into users(id,tenant_id,email,password_hash,role) select %s,%s,'evaluation@example.test',password_hash,'ADMIN' from users where email=%s and enabled limit 1 returning id",
                    (user, tenant, os.environ["BOOTSTRAP_EMAIL"]),
                ).fetchone()
                if not row:
                    raise RuntimeError("Bootstrap user unavailable")
            response = write(
                "POST",
                "/auth/login",
                json={
                    "tenant": slug,
                    "email": "evaluation@example.test",
                    "password": os.environ["BOOTSTRAP_PASSWORD"],
                },
            )
            response.raise_for_status()
            response = write("POST", "/ingestion/sources", json={"name": "Synthetic evaluation recorder"})
            response.raise_for_status()
            source = response.json()
            warmup = {
                **cases[0],
                "id": "warmup-existing-short-synthetic",
                "audio": "public/samples/support-call.wav",
                "referenceText": "",
                "metadata": {**cases[0]["metadata"], "speakers": 1, "customerChannel": None},
            }
            report["warmup"] = run(warmup, 0)
            report["warmup"]["note"] = (
                "Excluded from throughput and measured cases. Model residency before this run is unknown; this is not a cold-start claim."
            )
            write_report(args.output, report)
            batch = time.perf_counter()
            for repeat in range(args.repetitions):
                for case in cases:
                    report["results"].append(run(case, repeat + 1))
                    write_report(args.output, report)
            elapsed = time.perf_counter() - batch
            completed = [r for r in report["results"] if r["status"] == "COMPLETED"]
            report["metrics"] = dict(
                cases=len(report["results"]),
                completed=len(completed),
                failed=sum(r["status"] == "FAILED" for r in report["results"]),
                timedOut=sum(r["status"] == "TIMEOUT" for r in report["results"]),
                retries=sum(r["timings"]["retries"] for r in report["results"]),
                batchWallSeconds=elapsed,
                observedCallsPerHour=len(completed) / elapsed * 3600,
                successfulAudioSeconds=sum(r.get("audioSeconds", 0) for r in completed),
                note="Observed sequential throughput for this tiny synthetic mix, not a capacity or concurrency guarantee.",
            )
            report["status"] = (
                "passed"
                if len(completed) == len(report["results"])
                and all(all(r["acceptanceChecks"].values()) for r in report["results"])
                else "failed"
            )
        except Exception as exc:
            report.update(status="unavailable", errorType=type(exc).__name__)
            raise
        finally:
            if source:
                try:
                    write("DELETE", "/ingestion/sources/" + source["id"]).raise_for_status()
                except Exception:
                    report["tokenRevocation"] = "failed"
                else:
                    report["tokenRevocation"] = "passed"
            with owner() as conn:
                conn.execute("update ingestion_sources set enabled=false where tenant_id=%s", (tenant,))
                conn.execute("update users set enabled=false where id=%s", (user,))
            report["qaAccountDisabled"] = True
            write_report(args.output, report)
    if report.get("status") != "passed":
        raise SystemExit(1)


if __name__ == "__main__":
    main()
