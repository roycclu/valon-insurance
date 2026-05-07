// Production: these functions would be FastAPI endpoint handlers
// Current: pure JS business logic called directly from React state

export function extractReferencedClaims(text, claims) {
  return claims.filter((claim) => text.includes(claim.claimId)).map((claim) => claim.claimId);
}

export function buildPortfolioContext(claims) {
  return claims.map((claim) => ({
    claimId: claim.claimId,
    claimantName: claim.claimantName,
    assetType: claim.assetType,
    stage: claim.stage,
    adjusterAssigned: claim.adjusterAssigned,
    priority: claim.priority,
  }));
}

export function appendAgentFeed(currentFeed, entry, limit = 12) {
  return [entry, ...currentFeed].slice(0, limit);
}

export function summarizeToolResult(result) {
  if (!result) return "returned 0 results";
  if (Array.isArray(result.data)) {
    return `returned ${result.data.length} ${result.data.length === 1 ? "result" : "results"}`;
  }
  return `returned ${result.resultCount ?? 1} ${(result.resultCount ?? 1) === 1 ? "result" : "results"}`;
}

export function buildToolContext(toolResultsByClaim) {
  const context = {};
  Object.entries(toolResultsByClaim).forEach(([claimId, tools]) => {
    const entries = Object.entries(tools || {});
    if (!entries.length) return;
    context[claimId] = entries.map(([toolId, result]) => ({
      toolId,
      sourceLabel: result.sourceLabel,
      systemName: result.systemName,
      data: result.data,
    }));
  });
  return context;
}
