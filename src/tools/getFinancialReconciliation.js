const FINANCIALS = {
  "CLM-260501": {
    reserveAmount: "$2,750",
    paymentsMadeToDate: "$0",
    outstandingBalance: "$2,400",
    paymentSchedule: ["Awaiting final shop estimate before one-time settlement payment"],
    subrogationRecoveryStatus: "No subrogation potential identified",
  },
  "CLM-260502": {
    reserveAmount: "$18,500",
    paymentsMadeToDate: "$1,200 medical advance",
    outstandingBalance: "$17,300",
    paymentSchedule: ["Medical reimbursement review after additional records", "Property damage payment pending estimate"],
    subrogationRecoveryStatus: "Potential municipal recovery if pothole claim is substantiated",
  },
  "CLM-260503": {
    reserveAmount: "$4,500",
    paymentsMadeToDate: "$0",
    outstandingBalance: "$4,200",
    paymentSchedule: ["Single settlement disbursement queued after claimant signature"],
    subrogationRecoveryStatus: "Carrier pursuing contribution from delivery vehicle insurer",
  },
  "CLM-260504": {
    reserveAmount: "$7,200",
    paymentsMadeToDate: "$0",
    outstandingBalance: "$6,500",
    paymentSchedule: ["Hull payment pending marina report and repair estimate"],
    subrogationRecoveryStatus: "No external recovery opened",
  },
  "CLM-260505": {
    reserveAmount: "$1,800",
    paymentsMadeToDate: "$0",
    outstandingBalance: "$0 pending coverage decision",
    paymentSchedule: ["No payment scheduled until surveyor findings complete"],
    subrogationRecoveryStatus: "No subrogation opportunity currently identified",
  },
};

export default function getFinancialReconciliation(claimId) {
  return {
    toolName: "getFinancialReconciliation",
    systemName: "Majesco",
    sourceLabel: "Majesco",
    status: "mock",
    resultCount: 1,
    data: FINANCIALS[claimId] ?? null,
  };
}
