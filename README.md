# ValonOS Insurance Claims Module

## The Problem in One Paragraph

Specialty insurance claims cost $300-500 per claim to process before a dollar of indemnity is paid. That cost comes from vendor sprawl: 6-8 disconnected systems handle intake, triage, document collection, coverage adjudication, repair coordination, and payment. No unified object model means every handoff loses context. No programmable workflow means operators run the process through inboxes, follow-ups, and tribal knowledge. No AI-native layer means adjusters spend roughly 40% of their time chasing status across systems instead of making decisions.

## What This Is

ValonOS applied to motorcycle and boating insurance claims: a unified workflow OS that turns a fragmented claims process into a structured, programmable, AI-native operation.

## The Workflow

Five stages, one object, zero handoff ambiguity.

```text
FNOL Intake → AI Triage → Document Collection → Coverage Check → Resolution
```

### FNOL Intake

This stage decides whether the claim enters the system with enough structured data to move cleanly. It captures claimant, policy, incident, injury, vehicle, and severity data into one claim object that every downstream step can trust.

### AI Triage

This stage decides priority and routing. Injury and severity assign the file to `low`, `medium`, or `high` priority, determine the adjuster path, and separate straight-through claims from files that need immediate human review.

### Document Collection

This stage decides whether the file has enough evidence to adjudicate. Priority sets the checklist, from photos and police reports on simple files to repair estimates, medical records, and legal notices on higher-exposure claims.

### Coverage Check

This stage decides whether the loss fits the policy form, covered peril, and exclusion set. It combines claim facts with policy context to return `approved`, `pending`, or `denied`, and it isolates the files that need manual judgment before money moves.

### Resolution

This stage decides the operational and financial outcome. The adjuster sets the payout path, records notes, closes the file, and pushes the claim into the downstream systems that handle reserves, payments, and reporting.

## The Data Model

```ts
type Claim = {
  claimId: string;
  policyNumber: string;
  claimantName: string;
  incidentDate: string;
  incidentDescription: string;
  injuryInvolved: boolean;
  damageSeverity: "minor" | "moderate" | "severe";
  vehicleMake: string;
  vehicleModel: string;
  vehicleYear: string;
  stage: "fnol" | "triage" | "documents" | "coverage" | "resolution";
  priority: "low" | "medium" | "high";
  documents: string[];
  coverageStatus: "pending" | "approved" | "denied";
  adjusterAssigned: string;
  estimatedPayout: number;
  createdAt: string;
  updatedAt: string;
  notes: string;
  closed: boolean;
};
```

## What's Built

### Claims Pipeline

This is the workflow engine. It moves a claim through five explicit stages, recalculates priority and coverage state on every change, and keeps the file anchored to one canonical object instead of scattered records. That cuts handoff ambiguity and makes the process programmable.

### Task Tracking

This module answers two questions fast: what happens next, and who owns it. Stage state, document requirements, active-claim counts, cycle time, and escalation rate turn the queue into an operating system instead of a status chase.

### Agent Copilot

This is the adjudicator-facing reasoning layer. It injects live claim context, policy data, and workflow state into the model so the agent answers claim-specific questions instead of drifting into generic chat. That matters because adjusters need grounded judgment support, not free-form text generation.

### Observability

This module makes AI usable in a regulated workflow. Every call gets traced, every decision stays inspectable, and supervisors can review what context the model saw, what it returned, and how it behaved over time. That is the difference between an AI demo and an AI system you can actually operate.

## Current vs Planned Integrations

| Current | Planned |
| --- | --- |
| `localStorage` (demo) | Policy Admin System |
| Claude API (agent chat) | Repair Network API |
| Arize Phoenix (tracing) | Medical Provider Records |
|  | Finance/Reserves |
|  | State Regulatory Reporting |
|  | Reinsurer Notifications |

## Why This Matters

- Regulated industries need auditable AI, not AI bolted onto legacy tools.
- ValonOS works by encoding the ontology, making the process programmable, and placing AI inside the structure.
- The same playbook that pushed mortgage servicing from 0% to 60%+ margins applies to insurance.

## What's Next

1. Replace `localStorage` with a real claims database that supports durable multi-user state and system-of-record guarantees.
2. Connect the workflow to a live policy administration API so coverage logic runs on authoritative policy data.
3. Build a compliance-grade audit trail that records claim mutations, operator actions, AI traces, and regulatory reporting outputs.
