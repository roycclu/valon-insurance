import { useEffect, useMemo, useState } from "react";

const CLAIMS_STORAGE_KEY = "valon-claims-data-v3";
const TASKS_STORAGE_KEY = "valon-claims-tasks-v1";
const CHAT_STORAGE_KEY = "valon-claims-chat-v1";
const CHAT_CONFIG_STORAGE_KEY = "valon-claims-chat-config-v1";
const MODEL_DEFAULTS = {
  anthropic: "claude-sonnet-4-6",
  openai: "gpt-4.1-mini",
};

const STAGES = [
  { id: "fnol", label: "FNOL Intake" },
  { id: "triage", label: "AI Triage" },
  { id: "documents", label: "Document Collection" },
  { id: "coverage", label: "Coverage Check" },
  { id: "resolution", label: "Resolution" },
];

const TASK_TEMPLATES = {
  triage: {
    dueDays: 1,
    items: ["Review incident report", "Assign priority score"],
  },
  documents: {
    dueDays: 2,
    items: ["Chase missing police report", "Verify repair estimate"],
  },
  coverage: {
    dueDays: 1,
    items: ["Check policy exclusions", "Confirm coverage determination"],
  },
};

const INTEGRATIONS = [
  { name: "Policy Admin", status: "connected" },
  { name: "Repair Network", status: "connected" },
  { name: "Medical Providers", status: "pending" },
  { name: "Finance / Reserves", status: "connected" },
  { name: "State Regulators", status: "pending" },
];

const POLICY_DETAILS = {
  "MC-204812": {
    policyType: "RoadShield Plus",
    incidentType: "Collision",
    covered: true,
    exclusions: ["Racing events", "Commercial delivery use"],
    determination: "Approved for collision loss subject to deductible.",
  },
  "MC-557903": {
    policyType: "Urban Rider Select",
    incidentType: "Single Vehicle",
    covered: true,
    exclusions: ["Track days", "Intentional damage"],
    determination: "Covered loss with injury review and medical coordination required.",
  },
  "MC-998401": {
    policyType: "Essential Liability",
    incidentType: "Theft",
    covered: false,
    exclusions: ["Unsecured vehicle theft", "Off-road usage"],
    determination: "Theft loss is not covered under this form.",
  },
};

const DOCUMENT_LIBRARY = {
  low: ["Accident Photos", "Police Report"],
  medium: ["Accident Photos", "Police Report", "Repair Estimate"],
  high: ["Accident Photos", "Police Report", "Repair Estimate", "Medical Records", "Legal Notice"],
};

const SAMPLE_CLAIMS = [
  {
    claimId: "CLM-260501",
    policyNumber: "MC-204812",
    claimantName: "Darius Cole",
    incidentDate: "2026-05-02",
    incidentDescription: "Rear-end collision at a stoplight with fairing and fork damage.",
    injuryInvolved: false,
    damageSeverity: "minor",
    vehicleMake: "Yamaha",
    vehicleModel: "MT-07",
    vehicleYear: "2023",
    stage: "triage",
    priority: "low",
    documents: ["Accident Photos"],
    coverageStatus: "pending",
    adjusterAssigned: "A. Mercer",
    estimatedPayout: 2200,
    createdAt: "2026-05-02T14:16:00Z",
    updatedAt: "2026-05-02T15:02:00Z",
    notes: "No bodily injury reported. Photos uploaded from tow yard.",
    closed: false,
  },
  {
    claimId: "CLM-260502",
    policyNumber: "MC-557903",
    claimantName: "Elena Park",
    incidentDate: "2026-05-03",
    incidentDescription: "Low-side crash on rain-slick city street with rider wrist injury.",
    injuryInvolved: true,
    damageSeverity: "severe",
    vehicleMake: "Ducati",
    vehicleModel: "Monster",
    vehicleYear: "2024",
    stage: "documents",
    priority: "high",
    documents: ["Accident Photos", "Police Report", "Medical Records"],
    coverageStatus: "pending",
    adjusterAssigned: "P. Shah",
    estimatedPayout: 11800,
    createdAt: "2026-05-03T09:44:00Z",
    updatedAt: "2026-05-03T10:11:00Z",
    notes: "Escalated due to injury exposure and likely total loss review.",
    closed: false,
  },
  {
    claimId: "CLM-260503",
    policyNumber: "MC-998401",
    claimantName: "Miles Bennett",
    incidentDate: "2026-05-05",
    incidentDescription: "Motorcycle reported stolen from open driveway overnight.",
    injuryInvolved: false,
    damageSeverity: "moderate",
    vehicleMake: "Honda",
    vehicleModel: "CB500X",
    vehicleYear: "2022",
    stage: "coverage",
    priority: "medium",
    documents: ["Accident Photos", "Police Report", "Repair Estimate"],
    coverageStatus: "denied",
    adjusterAssigned: "M. Hale",
    estimatedPayout: 0,
    createdAt: "2026-05-05T21:05:00Z",
    updatedAt: "2026-05-05T22:08:00Z",
    notes: "Coverage concern due to policy form and driveway storage facts.",
    closed: false,
  },
];

