# ValonOS Insurance Claims Module Demo

## Overview

This demo was built to demonstrate how ValonOS principles, structured workflows, programmable processes, and AI-native operations apply to motorcycle and boating insurance claims processing. It turns claims handling into an explicit operating system rather than a loose collection of forms, inboxes, and point integrations. The current implementation focuses on the core claims lifecycle: intake, triage, document collection, coverage review, and resolution. In practice, that means a senior operator can see where a claim is, what decision was made, what data informed it, and which downstream systems need to be touched next.

## The Problem

Claims processing in specialty insurance is still dominated by legacy systems such as Guidewire and Duck Creek, plus a long tail of spreadsheets, adjuster notes, repair network portals, medical record exchanges, and finance tooling. Those systems were built for transaction capture, not for AI-native operations. As a result, the operating model is fragmented: first notice of loss lives in one place, coverage context in another, repair coordination somewhere else, and reserves or payment workflows in yet another system. There is no unified operating layer that can reason over the claim as a single object, drive the next action programmatically, or make AI outputs auditable by default. That fragmentation creates high manual overhead and contributes to a processing cost that often lands in the $300 to $500 range per claim before indemnity is even considered.

## Workflow & Ontology

The module models claims processing as a five-stage pipeline. Each stage has a defined input shape, a bounded decision surface, and a clear set of systems or operators involved. That is the core ValonOS pattern: encode operational work as a structured workflow over a stable domain object.

```text
FNOL Intake -> AI Triage -> Document Collection -> Coverage Check -> Resolution
```

### 1. FNOL Intake

FNOL captures the initial operational record. Inputs include claimant identity, policy number, incident date, narrative description, injury flag, vehicle details, and damage severity. The system creates the claim object, timestamps it, assigns a claim identifier, and establishes the initial workflow stage. In production, this stage would typically touch a customer portal, contact center tooling, or an intake API connected to policy administration.

### 2. AI Triage

Triage converts raw incident facts into an operational priority. In the demo, injury involvement and damage severity drive a deterministic priority assignment of `low`, `medium`, or `high`, along with reasoning that explains the outcome. The decision surface is deliberately simple: bodily injury and severe damage escalate immediately, while lower-severity claims remain candidates for streamlined handling. The systems touched here are the workflow engine, adjuster routing logic, and eventually the chat or reasoning layer that supports claim review.

### 3. Document Collection

Document collection translates priority into evidence requirements. Low-priority claims require a small baseline set, while medium- and high-priority claims add repair, medical, or legal artifacts. The system tracks which documents are required, which have been received, and whether the file is ready to proceed. In a real deployment this stage would coordinate with repair networks, claimant upload flows, police report retrieval, and medical provider records.

### 4. Coverage Check

Coverage review evaluates the claim against policy form, covered peril, and exclusions. The demo uses seeded policy records to derive a coverage status of `approved`, `pending`, or `denied`, plus a human-readable determination. The decision combines policy metadata with claim facts and flags cases that need manual review because of severity, injury exposure, or possible exclusions. This stage would connect directly to the policy administration system and any supporting rules or underwriting data required for adjudication.

### 5. Resolution

Resolution is where the operational claim becomes a financial and customer outcome. The adjuster records estimated payout, adds notes, closes the claim, and advances the file into a final state. In production, this stage would branch into reserves, payment processing, salvage or subrogation workflows, customer communications, and regulatory reporting. The important design choice is that resolution is not a separate toolchain; it is the terminal stage of the same structured claim object.

## Data Model

The front-end demo centers on a single claim object persisted in browser storage and mutated as the claim advances through the workflow. The schema below reflects the canonical object used in the React workstation.

```ts
type Claim = {
  claimId: string;                 // Unique claim identifier, e.g. CLM-260501
  policyNumber: string;            // Policy reference used for coverage lookup
  claimantName: string;            // Named insured or claimant display name
  incidentDate: string;            // ISO date of loss, e.g. 2026-05-03
  incidentDescription: string;     // Free-text narrative of the loss event
  injuryInvolved: boolean;         // Whether bodily injury is part of the claim
  damageSeverity: "minor" | "moderate" | "severe";
                                   // Coarse severity signal used by triage
  vehicleMake: string;             // Motorcycle or boat manufacturer
  vehicleModel: string;            // Vehicle model designation
  vehicleYear: string;             // Model year stored as a string for UI entry
  stage: "fnol" | "triage" | "documents" | "coverage" | "resolution";
                                   // Active workflow stage
  priority: "low" | "medium" | "high";
                                   // Triage output used for routing and doc rules
  documents: string[];             // Received document labels for checklist tracking
  coverageStatus: "pending" | "approved" | "denied";
                                   // Current coverage disposition
  adjusterAssigned: string;        // Operator currently responsible for the file
  estimatedPayout: number;         // Draft indemnity estimate in dollars
  createdAt: string;               // ISO timestamp for claim creation
  updatedAt: string;               // ISO timestamp for last mutation
  notes: string;                   // Operator notes and closure commentary
  closed: boolean;                 // Terminal open/closed state
};
```

