import pytest
from csi_worker.support_summary import Report, validate_report


def report(reference):
    return Report.model_validate(
        {
            "overview": "Customers report late verification codes.",
            "strengths": [],
            "advice": [
                {
                    "title": "Investigate code delivery",
                    "observation": "The code arrived after expiry.",
                    "evidenceRefs": [reference, reference],
                    "area": "Product",
                    "priority": "High",
                    "recommendation": "Compare provider timestamps with code expiry.",
                    "validation": "Review delivery logs before identifying a cause.",
                    "successMetric": "Expired-code contacts per sign-in attempt.",
                }
            ],
        }
    )


def test_summary_rejects_evidence_outside_its_snapshot():
    with pytest.raises(ValueError, match="SUMMARY_EVIDENCE_NOT_IN_SNAPSHOT"):
        validate_report(report("CALL-9999"), {"evidence": [{"reference": "CALL-1001"}]})


def test_summary_retains_valid_evidence_and_deduplicates_references():
    result = validate_report(report("CALL-1001"), {"evidence": [{"reference": "CALL-1001"}]})
    assert result.advice[0].evidenceRefs == ["CALL-1001"]


def test_summary_rejects_advice_without_evidence():
    payload = report("CALL-1001").model_dump()
    payload["advice"][0]["evidenceRefs"] = []
    with pytest.raises(ValueError):
        Report.model_validate(payload)


def test_overview_uses_measured_counts_instead_of_model_claims():
    from csi_worker.support_summary import measured_overview

    text = measured_overview(
        {
            "current": {
                "calls": 10,
                "customers": 7,
                "negative": 8,
                "positive": 1,
                "neutral": 1,
                "issueCalls": 8,
                "repeatCustomers": 2,
            }
        }
    )
    assert "10 analyzed calls from 7 customers" in text
    assert "2 customers contacted support more than once" in text


def test_generated_advice_uses_defined_measures_not_model_targets(monkeypatch):
    import json

    import csi_worker.support_summary as module

    item = report("CALL-1001").advice[0].model_dump()
    item.pop("successMetric")
    item.pop("validation")
    monkeypatch.setattr(
        module, "ollama", lambda path, payload: {"message": {"content": json.dumps({"advice": [item]})}}
    )
    monkeypatch.setattr(module, "redact_segments", lambda segments: segments)
    result = module.generate_report(
        {
            "days": 7,
            "current": {
                "calls": 1,
                "customers": 1,
                "negative": 1,
                "positive": 0,
                "neutral": 0,
                "issueCalls": 1,
                "repeatCustomers": 0,
            },
            "previous": {},
            "evidence": [
                {
                    "reference": "CALL-1001",
                    "summary": "The code expired before it arrived.",
                    "sentiment": "Negative",
                    "title": "Late verification code",
                }
            ],
        }
    )
    assert result["advice"][0]["successMetric"] == module.MEASURES["Product"]
    assert "Establish a baseline" in result["advice"][0]["successMetric"]


def test_summary_rejects_invented_service_targets():
    candidate = report("CALL-1001")
    candidate.advice[0].recommendation = "Deliver every login code within 15 minutes."
    with pytest.raises(ValueError, match="SUMMARY_UNSUPPORTED_TARGET"):
        validate_report(candidate, {"evidence": [{"reference": "CALL-1001"}]})
