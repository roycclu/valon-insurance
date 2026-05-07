const POLICY_RECORDS = {
  "CLM-260501": {
    coverageTypes: ["Collision", "Comprehensive", "Uninsured Motorist", "Roadside"],
    limits: ["Collision actual cash value", "Property damage $50,000"],
    deductibles: ["Collision $500", "Comprehensive $250"],
    exclusions: ["Racing events", "Commercial delivery use"],
    premiumAmount: "$1,860 annual",
    paymentStatus: "Paid current",
    renewalDate: "2026-08-14",
    endorsements: ["Roadside assistance", "OEM parts"],
  },
  "CLM-260502": {
    coverageTypes: ["Collision", "Bodily Injury", "Medical Payments"],
    limits: ["Bodily injury $100,000 / $300,000", "Property damage $50,000"],
    deductibles: ["Collision $1,000"],
    exclusions: ["Track use", "Intentional damage", "Mechanical breakdown"],
    premiumAmount: "$2,420 annual",
    paymentStatus: "Paid current",
    renewalDate: "2026-04-02",
    endorsements: ["Accessory coverage", "Rental reimbursement"],
  },
  "CLM-260503": {
    coverageTypes: ["Collision", "Comprehensive", "Accessory coverage"],
    limits: ["Collision actual cash value", "Accessories $3,500"],
    deductibles: ["Collision $500"],
    exclusions: ["Commercial courier use", "Racing events"],
    premiumAmount: "$1,940 annual",
    paymentStatus: "Paid current",
    renewalDate: "2026-11-21",
    endorsements: ["OEM parts", "Trip interruption"],
  },
  "CLM-260504": {
    coverageTypes: ["Hull", "Liability", "Weather event damage"],
    limits: ["Hull agreed value $18,000", "Liability $300,000"],
    deductibles: ["Hull $750"],
    exclusions: ["Racing events", "Intentional grounding"],
    premiumAmount: "$1,280 annual",
    paymentStatus: "Paid current",
    renewalDate: "2026-06-03",
    endorsements: ["Weather rider", "Tow assistance"],
  },
  "CLM-260505": {
    coverageTypes: ["Liability", "Tow reimbursement", "Limited physical damage"],
    limits: ["Liability $200,000", "Tow reimbursement $2,500"],
    deductibles: ["Physical damage $1,000"],
    exclusions: ["Mechanical breakdown", "Wear and tear", "Gradual deterioration"],
    premiumAmount: "$980 annual",
    paymentStatus: "On payment plan - current",
    renewalDate: "2026-03-18",
    endorsements: ["Winter storage layup", "Trailer coverage"],
  },
};

export default function getPolicyDetails(claimId) {
  return {
    toolName: "getPolicyDetails",
    systemName: "Guidewire PolicyCenter",
    sourceLabel: "Guidewire PolicyCenter",
    status: "mock",
    resultCount: 1,
    data: POLICY_RECORDS[claimId] ?? null,
  };
}
