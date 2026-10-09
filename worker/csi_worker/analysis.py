import os
import re
import unicodedata
from typing import Literal
from urllib.parse import urlparse

import httpx
from pydantic import BaseModel, ConfigDict, Field, ValidationError

PROMPT_VERSION = "call-analysis-v6-reviewed"


class Finding(BaseModel):
    model_config = ConfigDict(extra="forbid")
    title: str = Field(min_length=3, max_length=120)
    category: str = Field(min_length=2, max_length=80)
    priority: Literal["Critical", "High", "Medium"]
    description: str = Field(min_length=3, max_length=1000)
    evidence: list[int] = Field(min_length=1, max_length=50)
    proposedAction: str = Field(min_length=5, max_length=1000)
    expectedOutcome: str = Field(min_length=5, max_length=500)


class Analysis(BaseModel):
    model_config = ConfigDict(extra="forbid")
    summary: str = Field(min_length=3, max_length=500)
    topic: str = Field(min_length=2, max_length=80)
    sentiment: Literal["Positive", "Neutral", "Negative"]
    issues: list[Finding] = Field(max_length=10)


class AnalysisEnvelope(Analysis):
    # Validate each finding separately without relaxing the top-level contract.
    issues: list[object] = Field(max_length=10)


def analysis_segments(segments, role_attribution="unknown"):
    """Speaker identity is not a conversational role without recording metadata."""
    result = []
    for index, segment in enumerate(segments):
        speaker = segment.get("speaker") or "Unknown speaker"
        source = segment.get("roleSource", role_attribution)
        role = segment.get("role", str(speaker).lower())
        trusted = source == "channel-metadata" and role in {"customer", "agent"}
        result.append(
            {
                "index": index,
                "text": segment["text"],
                "speaker": speaker,
                "role": role if trusted else "unknown",
                "roleSource": "channel-metadata" if trusted else "unknown",
            }
        )
    return result


def validate_evidence(analysis, segments):
    for finding in analysis.issues:
        validate_finding(finding, segments)


def validate_finding(finding, segments):
    finding.evidence = sorted(set(finding.evidence))
    if any(i < 0 or i >= len(segments) for i in finding.evidence):
        raise ValueError("INVALID_EVIDENCE_REFERENCE")
    if all(segments[i].get("role") == "agent" for i in finding.evidence):
        raise ValueError("AGENT_ONLY_EVIDENCE")


def merge_duplicates(findings):
    retained = []
    by_content = {}
    merged = 0
    priority = {"Medium": 0, "High": 1, "Critical": 2}
    for finding in findings:
        # Conservative content matching avoids merging different remedies for one symptom.
        key = tuple(
            " ".join(re.findall(r"\w+", unicodedata.normalize("NFKC", value).casefold()))
            for value in (finding.description, finding.proposedAction, finding.expectedOutcome)
        )
        previous = by_content.get(key)
        evidence = sorted(set(previous.evidence + finding.evidence)) if previous else []
        if previous is not None and len(evidence) <= 50:
            previous.evidence = evidence
            previous.priority = max((previous.priority, finding.priority), key=priority.get)
            merged += 1
        else:
            retained.append(finding)
            by_content[key] = finding
    return retained, merged


def ollama(path, payload):
    if ":cloud" in str(payload.get("model", "")):
        raise ValueError("CLOUD_MODELS_DISABLED")
    base = os.environ.get("OLLAMA_URL", "http://127.0.0.1:11434")
    parsed = urlparse(base)
    if (
        parsed.hostname not in {"127.0.0.1", "localhost", "::1", "host.docker.internal", "ollama"}
        or parsed.username
    ):
        raise ValueError("OLLAMA_MUST_BE_LOCAL")
    with httpx.Client(timeout=300, trust_env=False, follow_redirects=False) as client:
        metadata = client.post(base + "/api/show", json={"model": payload["model"]})
        metadata.raise_for_status()
        model_info = metadata.json()
        if model_info.get("remote_model") or model_info.get("remote_host"):
            raise ValueError("REMOTE_MODEL_DISABLED")
        response = client.post(base + path, json=payload)
        response.raise_for_status()
        return response.json()


def analyze(segments, profile=None, role_attribution="unknown"):
    import json

    from .agent_profile import CONTRACT, DEFAULT_PROFILE, compile_prompt, complete

    profile = {**DEFAULT_PROFILE, **(profile or {})}
    instructions = compile_prompt(profile, "callSystemPrompt")
    segments = analysis_segments(segments, role_attribution)
    # Chunking avoids silently discarding the end of a long call.
    findings = []
    rejected = []
    summaries = []
    sentiments = []
    topic = "Uncategorized"
    for start in range(0, len(segments), 35):
        chunk = segments[start : start + 35]
        content, model = complete(
            profile,
            Analysis.model_json_schema(),
            [
                {"role": "system", "content": instructions},
                {
                    "role": "user",
                    "content": json.dumps(chunk),
                },
            ],
            ollama,
        )
        result = AnalysisEnvelope.model_validate_json(content)
        for index, candidate in enumerate(result.issues):
            try:
                finding = Finding.model_validate(candidate)
                validate_finding(finding, segments)
                if any(i < start or i >= start + len(chunk) for i in finding.evidence):
                    raise ValueError("EVIDENCE_OUTSIDE_CHUNK")
                findings.append(finding)
            except (ValidationError, ValueError) as exc:
                rejected.append(
                    dict(
                        chunkStart=start,
                        findingIndex=index,
                        code="INVALID_FINDING_SCHEMA" if isinstance(exc, ValidationError) else str(exc),
                    )
                )
        summaries.append(result.summary)
        sentiments.append(result.sentiment)
        topic = result.topic
    if not summaries:
        raise ValueError("NO_SPEECH_DETECTED")
    findings, merged = merge_duplicates(findings)
    unknown_roles = any(s["role"] == "unknown" for s in segments)
    if unknown_roles or rejected:
        # A prompt cannot enforce attribution. Use attributed source locations, not guessed roles.
        indices = sorted({i for f in findings for i in f.evidence}) or list(range(len(segments)))
        excerpts = " | ".join(f'[{i}] "{segments[i]["text"][:180]}"' for i in indices[:2])
        notice = "Speaker roles are unverified." if unknown_roles else "Some proposed findings were rejected."
        summaries = [notice + " Transcript excerpts: " + excerpts]
    sentiment = (
        "Negative"
        if "Negative" in sentiments
        else "Positive"
        if all(s == "Positive" for s in sentiments)
        else "Neutral"
    )
    return {
        "summary": "\n".join(summaries),
        "topic": topic,
        "sentiment": sentiment,
        "issues": [f.model_dump() for f in findings],
        "model": model,
        "promptVersion": PROMPT_VERSION,
        "rejectedFindings": rejected,
        "duplicatesMerged": merged,
        "reviewRequired": bool(rejected) or unknown_roles,
        "roleUncertainty": unknown_roles,
        "summaryMode": "source-excerpts" if unknown_roles or rejected else "model",
        "profileVersion": profile["version"],
        "providerId": profile["providerId"],
        "skillVersion": profile.get("skillVersion", CONTRACT["version"]),
    }


def embed(text):
    model = os.environ.get("EMBEDDING_MODEL", "nomic-embed-text:latest")
    vector = ollama("/api/embed", {"model": model, "input": "search_document: " + text})["embeddings"][0]
    import math

    if len(vector) != 768 or not all(math.isfinite(x) for x in vector) or not any(vector):
        raise ValueError("INVALID_EMBEDDING")
    return vector
