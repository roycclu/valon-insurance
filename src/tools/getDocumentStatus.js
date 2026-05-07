// Production: this would call the real Box API via FastAPI proxy
// Current: returns mock data matching the expected response shape

const DOCUMENTS = {
  "CLM-260501": [
    { name: "Accident Photos", requested: true, received: true, uploadTimestamp: "2026-05-03T18:14:00Z", pending: false, authenticityFlag: "Verified EXIF metadata" },
    { name: "Police Report", requested: true, received: true, uploadTimestamp: "2026-05-04T09:26:00Z", pending: false, authenticityFlag: "Validated against NYPD report number" },
    { name: "Repair Estimate", requested: true, received: false, uploadTimestamp: null, pending: true, authenticityFlag: "Pending upload" },
  ],
  "CLM-260502": [
    { name: "Accident Photos", requested: true, received: true, uploadTimestamp: "2026-05-03T20:01:00Z", pending: false, authenticityFlag: "Image chain intact" },
    { name: "Police Report", requested: true, received: false, uploadTimestamp: null, pending: true, authenticityFlag: "Pending upload" },
    { name: "Medical Records", requested: true, received: true, uploadTimestamp: "2026-05-04T09:08:00Z", pending: false, authenticityFlag: "Facility letterhead verified" },
    { name: "Legal Notice", requested: true, received: true, uploadTimestamp: "2026-05-06T16:35:00Z", pending: false, authenticityFlag: "Attorney signature verified" },
    { name: "Repair Estimate", requested: true, received: false, uploadTimestamp: null, pending: true, authenticityFlag: "Pending upload" },
  ],
  "CLM-260503": [
    { name: "Accident Photos", requested: true, received: true, uploadTimestamp: "2026-04-28T14:20:00Z", pending: false, authenticityFlag: "Verified" },
    { name: "Police Report", requested: true, received: true, uploadTimestamp: "2026-04-29T08:55:00Z", pending: false, authenticityFlag: "Validated" },
    { name: "Repair Estimate", requested: true, received: true, uploadTimestamp: "2026-05-01T10:18:00Z", pending: false, authenticityFlag: "Shop certificate verified" },
    { name: "Settlement Agreement", requested: true, received: false, uploadTimestamp: null, pending: true, authenticityFlag: "Awaiting claimant e-sign" },
  ],
  "CLM-260504": [
    { name: "Incident Photos", requested: true, received: true, uploadTimestamp: "2026-05-01T18:31:00Z", pending: false, authenticityFlag: "Dockside metadata verified" },
    { name: "Marina Incident Report", requested: true, received: false, uploadTimestamp: null, pending: true, authenticityFlag: "Pending upload" },
    { name: "Marine Repair Estimate", requested: true, received: false, uploadTimestamp: null, pending: true, authenticityFlag: "Pending upload" },
    { name: "Weather Data Pull", requested: true, received: true, uploadTimestamp: "2026-05-02T09:06:00Z", pending: false, authenticityFlag: "NOAA data source confirmed" },
  ],
  "CLM-260505": [
    { name: "Tow Record", requested: true, received: true, uploadTimestamp: "2026-04-25T14:02:00Z", pending: false, authenticityFlag: "USCG log verified" },
    { name: "Maintenance Records", requested: true, received: true, uploadTimestamp: "2026-05-04T15:50:00Z", pending: false, authenticityFlag: "Service invoices consistent" },
    { name: "Marine Surveyor Inspection", requested: true, received: false, uploadTimestamp: null, pending: true, authenticityFlag: "Pending upload" },
    { name: "Repair Estimate", requested: true, received: true, uploadTimestamp: "2026-04-29T12:02:00Z", pending: false, authenticityFlag: "Vendor estimate signed" },
  ],
};

export default async function getDocumentStatus(claimId) {
  const docs = DOCUMENTS[claimId] ?? [];
  return {
    toolName: "getDocumentStatus",
    systemName: "Box",
    sourceLabel: "Box",
    status: "mock",
    resultCount: docs.length,
    data: docs,
  };
}
