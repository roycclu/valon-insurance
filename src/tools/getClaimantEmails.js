// Production: this would call the real Salesforce Service Cloud API via FastAPI proxy
// Current: returns mock data matching the expected response shape

const EMAIL_THREADS = {
  "CLM-260501": [
    {
      date: "2026-05-07T13:02:00Z",
      subject: "Follow-up: certified repair estimate for CLM-260501",
      direction: "outbound",
      summary: "Sarah Chen requested the Brooklyn repair shop estimate needed to finalize payment authority.",
      adjusterName: "Sarah Chen",
    },
    {
      date: "2026-05-05T16:28:00Z",
      subject: "Re: CLM-260501 status update",
      direction: "inbound",
      summary: "Claimant confirmed the motorcycle remains at the shop and the estimate should be ready by Friday.",
      adjusterName: "Sarah Chen",
    },
    {
      date: "2026-05-04T10:14:00Z",
      subject: "Document request for CLM-260501",
      direction: "outbound",
      summary: "Adjuster requested police report and repair estimate to complete the document package.",
      adjusterName: "Sarah Chen",
    },
    {
      date: "2026-05-03T18:20:00Z",
      subject: "Re: Claim acknowledgment CLM-260501",
      direction: "inbound",
      summary: "Claimant acknowledged FNOL receipt and attached scene photos from the BQE shoulder.",
      adjusterName: "Sarah Chen",
    },
    {
      date: "2026-05-03T15:18:00Z",
      subject: "Your claim has been opened: CLM-260501",
      direction: "outbound",
      summary: "Initial FNOL acknowledgment with adjuster contact details and next-step instructions.",
      adjusterName: "Sarah Chen",
    },
  ],
  "CLM-260502": [
    {
      date: "2026-05-07T10:42:00Z",
      subject: "Attorney representation noted for CLM-260502",
      direction: "inbound",
      summary: "Plaintiff attorney confirmed representation and requested all future communications route through counsel.",
      adjusterName: "James Okafor",
    },
    {
      date: "2026-05-06T17:05:00Z",
      subject: "Status update: coverage review on CLM-260502",
      direction: "outbound",
      summary: "Adjuster advised claimant counsel that coverage remains under review pending police report and repair estimate.",
      adjusterName: "James Okafor",
    },
    {
      date: "2026-05-05T13:16:00Z",
      subject: "Request for missing police report and shop estimate",
      direction: "outbound",
      summary: "Documents follow-up flagged two missing items and asked for production within 48 hours.",
      adjusterName: "James Okafor",
    },
    {
      date: "2026-05-04T09:10:00Z",
      subject: "Re: CLM-260502 medical records submission",
      direction: "inbound",
      summary: "Claimant shared urgent care discharge notes and advised she may retain counsel.",
      adjusterName: "James Okafor",
    },
    {
      date: "2026-05-03T19:31:00Z",
      subject: "Claim acknowledgment for CLM-260502",
      direction: "outbound",
      summary: "FNOL acknowledgment summarized severe damage, injury handling, and James Okafor’s direct contact details.",
      adjusterName: "James Okafor",
    },
  ],
  "CLM-260503": [
    {
      date: "2026-05-07T15:28:00Z",
      subject: "Settlement agreement signature reminder",
      direction: "outbound",
      summary: "Sarah Chen asked the claimant to complete DocuSign so payment can be released.",
      adjusterName: "Sarah Chen",
    },
    {
      date: "2026-05-06T12:40:00Z",
      subject: "Re: CLM-260503 payout timing",
      direction: "inbound",
      summary: "Claimant asked when funds would disburse after signing the settlement package.",
      adjusterName: "Sarah Chen",
    },
    {
      date: "2026-05-05T17:08:00Z",
      subject: "Coverage approved on CLM-260503",
      direction: "outbound",
      summary: "Adjuster confirmed the net settlement amount and next steps toward close.",
      adjusterName: "Sarah Chen",
    },
    {
      date: "2026-05-01T10:35:00Z",
      subject: "Repair estimate validated",
      direction: "outbound",
      summary: "Adjuster confirmed the St. George estimate had been reviewed and accepted.",
      adjusterName: "Sarah Chen",
    },
    {
      date: "2026-04-28T14:18:00Z",
      subject: "Claim acknowledgment CLM-260503",
      direction: "outbound",
      summary: "Initial FNOL acknowledgment with required document checklist for the collision file.",
      adjusterName: "Sarah Chen",
    },
  ],
  "CLM-260504": [
    {
      date: "2026-05-07T10:06:00Z",
      subject: "Marina report still outstanding for CLM-260504",
      direction: "outbound",
      summary: "James Okafor followed up with the marina manager and claimant on the missing incident report.",
      adjusterName: "James Okafor",
    },
    {
      date: "2026-05-05T14:30:00Z",
      subject: "Re: weather data and docking claim status",
      direction: "inbound",
      summary: "Claimant confirmed wind gust concerns and asked whether weather evidence was sufficient for coverage.",
      adjusterName: "James Okafor",
    },
    {
      date: "2026-05-03T11:42:00Z",
      subject: "Document request: marina report and marine estimate",
      direction: "outbound",
      summary: "Adjuster requested the official dock incident report and certified marine repair quote.",
      adjusterName: "James Okafor",
    },
    {
      date: "2026-05-02T09:24:00Z",
      subject: "FNOL follow-up for docking collision",
      direction: "outbound",
      summary: "Loss acknowledgment explained the required documentation for the boating file.",
      adjusterName: "James Okafor",
    },
    {
      date: "2026-05-01T18:26:00Z",
      subject: "Your claim has been opened: CLM-260504",
      direction: "outbound",
      summary: "Initial FNOL acknowledgment sent after marina collision was logged.",
      adjusterName: "James Okafor",
    },
  ],
  "CLM-260505": [
    {
      date: "2026-05-07T09:44:00Z",
      subject: "Surveyor appointment confirmed for CLM-260505",
      direction: "outbound",
      summary: "Sarah Chen confirmed the marine surveyor visit that will determine coverage for the engine failure.",
      adjusterName: "Sarah Chen",
    },
    {
      date: "2026-05-04T15:55:00Z",
      subject: "Re: maintenance records submission",
      direction: "inbound",
      summary: "Claimant attached prior service invoices and disputed any suggestion of wear-and-tear neglect.",
      adjusterName: "Sarah Chen",
    },
    {
      date: "2026-05-02T11:10:00Z",
      subject: "Coverage review update on CLM-260505",
      direction: "outbound",
      summary: "Adjuster explained the mechanical breakdown exclusion and the need for survey findings.",
      adjusterName: "Sarah Chen",
    },
    {
      date: "2026-04-29T12:08:00Z",
      subject: "Repair estimate received for engine failure claim",
      direction: "outbound",
      summary: "Adjuster acknowledged receipt of the engine replacement estimate and requested maintenance records.",
      adjusterName: "Sarah Chen",
    },
    {
      date: "2026-04-25T13:22:00Z",
      subject: "Claim acknowledgment CLM-260505",
      direction: "outbound",
      summary: "Initial FNOL acknowledgment for the Coast Guard tow event and engine failure report.",
      adjusterName: "Sarah Chen",
    },
  ],
};

export default async function getClaimantEmails(claimId) {
  const interactions = EMAIL_THREADS[claimId] ?? [];
  return {
    toolName: "getClaimantEmails",
    systemName: "Salesforce Service Cloud",
    sourceLabel: "Salesforce Service Cloud",
    status: "mock",
    resultCount: interactions.length,
    data: interactions,
  };
}
