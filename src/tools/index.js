import getClaimantEmails from "./getClaimantEmails";
import getCRMProfile from "./getCRMProfile";
import getPolicyDetails from "./getPolicyDetails";
import getClaimsHistory from "./getClaimsHistory";
import getFinancialReconciliation from "./getFinancialReconciliation";
import getDocumentStatus from "./getDocumentStatus";
import searchFraudDatabase from "./searchFraudDatabase";

export const toolRegistry = [
  {
    id: "getClaimantEmails",
    label: "Claimant Emails",
    systemName: "Salesforce Service Cloud",
    status: "mock",
    sourceLabel: "Salesforce Service Cloud",
    run: getClaimantEmails,
  },
  {
    id: "getCRMProfile",
    label: "CRM Profile",
    systemName: "Salesforce Financial Services Cloud",
    status: "mock",
    sourceLabel: "Salesforce FSC",
    run: getCRMProfile,
  },
  {
    id: "getPolicyDetails",
    label: "Policy Details",
    systemName: "Guidewire PolicyCenter",
    status: "mock",
    sourceLabel: "Guidewire PolicyCenter",
    run: getPolicyDetails,
  },
  {
    id: "getClaimsHistory",
    label: "Claims History",
    systemName: "Guidewire ClaimCenter",
    status: "mock",
    sourceLabel: "Guidewire ClaimCenter",
    run: getClaimsHistory,
  },
  {
    id: "getFinancialReconciliation",
    label: "Financial Reconciliation",
    systemName: "Majesco",
    status: "mock",
    sourceLabel: "Majesco",
    run: getFinancialReconciliation,
  },
  {
    id: "getDocumentStatus",
    label: "Document Status",
    systemName: "Box",
    status: "mock",
    sourceLabel: "Box",
    run: getDocumentStatus,
  },
  {
    id: "searchFraudDatabase",
    label: "Fraud Search",
    systemName: "ISO ClaimSearch",
    status: "mock",
    sourceLabel: "ISO ClaimSearch",
    run: searchFraudDatabase,
  },
];

export {
  getClaimantEmails,
  getCRMProfile,
  getPolicyDetails,
  getClaimsHistory,
  getFinancialReconciliation,
  getDocumentStatus,
  searchFraudDatabase,
};
