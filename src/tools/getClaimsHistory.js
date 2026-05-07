// Production: this would call the real Guidewire ClaimCenter API via FastAPI proxy
// Current: returns mock data matching the expected response shape

const CLAIMS_HISTORY = {
  "CLM-260501": [
    { claimId: "CLM-240188", date: "2024-11-12", type: "Parking lot tip-over", payout: "$980", status: "Closed", fraudFlag: false },
  ],
  "CLM-260502": [
    { claimId: "CLM-231004", date: "2023-07-04", type: "Glass replacement inquiry", payout: "$0", status: "Closed without payment", fraudFlag: false },
  ],
  "CLM-260503": [
    { claimId: "CLM-240002", date: "2024-01-15", type: "Hit while parked", payout: "$2,150", status: "Closed", fraudFlag: false },
    { claimId: "CLM-220844", date: "2022-09-22", type: "Weather-related vandalism", payout: "$1,280", status: "Closed", fraudFlag: false },
  ],
  "CLM-260504": [],
  "CLM-260505": [
    { claimId: "CLM-230677", date: "2023-08-11", type: "Trailer scrape", payout: "$650", status: "Closed", fraudFlag: false },
  ],
};

export default async function getClaimsHistory(claimId) {
  const history = CLAIMS_HISTORY[claimId] ?? [];
  return {
    toolName: "getClaimsHistory",
    systemName: "Guidewire ClaimCenter",
    sourceLabel: "Guidewire ClaimCenter",
    status: "mock",
    resultCount: history.length,
    data: history,
  };
}
