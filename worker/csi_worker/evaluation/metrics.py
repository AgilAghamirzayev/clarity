"""Deterministic label checks, not an LLM judge or proof of semantic truth."""

import re


def ratio(numerator, denominator):
    return numerator / denominator if denominator else None


def privacy_counts(text, expected, detected):
    truth = {i for s in expected for i in range(s["start"], s["end"])}
    masked = {i for start, end in detected for i in range(start, end)}
    if any(i < 0 or i >= len(text) for i in truth | masked):
        raise ValueError("Privacy span outside text")
    return dict(
        sensitiveCharacters=len(truth),
        missedCharacters=len(truth - masked),
        nonSensitiveCharacters=len(text) - len(truth),
        excessiveCharacters=len(masked - truth),
        sensitiveSpans=len(expected),
        missedSpans=sum(not set(range(s["start"], s["end"])) <= masked for s in expected),
    )


def score_case(case, output):
    expected = case["expectedIssues"]
    predictions = output["issues"]
    matched = set()
    details = []
    for finding in predictions:
        text = finding["title"] + " " + finding["description"]
        candidates = [
            e
            for e in expected
            if all(any(re.search(p, text, re.I) for p in group) for group in e["termGroups"])
        ]
        target = next((e for e in candidates if e["id"] not in matched), None)
        if target:
            matched.add(target["id"])
        support = (
            bool(target)
            and bool(finding["evidence"])
            and set(finding["evidence"]) <= set(target["supportingSegments"])
        )
        forbidden = [
            p
            for p in case["forbiddenClaims"]
            if re.search(
                p,
                " ".join(
                    str(finding[k]) for k in ["title", "description", "proposedAction", "expectedOutcome"]
                ),
                re.I,
            )
        ]
        action = bool(target) and bool(re.search(target["actionPattern"], finding["proposedAction"], re.I))
        details.append(
            dict(
                expectedIssue=target["id"] if target else None,
                citationLabelSupported=support,
                actionPatternMatched=action,
                forbiddenPatterns=forbidden,
                rubricUnsupported=not (support and action and not forbidden),
            )
        )
    summary_violations = [p for p in case["forbiddenClaims"] if re.search(p, output["summary"], re.I)]
    return dict(
        expected=len(expected),
        predicted=len(predictions),
        matched=len(matched),
        unsupported=sum(d["rubricUnsupported"] for d in details),
        findings=details,
        missingIssueIds=[e["id"] for e in expected if e["id"] not in matched],
        summaryForbiddenPatterns=summary_violations,
        sentimentMatch=None if case["sentiment"] is None else case["sentiment"] == output["sentiment"],
    )


def aggregate(results):
    scores = [r["score"] for r in results if r.get("score")]
    expected = sum(r["expectedIssueCount"] for r in results)
    matched = sum(s["matched"] for s in scores)
    predicted = sum(s["predicted"] for s in scores)
    return dict(
        cases=len(results),
        succeeded=sum(r["status"] == "passed" for r in results),
        failed=sum(r["status"] == "failed" for r in results),
        unavailable=sum(r["status"] == "unavailable" for r in results),
        expectedIssues=expected,
        predictedIssues=predicted,
        matchedIssues=matched,
        issueLabelPrecision=ratio(matched, predicted),
        issueLabelRecall=ratio(matched, expected),
        rubricUnsupportedRecommendations=sum(s["unsupported"] for s in scores),
        rubricUnsupportedRecommendationRate=ratio(sum(s["unsupported"] for s in scores), predicted),
        humanReviewedSemanticCorrectness=None,
    )


def grouping_counts(labels, assignments):
    counts = dict(samePairs=0, differentPairs=0, falseSplits=0, falseMerges=0)
    for i in range(len(labels)):
        for j in range(i):
            same = labels[i] == labels[j]
            together = assignments[i] == assignments[j]
            counts["samePairs" if same else "differentPairs"] += 1
            counts["falseSplits"] += int(same and not together)
            counts["falseMerges"] += int(not same and together)
    return {
        **counts,
        "falseSplitRate": ratio(counts["falseSplits"], counts["samePairs"]),
        "falseMergeRate": ratio(counts["falseMerges"], counts["differentPairs"]),
    }
