"""Local, evidence-linked support advice built from a fixed reporting snapshot."""

import json
import re
from typing import Literal

from psycopg.types.json import Jsonb
from pydantic import BaseModel, ConfigDict, Field
from temporalio import activity
from temporalio.exceptions import ApplicationError

from .analysis import ollama
from .privacy import redact_segments
from .storage import database


class EvidenceFinding(BaseModel):
    model_config = ConfigDict(extra="forbid")
    title: str = Field(min_length=3, max_length=120)
    observation: str = Field(min_length=10, max_length=500)
    evidenceRefs: list[str] = Field(min_length=1, max_length=5)


class AdviceInput(EvidenceFinding):
    area: Literal["Policy", "Product", "Operations"]
    priority: Literal["High", "Medium", "Low"]
    recommendation: str = Field(min_length=10, max_length=600)


class Advice(AdviceInput):
    validation: str = Field(min_length=10, max_length=500)
    successMetric: str = Field(min_length=10, max_length=300)


class Report(BaseModel):
    model_config = ConfigDict(extra="forbid")
    overview: str = Field(min_length=10, max_length=1200)
    strengths: list[EvidenceFinding] = Field(max_length=3)
    advice: list[Advice] = Field(max_length=6)


class AdviceReport(BaseModel):
    model_config = ConfigDict(extra="forbid")
    advice: list[AdviceInput] = Field(max_length=3)


VALIDATIONS = {
    "Policy": "Compare the policy documents and customer-facing explanations with the cited experiences. Confirm the existing rules with the policy owner before changing them.",
    "Product": "Reproduce the reported scenario and review application logs and tests. Confirm the cause with the engineering team before changing code.",
    "Operations": "Review case ownership, handoff records and promised updates against actual follow-ups. Confirm the service expectations before changing the process.",
}


MEASURES = {
    "Policy": "Policy clarification contacts as a share of relevant support calls. Establish a baseline before setting a target.",
    "Product": "Issue-related contacts per relevant product attempt, using application logs for the denominator. Establish a baseline before setting a target.",
    "Operations": "Repeat contacts about the same issue per case, using case records to match follow-ups. Establish a baseline before setting a target.",
}


def measured_overview(snapshot):
    metrics = snapshot["current"]
    return (
        f"Across {metrics['calls']} analyzed calls from {metrics['customers']} customers, "
        f"{metrics['negative']} calls had negative sentiment, {metrics['positive']} positive "
        f"and {metrics['neutral']} neutral. {metrics['issueCalls']} calls were linked to an issue. "
        f"{metrics['repeatCustomers']} customers contacted support more than once in this period. "
        "The suggestions below identify reviews to prioritize; they do not establish a root cause."
    )


def validate_report(report, snapshot):
    available = {call["reference"] for call in snapshot["evidence"]}
    for finding in [*report.strengths, *report.advice]:
        if not set(finding.evidenceRefs).issubset(available):
            raise ValueError("SUMMARY_EVIDENCE_NOT_IN_SNAPSHOT")
        finding.evidenceRefs = list(dict.fromkeys(finding.evidenceRefs))
        if isinstance(finding, Advice) and re.search(
            r"\b\d+(?:\.\d+)?\s*(?:%|percent|seconds?|minutes?|hours?|days?|weeks?)",
            finding.title + " " + finding.recommendation,
            re.IGNORECASE,
        ):
            raise ValueError("SUMMARY_UNSUPPORTED_TARGET")
    return report


def generate_report(snapshot):
    if not snapshot["evidence"]:
        raise ValueError("SUMMARY_REQUIRES_EVIDENCE")
    from .agent_profile import DEFAULT_PROFILE, compile_prompt, complete

    profile = {**DEFAULT_PROFILE, **snapshot.get("analysisProfile", {})}
    # Internal row IDs and routing metadata are unnecessary for inference.
    context = {
        "days": snapshot["days"],
        "current": snapshot["current"],
        "previous": snapshot["previous"],
        "calls": [{k: c[k] for k in ["reference", "summary", "sentiment"]} for c in snapshot["evidence"]],
    }
    content, model = complete(
        profile,
        AdviceReport.model_json_schema(),
        [
            {"role": "system", "content": compile_prompt(profile, "summarySystemPrompt")},
            {"role": "user", "content": json.dumps(context)},
        ],
        ollama,
        context_size=16384,
    )
    generated = AdviceReport.model_validate_json(content)
    strengths = [
        EvidenceFinding(
            title="Positive experience: " + call["title"][:95],
            observation=call["summary"][:500],
            evidenceRefs=[call["reference"]],
        )
        for call in snapshot["evidence"]
        if call["sentiment"] == "Positive"
    ][:2]
    report = validate_report(
        Report(
            overview=measured_overview(snapshot),
            strengths=strengths,
            advice=[
                Advice(
                    **item.model_dump(), validation=VALIDATIONS[item.area], successMetric=MEASURES[item.area]
                )
                for item in generated.advice
            ],
        ),
        snapshot,
    ).model_dump()
    fields = []
    for item in report["advice"]:
        fields.extend((item, key) for key in ["title", "observation", "recommendation"] if key in item)
    masked = redact_segments([{"text": item[key]} for item, key in fields])
    for (item, key), segment in zip(fields, masked):
        item[key] = segment["text"]
    report.update(
        model=model,
        promptVersion="support-summary-v5",
        profileVersion=profile["version"],
        providerId=profile["providerId"],
    )
    return report


@activity.defn
def build_support_summary(event):
    try:
        with database(event["tenant"]) as conn:
            row = conn.execute("select * from support_summaries where id=%s", (event["resource"],)).fetchone()
            if not row:
                raise ValueError("SUMMARY_NOT_FOUND")
            if row["status"] == "COMPLETED":
                return
            conn.execute(
                "update support_summaries set status='PROCESSING',updated_at=now() where id=%s",
                (event["resource"],),
            )
            snapshot = row["snapshot"]
        report = generate_report(snapshot)
        with database(event["tenant"]) as conn:
            saved = conn.execute(
                "update support_summaries set status='COMPLETED',report=%s,error_code=null,updated_at=now() where id=%s and status<>'COMPLETED' returning id",
                (Jsonb(report), event["resource"]),
            ).fetchone()
            if saved:
                conn.execute(
                    "insert into audit(tenant_id,actor,action,resource) values (%s,'local-worker','summary.completed',%s)",
                    (event["tenant"], event["resource"]),
                )
    except Exception:
        raise ApplicationError("SUMMARY_GENERATION_FAILED", type="SUMMARY_GENERATION_FAILED") from None


@activity.defn
def fail_support_summary(event):
    with database(event["tenant"]) as conn:
        conn.execute(
            "update support_summaries set status='FAILED',error_code='SUMMARY_GENERATION_FAILED',updated_at=now() where id=%s and status<>'COMPLETED'",
            (event["resource"],),
        )
