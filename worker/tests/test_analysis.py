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
