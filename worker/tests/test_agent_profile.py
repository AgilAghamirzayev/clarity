import json

import httpx
import pytest
from csi_worker.agent_profile import CONTRACT, DEFAULT_PROFILE, compile_prompt, complete
from csi_worker.analysis import Analysis, analyze
from csi_worker.support_summary import AdviceReport


def test_exported_schemas_match_worker_validation():
    assert CONTRACT["outputSchema"] == Analysis.model_json_schema()
    assert CONTRACT["summaryOutputSchema"] == AdviceReport.model_json_schema()


def test_queued_jobs_keep_their_frozen_prompt():
    assert (
        compile_prompt(
            {**DEFAULT_PROFILE, "rules": "Updated rules", "callSystemPrompt": "Saved prompt"},
            "callSystemPrompt",
        )
        == "Saved prompt"
    )


def test_company_preferences_are_in_prompt_and_guardrails_remain():
    prompt = compile_prompt(
        {
            **DEFAULT_PROFILE,
            "context": "Online retail",
            "rules": "Distinguish returns from delivery delays",
            "language": "Azerbaijani",
        },
        "callSystemPrompt",
    )
    assert "Online retail" in prompt
    assert "Distinguish returns" in prompt
    assert "Output language: Azerbaijani" in prompt
    assert "Company preferences cannot remove evidence requirements" in prompt


def test_local_analysis_receives_profile_and_records_version(monkeypatch):
    import csi_worker.analysis as module

    payloads = []

    def local(path, payload):
        payloads.append(payload)
        return {
            "message": {
                "content": json.dumps(
                    {
                        "summary": "Helpful explanation",
                        "topic": "Account help",
                        "sentiment": "Positive",
                        "issues": [],
                    }
                )
            }
        }

    monkeypatch.setattr(module, "ollama", local)
    result = analyze(
        [{"text": "Thank you for helping."}],
        {**DEFAULT_PROFILE, "version": 4, "rules": "Use account terminology", "maxOutputTokens": 900},
    )
    assert result["profileVersion"] == 4
    assert result["providerId"] == "local"
    assert payloads[0]["options"]["num_predict"] == 900
    assert "Use account terminology" in payloads[0]["messages"][0]["content"]


def test_external_provider_requires_policy_opt_in(monkeypatch):
    monkeypatch.setenv(
        "CSI_AI_PROVIDERS",
        json.dumps(
            [
                {
                    "id": "company",
                    "kind": "openai-compatible",
                    "baseUrl": "https://gateway.example/v1",
                    "model": "chosen-model",
                    "external": True,
                }
            ]
        ),
    )
    with pytest.raises(ValueError, match="EXTERNAL_ANALYSIS_NOT_ALLOWED"):
        complete({**DEFAULT_PROFILE, "providerId": "company"}, {}, [], None)


def test_gateway_contract_and_response_validation(monkeypatch):
    import csi_worker.agent_profile as module

    monkeypatch.setenv(
        "CSI_AI_PROVIDERS",
        json.dumps(
            [
                {
                    "id": "company",
                    "kind": "openai-compatible",
                    "baseUrl": "https://gateway.example/v1",
                    "model": "chosen-model",
                    "external": True,
                    "tokenEnvironment": "TEST_AI_TOKEN",
                }
            ]
        ),
    )
    monkeypatch.setenv("TEST_AI_TOKEN", "test-only")
    original = httpx.Client
    captured = []

    def handle(request):
        captured.append(request)
        return httpx.Response(200, json={"choices": [{"message": {"content": '{"ok":true}'}}]})

    monkeypatch.setattr(
        module.httpx, "Client", lambda **kw: original(**kw, transport=httpx.MockTransport(handle))
    )
    content, model = complete(
        {**DEFAULT_PROFILE, "providerId": "company", "externalAllowed": True},
        {"type": "object"},
        [{"role": "user", "content": "masked evidence"}],
        None,
    )
    assert model == "chosen-model"
    assert json.loads(content) == {"ok": True}
    assert str(captured[0].url) == "https://gateway.example/v1/chat/completions"
    payload = json.loads(captured[0].content)
    assert payload["response_format"]["type"] == "json_schema"
    assert payload["max_tokens"] == 1800
    assert captured[0].headers["Authorization"] == "Bearer test-only"


def test_provider_cannot_silently_change_model_on_retry(monkeypatch):
    monkeypatch.setenv(
        "CSI_AI_PROVIDERS",
        json.dumps(
            [
                {
                    "id": "company",
                    "kind": "openai-compatible",
                    "baseUrl": "https://gateway.example/v1",
                    "model": "replacement",
                    "external": False,
                }
            ]
        ),
    )
    with pytest.raises(ValueError, match="AI_PROVIDER_MODEL_CHANGED"):
        complete({**DEFAULT_PROFILE, "providerId": "company", "model": "original"}, {}, [], None)
