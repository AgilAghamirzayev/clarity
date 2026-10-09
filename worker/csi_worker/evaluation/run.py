"""Opt-in text model evaluation with explicit synthetic labels and retained failures."""

import argparse
import json
import time
from pathlib import Path
from unittest.mock import patch

import httpx

from csi_worker import agent_profile
from csi_worker.analysis import analyze
from csi_worker.privacy import detect_spans, mask_segments

from .metrics import aggregate, privacy_counts, ratio, score_case
from .runtime import ROOT, digest, manifest, resources, write_report
from .validate import validate_transcripts


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--split", choices=["development", "heldout"], default="development")
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--cases", type=Path, default=ROOT / "evaluation/cases/transcripts.json")
    parser.add_argument("--execute-models", action="store_true", required=True)
    args = parser.parse_args()
    if args.output.exists():
        parser.error("Use a new output path to preserve prior results")
    cases = json.loads(args.cases.read_text())
    validate_transcripts(cases)
    selected = [c for c in cases if c["split"] == args.split]
    if not selected:
        parser.error("No cases in the selected split")
    report = dict(
        kind="text-only",
        corpusSHA256=digest(args.cases),
        split=args.split,
        synthetic=all(c.get("synthetic") is True for c in selected),
        provenance=manifest(),
        results=[],
        semanticStatus="Deterministic label/regex checks only. Human semantic adjudication pending. No model judge.",
        excludes=[
            "audio decoding",
            "ASR",
            "diarization",
            "queue",
            "Temporal retries",
            "database grouping",
            "post-analysis output redaction",
        ],
    )
    began = time.perf_counter()
    try:
        analyze([{"text": "Thank you. Everything works well.", "speaker": "Unknown speaker"}])
        report["warmup"] = {
            "status": "passed",
            "seconds": time.perf_counter() - began,
            "coldStart": False,
            "note": "Warm-up request excluded from case latency; models may already be resident.",
        }
    except Exception as exc:
        report["warmup"] = {
            "status": "unavailable",
            "errorType": type(exc).__name__,
            "seconds": time.perf_counter() - began,
        }
    real_complete = agent_profile.complete
    for case in selected:
        start = time.perf_counter()
        raw = []
        result = dict(
            id=case["id"],
            expectedIssueCount=len(case["expectedIssues"]),
            expectedIssueIds=[e["id"] for e in case["expectedIssues"]],
            status="failed",
            retries=0,
            phase="input-masking",
        )

        def capture(*a, **kw):
            value = real_complete(*a, **kw)
            raw.append(value[0])
            return value

        try:
            text = "\n".join(s["text"] for s in case["segments"])
            spans = detect_spans(text)
            result["privacy"] = privacy_counts(text, case["sensitiveSpans"], spans)
            segments = mask_segments(case["segments"], spans)
            result["maskedSegments"] = segments
            result["phase"] = "analysis"
            with patch.object(agent_profile, "complete", capture):
                output = analyze(segments)
            result.update(
                status="passed",
                phase="complete",
                structuralValidation="passed",
                output=output,
                score=score_case(case, output),
            )
        except (httpx.ConnectError, httpx.TimeoutException, FileNotFoundError) as exc:
            result.update(
                status="unavailable", errorType=type(exc).__name__, structuralValidation="not-completed"
            )
        except httpx.HTTPStatusError as exc:
            result.update(
                status="unavailable" if exc.response.status_code in {404, 503} else "failed",
                errorType=type(exc).__name__,
                httpStatus=exc.response.status_code,
                structuralValidation="not-completed",
            )
        except Exception as exc:
            result.update(
                errorType=type(exc).__name__,
                structuralValidation="failed" if raw else "not-completed",
                failureCode=str(exc)
                if str(exc)
                in {
                    "AGENT_ONLY_EVIDENCE",
                    "INVALID_EVIDENCE_REFERENCE",
                    "EVIDENCE_OUTSIDE_CHUNK",
                    "NO_SPEECH_DETECTED",
                }
                else "See retained model output",
            )
        result.update(seconds=time.perf_counter() - start, rawModelOutputs=raw, resources=resources())
        report["results"].append(result)
        report["metrics"] = aggregate(report["results"])
        privacy = {
            key: sum(r.get("privacy", {}).get(key, 0) for r in report["results"])
            for key in [
                "sensitiveCharacters",
                "missedCharacters",
                "nonSensitiveCharacters",
                "excessiveCharacters",
                "sensitiveSpans",
                "missedSpans",
            ]
        }
        report["privacy"] = {
            **privacy,
            "casesScored": sum("privacy" in r for r in report["results"]),
            "missedCharacterRate": ratio(privacy["missedCharacters"], privacy["sensitiveCharacters"]),
            "excessiveCharacterRate": ratio(
                privacy["excessiveCharacters"], privacy["nonSensitiveCharacters"]
            ),
        }
        write_report(args.output, report)
        print(case["id"], result["status"], round(result["seconds"], 2), flush=True)
    report["completed"] = True
    write_report(args.output, report)
    if report["metrics"]["failed"] or report["metrics"]["unavailable"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
