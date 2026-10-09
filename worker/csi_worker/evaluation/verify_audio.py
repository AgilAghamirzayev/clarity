"""Read-only verification of the recordings retained by a benchmark run."""

import argparse
import json
from pathlib import Path

from .audio import acceptance_checks, owner, timings
from .runtime import ROOT, digest, write_report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--report", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--cases", type=Path, default=ROOT / "evaluation/cases/recordings.json")
    args = parser.parse_args()
    if args.output.exists():
        parser.error("Use a new output path")
    report = json.loads(args.report.read_text())
    if not report["tenant"].startswith("evaluation-"):
        parser.error("Only isolated evaluation tenants are supported")
    cases = {c["id"]: c for c in json.loads(args.cases.read_text())}
    checks = []
    with owner() as conn:
        tenant = conn.execute("select id from tenants where slug=%s", (report["tenant"],)).fetchone()["id"]
        for result in report["results"]:
            row = conn.execute(
                "select status,transcript,analysis from calls where tenant_id=%s and id=%s",
                (tenant, result["callId"]),
            ).fetchone()
            measurement = timings(tenant, result["callId"])
            checks.append(
                dict(
                    id=result["id"],
                    callId=result["callId"],
                    checks=acceptance_checks(cases[result["id"]], row, measurement),
                    linkedRecommendations=measurement["recommendations"],
                )
            )
        boundaries = conn.execute(
            "select (select count(*) from decisions where tenant_id=%s) as decisions, (select count(*) from deliveries where tenant_id=%s) as deliveries",
            (tenant, tenant),
        ).fetchone()
    write_report(
        args.output,
        dict(
            sourceReportSHA256=digest(args.report),
            status="passed"
            if all(all(r["checks"].values()) for r in checks)
            and boundaries == {"decisions": 0, "deliveries": 0}
            else "failed",
            results=checks,
            approvalBoundaries=boundaries,
        ),
    )


if __name__ == "__main__":
    main()
