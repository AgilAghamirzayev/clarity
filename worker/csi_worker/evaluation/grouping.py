"""Evaluate the same fixed first-exemplar grouping rule used by production."""

import argparse
import json
import math
import random
import time
from pathlib import Path

from csi_worker.analysis import embed
from csi_worker.grouping import DISTANCE_THRESHOLD, POLICY_VERSION, should_merge

from .metrics import grouping_counts
from .runtime import ROOT, manifest, write_report


def cosine_distance(a, b):
    return 1 - sum(x * y for x, y in zip(a, b, strict=True)) / math.sqrt(
        sum(x * x for x in a) * sum(y * y for y in b)
    )


def assign(vectors, order, threshold):
    exemplars = []
    assignments = [None] * len(vectors)
    for i in order:
        distances = [cosine_distance(vectors[i], vectors[e]) for e in exemplars]
        nearest = min(range(len(distances)), key=distances.__getitem__) if distances else None
        if nearest is not None and should_merge(distances[nearest], threshold):
            assignments[i] = nearest
        else:
            assignments[i] = len(exemplars)
            exemplars.append(i)
    return assignments


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--split", choices=["development", "heldout"], default="development")
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--execute-models", action="store_true", required=True)
    args = parser.parse_args()
    if args.output.exists():
        parser.error("Use a new output path")
    cases = [
        c
        for c in json.loads((ROOT / "evaluation/cases/grouping.json").read_text())
        if c["split"] == args.split
    ]
    report = dict(
        kind="embedding-grouping",
        split=args.split,
        synthetic=True,
        provenance=manifest(),
        policy=POLICY_VERSION,
        threshold=DISTANCE_THRESHOLD,
        cases=cases,
    )
    start = time.perf_counter()
    try:
        vectors = [embed(c["title"] + ": " + c["description"]) for c in cases]
        labels = [c["group"] for c in cases]
        report["pairDistances"] = [
            dict(
                a=cases[i]["id"],
                b=cases[j]["id"],
                sameLabel=labels[i] == labels[j],
                distance=cosine_distance(vectors[i], vectors[j]),
            )
            for i in range(len(cases))
            for j in range(i)
        ]
        report["orders"] = []
        for seed in range(10):
            order = list(range(len(cases)))
            if seed:
                random.Random(seed).shuffle(order)
            assignments = assign(vectors, order, DISTANCE_THRESHOLD)
            report["orders"].append(
                dict(
                    seed=seed,
                    order=order,
                    assignments=assignments,
                    metrics=grouping_counts(labels, assignments),
                )
            )
        if args.split == "development":
            report["developmentThresholdSweep"] = [
                dict(
                    threshold=t, metrics=grouping_counts(labels, assign(vectors, list(range(len(cases))), t))
                )
                for t in [0.15, 0.18, 0.22, 0.26, 0.30]
            ]
        report["status"] = "passed"
    except Exception as exc:
        report.update(status="unavailable", errorType=type(exc).__name__)
    report["seconds"] = time.perf_counter() - start
    write_report(args.output, report)
    print(report["status"], flush=True)
    if report["status"] != "passed":
        raise SystemExit(1)


if __name__ == "__main__":
    main()
