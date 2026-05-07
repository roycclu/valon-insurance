// Production: these functions would be FastAPI endpoint handlers
// Current: pure JS business logic called directly from React state

export function buildTaskId(claim, title) {
  return `${claim.claimId}:${claim.stage}:${title}`;
}

export function documentStatusMissingCount(claim) {
  return claim.documentChecklist.filter((item) => item.status !== "received").length;
}

export function daysSince(timestamp) {
  const milliseconds = Date.now() - new Date(timestamp).getTime();
  return Math.max(0, Math.round(milliseconds / 86400000));
}

export function buildAgentPrompt(task, claim) {
  const delayDays = daysSince(claim.updatedAt);
  const missingDocs = claim.documentChecklist
    .filter((item) => item.status !== "received")
    .map((item) => item.name)
    .join(" and ");
  if (task.stage === "documents") {
    return `${claim.claimId} is missing ${missingDocs || "required documents"}. What's the best way to follow up with the claimant given the ${claim.priority} priority and ${delayDays}-day delay?`;
  }
  if (task.stage === "coverage") {
    return `${claim.claimId} is in coverage review with this issue: ${claim.issue}. What should the adjuster do next, and what decision risks should they document?`;
  }
  if (task.stage === "resolution") {
    return `${claim.claimId} is ready for resolution but still blocked by ${claim.issue}. Draft the next adjuster action and a claimant-facing follow-up note.`;
  }
  return `Review ${claim.claimId}. What is the next best operational action for the adjuster on this file?`;
}

export function buildTasks(claims, taskStatuses) {
  return claims
    .filter((claim) => !claim.closed && claim.stage !== "fnol")
    .flatMap((claim) => {
      let items = [];
      if (claim.stage === "documents") {
        const missingDocs = claim.documentChecklist.filter((item) => item.status !== "received").map((item) => item.name);
        items = [
          {
            title: missingDocs.length ? `Collect ${missingDocs.join(" + ")}` : "Confirm document package completeness",
            dueDate: new Date(new Date(claim.updatedAt).getTime() + 2 * 86400000).toISOString(),
          },
          {
            title: "Claimant follow-up",
            dueDate: new Date(new Date(claim.updatedAt).getTime() + 1 * 86400000).toISOString(),
          },
        ];
      } else if (claim.stage === "coverage") {
        items = [
          {
            title: "Coverage decision review",
            dueDate: new Date(new Date(claim.updatedAt).getTime() + 1 * 86400000).toISOString(),
          },
          {
            title: "Escalate issue note",
            dueDate: new Date(new Date(claim.updatedAt).getTime() + 1 * 86400000).toISOString(),
          },
        ];
      } else if (claim.stage === "resolution") {
        items = [
          {
            title: "Close settlement package",
            dueDate: new Date(new Date(claim.updatedAt).getTime() + 1 * 86400000).toISOString(),
          },
        ];
      } else if (claim.stage === "triage") {
        items = [
          {
            title: "Confirm triage disposition",
            dueDate: new Date(new Date(claim.updatedAt).getTime() + 1 * 86400000).toISOString(),
          },
        ];
      }

      return items.map((item) => {
        const id = buildTaskId(claim, item.title);
        const status = taskStatuses[id] ?? "pending";
        return {
          id,
          title: item.title,
          claimId: claim.claimId,
          stage: claim.stage,
          dueDate: item.dueDate,
          adjusterAssigned: claim.adjusterAssigned,
          status,
          overdue: status !== "done" && new Date(item.dueDate).getTime() < Date.now(),
          prompt: buildAgentPrompt({ stage: claim.stage, title: item.title }, claim),
        };
      });
    });
}
