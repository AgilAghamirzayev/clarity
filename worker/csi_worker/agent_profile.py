"""Versioned company instructions and deployment-controlled inference providers."""

import json
import os
from pathlib import Path
from urllib.parse import urlparse

import httpx

CONTRACT = json.loads(
    (Path(__file__).resolve().parents[2] / "server/src/main/resources/agent/skill.json").read_text()
)
DEFAULT_PROFILE = {
    "providerId": "local",
    "context": "",
    "rules": "",
    "language": "English",
    "temperature": 0,
    "maxOutputTokens": 1800,
    "externalAllowed": False,
    "version": 0,
}


def compile_prompt(profile, kind):
    profile = {**DEFAULT_PROFILE, **(profile or {})}
    if kind in profile:
        return profile[kind]
    return (
        CONTRACT[kind]
        + "\n\nCompany context:\n"
        + profile["context"]
        + "\n\nAnalysis preferences:\n"
        + profile["rules"]
        + "\n\nOutput language: "
        + profile["language"]
        + ".\n"
        + CONTRACT["guardrails"]
    )


def resolve_provider(profile):
    if profile["providerId"] == "local":
        return {
            "id": "local",
            "kind": "ollama",
            "model": profile.get("model") or os.environ.get("LLM_MODEL", "qwen3:4b-instruct"),
            "external": False,
        }
    providers = json.loads(os.environ.get("CSI_AI_PROVIDERS", "[]"))
    provider = next((p for p in providers if p["id"] == profile["providerId"]), None)
    if not provider or provider["kind"] != "openai-compatible":
        raise ValueError("AI_PROVIDER_NOT_CONFIGURED")
    provider = dict(provider)
    if profile.get("model") and profile["model"] != provider["model"]:
        raise ValueError("AI_PROVIDER_MODEL_CHANGED")
    if provider["external"] and not profile["externalAllowed"]:
        raise ValueError("EXTERNAL_ANALYSIS_NOT_ALLOWED")
    url = urlparse(provider["baseUrl"])
    if (
        not url.hostname
        or url.username
        or url.password
        or url.query
        or url.fragment
        or url.scheme not in (["https"] if provider["external"] else ["https", "http"])
    ):
        raise ValueError("INVALID_AI_PROVIDER_URL")
    return provider


def complete(profile, schema, messages, local_chat, context_size=8192):
    profile = {**DEFAULT_PROFILE, **(profile or {})}
    provider = resolve_provider(profile)
    if provider["kind"] == "ollama":
        result = local_chat(
            "/api/chat",
            {
                "model": provider["model"],
                "stream": False,
                "think": False,
                "format": schema,
                "options": {
                    "temperature": profile["temperature"],
                    "num_ctx": context_size,
                    "num_predict": profile["maxOutputTokens"],
                    "repeat_penalty": 1.1,
                },
                "messages": messages,
            },
        )
        content = result["message"]["content"]
    else:
        headers = {}
        credential = provider.get("tokenEnvironment")
        if credential:
            token = os.environ.get(credential)
            if not token:
                raise ValueError("AI_PROVIDER_CREDENTIAL_MISSING")
            headers["Authorization"] = "Bearer " + token
        with httpx.Client(timeout=300, trust_env=False, follow_redirects=False) as client:
            result = client.post(
                provider["baseUrl"].rstrip("/") + "/chat/completions",
                headers=headers,
                json={
                    "model": provider["model"],
                    "messages": messages,
                    "temperature": profile["temperature"],
                    "max_tokens": profile["maxOutputTokens"],
                    "response_format": {
                        "type": "json_schema",
                        "json_schema": {"name": "clarity_analysis", "strict": True, "schema": schema},
                    },
                },
            )
            result.raise_for_status()
            content = result.json()["choices"][0]["message"]["content"]
    if not isinstance(content, str) or len(content) > 100000:
        raise ValueError("INVALID_PROVIDER_OUTPUT")
    return content, provider["model"]
