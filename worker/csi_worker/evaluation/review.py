"""Export unfilled human-review sheets and score only explicitly completed reviews."""

import argparse
import csv
import json
from pathlib import Path

from .metrics import ratio
from .runtime import digest, write_report

FIELDS = [
    "report_sha256",
    "case_id",
    "kind",
    "finding_index",
    "text",
    "expected_issue_ids",
    "matched_expected_issue",
    "claim_supported",
    "recommendation_supported",
    "reviewer",
    "review_status",
    "notes",
]


def rows_for(report, sha):
    rows = []
    for case in report["results"]:
        output = case.get("output") or case.get("analysis")
        if not output:
            continue
        rows.append(
            dict(
                report_sha256=sha,
                case_id=case["id"],
                kind="summary",
                finding_index="",
                text=output["summary"],
                review_status="pending",
            )
        )
        for index, finding in enumerate(output["issues"]):
            rows.append(
                dict(
                    report_sha256=sha,
                    case_id=case["id"],
                    kind="finding",
                    finding_index=str(index),
                    text=json.dumps(finding),
                    review_status="pending",
                )
            )
    return rows


def adjudicate(report, sha, rows):
    required = {(r["case_id"], r["kind"], r["finding_index"]) for r in rows_for(report, sha)}
    seen = set()
    for row in rows:
        key = (row["case_id"], row["kind"], row["finding_index"])
        if key in seen or key not in required or row["report_sha256"] != sha:
            raise ValueError("Duplicate, unknown or stale review row")
        seen.add(key)
    complete = (
        len(rows) == len(required)
        and bool(required)
        and all(
            r["review_status"] == "reviewed"
            and r["reviewer"].strip()
            and r["notes"].strip()
            and r["claim_supported"] in {"yes", "no"}
            and (r["kind"] == "summary" or r["recommendation_supported"] in {"yes", "no"})
            for r in rows
        )
    )
    if not complete:
        return dict(
            status="pending", requiredRows=len(required), providedRows=len(rows), semanticMetrics=None
        )
    cases = {c["id"]: c for c in report["results"]}
    matched = set()
    findings = [r for r in rows if r["kind"] == "finding"]
    true_positive = 0
    for row in findings:
        expected = row["matched_expected_issue"].strip()
        allowed = cases[row["case_id"]]["expectedIssueIds"]
        if expected and expected not in allowed:
            raise ValueError("Matched issue must use a corpus label")
        key = (row["case_id"], expected)
        if expected and row["claim_supported"] == "yes" and key not in matched:
            matched.add(key)
            true_positive += 1
    expected = sum(c["expectedIssueCount"] for c in report["results"])
    return dict(
        status="reviewed",
        reviewers=sorted({r["reviewer"] for r in rows}),
        semanticMetrics=dict(
            issuePrecision=ratio(true_positive, len(findings)),
            issueRecall=ratio(true_positive, expected),
            unsupportedRecommendationRate=ratio(
                sum(r["recommendation_supported"] == "no" for r in findings), len(findings)
            ),
            unsupportedSummaries=sum(r["kind"] == "summary" and r["claim_supported"] == "no" for r in rows),
        ),
        note="Human-entered judgments, not automatic ground truth. Retain reviewer notes and resolve disagreements before claims.",
    )


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("mode", choices=["template", "score"])
    parser.add_argument("--report", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--reviews", type=Path)
    args = parser.parse_args()
    if args.output.exists():
        parser.error("Use a new output path")
    report = json.loads(args.report.read_text())
    sha = digest(args.report)
    if args.mode == "template":
        cases = {c["id"]: c for c in report["results"]}
        rows = rows_for(report, sha)
        for row in rows:
            row["expected_issue_ids"] = ";".join(cases[row["case_id"]].get("expectedIssueIds", []))
        with args.output.open("w", newline="") as file:
            writer = csv.DictWriter(file, fieldnames=FIELDS)
            writer.writeheader()
            writer.writerows(rows)
    else:
        if not args.reviews:
            parser.error("--reviews is required for scoring")
        with args.reviews.open(newline="") as file:
            rows = list(csv.DictReader(file))
        write_report(args.output, adjudicate(report, sha, rows))


if __name__ == "__main__":
    main()
