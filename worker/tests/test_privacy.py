from csi_worker.privacy import mask_patterns, merge_spans


def test_identifiers_are_removed_and_non_sensitive_text_preserved():
    source = "Call +994 50 123 45 67 or john@example.com, card 4111 1111 1111 1111, IBAN AZ21NABZ00000000137010001944. Refund failed."
    masked = mask_patterns(source)
    for secret in ["994", "john@example.com", "4111", "AZ21NABZ"]:
        assert secret not in masked
    assert "Refund failed." in masked


def test_overlapping_spans_do_not_leak_suffixes():
    assert merge_spans("abcdef", [(0, 3), (2, 5)]) == "[PII]f"


def test_id_label_does_not_mask_general_words():
    text = "Identify why the identity verification and financial guidance failed."
    assert mask_patterns(text) == text
    for identifier in ["ID: ABC12345", "FIN ABC1234", "passport # AB123456", "PIN-123456"]:
        assert mask_patterns(identifier).endswith("[PII]")


def test_redaction_crosses_asr_segment_boundaries(monkeypatch):
    from csi_worker.privacy import redact_segments

    monkeypatch.setattr("csi_worker.privacy.local_entities", lambda text: [])
    result = redact_segments(
        [
            {"text": "Call +994 50", "speaker": "Speaker 1"},
            {"text": "123 45 67 please", "speaker": "Speaker 1"},
        ]
    )
    assert "994" not in result[0]["text"]
    assert "123" not in result[1]["text"]
    assert "please" in result[1]["text"]


def test_explicit_name_introduction_masks_only_the_name():
    assert mask_patterns("My name is Lena Fiction. Refund failed.") == "My name is [PII]. Refund failed."
    assert (
        mask_patterns("My name is not relevant. Refund failed.") == "My name is not relevant. Refund failed."
    )
