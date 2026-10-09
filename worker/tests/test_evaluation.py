from csi_worker.evaluation.metrics import aggregate, grouping_counts, privacy_counts, score_case


def test_semantic_proxy_does_not_confuse_index_validity_with_support():
    case = dict(
        expectedIssues=[
            dict(id="payment", termGroups=[["payment"]], supportingSegments=[0], actionPattern="inspect")
        ],
        forbiddenClaims=["caused by database"],
        sentiment="Negative",
    )
    output = dict(
        summary="Payment failed",
        sentiment="Negative",
        issues=[
            dict(
                title="Payment failure",
                description="caused by database",
                evidence=[1],
                proposedAction="Inspect logs",
                expectedOutcome="Fewer failures",
            )
        ],
    )
    score = score_case(case, output)
    assert score["matched"] == 1
    assert score["unsupported"] == 1
    assert not score["findings"][0]["citationLabelSupported"]
    assert score["findings"][0]["forbiddenPatterns"]


def test_failed_case_remains_in_recall_denominator():
    result = aggregate([dict(status="failed", expectedIssueCount=2)])
    assert result["issueLabelRecall"] == 0
    assert result["issueLabelPrecision"] is None
    assert result["humanReviewedSemanticCorrectness"] is None


def test_duplicate_predictions_do_not_inflate_recall():
    case = dict(
        expectedIssues=[
            dict(id="payment", termGroups=[["payment"]], supportingSegments=[0], actionPattern="inspect")
        ],
        forbiddenClaims=[],
        sentiment=None,
    )
    finding = dict(
        title="Payment",
        description="Payment failed",
        evidence=[0],
        proposedAction="Inspect logs",
        expectedOutcome="Fewer failures",
    )
    result = score_case(case, dict(summary="Failure", sentiment="Negative", issues=[finding, finding]))
    assert result["matched"] == 1 and result["predicted"] == 2 and result["unsupported"] == 1


def test_privacy_metrics_count_misses_and_overmasking_separately():
    assert privacy_counts("abc def", [dict(start=0, end=3)], [(0, 2), (4, 7)]) == dict(
        sensitiveCharacters=3,
        missedCharacters=1,
        nonSensitiveCharacters=4,
        excessiveCharacters=3,
        sensitiveSpans=1,
        missedSpans=1,
    )


def test_grouping_metrics_detect_both_errors():
    counts = grouping_counts(["a", "a", "b"], [0, 1, 1])
    assert counts["falseSplits"] == 1 and counts["falseMerges"] == 1
    assert counts["falseSplitRate"] == 1 and counts["falseMergeRate"] == 0.5


def test_grouping_uses_fixed_first_exemplar_and_strict_boundary():
    from csi_worker.evaluation.grouping import assign
    from csi_worker.grouping import should_merge

    assert should_merge(0.21999)
    assert not should_merge(0.22)
    assert not should_merge(float("nan"))
    assert assign([[1, 0], [0.99, 0.01], [0, 1]], [0, 1, 2], 0.22) == [0, 0, 1]


def test_cost_is_explicit_and_idle_capacity_is_not_free():
    import pytest
    from csi_worker.evaluation.cost import calculate

    # Arithmetic-only fictional inputs, not market prices or benchmark results.
    inputs = dict(
        currency="TEST",
        serverHourlyPrice=2,
        provisionedHoursPerMonth=100,
        targetUtilization=0.5,
        measuredCallsPerHour=10,
        storageGB=5,
        storagePricePerGBMonth=1,
        otherMonthlyCost=5,
    )
    report = calculate(inputs)
    assert report["estimatedMonthlyCost"] == 210
    assert report["estimatedMonthlyCalls"] == 500
    assert report["estimatedCostPerCall"] == 0.42
    with pytest.raises(ValueError):
        calculate({**inputs, "targetUtilization": 0})
    with pytest.raises(ValueError):
        calculate({**inputs, "serverHourlyPrice": None})


def test_audio_word_error_counts_substitution_and_missing_words():
    from csi_worker.evaluation.audio import word_error_rate

    assert word_error_rate("Hello there friend", "hello friend")["rate"] == 1 / 3


def test_committed_corpus_has_valid_labels_and_no_cross_split_duplicates():
    import json

    from csi_worker.evaluation.runtime import ROOT
    from csi_worker.evaluation.validate import validate_transcripts

    cases = json.loads((ROOT / "evaluation/cases/transcripts.json").read_text())
    assert validate_transcripts(cases)["heldout"] == 6


def test_human_metrics_stay_pending_until_complete_signed_reviews():
    from csi_worker.evaluation.review import adjudicate, rows_for

    report = dict(
        results=[
            dict(
                id="a",
                expectedIssueCount=1,
                expectedIssueIds=["payment"],
                output=dict(summary="Payment failed", issues=[dict(title="Payment failed")]),
            )
        ]
    )
    audio_case = {**report["results"][0], "analysis": report["results"][0]["output"]}
    del audio_case["output"]
    assert len(rows_for({"results": [audio_case]}, "hash")) == 2
    rows = rows_for(report, "hash")
    for row in rows:
        row.update(
            reviewer="", notes="", claim_supported="", recommendation_supported="", matched_expected_issue=""
        )
    assert adjudicate(report, "hash", rows)["semanticMetrics"] is None
    for row in rows:
        row.update(
            reviewer="Test reviewer",
            notes="Arithmetic fixture, not a real review.",
            claim_supported="yes",
            recommendation_supported="no",
            matched_expected_issue="payment",
            review_status="reviewed",
        )
    result = adjudicate(report, "hash", rows)["semanticMetrics"]
    assert result["issuePrecision"] == 1 and result["unsupportedRecommendationRate"] == 1


def test_audio_presence_checks_do_not_claim_full_semantic_correctness():
    from csi_worker.evaluation.audio import acceptance_checks

    case = {"expectedIssueIds": ["failure"]}
    record = {
        "status": "COMPLETED",
        "transcript": {"segments": [{"role": "customer", "roleSource": "channel-metadata"}]},
        "analysis": {"issues": [{}]},
    }
    assert acceptance_checks(case, record, {"recommendations": 1})["recordingToRecommendation"]
    assert not acceptance_checks(case, record, {"recommendations": 0})["recordingToRecommendation"]


def test_keyword_baseline_uses_reporter_text_and_not_agent_hypotheticals():
    from csi_worker.evaluation.keyword_baseline import analyze_keywords

    segments = [
        dict(role="customer", text="My payment failed twice"),
        dict(role="agent", text="A file upload could fail, hypothetically"),
    ]
    output = analyze_keywords(segments)
    assert len(output["issues"]) == 1
    assert output["issues"][0]["evidence"] == [0]


def test_cost_per_audio_hour_requires_explicit_workload_duration():
    from csi_worker.evaluation.cost import calculate

    inputs = dict(
        currency="TEST",
        serverHourlyPrice=2,
        provisionedHoursPerMonth=100,
        targetUtilization=0.5,
        measuredCallsPerHour=10,
        storageGB=5,
        storagePricePerGBMonth=1,
        otherMonthlyCost=5,
    )
    assert calculate(inputs)["estimatedCostPerAudioHour"] is None
    result = calculate({**inputs, "meanAudioSecondsPerCall": 360})
    assert result["estimatedMonthlyAudioHours"] == 50
    assert result["estimatedCostPerAudioHour"] == 4.2
