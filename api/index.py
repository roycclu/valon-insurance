from __future__ import annotations

from copy import deepcopy
from dataclasses import dataclass
from datetime import datetime, timezone
import json
import os
from statistics import mean
import time
from typing import Any, Literal
from urllib import error, request
from uuid import uuid4

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

try:
    from opentelemetry import trace as trace_api
    from opentelemetry.trace import Status, StatusCode
    from phoenix.otel import register
except ImportError:
    register = None
    trace_api = None
    Status = None
    StatusCode = None


app = FastAPI(title="Motorcycle Claims Workflow API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


PHOENIX_UI_URL = os.getenv("PHOENIX_UI_URL", "http://your-digital-ocean-ip:6006")
PHOENIX_COLLECTOR_ENDPOINT = os.getenv("PHOENIX_COLLECTOR_ENDPOINT", f"{PHOENIX_UI_URL}/v1/traces")
PHOENIX_PROJECT_NAME = os.getenv("PHOENIX_PROJECT_NAME", "valon-insurance-claims-demo")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
DEFAULT_LLM_PROVIDER = os.getenv("LLM_PROVIDER", "anthropic")
DEFAULT_ANTHROPIC_MODEL = os.getenv("CLAUDE_MODEL", os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-6"))
DEFAULT_OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4.1-mini")


def configure_tracer():
    if register is None:
        return None
    try:
        return register(
            project_name=PHOENIX_PROJECT_NAME,
            endpoint=PHOENIX_COLLECTOR_ENDPOINT,
            protocol="http/protobuf",
            batch=False,
        )
    except Exception:
        return None


TRACER_PROVIDER = configure_tracer()
TRACER = trace_api.get_tracer("valon.insurance.chat") if trace_api else None


Priority = Literal["Low", "Medium", "High"]
CoverageDecision = Literal["Approved", "Pending Review", "Denied"]
ClaimStatus = Literal["Intake", "Triage", "Docs Pending", "Coverage Review", "Escalated", "Closed"]


@dataclass(frozen=True)
class PolicyRecord:
    policy_number: str
    holder_name: str
    plan_name: str
    status: str
    incident_type: str
    covered_incident_types: list[str]
    exclusions: list[str]
    notes: str


POLICIES: dict[str, PolicyRecord] = {
    "MC-204812": PolicyRecord(
        policy_number="MC-204812",
        holder_name="Darius Cole",
        plan_name="RoadShield Plus",
        status="Active",
        incident_type="Collision",
        covered_incident_types=["Collision", "Theft", "Fire"],
        exclusions=["Racing events", "Commercial delivery use"],
        notes="Standard deductible applies.",
    ),
    "MC-557903": PolicyRecord(
        policy_number="MC-557903",
        holder_name="Elena Park",
        plan_name="Urban Rider Select",
        status="Active",
        incident_type="Single Vehicle",
        covered_incident_types=["Collision", "Single Vehicle", "Vandalism"],
        exclusions=["Track days", "Intentional damage"],
        notes="OEM parts endorsement active.",
    ),
    "MC-998401": PolicyRecord(
        policy_number="MC-998401",
        holder_name="Miles Bennett",
        plan_name="Essential Liability",
        status="Active",
        incident_type="Theft",
        covered_incident_types=["Collision"],
        exclusions=["Unsecured vehicle theft", "Off-road usage"],
        notes="Theft requires proof of secure storage.",
    ),
}


class IntakePayload(BaseModel):
    claimant_name: str = Field(min_length=1)
    policy_number: str = Field(min_length=1)
    incident_date: str
    incident_description: str = Field(min_length=10)
    injury_involved: bool
    vehicle_damage_severity: Literal["minor", "moderate", "severe"]


class DocumentUpdate(BaseModel):
    received: bool


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1)


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    claims: list[dict[str, Any]]
    provider: Literal["anthropic", "openai"] | None = None
    model: str | None = None


def score_triage(injury_involved: bool, vehicle_damage_severity: str) -> tuple[Priority, str]:
    if injury_involved:
        return "High", "Injury involved automatically elevates the claim to High priority."
    if vehicle_damage_severity == "severe":
        return "High", "Severe vehicle damage requires immediate adjuster attention."
    if vehicle_damage_severity == "moderate":
        return "Medium", "Moderate damage indicates a likely repair coordination workflow."
    return "Low", "Minor damage with no injury is suitable for streamlined handling."


def required_documents(priority: Priority) -> list[dict[str, object]]:
    baseline = [
        {"key": "photos", "label": "Accident Photos", "received": True},
        {"key": "police_report", "label": "Police Report", "received": False},
    ]
    if priority == "Medium":
        baseline.append({"key": "repair_estimate", "label": "Repair Estimate", "received": False})
    if priority == "High":
        baseline.extend(
            [
                {"key": "repair_estimate", "label": "Repair Estimate", "received": False},
                {"key": "medical_records", "label": "Medical Records", "received": False},
                {"key": "legal_notice", "label": "Legal Notice", "received": False},
            ]
        )
    return baseline


def coverage_result(policy: PolicyRecord, description: str, priority: Priority) -> tuple[CoverageDecision, str, list[str]]:
    lowered = description.lower()
    matched_exclusions = [item for item in policy.exclusions if any(token in lowered for token in item.lower().split())]
    if policy.incident_type not in policy.covered_incident_types:
        return "Denied", f"{policy.incident_type} is not covered under {policy.plan_name}.", matched_exclusions
    if matched_exclusions:
        return "Pending Review", "Potential exclusion language found in incident narrative.", matched_exclusions
    if priority == "High":
        return "Pending Review", "High-severity claims require manual coverage confirmation.", matched_exclusions
    return "Approved", "Incident aligns with covered peril and no exclusions were triggered.", matched_exclusions


def build_escalation(priority: Priority, decision: CoverageDecision) -> dict[str, object] | None:
    if priority != "High" and decision != "Denied":
        return None
    reason = "High-priority injury/severity workflow." if priority == "High" else "Coverage denial requires human review."
    adjuster = "Priya Shah" if priority == "High" else "Marcus Hale"
    return {
        "assigned_adjuster": adjuster,
        "reason": reason,
        "sla_minutes_remaining": 42 if priority == "High" else 88,
        "queue_status": "Queued",
    }


def build_claim(seed: dict[str, object]) -> dict[str, object]:
    priority, triage_reason = score_triage(seed["injury_involved"], seed["vehicle_damage_severity"])
    policy = POLICIES[seed["policy_number"]]
    coverage_decision, coverage_reason, flagged_exclusions = coverage_result(
        policy, seed["incident_description"], priority
    )
    escalation = build_escalation(priority, coverage_decision)
    status: ClaimStatus
    if escalation:
        status = "Escalated"
    elif coverage_decision == "Approved":
        status = "Coverage Review"
    else:
        status = "Docs Pending"
    return {
        **seed,
        "triage": {"priority": priority, "reasoning": triage_reason},
        "documents": required_documents(priority),
        "coverage": {
            "decision": coverage_decision,
            "reason": coverage_reason,
            "policy": {
                "policy_number": policy.policy_number,
                "holder_name": policy.holder_name,
                "plan_name": policy.plan_name,
                "status": policy.status,
                "incident_type": policy.incident_type,
                "covered_incident_types": policy.covered_incident_types,
                "exclusions": policy.exclusions,
                "notes": policy.notes,
            },
            "flagged_exclusions": flagged_exclusions,
        },
        "escalation": escalation,
        "status": status,
        "stage_timings": {
            "intake_minutes": seed["stage_timings"]["intake_minutes"],
            "triage_minutes": seed["stage_timings"]["triage_minutes"],
            "document_minutes": seed["stage_timings"]["document_minutes"],
            "coverage_minutes": seed["stage_timings"]["coverage_minutes"],
            "escalation_minutes": seed["stage_timings"]["escalation_minutes"],
        },
    }


SAMPLE_CLAIMS = [
    {
        "id": "CLM-240501",
        "claimant_name": "Darius Cole",
        "policy_number": "MC-204812",
        "incident_date": "2026-05-02",
        "incident_description": "Rear-end collision at a stoplight with fairing and fork damage.",
        "injury_involved": False,
        "vehicle_damage_severity": "moderate",
        "created_at": "2026-05-02T14:16:00Z",
        "stage_timings": {
            "intake_minutes": 6,
            "triage_minutes": 2,
            "document_minutes": 18,
            "coverage_minutes": 9,
            "escalation_minutes": 0,
        },
    },
    {
        "id": "CLM-240502",
        "claimant_name": "Elena Park",
        "policy_number": "MC-557903",
        "incident_date": "2026-05-03",
        "incident_description": "Low-side crash on rain-slick city street with rider wrist injury.",
        "injury_involved": True,
        "vehicle_damage_severity": "severe",
        "created_at": "2026-05-03T09:44:00Z",
        "stage_timings": {
            "intake_minutes": 8,
            "triage_minutes": 1,
            "document_minutes": 27,
            "coverage_minutes": 12,
            "escalation_minutes": 5,
        },
    },
    {
        "id": "CLM-240503",
        "claimant_name": "Miles Bennett",
        "policy_number": "MC-998401",
        "incident_date": "2026-05-05",
        "incident_description": "Motorcycle reported stolen from open driveway overnight.",
        "injury_involved": False,
        "vehicle_damage_severity": "minor",
        "created_at": "2026-05-05T21:05:00Z",
        "stage_timings": {
            "intake_minutes": 5,
            "triage_minutes": 2,
            "document_minutes": 14,
            "coverage_minutes": 11,
            "escalation_minutes": 4,
        },
    },
]


CLAIMS = [build_claim(seed) for seed in SAMPLE_CLAIMS]


def metrics() -> dict[str, object]:
    active = len(CLAIMS)
    stage_keys = [
        ("intake_minutes", "FNOL Intake"),
        ("triage_minutes", "AI Triage"),
        ("document_minutes", "Document Collection"),
        ("coverage_minutes", "Coverage Check"),
        ("escalation_minutes", "Escalation"),
    ]
    avg_stage = {
        label: round(mean(claim["stage_timings"][key] for claim in CLAIMS), 1) for key, label in stage_keys
    }
    escalation_count = sum(1 for claim in CLAIMS if claim["escalation"])
    by_status: dict[str, int] = {}
    for claim in CLAIMS:
        by_status[claim["status"]] = by_status.get(claim["status"], 0) + 1
    return {
        "active_claims": active,
        "average_time_per_stage": avg_stage,
        "escalation_rate": round((escalation_count / active) * 100, 1) if active else 0,
        "claims_by_status": by_status,
    }


@app.get("/api/claims")
def get_claims() -> dict[str, object]:
    return {"claims": CLAIMS, "metrics": metrics()}


@app.get("/api/claims/{claim_id}")
def get_claim(claim_id: str) -> dict[str, object]:
    claim = next((item for item in CLAIMS if item["id"] == claim_id), None)
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")
    return claim


@app.post("/api/claims")
def create_claim(payload: IntakePayload) -> dict[str, object]:
    timestamp = datetime.now(timezone.utc)
    seed = {
        "id": f"CLM-{uuid4().hex[:6].upper()}",
        "claimant_name": payload.claimant_name,
        "policy_number": payload.policy_number,
        "incident_date": payload.incident_date,
        "incident_description": payload.incident_description,
        "injury_involved": payload.injury_involved,
        "vehicle_damage_severity": payload.vehicle_damage_severity,
        "created_at": timestamp.isoformat().replace("+00:00", "Z"),
        "stage_timings": {
            "intake_minutes": 4,
            "triage_minutes": 1,
            "document_minutes": 0,
            "coverage_minutes": 0,
            "escalation_minutes": 0,
        },
    }
    if seed["policy_number"] not in POLICIES:
        raise HTTPException(status_code=400, detail="Unknown policy number for demo dataset")
    claim = build_claim(seed)
    CLAIMS.insert(0, claim)
    return {"claim": claim, "metrics": metrics()}


@app.patch("/api/claims/{claim_id}/documents/{document_key}")
def update_document(claim_id: str, document_key: str, payload: DocumentUpdate) -> dict[str, object]:
    claim = next((item for item in CLAIMS if item["id"] == claim_id), None)
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")
    documents = deepcopy(claim["documents"])
    found = False
    for document in documents:
        if document["key"] == document_key:
            document["received"] = payload.received
            found = True
            break
    if not found:
        raise HTTPException(status_code=404, detail="Document not found")
    claim["documents"] = documents
    if all(doc["received"] for doc in documents) and claim["coverage"]["decision"] == "Approved":
        claim["status"] = "Coverage Review"
    elif claim["escalation"]:
        claim["status"] = "Escalated"
    else:
        claim["status"] = "Docs Pending"
    return {"claim": claim, "metrics": metrics()}


def extract_message_text(content: list[dict[str, Any]]) -> str:
    text_parts = [item.get("text", "") for item in content if item.get("type") == "text"]
    return "\n".join(part for part in text_parts if part).strip()


def call_anthropic(system_prompt: str, messages: list[dict[str, Any]], model: str) -> tuple[str, dict[str, Any]]:
    if not ANTHROPIC_API_KEY:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY is not configured")
    anthropic_payload = {
        "model": model,
        "max_tokens": 700,
        "system": system_prompt,
        "messages": messages,
    }
    req = request.Request(
        "https://api.anthropic.com/v1/messages",
        data=json.dumps(anthropic_payload).encode("utf-8"),
        headers={
            "content-type": "application/json",
            "x-api-key": ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
        },
        method="POST",
    )
    with request.urlopen(req, timeout=60) as response:
        response_payload = json.loads(response.read().decode("utf-8"))
    return extract_message_text(response_payload.get("content", [])), response_payload.get("usage", {})


def call_openai(system_prompt: str, messages: list[dict[str, Any]], model: str) -> tuple[str, dict[str, Any]]:
    if not OPENAI_API_KEY:
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY is not configured")
    openai_payload = {
        "model": model,
        "messages": [{"role": "system", "content": system_prompt}, *messages],
        "max_completion_tokens": 700,
    }
    req = request.Request(
        "https://api.openai.com/v1/chat/completions",
        data=json.dumps(openai_payload).encode("utf-8"),
        headers={
            "content-type": "application/json",
            "authorization": f"Bearer {OPENAI_API_KEY}",
        },
        method="POST",
    )
    with request.urlopen(req, timeout=60) as response:
        response_payload = json.loads(response.read().decode("utf-8"))
    choice = response_payload.get("choices", [{}])[0]
    message_content = choice.get("message", {}).get("content", "")
    if isinstance(message_content, list):
        text_parts = [item.get("text", "") for item in message_content if isinstance(item, dict)]
        message = "\n".join(part for part in text_parts if part).strip()
    else:
        message = str(message_content).strip()
    return message, response_payload.get("usage", {})


@app.post("/api/chat")
def chat_with_agent(payload: ChatRequest) -> dict[str, object]:
    claims_json = json.dumps(payload.claims, ensure_ascii=True)
    provider = payload.provider or DEFAULT_LLM_PROVIDER
    model = payload.model or (
        DEFAULT_OPENAI_MODEL if provider == "openai" else DEFAULT_ANTHROPIC_MODEL
    )
    system_prompt = (
        "You are an operations copilot for ValonOS Insurance Claims Module (New Ventures). "
        "Answer only using the claim dataset provided below. Be concise, precise, and auditable. "
        "If the answer requires calculation, show the result clearly. "
        "If data is missing, say so directly.\n\n"
        f"Current claims dataset JSON:\n{claims_json}"
    )
    request_messages = [message.model_dump() for message in payload.messages]

    started = time.perf_counter()
    span_context = TRACER.start_as_current_span("claude.chat.request") if TRACER is not None else None

    if span_context is None:
        span = None
    else:
        span = span_context.__enter__()
        span.set_attribute("llm.vendor", provider)
        span.set_attribute("llm.model", model)
        span.set_attribute("valon.claim_context_size_bytes", len(claims_json.encode("utf-8")))
        span.set_attribute("valon.prompt.system", system_prompt)
        span.set_attribute(
            "valon.prompt.messages_json",
            json.dumps(request_messages, ensure_ascii=True),
        )

    try:
        if provider == "openai":
            message, usage = call_openai(system_prompt, request_messages, model)
        elif provider == "anthropic":
            message, usage = call_anthropic(system_prompt, request_messages, model)
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported provider: {provider}")
        latency_ms = int((time.perf_counter() - started) * 1000)

        if span is not None:
            span.set_attribute("valon.response.text", message)
            span.set_attribute("valon.latency_ms", latency_ms)
            span.set_attribute("llm.usage.input_tokens", usage.get("input_tokens", 0))
            span.set_attribute("llm.usage.output_tokens", usage.get("output_tokens", 0))

        return {
            "message": message,
            "usage": usage,
            "latency_ms": latency_ms,
            "context_size": len(claims_json),
            "provider": provider,
            "model": model,
        }
    except error.HTTPError as exc:
        detail = exc.read().decode("utf-8", "ignore")
        if span is not None and Status is not None and StatusCode is not None:
            span.record_exception(exc)
            span.set_status(Status(StatusCode.ERROR, detail[:500]))
        raise HTTPException(status_code=exc.code, detail=detail or "Anthropic API request failed")
    except Exception as exc:
        if span is not None and Status is not None and StatusCode is not None:
            span.record_exception(exc)
            span.set_status(Status(StatusCode.ERROR, str(exc)[:500]))
        raise HTTPException(status_code=500, detail=str(exc))
    finally:
        if span_context is not None:
            span_context.__exit__(None, None, None)
        if TRACER_PROVIDER is not None:
            try:
                TRACER_PROVIDER.force_flush()
            except Exception:
                pass
