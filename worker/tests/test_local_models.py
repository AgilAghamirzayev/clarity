import os

import pytest
from csi_worker.analysis import analyze, embed
from csi_worker.privacy import redact

pytestmark = pytest.mark.skipif(
    os.environ.get("CSI_MODEL_TESTS") != "true", reason="Requires provisioned local weights and Ollama"
)


def test_customer_problem_is_extracted_with_real_local_llm():
    result = analyze(
        [
            {
                "text": "I tried to pay my invoice three times. Every payment failed with an error. This is unacceptable."
            },
            {"text": "I will escalate the payment failure to our technical team."},
        ]
    )
    assert result["sentiment"] == "Negative"
    assert result["issues"]
    assert 0 in result["issues"][0]["evidence"]
    assert len(embed("payment failure")) == 768


def test_local_entity_and_pattern_redaction():
    result = redact("My name is John Smith. Email john.smith@example.com or call +994 50 123 45 67.")
    assert "John Smith" not in result
    assert "john.smith@example.com" not in result
    assert "123 45 67" not in result


def test_positive_call_does_not_invent_a_problem():
    result = analyze(
        [
            {
                "text": "Customer: Your app works perfectly. I have no problems. I just wanted to thank you for the excellent service."
            },
            {"text": "Agent: Thank you for the feedback. Have a good day."},
        ]
    )
    assert result["sentiment"] == "Positive"
    assert result["issues"] == []
