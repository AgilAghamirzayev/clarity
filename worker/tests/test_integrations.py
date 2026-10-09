import pytest
from csi_worker.integrations import send, validate_destination


def test_private_address_and_unlisted_hosts_rejected(monkeypatch):
    monkeypatch.setenv("INTEGRATION_ALLOWED_ORIGINS", "https://example.com")
    monkeypatch.setattr("socket.getaddrinfo", lambda *a, **k: [(2, 1, 6, "", ("127.0.0.1", 443))])
    with pytest.raises(ValueError, match="PRIVATE"):
        validate_destination("https://example.com")
    with pytest.raises(ValueError, match="NOT_ALLOWED"):
        validate_destination("https://attacker.com")


def test_crm_has_stable_idempotency_and_signature(monkeypatch):
    seen = []
    monkeypatch.setattr("csi_worker.integrations.request", lambda *args: seen.append(args) or {"id": "crm-1"})
    assert send("crm", {"endpoint": "https://example.com"}, "secret", "delivery-1", {"x": 1}) == "crm-1"
    assert seen[0][2]["Idempotency-Key"] == "delivery-1"
    assert seen[0][2]["X-CSI-Signature"].startswith("sha256=")


def test_jira_recovers_prior_issue_instead_of_creating_duplicate(monkeypatch):
    seen = []
    monkeypatch.setattr(
        "csi_worker.integrations.request", lambda *args: seen.append(args) or {"issues": [{"key": "CSI-1"}]}
    )
    assert (
        send("jira", {"endpoint": "https://example.com", "email": "bot@example.com"}, "token", "key", {})
        == "CSI-1"
    )
    assert len(seen) == 1
