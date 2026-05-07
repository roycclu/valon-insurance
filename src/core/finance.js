// Production: these functions would be FastAPI endpoint handlers
// Current: pure JS business logic called directly from React state

export const FINANCE_METRICS = {
  premiumsWritten: 2400000,
  premiumsEarned: 1800000,
  claimsIncurred: 640000,
  claimsReserved: 280000,
  lossRatio: 35.6,
  expenseRatio: 18.2,
  combinedRatio: 53.8,
  averageClaimSeverity: 8200,
  averagePremiumPerPolicy: 680,
  policiesInForce: 3529,
  claimsFrequency: 4.2,
};

export const MONTHLY_FINANCIALS = [
  { month: "Nov", premiums: 280000, claims: 92000 },
  { month: "Dec", premiums: 295000, claims: 101000 },
  { month: "Jan", premiums: 305000, claims: 109000 },
  { month: "Feb", premiums: 292000, claims: 98000 },
  { month: "Mar", premiums: 318000, claims: 116000 },
  { month: "Apr", premiums: 310000, claims: 124000 },
];

export const RESERVE_BY_PRIORITY = {
  high: 15000,
  medium: 6000,
  low: 2000,
};

export function combinedRatioTone(value) {
  if (value < 60) return "good";
  if (value <= 90) return "warning";
  return "critical";
}

export function buildFinanceView(claims) {
  const openClaims = claims.filter((claim) => !claim.closed);
  const reserveByPriority = Object.entries(RESERVE_BY_PRIORITY).map(([priority, averageReserve]) => {
    const openCount = openClaims.filter((claim) => claim.priority === priority).length;
    return {
      priority,
      openCount,
      averageReserve,
      totalReserve: openCount * averageReserve,
    };
  });
  const totalReserveRequirement = reserveByPriority.reduce((sum, tier) => sum + tier.totalReserve, 0);
  const reserveCoverageRatio = totalReserveRequirement ? FINANCE_METRICS.claimsReserved / totalReserveRequirement : 0;
  return {
    ...FINANCE_METRICS,
    reserveByPriority,
    totalReserveRequirement,
    reserveCoverageRatio,
  };
}
