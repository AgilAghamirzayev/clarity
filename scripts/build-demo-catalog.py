"""Generate fictional support audio on macOS and process it through the real local pipeline.

Run once during development. The exported catalog ships with the API on every platform.
No credentials, private recordings or customer data are included in the export.
"""

import hashlib
import json
import os
import subprocess
import tempfile
import time
from datetime import UTC, datetime, timedelta
from pathlib import Path
from uuid import uuid4

import av
import numpy as np
import psycopg
import soundfile as sf
from csi_worker.storage import bucket, objects
from csi_worker.support_summary import generate_report
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "server/src/main/resources/demo"
SCENARIOS = json.loads((ROOT / "demo/scenarios.json").read_text())
VERSION = "support-catalog-v1"


def audio(scenario):
    target = DEST / "audio" / (scenario["key"] + ".wav")
    if target.exists():
        return target
    parts = []
    with tempfile.TemporaryDirectory() as temporary:
        for index, (speaker, text) in enumerate(scenario["dialogue"]):
            path = Path(temporary) / f"{index}.aiff"
            subprocess.run(
                [
                    "say",
                    "-v",
                    "Samantha" if speaker == "Customer" else "Daniel",
                    "-r",
                    "175",
                    "-o",
                    str(path),
                    text,
                ],
                check=True,
            )
            with av.open(str(path)) as source:
                resampler = av.AudioResampler(format="fltp", layout="mono", rate=16000)
                frames = [
                    f.to_ndarray().ravel()
                    for frame in source.decode(audio=0)
                    for f in resampler.resample(frame)
                ]
                frames.extend(f.to_ndarray().ravel() for f in resampler.resample(None))
            mono = np.concatenate(frames)
            stereo = np.zeros((len(mono), 2), dtype=np.float32)
            stereo[:, 0 if speaker == "Customer" else 1] = mono
            parts.extend([stereo, np.zeros((4000, 2), dtype=np.float32)])
    sf.write(str(target), np.concatenate(parts), 16000, subtype="PCM_16")
    return target


def main():
    DEST.mkdir(parents=True, exist_ok=True)
    (DEST / "audio").mkdir(exist_ok=True)
    anchor = datetime.now(UTC)
    with psycopg.connect(
        os.environ.get("OWNER_DATABASE_URL", "postgresql://csi_owner@localhost:5546/csi"),
        password=os.environ["DB_OWNER_PASSWORD"],
        row_factory=dict_row,
    ) as conn:
        conn.execute(
            "insert into tenants(id,slug) values(%s,%s) on conflict(slug) do nothing", (uuid4(), VERSION)
        )
        tenant = conn.execute("select id from tenants where slug=%s", (VERSION,)).fetchone()["id"]
        conn.commit()
        for scenario in SCENARIOS:
            path = audio(scenario)
            if conn.execute(
                "select id from calls where tenant_id=%s and import_key=%s", (tenant, scenario["key"])
            ).fetchone():
                continue
            call = uuid4()
            key = f"{tenant}/{call}/audio"
            objects().upload_file(str(path), bucket(), key, ExtraArgs={"ContentType": "audio/wav"})
            recorded = anchor - timedelta(days=scenario["daysAgo"], hours=1)
            metadata = dict(
                title=scenario["title"],
                sample=True,
                demoSeedVersion=VERSION,
                customer=scenario["customer"],
                agent=scenario["agent"],
                department=scenario["department"],
                date=recorded.isoformat(),
                language="en",
                speakers=2,
                customerChannel=0,
            )
            conn.execute(
                "insert into calls(id,tenant_id,import_key,audio_key,sha256,content_type,metadata,created_at) values(%s,%s,%s,%s,%s,'audio/wav',%s,%s)",
                (
                    call,
                    tenant,
                    scenario["key"],
                    key,
                    hashlib.sha256(path.read_bytes()).hexdigest(),
                    Jsonb(metadata),
                    recorded,
                ),
            )
            conn.execute(
                "insert into outbox(id,tenant_id,type,resource_id) values(%s,%s,'call.imported',%s)",
                (uuid4(), tenant, call),
            )
            conn.commit()
            print(f"Queued: {scenario['title']}", flush=True)
        deadline = time.monotonic() + 1800
        while time.monotonic() < deadline:
            rows = conn.execute(
                "select status,count(*) as count from calls where tenant_id=%s group by status", (tenant,)
            ).fetchall()
            conn.commit()
            print({r["status"]: r["count"] for r in rows}, flush=True)
            if any(r["status"] == "FAILED" for r in rows):
                raise RuntimeError("Catalog processing failed. Inspect the worker before exporting.")
            if len(rows) == 1 and rows[0]["status"] == "COMPLETED" and rows[0]["count"] == len(SCENARIOS):
                break
            time.sleep(10)
        else:
            raise RuntimeError("Catalog processing timed out")
        export(conn, tenant)


