"""Cheap corpus checks. No models or services are required."""

import json
from pathlib import Path

from .runtime import ROOT


def validate_transcripts(cases):
    ids = set()
    texts = {}
    for case in cases:
        if case["id"] in ids:
            raise ValueError("Duplicate case ID")
        ids.add(case["id"])
        if case["split"] not in {"development", "heldout"}:
            raise ValueError("Unknown split")
        text = "\n".join(s["text"] for s in case["segments"])
        key = " ".join(text.lower().split())
        if key in texts and texts[key] != case["split"]:
            raise ValueError("Text leakage between splits")
        texts[key] = case["split"]
        issue_ids = set()
        for issue in case["expectedIssues"]:
            if issue["id"] in issue_ids or not issue["supportingSegments"]:
                raise ValueError("Invalid issue label")
            issue_ids.add(issue["id"])
            if any(i < 0 or i >= len(case["segments"]) for i in issue["supportingSegments"]):
                raise ValueError("Label references missing segment")
        for span in case["sensitiveSpans"]:
            if not 0 <= span["start"] < span["end"] <= len(text):
                raise ValueError("Invalid sensitive span")
        for segment in case["segments"]:
            if segment["role"] not in {"customer", "agent", "unknown"}:
                raise ValueError("Invalid role")
    return {
        "status": "passed",
        "cases": len(cases),
        "development": sum(c["split"] == "development" for c in cases),
        "heldout": sum(c["split"] == "heldout" for c in cases),
    }


def main():
    print(
        json.dumps(validate_transcripts(json.loads((ROOT / "evaluation/cases/transcripts.json").read_text())))
    )
    audio = json.loads((ROOT / "evaluation/cases/recordings.json").read_text())
    for case in audio:
        if not (ROOT / Path(case["audio"])).is_file():
            raise ValueError("Missing labeled audio file")
        if case["split"] == "heldout" and "already exposed" in case["provenance"]:
            raise ValueError("Reused demo is not held out")
    print(json.dumps({"audioCases": len(audio), "status": "passed"}))


if __name__ == "__main__":
    main()