const NEW_CLAIM_TEMPLATE = {
  claimId: "",
  policyNumber: "MC-204812",
  claimantName: "",
  incidentDate: "",
  incidentDescription: "",
  injuryInvolved: false,
  damageSeverity: "minor",
  vehicleMake: "",
  vehicleModel: "",
  vehicleYear: "",
  stage: "fnol",
  priority: "low",
  documents: [],
  coverageStatus: "pending",
  adjusterAssigned: "Unassigned",
  estimatedPayout: 0,
  createdAt: "",
  updatedAt: "",
  notes: "",
  closed: false,
};

function derivePriority(claim) {
  if (claim.injuryInvolved) {
    return {
      priority: "high",
      reasoning: "Bodily injury triggers high-priority handling and immediate adjuster involvement.",
    };
  }
  if (claim.damageSeverity === "severe") {
    return {
      priority: "high",
      reasoning: "Severe motorcycle damage suggests material indemnity exposure and expedited review.",
    };
  }
  if (claim.damageSeverity === "moderate") {
    return {
      priority: "medium",
      reasoning: "Moderate damage requires repair network coordination and a standard adjuster queue.",
    };
  }
  return {
    priority: "low",
    reasoning: "Minor damage with no injury fits streamlined straight-through processing.",
  };
}

function deriveCoverage(claim) {
  const policy = POLICY_DETAILS[claim.policyNumber] ?? POLICY_DETAILS["MC-204812"];
  if (!policy.covered) {
    return {
      status: "denied",
      reason: "Incident profile does not align to covered peril under the current policy form.",
      policy,
    };
  }
  if (claim.injuryInvolved || claim.priority === "high") {
    return {
      status: "pending",
      reason: "Coverage appears available, but severity and injury facts require manual review.",
      policy,
    };
  }
  return {
    status: "approved",
    reason: "Policy coverage aligns with reported incident and no hard exclusion is triggered.",
    policy,
  };
}

function getRequiredDocuments(priority) {
  return DOCUMENT_LIBRARY[priority] ?? DOCUMENT_LIBRARY.low;
}

function stageIndex(stage) {
  return STAGES.findIndex((item) => item.id === stage);
}

function nextStage(stage) {
  const index = stageIndex(stage);
  return STAGES[Math.min(index + 1, STAGES.length - 1)]?.id ?? "resolution";
}

function stageLabel(stage) {
  return STAGES.find((item) => item.id === stage)?.label ?? stage;
}