def export(conn, tenant):
    calls = conn.execute(
        "select * from calls where tenant_id=%s order by created_at desc", (tenant,)
    ).fetchall()
    for call in calls:
        scenario = next(s for s in SCENARIOS if s["key"] == call["import_key"])
        call["audioResource"] = "demo/audio/" + scenario["key"] + ".wav"
        call["daysAgo"] = scenario["daysAgo"]
        call.pop("audio_key")
        call.pop("tenant_id")
    data = {
        "version": VERSION,
        "provenance": "Fictional support scenarios, generated voices, real local transcription and AI analysis.",
        "calls": calls,
    }
    for table in ["issues", "call_issues", "recommendations"]:
        data[table] = conn.execute(f"select * from {table} where tenant_id=%s", (tenant,)).fetchall()
        for row in data[table]:
            row.pop("tenant_id")
    data["summaries"] = []
    for days in [7, 30, 90]:
        current = [call for call in calls if call["daysAgo"] < days]
        previous = [call for call in calls if days <= call["daysAgo"] < 2 * days]
        evidence = [
            dict(
                id=str(c["id"]),
                reference=f"CALL-{c['display_number']}",
                title=c["metadata"]["title"],
                summary=c["analysis"]["summary"],
                sentiment=c["analysis"]["sentiment"],
                sample=True,
            )
            for c in current
        ]
        snapshot = dict(
            days=days,
            current=metrics(current, data["call_issues"]),
            previous=metrics(previous, data["call_issues"]),
            evidence=evidence,
        )
        data["summaries"].append(dict(days=days, report=generate_report(snapshot)))
        print(f"Generated real {days}-day support summary.", flush=True)
    apply_labels(data)
    (DEST / "catalog.json").write_text(json.dumps(data, default=str, indent=2) + "\n")
    print(f"Exported {len(calls)} real processed recordings.", flush=True)


def apply_labels(data):
    corrections = json.loads((ROOT / "demo/corrections.json").read_text())

    def correct(value):
        if isinstance(value, str):
            for before, after in corrections.items():
                value = value.replace(before, after)
            return value
        if isinstance(value, list):
            return [correct(item) for item in value]
        if isinstance(value, dict):
            return {key: correct(item) for key, item in value.items()}
        return value

    for key, value in list(data.items()):
        data[key] = correct(value)
    labels = {row["modelTitle"]: row for row in json.loads((ROOT / "demo/labels.json").read_text())}
    by_issue = {}
    for issue in data["issues"]:
        label = labels.get(issue["data"]["title"])
        if label:
            issue["data"]["title"] = label["title"]
            by_issue[str(issue["id"])] = label
    for recommendation in data["recommendations"]:
        label = by_issue.get(str(recommendation["issue_id"]))
        if label:
            recommendation["data"]["title"] = label["recommendationTitle"]
    data["editorialNotes"] = (
        "Titles shortened for readability; verified over-redaction of generic words corrected in this fictional catalog. Model findings otherwise retained."
    )


def metrics(calls, links):
    customers = [c["metadata"]["customer"] for c in calls]
    return dict(
        calls=len(calls),
        customers=len(set(customers)),
        positive=sum(c["analysis"]["sentiment"] == "Positive" for c in calls),
        neutral=sum(c["analysis"]["sentiment"] == "Neutral" for c in calls),
        negative=sum(c["analysis"]["sentiment"] == "Negative" for c in calls),
        issueCalls=sum(any(str(link["call_id"]) == str(c["id"]) for link in links) for c in calls),
        repeatCustomers=sum(customers.count(customer) > 1 for customer in set(customers)),
    )


if __name__ == "__main__":
    main()
