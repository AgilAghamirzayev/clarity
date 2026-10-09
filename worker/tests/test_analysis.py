import pytest
from csi_worker.analysis import Analysis, validate_evidence


def sample():
    return Analysis.model_validate(
        dict(
            summary="Payment failed",
            topic="Payments",
            sentiment="Negative",
            issues=[
                dict(
                    title="Failed payment",
                    category="Payments",
                    priority="High",
                    description="Payment failed twice",
                    evidence=[0],
                    proposedAction="Inspect decline reason",
                    expectedOutcome="Reduce failures",
                )
            ],
        )
    )


def test_evidence_must_reference_real_segments():
    analysis = sample()
    validate_evidence(analysis, [{"text": "Payment failed"}])
    analysis.issues[0].evidence = [8]
    with pytest.raises(ValueError):
        validate_evidence(analysis, [{"text": "Payment failed"}])


def test_empty_evidence_cannot_create_recommendation():
    value = sample().model_dump()
    value["issues"][0]["evidence"] = []
    with pytest.raises(ValueError):
        Analysis.model_validate(value)


def test_roles_require_provenance_and_unknowns_stay_unknown():
    from csi_worker.analysis import analysis_segments

    result = analysis_segments(
        [
            {"text": "I cannot log in", "speaker": "Speaker 2"},
            {"text": "Maybe a database failure?", "speaker": "Agent"},
            {"text": "Payment failed", "speaker": "Customer", "roleSource": "channel-metadata"},
        ]
    )
    assert [s["role"] for s in result] == ["unknown", "unknown", "customer"]
    assert result[0]["speaker"] == "Speaker 2"
    assert result[1]["roleSource"] == "unknown"


def test_valid_index_of_known_agent_is_not_customer_evidence():
    analysis = sample()
    with pytest.raises(ValueError, match="AGENT_ONLY_EVIDENCE"):
        validate_evidence(analysis, [{"role": "agent", "text": "For example, a payment could fail."}])
    validate_evidence(analysis, [{"role": "customer", "text": "My payment failed."}])
    validate_evidence(analysis, [{"role": "unknown", "text": "My payment failed."}])


def test_model_receives_speaker_role_and_global_indices(monkeypatch):
    import json

    import csi_worker.analysis as module

    payloads = []

    def local(path, payload):
        payloads.append(payload)
        return {
            "message": {
                "content": json.dumps(
                    {"summary": "Helpful call", "topic": "Feedback", "sentiment": "Positive", "issues": []}
                )
            }
        }

    monkeypatch.setattr(module, "ollama", local)
    segments = [{"text": "Thank you", "speaker": "Customer"} for _ in range(36)]
    segments[1] = {"text": "Glad to help", "speaker": "Agent"}
    module.analyze(segments, role_attribution="channel-metadata")
    first = json.loads(payloads[0]["messages"][1]["content"])
    second = json.loads(payloads[1]["messages"][1]["content"])
    assert first[0]["role"] == "customer" and first[1]["role"] == "agent"
    assert first[1]["speaker"] == "Agent"
    assert second[0]["index"] == 35


def run_output(monkeypatch, issues, segments, summary="The customer reported a failure."):
    import json

    from csi_worker import agent_profile
    from csi_worker.analysis import analyze

    monkeypatch.setattr(
        agent_profile,
        "complete",
        lambda *a, **kw: (
            json.dumps(dict(summary=summary, topic="Payments", sentiment="Negative", issues=issues)),
            "test-model",
        ),
    )
    return analyze(segments, role_attribution="channel-metadata")


def test_bad_finding_does_not_discard_valid_customer_finding(monkeypatch):
    valid = sample().issues[0].model_dump()
    result = run_output(
        monkeypatch,
        [valid, {**valid, "evidence": [1]}, {**valid, "evidence": [99]}, {**valid, "evidence": []}],
        [
            {"text": "My payment failed", "speaker": "Customer"},
            {"text": "Maybe a link expired", "speaker": "Agent"},
        ],
    )
    assert result["issues"] == [valid]
    assert [r["code"] for r in result["rejectedFindings"]] == [
        "AGENT_ONLY_EVIDENCE",
        "INVALID_EVIDENCE_REFERENCE",
        "INVALID_FINDING_SCHEMA",
    ]
    assert result["reviewRequired"] is True


def test_duplicates_merge_evidence_but_distinct_actions_are_kept(monkeypatch):
    valid = sample().issues[0].model_dump()
    duplicate = {**valid, "title": "Payment declined", "evidence": [1], "priority": "Critical"}
    distinct = {**valid, "proposedAction": "Inspect account lock history"}
    result = run_output(
        monkeypatch, [valid, duplicate, distinct], [{"text": "Payment failed", "speaker": "Customer"}] * 2
    )
    assert len(result["issues"]) == 2
    assert result["issues"][0]["evidence"] == [0, 1]
    assert result["issues"][0]["priority"] == "Critical"
    assert result["duplicatesMerged"] == 1


def test_all_rejected_is_visible_and_not_a_clean_no_problem_result(monkeypatch):
    valid = sample().issues[0].model_dump()
    result = run_output(monkeypatch, [valid], [{"text": "A hypothetical failure", "speaker": "Agent"}])
    assert result["issues"] == []
    assert result["reviewRequired"] is True
    assert result["rejectedFindings"][0]["code"] == "AGENT_ONLY_EVIDENCE"


def test_unknown_roles_use_source_excerpts_instead_of_invented_attribution(monkeypatch):
    result = run_output(
        monkeypatch,
        [],
        [{"text": "I cannot sign in", "speaker": "Speaker 1"}],
        summary="The customer complained and the agent resolved the issue.",
    )
    assert "I cannot sign in" in result["summary"]
    assert "customer" not in result["summary"] and "agent resolved" not in result["summary"]
    assert result["summaryMode"] == "source-excerpts"
    assert result["roleUncertainty"] is True


def test_evidence_from_another_chunk_is_rejected_individually(monkeypatch):
    valid = sample().issues[0].model_dump()
    result = run_output(monkeypatch, [valid], [{"text": "Payment failed", "speaker": "Customer"}] * 36)
    assert len(result["issues"]) == 1
    assert result["rejectedFindings"] == [dict(chunkStart=35, findingIndex=0, code="EVIDENCE_OUTSIDE_CHUNK")]
