from __future__ import annotations

from copy import deepcopy
from dataclasses import dataclass
from datetime import datetime, timezone
from statistics import mean
from typing import Literal
from uuid import uuid4

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field


app = FastAPI(title="Motorcycle Claims Workflow API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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