The FastAPI layer in `api/index.py` exposes the same operating concepts with a slightly richer nested representation for triage, document status, coverage detail, escalation state, and per-stage timings. That backend model is useful for APIs and observability because it preserves not just the claim state, but the reasoning artifacts that produced it.

## Modules

### Claims Pipeline

The claims pipeline is the core workflow engine. It encodes the five-stage claim lifecycle, stores the active stage on the claim object, and recalculates derived attributes such as priority, coverage status, and adjuster assignment as the file changes. Technically, the React client manages this state locally, while the FastAPI backend demonstrates the same logic through API endpoints and structured claim records.

### Task Tracking

Task tracking is implemented through stage progression, required-document checklists, and operational status indicators such as active claims, average cycle time, escalation rate, and claims by stage. It matters because claims work is not just about storing a file; it is about knowing what remains to be done, by whom, and with what SLA implications. The demo expresses that as deterministic workflow state rather than as ad hoc human memory.

### Agent Chat Interface

The agent chat interface is the adjudicator-facing reasoning layer. Its role is to let an operator interrogate a claim in natural language without losing the structured context of the file. Technically, the pattern is straightforward: inject the current claim object, policy context, and workflow state into the model prompt; preserve multi-turn conversation state; and constrain the agent to claim-relevant tasks such as summarization, next-step guidance, coverage reasoning support, and document gap analysis.

### Observability

Observability captures how the system is behaving, both operationally and, in the AI path, inferentially. For the workflow layer, that means stage counts, cycle times, escalations, and status distributions. For the agent layer, that means tracing prompt inputs, context payloads, outputs, latency, and failure modes so the team can debug behavior, evaluate quality, and satisfy audit expectations in a regulated environment.

## Integrations (Current & Planned)

The current demo implementation persists claims in `localStorage`, which is enough to demonstrate stateful workflow progression in a self-contained workstation. The intended current AI and observability surfaces are a Claude-backed chat agent for operator interaction and Arize Phoenix for tracing and evaluation of model calls. In this repository, the persistence layer is implemented directly, while the agent and tracing integrations represent the target interface pattern for the next deployment step.

Planned integrations are the systems that turn the demo into an actual claims operating layer: a policy administration system for authoritative coverage data, a repair network API for estimates and repair coordination, medical provider records for injury claims, finance and reserves systems for loss accounting and payment flow, state regulatory reporting for compliance submissions, and reinsurer notifications for files that cross attachment or reporting thresholds.

## AI Agent Design

The claims agent is designed as a context-grounded adjudication assistant, not a free-form chatbot. Each interaction is anchored on the live claim object, relevant policy data, document status, workflow stage, and prior operator messages. That gives the model enough context to answer practical questions such as: What is missing before coverage review? Why was this claim escalated? What facts suggest a manual coverage review? Summarize the file for handoff. Draft an adjuster note. This pattern matters because adjudicators do not need generic language generation; they need fast, context-aware reasoning over a structured claim with clear boundaries around what the model can and cannot infer.

## Observability

Every AI call in a regulated workflow should be traced because claims decisions are not disposable interactions. They affect coverage handling, financial exposure, customer outcomes, and downstream compliance obligations. Arize Phoenix is the right shape of tool for this layer because it captures prompt and response payloads, context windows, latency, token usage, traces across calls, and evaluation signals that help teams inspect quality and drift over time. In practice, that means a supervisor can answer not just what the agent said, but what data it saw, why it produced that answer, and whether similar files are behaving consistently. That auditability is essential when AI is participating in adjudication-adjacent work.

## What's Next

The first production step is replacing `localStorage` with a real claims database so the system has durable multi-user state, queryability, and a trustworthy system of record. The second is connecting to an actual policy administration system via API so coverage decisions are grounded in live policy data rather than seeded demo fixtures. The third is building a compliance-grade audit trail that records claim mutations, operator actions, AI traces, and reporting outputs in a form suitable for regulatory review.

## Why This Matters for Regulated Industries

The broader point is not insurance alone. Regulated industries need systems that are structured, auditable, and AI-native from first principles. Bolting an LLM onto legacy workflow software does not solve the underlying operating problem, because the system still lacks a unified object model, explicit decision stages, and traceable process logic. ValonOS is the opposite approach: define the workflow, encode the ontology, make the process programmable, and then place AI inside that structure where it can be useful, inspectable, and safe to operate.
