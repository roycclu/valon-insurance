// Production: these functions would be FastAPI endpoint handlers
// Current: pure JS business logic called directly from React state

import { POLICY_DETAILS } from "../data/claims";
import { STAGES } from "../data/config";
import { formatCurrency } from "../utils/format";
import { buildFinanceView as financeBuildFinanceView } from "./finance";

export function derivePriority(claim) {
  if (claim.priority) {
    return {
      priority: claim.priority,
      reasoning:
        claim.priority === "high"
          ? "High-priority handling due to injury exposure, severity, or legal complexity."
          : claim.priority === "medium"
            ? "Medium-priority handling due to repair coordination and moderate exposure."
            : "Low-priority handling due to straightforward facts and limited exposure.",
    };
  }
  if (claim.injuryInvolved) {
    return {
      priority: "high",
      reasoning: "Bodily injury triggers high-priority handling and immediate adjuster involvement.",
    };
  }
  if (claim.damageSeverity === "severe") {
    return {
      priority: "high",
      reasoning: "Severe damage suggests material indemnity exposure and expedited review.",
    };
  }
  if (claim.damageSeverity === "moderate") {
    return {
      priority: "medium",
      reasoning: "Moderate damage requires repair coordination and standard adjuster handling.",
    };
  }
  return {
    priority: "low",
    reasoning: "Minor damage with no injury fits streamlined handling.",
  };
}

export function deriveCoverage(claim) {
  const policy = POLICY_DETAILS[claim.policyNumber] ?? POLICY_DETAILS["MC-204812"];
  if (claim.coverageStatus || claim.coverageReason) {
    return {
      status: claim.coverageStatus ?? "pending",
      reason: claim.coverageReason ?? policy.determination,
      policy,
    };
  }
  if (!policy.covered) {
    return {
      status: "denied",
      reason: "Incident profile does not align to covered peril under the current policy form.",
      policy,
    };
  }
  if (claim.injuryInvolved || claim.priority === "high") {
    return {
      status: "pending",
      reason: "Coverage appears available, but severity and injury facts require manual review.",
      policy,
    };
  }
  return {
    status: "approved",
    reason: "Policy coverage aligns with reported incident and no hard exclusion is triggered.",
    policy,
  };
}

export function stageIndex(stage) {
  return STAGES.findIndex((item) => item.id === stage);
}

export function nextStage(stage) {
  const index = stageIndex(stage);
  return STAGES[Math.min(index + 1, STAGES.length - 1)]?.id ?? "resolution";
}

export function stageLabel(stage) {
  return STAGES.find((item) => item.id === stage)?.label ?? stage;
}

export function buildClaim(input, existing = {}) {
  const now = new Date().toISOString();
  const triage = derivePriority({ ...existing, ...input });
  const coverage = deriveCoverage({
    ...existing,
    ...input,
    priority: input.priority ?? existing.priority ?? triage.priority,
  });
  const requiredDocuments = input.requiredDocuments ?? existing.requiredDocuments ?? ["Accident Photos", "Police Report"];
  const documentChecklist =
    input.documentChecklist ??
    existing.documentChecklist ??
    requiredDocuments.map((name) => ({ name, status: "pending", notes: "" }));

  return {
    ...existing,
    ...input,
    priority: input.priority ?? existing.priority ?? triage.priority,
    coverageStatus: input.coverageStatus ?? existing.coverageStatus ?? coverage.status,
    coverageReason: input.coverageReason ?? existing.coverageReason ?? coverage.reason,
    requiredDocuments,
    documentChecklist,
    updatedAt: input.updatedAt ?? now,
    createdAt: existing.createdAt || input.createdAt || now,
    claimId: existing.claimId || input.claimId || `CLM-${Math.floor(100000 + Math.random() * 900000)}`,
    adjusterAssigned: input.adjusterAssigned ?? existing.adjusterAssigned ?? "Unassigned",
    payoutLabel:
      input.payoutLabel ??
      existing.payoutLabel ??
      (typeof input.estimatedPayout === "number" ? formatCurrency(input.estimatedPayout) : "TBD"),
    timeline: input.timeline ?? existing.timeline ?? [],
    closed: input.closed ?? existing.closed ?? false,
  };
}

function calculateAverageStageHours(claims, stage) {
  const stageClaims = claims.filter((claim) => claim.stage === stage && !claim.closed);
  if (!stageClaims.length) return "0.0";
  const totalHours = stageClaims.reduce((sum, claim) => {
    const updated = new Date(claim.updatedAt).getTime();
    const created = new Date(claim.createdAt).getTime();
    return sum + Math.max(1, (updated - created) / (1000 * 60 * 60));
  }, 0);
  return (totalHours / stageClaims.length).toFixed(1);
}

export function calculateMetrics(claims) {
  const activeClaims = claims.filter((claim) => !claim.closed).length;
  const stageCounts = STAGES.reduce((accumulator, stage) => {
    accumulator[stage.id] = claims.filter((claim) => claim.stage === stage.id && !claim.closed).length;
    return accumulator;
  }, {});
  const cycleTimes = claims.map((claim) => {
    const start = new Date(claim.createdAt).getTime();
    const end = new Date(claim.updatedAt).getTime();
    return Math.max(0, (end - start) / (1000 * 60 * 60 * 24));
  });
  const averageCycleTime = cycleTimes.length
    ? (cycleTimes.reduce((sum, value) => sum + value, 0) / cycleTimes.length).toFixed(1)
    : "0.0";
  const escalationRate = claims.length
    ? Math.round((claims.filter((claim) => claim.priority === "high").length / claims.length) * 100)
    : 0;
  const avgTriageHours = calculateAverageStageHours(claims, "triage");
  return { activeClaims, stageCounts, averageCycleTime, escalationRate, avgTriageHours };
}

export function buildSystemHealth(integrations) {
  const counts = integrations.reduce(
    (accumulator, integration) => {
      accumulator[integration.status] += 1;
      return accumulator;
    },
    { connected: 0, pending: 0, "not-configured": 0 },
  );
  let overallStatus = "Operational";
  if (counts.connected === 0 && counts.pending === 0) {
    overallStatus = "Not Configured";
  } else if (counts.pending > 0 || counts["not-configured"] > 0) {
    overallStatus = "Degraded";
  }
  return { counts, overallStatus };
}

export const buildFinanceView = financeBuildFinanceView;
