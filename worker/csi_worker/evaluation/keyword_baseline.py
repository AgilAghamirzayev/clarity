"""Frozen, non-model transcript keyword baseline. Synthetic inputs only."""

import argparse
import json
import re
import time
from pathlib import Path

from .metrics import aggregate, score_case
from .runtime import digest, write_report
from .validate import validate_transcripts

RULES = {
    "Payments": r"\b(pay(?:ment|ing)?|checkout|charg(?:e|ed))\b",
    "Access": r"\b(login|log in|sign in|password|access)\b",
    "Uploads": r"\b(upload|file|document)\b",
    "Refunds": r"\b(refund|reimbursement)\b",
}
FRICTION = r"\b(fail\w*|declin\w*|cannot|can't|unable|error|missing|unclear|stuck|wrong|twice|wait\w*)\b"


def analyze_keywords(segments):
    issues = []
    for category, pattern in RULES.items():
        evidence = [
            i
            for i, s in enumerate(segments)
            if s.get("role") != "agent"
            and re.search(pattern, s["text"], re.I)
            and re.search(FRICTION, s["text"], re.I)
        ]
        if evidence:
            issues.append(
                dict(
                    title=f"{category} problem",
                    category=category,
                    priority="Medium",
                    description=" ".join(segments[i]["text"] for i in evidence),
                    evidence=evidence,
                    proposedAction=f"Review the reported {category.lower()} problem",
                    expectedOutcome="Resolve the reported problem; verify with the reporter",
                )
            )
    return dict(
        summary="Keyword matches require human interpretation.",
        topic="Keyword baseline",
        sentiment="Negative" if issues else "Neutral",
        issues=issues,
    )


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cases", type=Path, required=True)
    parser.add_argument("--split", choices=["development", "heldout"], default="heldout")
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    if args.output.exists():
        parser.error("Use a new output path")
    cases = json.loads(args.cases.read_text())
    validate_transcripts(cases)
    selected = [c for c in cases if c["split"] == args.split]
    if not selected or not all(c.get("synthetic") is True for c in selected):
        parser.error("Provide nonempty synthetic cases")
    results = []
    for case in selected:
        began = time.perf_counter()
        output = analyze_keywords(case["segments"])
        results.append(
            dict(
                id=case["id"],
                status="passed",
                expectedIssueCount=len(case["expectedIssues"]),
                expectedIssueIds=[e["id"] for e in case["expectedIssues"]],
                output=output,
                score=score_case(case, output),
                seconds=time.perf_counter() - began,
            )
        )
    write_report(
        args.output,
        dict(
            kind="keyword-baseline-v1",
            split=args.split,
            synthetic=True,
            corpusSHA256=digest(args.cases),
            sourceSHA256=digest(Path(__file__)),
            results=results,
            metrics=aggregate(results),
            limitation="Rules receive only the transcript and roles, never expected labels. Reference transcripts, no ASR, no PII masking, no human timing. Lexical proxy scores do not establish semantic quality or user benefit.",
        ),
    )


if __name__ == "__main__":
    main()
