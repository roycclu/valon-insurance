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
  { name: "Policy Admin System", status: "connected", lastChecked: "May 07, 2026 09:12 UTC" },
  { name: "Repair Network API", status: "connected", lastChecked: "May 07, 2026 09:10 UTC" },
  { name: "Medical Providers", status: "pending", lastChecked: "May 07, 2026 08:54 UTC" },
  { name: "Finance / Reserves", status: "connected", lastChecked: "May 07, 2026 09:08 UTC" },
  { name: "State Regulatory Reporting", status: "pending", lastChecked: "May 07, 2026 08:48 UTC" },
  { name: "Reinsurer Notifications", status: "not-configured", lastChecked: "Not checked" },
  { name: "Arize Phoenix (Observability)", status: "not-configured", lastChecked: "Not checked" },
];