function formatDate(value) {
  if (!value) return "--";
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

function formatDateTime(value) {
  if (!value) return "--";
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function buildClaim(input, existing = {}) {
  const now = new Date().toISOString();
  const triage = derivePriority(input);
  const coverage = deriveCoverage({ ...input, priority: triage.priority });
  return {
    ...existing,
    ...input,
    priority: triage.priority,
    coverageStatus: coverage.status,
    updatedAt: now,
    createdAt: existing.createdAt || now,
    claimId: existing.claimId || `CLM-${Math.floor(100000 + Math.random() * 900000)}`,
    adjusterAssigned:
      existing.adjusterAssigned ||
      (triage.priority === "high" ? "P. Shah" : triage.priority === "medium" ? "M. Hale" : "A. Mercer"),
    documents: existing.documents || [],
    closed: existing.closed || false,
  };
}

function calculateMetrics(claims) {
  const activeClaims = claims.filter((claim) => !claim.closed).length;
  const stageCounts = STAGES.reduce((accumulator, stage) => {
    accumulator[stage.id] = claims.filter((claim) => claim.stage === stage.id && !claim.closed).length;
    return accumulator;
  }, {});
  const cycleTimes = claims.map((claim) => {
    const start = new Date(claim.createdAt).getTime();
    const end = new Date(claim.updatedAt).getTime();
    return Math.max(0, (end - start) / (1000 * 60 * 60 * 24));
  });
  const averageCycleTime = cycleTimes.length
    ? (cycleTimes.reduce((sum, value) => sum + value, 0) / cycleTimes.length).toFixed(1)
    : "0.0";
  const escalationRate = claims.length
    ? Math.round((claims.filter((claim) => claim.priority === "high").length / claims.length) * 100)
    : 0;
  const avgTriageHours = calculateAverageStageHours(claims, "triage");
  return { activeClaims, stageCounts, averageCycleTime, escalationRate, avgTriageHours };
}

function calculateAverageStageHours(claims, stage) {
  const stageClaims = claims.filter((claim) => claim.stage === stage && !claim.closed);
  if (!stageClaims.length) return "0.0";
  const totalHours = stageClaims.reduce((sum, claim) => {
    const updated = new Date(claim.updatedAt).getTime();
    const created = new Date(claim.createdAt).getTime();
    return sum + Math.max(1, (updated - created) / (1000 * 60 * 60));
  }, 0);
  return (totalHours / stageClaims.length).toFixed(1);
}

function buildTaskId(claim, title) {
  return `${claim.claimId}:${claim.stage}:${title}`;
}

function buildTasks(claims, taskStatuses) {
  const now = Date.now();
  return claims
    .filter((claim) => !claim.closed && Object.hasOwn(TASK_TEMPLATES, claim.stage))
    .flatMap((claim) => {
      const template = TASK_TEMPLATES[claim.stage];
      const dueDate = new Date(new Date(claim.updatedAt).getTime() + template.dueDays * 86400000).toISOString();
      return template.items.map((title) => {
        const id = buildTaskId(claim, title);
        const status = taskStatuses[id] ?? "pending";
        return {
          id,
          title,
          claimId: claim.claimId,
          stage: claim.stage,
          dueDate,
          adjusterAssigned: claim.adjusterAssigned,
          status,
          overdue: status !== "done" && new Date(dueDate).getTime() < now,
        };
      });
    });
}

function App() {
  const [claims, setClaims] = useState([]);
  const [hydrated, setHydrated] = useState(false);
  const [selectedClaimId, setSelectedClaimId] = useState("");
  const [activeTab, setActiveTab] = useState("claim");
  const [taskStatuses, setTaskStatuses] = useState({});
  const [selectedAdjuster, setSelectedAdjuster] = useState("All Adjusters");
  const [chatMessages, setChatMessages] = useState([]);
  const [chatDraft, setChatDraft] = useState("");
  const [chatOpen, setChatOpen] = useState(true);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState("");
  const [llmProvider, setLlmProvider] = useState("anthropic");
  const [llmModel, setLlmModel] = useState(MODEL_DEFAULTS.anthropic);

  useEffect(() => {
    const storedClaims = window.localStorage.getItem(CLAIMS_STORAGE_KEY);
    const storedTasks = window.localStorage.getItem(TASKS_STORAGE_KEY);
    const storedChat = window.localStorage.getItem(CHAT_STORAGE_KEY);
    const storedChatConfig = window.localStorage.getItem(CHAT_CONFIG_STORAGE_KEY);
    const nextClaims = storedClaims ? JSON.parse(storedClaims) : SAMPLE_CLAIMS;
    const nextTasks = storedTasks ? JSON.parse(storedTasks) : {};
    const nextChat = storedChat
      ? JSON.parse(storedChat)
      : [
          {
            role: "assistant",
            content: "Claims assistant is ready. Ask about overdue files, missing documents, priorities, or stage timing.",
          },
        ];
    const nextChatConfig = storedChatConfig
      ? JSON.parse(storedChatConfig)
      : { provider: "anthropic", model: MODEL_DEFAULTS.anthropic };

    setClaims(nextClaims);
    setTaskStatuses(nextTasks);
    setChatMessages(nextChat);
    setLlmProvider(nextChatConfig.provider || "anthropic");
    setLlmModel(nextChatConfig.model || MODEL_DEFAULTS[nextChatConfig.provider] || MODEL_DEFAULTS.anthropic);
    setSelectedClaimId(nextClaims[0]?.claimId ?? "");
    setSelectedAdjuster(nextClaims[0]?.adjusterAssigned ?? "All Adjusters");
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(CLAIMS_STORAGE_KEY, JSON.stringify(claims));
  }, [claims, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(taskStatuses));
  }, [hydrated, taskStatuses]);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(chatMessages));
  }, [chatMessages, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(
      CHAT_CONFIG_STORAGE_KEY,
      JSON.stringify({ provider: llmProvider, model: llmModel }),
    );
  }, [hydrated, llmModel, llmProvider]);

  const selectedClaim = useMemo(
    () => claims.find((claim) => claim.claimId === selectedClaimId) ?? null,
    [claims, selectedClaimId],
  );

  const metrics = useMemo(() => calculateMetrics(claims), [claims]);
  const tasks = useMemo(() => buildTasks(claims, taskStatuses), [claims, taskStatuses]);
  const adjusters = useMemo(
    () => ["All Adjusters", ...new Set(claims.map((claim) => claim.adjusterAssigned).filter(Boolean))],
    [claims],
  );
  const visibleTasks = useMemo(
    () =>
      selectedAdjuster === "All Adjusters"
        ? tasks
        : tasks.filter((task) => task.adjusterAssigned === selectedAdjuster),
    [selectedAdjuster, tasks],
  );

  const upsertClaim = (nextClaim) => {
    setClaims((current) => {
      const exists = current.some((claim) => claim.claimId === nextClaim.claimId);
      if (!exists) {
        return [nextClaim, ...current];
      }
      return current.map((claim) => (claim.claimId === nextClaim.claimId ? nextClaim : claim));
    });
    setSelectedClaimId(nextClaim.claimId);
  };

  const updateClaimById = (claimId, patch) => {
    const existing = claims.find((claim) => claim.claimId === claimId);
    if (!existing) return;
    const merged = { ...existing, ...patch };
    const rebuilt = buildClaim(merged, existing);
    upsertClaim(rebuilt);
  };

  const createClaim = () => {
    const newClaim = buildClaim(NEW_CLAIM_TEMPLATE);
    upsertClaim(newClaim);
    setActiveTab("claim");
  };

  const moveStage = (direction) => {
    if (!selectedClaim) return;
    const index = stageIndex(selectedClaim.stage);
    const nextIndex = Math.min(STAGES.length - 1, Math.max(0, index + direction));
    updateClaimById(selectedClaim.claimId, { stage: STAGES[nextIndex].id });
  };

  const toggleDocument = (document) => {
    if (!selectedClaim) return;
    const documents = selectedClaim.documents.includes(document)
      ? selectedClaim.documents.filter((item) => item !== document)
      : [...selectedClaim.documents, document];
    updateClaimById(selectedClaim.claimId, { documents });
  };

  const updateTaskStatus = (task, status) => {
    const nextStatuses = { ...taskStatuses, [task.id]: status };
    setTaskStatuses(nextStatuses);
    const stageTasks = buildTasks(claims, nextStatuses).filter(
      (candidate) => candidate.claimId === task.claimId && candidate.stage === task.stage,
    );
    if (stageTasks.length && stageTasks.every((candidate) => candidate.status === "done")) {
      const claim = claims.find((item) => item.claimId === task.claimId);
      if (claim) {
        updateClaimById(task.claimId, {
          stage: nextStage(task.stage),
          notes: `${claim.notes}\n${stageLabel(task.stage)} task bundle completed ${new Date().toLocaleString("en-US")}.`.trim(),
        });
      }
    }
  };

  const closeClaim = () => {
    if (!selectedClaim) return;
    updateClaimById(selectedClaim.claimId, {
      closed: true,
      stage: "resolution",
      notes: `${selectedClaim.notes}\nClosed ${new Date().toLocaleString("en-US")} by ${selectedClaim.adjusterAssigned}.`.trim(),
    });
  };

  const sendChat = async (event) => {
    event.preventDefault();
    const question = chatDraft.trim();
    if (!question || chatLoading) return;
    const nextMessages = [...chatMessages, { role: "user", content: question }];
    setChatMessages(nextMessages);
    setChatDraft("");
    setChatLoading(true);
    setChatError("");

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages.map((message) => ({
            role: message.role,
            content: message.content,
          })),
          claims,
          provider: llmProvider,
          model: llmModel,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.detail || "Chat request failed.");
      }
      setChatMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: payload.message,
          meta: `${payload.latency_ms} ms · ${payload.usage?.input_tokens ?? 0}/${payload.usage?.output_tokens ?? 0} tokens`,
        },
      ]);
    } catch (error) {
      setChatError(error.message);
    } finally {
      setChatLoading(false);
    }
  };

  const triage = selectedClaim ? derivePriority(selectedClaim) : null;
  const coverage = selectedClaim ? deriveCoverage(selectedClaim) : null;
  const requiredDocuments = selectedClaim ? getRequiredDocuments(selectedClaim.priority) : [];
  const maxStageCount = Math.max(1, ...Object.values(metrics.stageCounts || { fnol: 1 }));

  return (
    <div className="workspace">
      <header className="masthead">
        <div className="masthead-brand">
          <svg className="brand-mark" width="34" height="34" viewBox="0 0 34 34" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <line x1="17" y1="2" x2="17" y2="32" stroke="#C8922A" strokeWidth="2.5" strokeLinecap="round"/>
            <line x1="2" y1="17" x2="32" y2="17" stroke="#C8922A" strokeWidth="2.5" strokeLinecap="round"/>
            <line x1="6.51" y1="6.51" x2="27.49" y2="27.49" stroke="#C8922A" strokeWidth="2.5" strokeLinecap="round"/>
            <line x1="27.49" y1="6.51" x2="6.51" y2="27.49" stroke="#C8922A" strokeWidth="2.5" strokeLinecap="round"/>
            <line x1="3.76" y1="11.5" x2="30.24" y2="22.5" stroke="#C8922A" strokeWidth="1.5" strokeLinecap="round"/>
            <line x1="11.5" y1="3.76" x2="22.5" y2="30.24" stroke="#C8922A" strokeWidth="1.5" strokeLinecap="round"/>
            <line x1="30.24" y1="11.5" x2="3.76" y2="22.5" stroke="#C8922A" strokeWidth="1.5" strokeLinecap="round"/>
            <line x1="22.5" y1="3.76" x2="11.5" y2="30.24" stroke="#C8922A" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <div>
            <p className="kicker">Claims Management</p>
            <h1>ValonOS — Motorcycle Insurance</h1>
          </div>
        </div>
        <div className="masthead-meta">
          <span>React workstation</span>
          <span>localStorage persistence</span>
          <span className="obs-badge">Observability Dashboard</span>
        </div>
      </header>

      <section className="toolbar">
        <div className="tab-strip">
          <button
            className={`tab-button ${activeTab === "claim" ? "active" : ""}`}
            onClick={() => setActiveTab("claim")}
            type="button"
          >
            Claim Detail
          </button>
          <button
            className={`tab-button ${activeTab === "tasks" ? "active" : ""}`}
            onClick={() => setActiveTab("tasks")}
            type="button"
          >
            My Tasks
          </button>
          <button
            className={`tab-button ${activeTab === "dashboard" ? "active" : ""}`}
            onClick={() => setActiveTab("dashboard")}
            type="button"
          >
            Dashboard
          </button>
        </div>
        <button className="action-button" onClick={createClaim} type="button">
          New Claim
        </button>
      </section>

      <section className="layout">
        <aside className="claim-list-panel">
          <div className="section-head">
            <h2>Claims Queue</h2>
            <span>{metrics.activeClaims} active</span>
          </div>
          <div className="claim-list">
            {claims.map((claim) => (
              <button
                key={claim.claimId}
                className={`claim-row ${selectedClaimId === claim.claimId ? "selected" : ""}`}
                onClick={() => {
                  setSelectedClaimId(claim.claimId);
                  setActiveTab("claim");
                }}
                type="button"
              >
                <div className="claim-row-top">
                  <strong>{claim.claimId}</strong>
                  <span className={`priority-badge ${claim.priority}`}>{claim.priority}</span>
                </div>
                <div className="claimant-name">{claim.claimantName || "Unassigned claimant"}</div>
                <div className="claim-row-meta">
                  <span>{stageLabel(claim.stage)}</span>
                  <span>{formatDate(claim.createdAt)}</span>
                </div>
              </button>
            ))}
          </div>
        </aside>

        <main className="main-panel">
          {activeTab === "dashboard" ? (
            <section className="screen-panel">
              <div className="section-head">
                <h2>Operational Dashboard</h2>
                <span>Live from browser state</span>
              </div>
              <div className="metrics-grid">
                <MetricCard label="Total Active Claims" value={metrics.activeClaims} />
                <MetricCard label="Average Cycle Time" value={`${metrics.averageCycleTime} days`} />
                <MetricCard label="Escalation Rate" value={`${metrics.escalationRate}%`} />
                <MetricCard label="Average Triage Time" value={`${metrics.avgTriageHours} hrs`} />
              </div>
              <div className="chart-panel">
                <div className="chart-header">
                  <h3>Claims By Stage</h3>
                </div>
                <svg className="stage-chart" viewBox="0 0 600 240" role="img" aria-label="Claims by stage">
                  {STAGES.map((stage, index) => {
                    const value = metrics.stageCounts[stage.id] || 0;
                    const barHeight = (value / maxStageCount) * 150;
                    const x = 40 + index * 110;
                    const y = 180 - barHeight;
                    return (
                      <g key={stage.id}>
                        <rect x={x} y={y} width="68" height={barHeight} fill="#2C2A27" />
                        <text x={x + 34} y={198} textAnchor="middle" fill="#7A756E" fontSize="12">
                          {stage.label}
                        </text>
                        <text x={x + 34} y={y - 8} textAnchor="middle" fill="#1A1A1A" fontSize="14">
                          {value}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>
            </section>
          ) : null}

          {activeTab === "tasks" ? (
            <section className="screen-panel">
              <div className="section-head">
                <h2>My Tasks</h2>
                <div className="task-toolbar">
                  <label className="inline-field">
                    <span>Adjuster</span>
                    <select value={selectedAdjuster} onChange={(event) => setSelectedAdjuster(event.target.value)}>
                      {adjusters.map((adjuster) => (
                        <option key={adjuster} value={adjuster}>
                          {adjuster}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>
              <div className="task-list">
                {visibleTasks.map((task) => (
                  <div className={`task-row ${task.overdue ? "overdue" : ""}`} key={task.id}>
                    <div className="task-main">
                      <strong>{task.title}</strong>
                      <span>
                        {task.claimId} · {stageLabel(task.stage)} · Due {formatDateTime(task.dueDate)}
                      </span>
                    </div>
                    <div className="task-actions">
                      <input
                        checked={task.status === "done"}
                        onChange={(event) => updateTaskStatus(task, event.target.checked ? "done" : "pending")}
                        type="checkbox"
                      />
                      <select value={task.status} onChange={(event) => updateTaskStatus(task, event.target.value)}>
                        <option value="pending">pending</option>
                        <option value="in progress">in progress</option>
                        <option value="done">done</option>
                      </select>
                    </div>
                  </div>
                ))}
                {!visibleTasks.length ? <p className="empty-state">No tasks for this adjuster.</p> : null}
              </div>
            </section>
          ) : null}

          {activeTab === "claim" && selectedClaim ? (
            <section className="screen-panel">
              <div className="detail-head">
                <div>
                  <h2>{selectedClaim.claimId}</h2>
                  <p>
                    {selectedClaim.claimantName || "New intake"} · {selectedClaim.policyNumber} ·{" "}
                    {selectedClaim.vehicleYear} {selectedClaim.vehicleMake} {selectedClaim.vehicleModel}
                  </p>
                </div>
                <div className="detail-head-meta">
                  <span className={`priority-badge ${selectedClaim.priority}`}>{selectedClaim.priority}</span>
                  <span className={`status-chip ${selectedClaim.coverageStatus}`}>
                    {selectedClaim.coverageStatus}
                  </span>
                </div>
              </div>

              <div className="progress-strip">
                {STAGES.map((stage, index) => {
                  const currentIndex = stageIndex(selectedClaim.stage);
                  const state =
                    index < currentIndex ? "complete" : index === currentIndex ? "active" : "upcoming";
                  return (
                    <div className={`progress-step ${state}`} key={stage.id}>
                      <span className="step-number">{index + 1}</span>
                      <strong>{stage.label}</strong>
                    </div>
                  );
                })}
              </div>

              <div className="stage-nav">
                <button className="nav-button" onClick={() => moveStage(-1)} type="button">
                  Previous Stage
                </button>
                <button className="nav-button" onClick={() => moveStage(1)} type="button">
                  Next Stage
                </button>
              </div>

              <section className="detail-grid">
                <div className="content-panel">
                  {selectedClaim.stage === "fnol" ? (
                    <div className="stage-block">
                      <h3>FNOL Intake</h3>
                      <div className="form-grid">
                        <Field label="Claimant Name">
                          <input
                            value={selectedClaim.claimantName}
                            onChange={(event) => updateClaimById(selectedClaim.claimId, { claimantName: event.target.value })}
                          />
                        </Field>
                        <Field label="Policy Number">
                          <select
                            value={selectedClaim.policyNumber}
                            onChange={(event) => updateClaimById(selectedClaim.claimId, { policyNumber: event.target.value })}
                          >
                            {Object.keys(POLICY_DETAILS).map((policyNumber) => (
                              <option key={policyNumber} value={policyNumber}>
                                {policyNumber}
                              </option>
                            ))}
                          </select>
                        </Field>
                        <Field label="Incident Date">
                          <input
                            type="date"
                            value={selectedClaim.incidentDate}
                            onChange={(event) => updateClaimById(selectedClaim.claimId, { incidentDate: event.target.value })}
                          />
                        </Field>
                        <Field label="Damage Severity">
                          <select
                            value={selectedClaim.damageSeverity}
                            onChange={(event) => updateClaimById(selectedClaim.claimId, { damageSeverity: event.target.value })}
                          >
                            <option value="minor">minor</option>
                            <option value="moderate">moderate</option>
                            <option value="severe">severe</option>
                          </select>
                        </Field>
                        <Field label="Vehicle Make">
                          <input
                            value={selectedClaim.vehicleMake}
                            onChange={(event) => updateClaimById(selectedClaim.claimId, { vehicleMake: event.target.value })}
                          />
                        </Field>
                        <Field label="Vehicle Model">
                          <input
                            value={selectedClaim.vehicleModel}
                            onChange={(event) => updateClaimById(selectedClaim.claimId, { vehicleModel: event.target.value })}
                          />
                        </Field>
                        <Field label="Vehicle Year">
                          <input
                            value={selectedClaim.vehicleYear}
                            onChange={(event) => updateClaimById(selectedClaim.claimId, { vehicleYear: event.target.value })}
                          />
                        </Field>
                        <Field label="Injury Involved">
                          <select
                            value={String(selectedClaim.injuryInvolved)}
                            onChange={(event) =>
                              updateClaimById(selectedClaim.claimId, { injuryInvolved: event.target.value === "true" })
                            }
                          >
                            <option value="false">No</option>
                            <option value="true">Yes</option>
                          </select>
                        </Field>
                        <Field label="Incident Description" full>
                          <textarea
                            value={selectedClaim.incidentDescription}
                            onChange={(event) =>
                              updateClaimById(selectedClaim.claimId, { incidentDescription: event.target.value })
                            }
                          />
                        </Field>
                      </div>
                    </div>
                  ) : null}

                  {selectedClaim.stage === "triage" ? (
                    <div className="stage-block">
                      <h3>AI Triage</h3>
                      <div className="decision-banner">
                        <span className={`priority-badge ${triage.priority}`}>{triage.priority}</span>
                        <p>{triage.reasoning}</p>
                      </div>
                      <div className="key-value-list">
                        <KeyValue label="Injury Involved" value={selectedClaim.injuryInvolved ? "Yes" : "No"} />
                        <KeyValue label="Damage Severity" value={selectedClaim.damageSeverity} />
                        <KeyValue label="Assigned Adjuster" value={selectedClaim.adjusterAssigned} />
                      </div>
                    </div>
                  ) : null}

                  {selectedClaim.stage === "documents" ? (
                    <div className="stage-block">
                      <h3>Document Collection</h3>
                      <div className="checklist">
                        {requiredDocuments.map((document) => (
                          <label className="check-row" key={document}>
                            <div>
                              <strong>{document}</strong>
                              <span>{selectedClaim.documents.includes(document) ? "Received" : "Pending"}</span>
                            </div>
                            <input
                              checked={selectedClaim.documents.includes(document)}
                              onChange={() => toggleDocument(document)}
                              type="checkbox"
                            />
                          </label>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {selectedClaim.stage === "coverage" ? (
                    <div className="stage-block">
                      <h3>Coverage Check</h3>
                      <div className="key-value-list">
                        <KeyValue label="Policy Type" value={coverage.policy.policyType} />
                        <KeyValue label="Incident Type" value={coverage.policy.incidentType} />
                        <KeyValue label="Coverage Determination" value={coverage.reason} />
                        <KeyValue label="Coverage Status" value={coverage.status} />
                      </div>
                      <div className="exclusions-panel">
                        <h4>Exclusions</h4>
                        <ul>
                          {coverage.policy.exclusions.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ) : null}

                  {selectedClaim.stage === "resolution" ? (
                    <div className="stage-block">
                      <h3>Resolution</h3>
                      <div className="form-grid">
                        <Field label="Estimated Payout">
                          <input
                            type="number"
                            value={selectedClaim.estimatedPayout}
                            onChange={(event) =>
                              updateClaimById(selectedClaim.claimId, { estimatedPayout: Number(event.target.value) })
                            }
                          />
                        </Field>
                        <Field label="Adjuster Assigned">
                          <input
                            value={selectedClaim.adjusterAssigned}
                            onChange={(event) =>
                              updateClaimById(selectedClaim.claimId, { adjusterAssigned: event.target.value })
                            }
                          />
                        </Field>
                        <Field label="Adjuster Notes" full>
                          <textarea
                            value={selectedClaim.notes}
                            onChange={(event) => updateClaimById(selectedClaim.claimId, { notes: event.target.value })}
                          />
                        </Field>
                      </div>
                      <div className="resolution-actions">
                        <button className="action-button" onClick={closeClaim} type="button">
                          Close Claim
                        </button>
                        <span>{selectedClaim.closed ? "Closed" : "Open"} · Updated {formatDateTime(selectedClaim.updatedAt)}</span>
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="summary-panel">
                  <div className="summary-block">
                    <h3>Claim Summary</h3>
                    <div className="key-value-list">
                      <KeyValue label="Created" value={formatDateTime(selectedClaim.createdAt)} />
                      <KeyValue label="Last Updated" value={formatDateTime(selectedClaim.updatedAt)} />
                      <KeyValue label="Stage" value={stageLabel(selectedClaim.stage)} />
                      <KeyValue label="Priority" value={selectedClaim.priority} />
                    </div>
                  </div>
                  <div className="summary-block">
                    <h3>Coverage Summary</h3>
                    <p>{coverage.policy.determination}</p>
                  </div>
                  <div className="summary-block">
                    <h3>Notes</h3>
                    <p className="notes-copy">{selectedClaim.notes || "No notes entered."}</p>
                  </div>
                </div>
              </section>
            </section>
          ) : null}
        </main>

        <aside className="integration-panel">
          <div className="section-head">
            <h2>Integrations</h2>
            <span>Mock system health</span>
          </div>
          <div className="integration-list">
            {INTEGRATIONS.map((integration) => (
              <div className="integration-row" key={integration.name}>
                <div>
                  <strong>{integration.name}</strong>
                </div>
                <span className={`integration-status ${integration.status}`}>
                  <i />
                  {integration.status}
                </span>
              </div>
            ))}
          </div>
        </aside>
      </section>

      <section className={`chat-dock ${chatOpen ? "open" : "closed"}`}>
        <button className="chat-toggle" onClick={() => setChatOpen((current) => !current)} type="button">
          Agent Chat {chatOpen ? "−" : "+"}
        </button>
        {chatOpen ? (
          <div className="chat-panel">
            <div className="chat-messages">
              {chatMessages.map((message, index) => (
                <div className={`chat-bubble ${message.role}`} key={`${message.role}-${index}`}>
                  <strong>{message.role === "assistant" ? "Agent" : "User"}</strong>
                  <p>{message.content}</p>
                  {message.meta ? <span>{message.meta}</span> : null}
                </div>
              ))}
              {chatLoading ? <div className="typing-indicator">Claude is reviewing claims context...</div> : null}
            </div>
            {chatError ? <div className="chat-error">{chatError}</div> : null}
            <form className="chat-form" onSubmit={sendChat}>
              <div className="chat-config-grid">
                <label className="inline-field">
                  <span>LLM Provider</span>
                  <select
                    value={llmProvider}
                    onChange={(event) => {
                      const provider = event.target.value;
                      setLlmProvider(provider);
                      setLlmModel(MODEL_DEFAULTS[provider]);
                    }}
                  >
                    <option value="anthropic">Anthropic</option>
                    <option value="openai">OpenAI</option>
                  </select>
                </label>
                <label className="inline-field">
                  <span>Model</span>
                  <input value={llmModel} onChange={(event) => setLlmModel(event.target.value)} />
                </label>
              </div>
              <textarea
                placeholder="Ask about overdue claims, missing documents, priorities, or stage timing."
                value={chatDraft}
                onChange={(event) => setChatDraft(event.target.value)}
              />
              <button className="action-button" type="submit">
                Send
              </button>
            </form>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function Field({ label, children, full = false }) {
  return (
    <label className={full ? "field full" : "field"}>
      <span>{label}</span>
      {children}
    </label>
  );
}

function KeyValue({ label, value }) {
  return (
    <div className="key-value-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function MetricCard({ label, value }) {
  return (
    <div className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export default App;
