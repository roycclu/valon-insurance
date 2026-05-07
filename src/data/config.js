export const CLAIMS_STORAGE_KEY = "valon-claims-data-v4";
export const TASKS_STORAGE_KEY = "valon-claims-tasks-v2";
export const CHAT_STORAGE_KEY = "valon-claims-chat-v2";
export const CHAT_CONFIG_STORAGE_KEY = "valon-claims-chat-config-v1";
export const AGENT_FEED_STORAGE_KEY = "valon-agent-feed-v1";
export const AGENT_TOOL_RESULTS_STORAGE_KEY = "valon-agent-tool-results-v1";

export const MODEL_OPTIONS = {
  anthropic: ["claude-sonnet-4-6", "claude-opus-4-6", "claude-haiku-4-5"],
  openai: ["gpt-5", "gpt-4o", "gpt-4o-mini"],
  google: ["gemini-2.5-pro", "gemini-2.5-flash"],
};

export const MODEL_DEFAULTS = Object.fromEntries(
  Object.entries(MODEL_OPTIONS).map(([provider, models]) => [provider, models[0]]),
);

export const STAGES = [
  { id: "fnol", label: "FNOL Intake" },
  { id: "triage", label: "AI Triage" },
  { id: "documents", label: "Document Collection" },
  { id: "coverage", label: "Coverage Check" },
  { id: "resolution", label: "Resolution" },
];

export const INTEGRATIONS = [
  {
    name: "Guidewire ClaimCenter",
    category: "Claims Management",
    status: "connected",
    lastChecked: "May 07, 2026 09:12 UTC",
    description: "Core claims processing and adjudication",
  },
  {
    name: "Guidewire PolicyCenter",
    category: "Policy Administration",
    status: "connected",
    lastChecked: "May 07, 2026 09:10 UTC",
    description: "Policy records, coverage terms, endorsements",
  },
  {
    name: "Salesforce Financial Services Cloud",
    category: "CRM",
    status: "connected",
    lastChecked: "May 07, 2026 09:08 UTC",
    description: "Claimant profiles, service history, NPS",
  },
  {
    name: "ISO ClaimSearch",
    category: "Fraud Detection",
    status: "connected",
    lastChecked: "May 07, 2026 09:05 UTC",
    description: "Cross-carrier claims history and fraud signals",
  },
  {
    name: "Mitchell International",
    category: "Repair Estimating",
    status: "connected",
    lastChecked: "May 07, 2026 08:58 UTC",
    description: "Vehicle damage estimates and repair network",
  },
  {
    name: "Majesco P&C",
    category: "Finance & Reserves",
    status: "pending",
    lastChecked: "May 07, 2026 08:48 UTC",
    description: "Reserve management, payment processing, loss accounting",
  },
  {
    name: "DocuSign",
    category: "Document Management",
    status: "pending",
    lastChecked: "May 07, 2026 08:44 UTC",
    description: "Settlement agreements, claimant e-signatures",
  },
  {
    name: "Verisk Analytics",
    category: "Risk Intelligence",
    status: "pending",
    lastChecked: "May 07, 2026 08:40 UTC",
    description: "Actuarial data, catastrophe modeling, risk scoring",
  },
  {
    name: "State DOI Reporting Portal",
    category: "Regulatory",
    status: "not-configured",
    lastChecked: "Not checked",
    description: "State Department of Insurance compliance submissions",
  },
  {
    name: "Arize Phoenix",
    category: "AI Observability",
    status: "not-configured",
    lastChecked: "Not checked",
    description: "LLM trace logging, prompt evaluation, drift detection",
  },
];
