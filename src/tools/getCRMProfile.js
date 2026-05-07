const CRM_RECORDS = {
  "CLM-260501": {
    contactInfo: {
      email: "marcus.rivera@example.com",
      phone: "(718) 555-0139",
      preferredChannel: "SMS + Email",
      mailingAddress: "Brooklyn, NY 11217",
    },
    policyHistory: ["MC-204812 active since 2022", "Added roadside endorsement in 2025"],
    priorClaimsCount: 1,
    customerSinceDate: "2022-08-14",
    npsScore: 58,
    openServiceTickets: 0,
    assignedAccountManager: "Dana Hoffman",
  },
  "CLM-260502": {
    contactInfo: {
      email: "elena.park@example.com",
      phone: "(917) 555-0188",
      preferredChannel: "Attorney routed email",
      mailingAddress: "Astoria, NY 11103",
    },
    policyHistory: ["MC-198341 active since 2021", "Accident forgiveness removed at last renewal"],
    priorClaimsCount: 0,
    customerSinceDate: "2021-04-02",
    npsScore: 41,
    openServiceTickets: 2,
    assignedAccountManager: "Melissa Tran",
  },
  "CLM-260503": {
    contactInfo: {
      email: "thomas.nguyen@example.com",
      phone: "(347) 555-0150",
      preferredChannel: "Email",
      mailingAddress: "Staten Island, NY 10314",
    },
    policyHistory: ["MC-201567 active since 2019", "Increased collision limits in 2024"],
    priorClaimsCount: 2,
    customerSinceDate: "2019-11-21",
    npsScore: 66,
    openServiceTickets: 1,
    assignedAccountManager: "Dana Hoffman",
  },
  "CLM-260504": {
    contactInfo: {
      email: "dominique.osei@example.com",
      phone: "(646) 555-0144",
      preferredChannel: "Phone",
      mailingAddress: "Harlem, NY 10027",
    },
    policyHistory: ["BT-334821 active since 2023", "Weather rider endorsement added 2025"],
    priorClaimsCount: 0,
    customerSinceDate: "2023-06-03",
    npsScore: 71,
    openServiceTickets: 0,
    assignedAccountManager: "Keisha Morgan",
  },
  "CLM-260505": {
    contactInfo: {
      email: "rachel.steinberg@example.com",
      phone: "(212) 555-0108",
      preferredChannel: "Email",
      mailingAddress: "New York, NY 10024",
    },
    policyHistory: ["BT-298043 active since 2020", "Storage layup endorsement added 2024"],
    priorClaimsCount: 1,
    customerSinceDate: "2020-03-18",
    npsScore: 52,
    openServiceTickets: 1,
    assignedAccountManager: "Keisha Morgan",
  },
};

export default function getCRMProfile(claimId) {
  return {
    toolName: "getCRMProfile",
    systemName: "Salesforce Financial Services Cloud",
    sourceLabel: "Salesforce FSC",
    status: "mock",
    resultCount: 1,
    data: CRM_RECORDS[claimId] ?? null,
  };
}
