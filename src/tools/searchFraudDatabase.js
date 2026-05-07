const FRAUD_RESULTS = {
  "CLM-260501": {
    fraudRiskScore: 11,
    priorClaimsAcrossCarriers: 1,
    flaggedPatterns: [],
    priorSoftFraudIndicators: ["No significant cross-carrier concerns identified"],
  },
  "CLM-260502": {
    fraudRiskScore: 34,
    priorClaimsAcrossCarriers: 2,
    flaggedPatterns: ["Attorney retained within 72 hours", "High-severity claim with municipal liability angle"],
    priorSoftFraudIndicators: ["No confirmed fraud history", "Escalate only if police report conflicts with medical narrative"],
  },
  "CLM-260503": {
    fraudRiskScore: 18,
    priorClaimsAcrossCarriers: 3,
    flaggedPatterns: [],
    priorSoftFraudIndicators: ["Normal claim frequency for policy tenure"],
  },
  "CLM-260504": {
    fraudRiskScore: 22,
    priorClaimsAcrossCarriers: 0,
    flaggedPatterns: ["Weather corroboration reduces staging concern"],
    priorSoftFraudIndicators: ["No adverse ISO history located"],
  },
  "CLM-260505": {
    fraudRiskScore: 47,
    priorClaimsAcrossCarriers: 2,
    flaggedPatterns: ["Mechanical failure claims can mask maintenance neglect"],
    priorSoftFraudIndicators: ["No hard fraud markers", "Review maintenance record continuity carefully"],
  },
};

export default function searchFraudDatabase(claimId) {
  return {
    toolName: "searchFraudDatabase",
    systemName: "ISO ClaimSearch",
    sourceLabel: "ISO ClaimSearch",
    status: "mock",
    resultCount: 1,
    data: FRAUD_RESULTS[claimId] ?? null,
  };
}
