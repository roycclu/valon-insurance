import { useEffect, useMemo, useRef, useState } from "react";
import { buildClaim, buildFinanceView, buildSystemHealth, calculateMetrics, deriveCoverage, derivePriority, nextStage, stageIndex, stageLabel } from "./core/claims";
import { appendAgentFeed, extractReferencedClaims } from "./core/agent";
import { callAnthropic, callOpenAI, logTrace } from "./core/llm";
import { MONTHLY_FINANCIALS, combinedRatioTone } from "./core/finance";
import { buildTasks, documentStatusMissingCount } from "./core/tasks";
import { NEW_CLAIM_TEMPLATE, SAMPLE_CLAIMS } from "./data/claims";
import {
  AGENT_FEED_STORAGE_KEY,
  CHAT_CONFIG_STORAGE_KEY,
  CHAT_STORAGE_KEY,
  CLAIMS_STORAGE_KEY,
  INTEGRATIONS,
  MODEL_DEFAULTS,
  MODEL_OPTIONS,
  STAGES,
  TASKS_STORAGE_KEY,
} from "./data/config";
import {
  capitalize,
  formatCurrency,
  formatDate,
  formatDateTime,
  formatInteger,
  formatPercent,
  providerLabel,
  statusLabel,
} from "./utils/format";
const AGENT_PROMPTS = [
  "What's blocking the portfolio?",
  "Show reserve exposure",
  "High priority actions today",
];

// Safely extract a display string from a message content value.
// Handles plain strings, Claude content-block arrays [{type:"text",text:"..."}],
// and any other unexpected value that might end up in localStorage.
function safeText(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .filter((block) => block?.type === "text")
      .map((block) => block?.text ?? "")
      .join("\n");
  }
  return "";
}

function SunburstIcon() {
  return (
    <svg className="agent-avatar-icon" viewBox="0 0 12 12" aria-hidden="true">
      <circle cx="6" cy="6" r="2.2" fill="currentColor" />
      <path
        d="M6 0.9v1.5M6 9.6v1.5M0.9 6h1.5M9.6 6h1.5M2.1 2.1l1.1 1.1M8.8 8.8l1.1 1.1M9.9 2.1L8.8 3.2M3.2 8.8L2.1 9.9"
        stroke="currentColor"
        strokeWidth="0.95"
        strokeLinecap="round"
      />
    </svg>
  );
}

function App() {
  const [claims, setClaims] = useState([]);
  const [hydrated, setHydrated] = useState(false);
  const [selectedClaimId, setSelectedClaimId] = useState("");
  const [activeTab, setActiveTab] = useState("tasks");
  const [taskStatuses, setTaskStatuses] = useState({});
  const [selectedAdjuster, setSelectedAdjuster] = useState("All Adjusters");
  const [chatMessages, setChatMessages] = useState([]);
  const [chatDraft, setChatDraft] = useState("");
  const [chatOpen, setChatOpen] = useState(true);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState("");
  const [llmProvider, setLlmProvider] = useState("anthropic");
  const [llmModel, setLlmModel] = useState(MODEL_DEFAULTS.anthropic);
  const [configOpen, setConfigOpen] = useState(false);
  const [agentFeed, setAgentFeed] = useState([]);
  const chatInputRef = useRef(null);

  useEffect(() => {
    const storedClaims = window.localStorage.getItem(CLAIMS_STORAGE_KEY);
    const storedTasks = window.localStorage.getItem(TASKS_STORAGE_KEY);
    const storedChat = window.localStorage.getItem(CHAT_STORAGE_KEY);
    const storedChatConfig = window.localStorage.getItem(CHAT_CONFIG_STORAGE_KEY);
    const storedFeed = window.localStorage.getItem(AGENT_FEED_STORAGE_KEY);
    const nextClaims = storedClaims ? JSON.parse(storedClaims) : SAMPLE_CLAIMS;
    const nextTasks = storedTasks ? JSON.parse(storedTasks) : {};
    const nextChat = storedChat
      ? JSON.parse(storedChat).map((msg) => ({
          ...msg,
          content: safeText(msg.content),
        }))
      : [
          {
            role: "assistant",
            content: "Claims assistant is ready. Ask about the full New York claims portfolio, overdue tasks, coverage blockers, or reserve exposure.",
          },
        ];
    const nextChatConfig = storedChatConfig
      ? JSON.parse(storedChatConfig)
      : { provider: "anthropic", model: MODEL_DEFAULTS.anthropic };
    const nextFeed = storedFeed
      ? JSON.parse(storedFeed)
      : [
          {
            title: "Portfolio context loaded",
            detail: "Agent initialized with all 5 active NY specialty claims.",
            claims: ["CLM-260501", "CLM-260502", "CLM-260503", "CLM-260504", "CLM-260505"],
            timestamp: "2026-05-07T16:00:00Z",
          },
        ];
    const nextProvider = nextChatConfig.provider || "anthropic";
    const providerModels = MODEL_OPTIONS[nextProvider] || MODEL_OPTIONS.anthropic;
    const nextModel = providerModels.includes(nextChatConfig.model) ? nextChatConfig.model : providerModels[0];

    setClaims(nextClaims);
    setTaskStatuses(nextTasks);
    setChatMessages(nextChat);
    setAgentFeed(nextFeed);
    setLlmProvider(nextProvider);
    setLlmModel(nextModel);
    setSelectedClaimId(nextClaims[0]?.claimId ?? "");
    setSelectedAdjuster("All Adjusters");
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(CLAIMS_STORAGE_KEY, JSON.stringify(claims));
  }, [claims, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(taskStatuses));
  }, [taskStatuses, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(chatMessages));
  }, [chatMessages, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(CHAT_CONFIG_STORAGE_KEY, JSON.stringify({ provider: llmProvider, model: llmModel }));
  }, [hydrated, llmProvider, llmModel]);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(AGENT_FEED_STORAGE_KEY, JSON.stringify(agentFeed));
  }, [agentFeed, hydrated]);

  useEffect(() => {
    if (!chatInputRef.current) return;
    chatInputRef.current.style.height = "0px";
    chatInputRef.current.style.height = `${Math.min(chatInputRef.current.scrollHeight, 96)}px`;
  }, [chatDraft]);

  const selectedClaim = useMemo(
    () => claims.find((claim) => claim.claimId === selectedClaimId) ?? null,
    [claims, selectedClaimId],
  );
  const metrics = useMemo(() => calculateMetrics(claims), [claims]);
  const finance = useMemo(() => buildFinanceView(claims), [claims]);
  const systemHealth = useMemo(() => buildSystemHealth(INTEGRATIONS), []);
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
  const agentTasks = useMemo(() => tasks.slice(0, 6), [tasks]);
  const maxStageCount = Math.max(1, ...Object.values(metrics.stageCounts || { fnol: 1 }));
  const showIntegrationsPanel = activeTab === "dashboard";

  const pushAgentFeed = (entry) => {
    setAgentFeed((current) => appendAgentFeed(current, entry));
  };

  const upsertClaim = (nextClaim) => {
    setClaims((current) => {
      const exists = current.some((claim) => claim.claimId === nextClaim.claimId);
      if (!exists) return [nextClaim, ...current];
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

  const toggleDocumentStatus = (documentName) => {
    if (!selectedClaim) return;
    const nextChecklist = selectedClaim.documentChecklist.map((item) =>
      item.name === documentName
        ? { ...item, status: item.status === "received" ? "pending" : "received" }
        : item,
    );
    updateClaimById(selectedClaim.claimId, { documentChecklist: nextChecklist });
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
          timeline: [
            ...claim.timeline,
            {
              timestamp: new Date().toISOString(),
              title: `${stageLabel(task.stage)} tasks completed`,
              detail: "Workflow advanced automatically after all open tasks were marked done.",
            },
          ],
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
      timeline: [
        ...selectedClaim.timeline,
        {
          timestamp: new Date().toISOString(),
          title: "Claim closed",
          detail: `Closed by ${selectedClaim.adjusterAssigned}.`,
        },
      ],
    });
  };

  const loadAgentPrompt = (task) => {
    const claim = claims.find((item) => item.claimId === task.claimId);
    if (!claim) return;
    setSelectedClaimId(claim.claimId);
    setChatDraft(task.prompt);
    setActiveTab("agent");
    pushAgentFeed({
      title: "Agent prompt prepared",
      detail: `Prepared follow-up prompt for ${task.title.toLowerCase()}.`,
      claims: [claim.claimId],
      timestamp: new Date().toISOString(),
    });
  };

  const buildSystemPrompt = () => {
    const claimsJson = JSON.stringify(claims, null, 0);
    return [
      "You are a senior claims adjudication assistant for ValonOS Specialty Insurance.",
      "You support adjusters handling real claims for real people going through difficult moments.",
      "",
      "Tone: empathetic toward claimants, professional with adjusters.",
      "When a claim involves injury, legal exposure, or financial hardship, acknowledge the human stakes.",
      "When giving operational guidance, be direct, specific, and action-oriented.",
      "",
      "Always reference specific claim IDs, claimant names, dollar amounts, and dates.",
      "Structure responses clearly — key facts first, recommended action second, risks flagged last.",
      "If something is legally or financially sensitive, say so explicitly.",
      "Never hedge without explaining why. Never give generic advice.",
      "",
      "For portfolio questions: total exposure, priority ranking, top blockers.",
      "For individual claims: stage, blocker, next action, human context.",
      "For financial questions: calculate from claims data, show your work briefly.",
      "",
      "Answer only using the claim dataset provided below. If data is missing, say so directly.",
      "",
      `Current claims dataset JSON:\n${claimsJson}`,
    ].join("\n");
  };

  const sendChat = async (event) => {
    event.preventDefault();
    const question = chatDraft.trim();
    if (!question || chatLoading) return;
    if (llmProvider === "google") {
      setChatError("Google is available in settings but not wired for direct browser calls yet. Switch to Anthropic or OpenAI.");
      return;
    }

    const nextMessages = [...chatMessages, { role: "user", content: question }];
    setChatMessages(nextMessages);
    setChatDraft("");
    setChatLoading(true);
    setChatError("");

    const inScopeClaims = extractReferencedClaims(question, claims);
    pushAgentFeed({
      title: "Agent asked to review portfolio",
      detail: question,
      claims: inScopeClaims.length ? inScopeClaims : claims.map((claim) => claim.claimId),
      timestamp: new Date().toISOString(),
    });

    try {
      const systemPrompt = buildSystemPrompt();
      const callArgs = { model: llmModel, systemPrompt, messages: nextMessages };
      const result = llmProvider === "openai"
        ? await callOpenAI(callArgs)
        : await callAnthropic(callArgs);

      setChatMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: result.text,
          meta: `${result.latencyMs} ms · ${result.usage.input_tokens}/${result.usage.output_tokens} tokens · ${inScopeClaims.length ? inScopeClaims.join(", ") : "portfolio-wide"}`,
        },
      ]);
      pushAgentFeed({
        title: "Agent recommendation returned",
        detail: result.text,
        claims: inScopeClaims.length ? inScopeClaims : claims.map((claim) => claim.claimId),
        timestamp: new Date().toISOString(),
      });
      logTrace({
        provider: llmProvider,
        model: llmModel,
        promptSnippet: question,
        responseSnippet: result.text,
        latencyMs: result.latencyMs,
      });
    } catch (error) {
      setChatError(error.message);
    } finally {
      setChatLoading(false);
    }
  };

  const handleChatInputChange = (event) => {
    setChatDraft(event.target.value);
  };

  const handleChatKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendChat(event);
    }
  };

  const triage = selectedClaim ? derivePriority(selectedClaim) : null;
  const coverage = selectedClaim ? deriveCoverage(selectedClaim) : null;

  return (
    <div className="workspace">
      <header className="masthead">
        <div className="masthead-brand">
          <svg className="brand-mark" width="34" height="34" viewBox="0 0 34 34" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <line x1="17" y1="2" x2="17" y2="32" stroke="#C8922A" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="2" y1="17" x2="32" y2="17" stroke="#C8922A" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="6.51" y1="6.51" x2="27.49" y2="27.49" stroke="#C8922A" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="27.49" y1="6.51" x2="6.51" y2="27.49" stroke="#C8922A" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="3.76" y1="11.5" x2="30.24" y2="22.5" stroke="#C8922A" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="11.5" y1="3.76" x2="22.5" y2="30.24" stroke="#C8922A" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="30.24" y1="11.5" x2="3.76" y2="22.5" stroke="#C8922A" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="22.5" y1="3.76" x2="11.5" y2="30.24" stroke="#C8922A" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <div>
            <p className="kicker">Claims Management</p>
            <h1>ValonOS — Specialty Insurance</h1>
          </div>
        </div>
        <button aria-label="Open configuration" className="settings-button" onClick={() => setConfigOpen(true)} type="button">
          ⚙
        </button>
      </header>

      <section className="toolbar">
        <div className="tab-strip">
          <button className={`tab-button ${activeTab === "tasks" ? "active" : ""}`} onClick={() => setActiveTab("tasks")} type="button">
            My Tasks
          </button>
          <button className={`tab-button ${activeTab === "agent" ? "active" : ""}`} onClick={() => setActiveTab("agent")} type="button">
            Agent Ops
          </button>
          <button className={`tab-button ${activeTab === "claim" ? "active" : ""}`} onClick={() => setActiveTab("claim")} type="button">
            Claim Detail
          </button>
          <button className={`tab-button ${activeTab === "dashboard" ? "active" : ""}`} onClick={() => setActiveTab("dashboard")} type="button">
            Dashboard
          </button>
          <button className={`tab-button ${activeTab === "finance" ? "active" : ""}`} onClick={() => setActiveTab("finance")} type="button">
            Finance View
          </button>
        </div>
        <button className="action-button" onClick={createClaim} type="button">
          New Claim
        </button>
      </section>

      <section className={`layout ${activeTab === "agent" ? "agent-mode" : showIntegrationsPanel ? "with-integrations" : "without-integrations"}`}>
        {activeTab !== "agent" ? (
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
                  <div className="claimant-name">{claim.claimantName}</div>
                  <div className="claim-row-meta">
                    <span>{stageLabel(claim.stage)}</span>
                    <span>{claim.assetType}</span>
                  </div>
                </button>
              ))}
            </div>
          </aside>
        ) : null}

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
              <div className="system-health-card">
                <div>
                  <h3>System Health</h3>
                  <p>{systemHealth.overallStatus}</p>
                </div>
                <div className="system-health-stats">
                  <span className="health-chip connected">{systemHealth.counts.connected} connected</span>
                  <span className="health-chip pending">{systemHealth.counts.pending} pending</span>
                  <span className="health-chip not-configured">{systemHealth.counts["not-configured"]} not configured</span>
                </div>
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

          {activeTab === "finance" ? (
            <section className="screen-panel">
              <div className="section-head">
                <h2>Finance View</h2>
                <span>CFO and BizOps snapshot</span>
              </div>
              <div className="metrics-grid finance-metrics-grid">
                <MetricCard label="Combined Ratio" value={formatPercent(finance.combinedRatio)} tone={combinedRatioTone(finance.combinedRatio)} detail="Under 100% indicates underwriting profitability" />
                <MetricCard label="Loss Ratio" value={formatPercent(finance.lossRatio)} tone="good" detail={`${formatPercent(finance.claimsFrequency)} claims frequency`} />
                <MetricCard label="Premiums Earned" value={formatCurrency(finance.premiumsEarned)} detail={`${formatCurrency(finance.averagePremiumPerPolicy)} avg premium per policy`} />
                <MetricCard label="Claims Incurred" value={formatCurrency(finance.claimsIncurred)} detail={`${formatCurrency(finance.averageClaimSeverity)} avg claim severity`} />
              </div>
              <div className="finance-grid">
                <div className="chart-panel">
                  <div className="chart-header">
                    <h3>Monthly Premiums vs Claims</h3>
                    <span>Last 6 months</span>
                  </div>
                  <FinancialBarChart data={MONTHLY_FINANCIALS} />
                </div>
                <div className="chart-panel">
                  <div className="chart-header">
                    <h3>Reserve Adequacy</h3>
                    <span>Open claims reserve model</span>
                  </div>
                  <div className="reserve-list">
                    {finance.reserveByPriority.map((tier) => (
                      <div className="reserve-row" key={tier.priority}>
                        <div>
                          <strong>{capitalize(tier.priority)} Priority</strong>
                          <span>{formatInteger(tier.openCount)} open claims · {formatCurrency(tier.averageReserve)} avg reserve</span>
                        </div>
                        <strong>{formatCurrency(tier.totalReserve)}</strong>
                      </div>
                    ))}
                  </div>
                  <div className="reserve-total">
                    <KeyValue label="Total Reserve Requirement" value={formatCurrency(finance.totalReserveRequirement)} />
                    <KeyValue label="Claims Reserved" value={formatCurrency(finance.claimsReserved)} />
                    <KeyValue label="Reserve Coverage" value={`${finance.reserveCoverageRatio.toFixed(1)}x modeled open-claim need`} />
                  </div>
                </div>
              </div>
              <div className="finance-summary-grid">
                <div className="summary-block">
                  <h3>Loss Ratio Trend</h3>
                  <p>Loss ratio is holding at {formatPercent(finance.lossRatio)}, which keeps claims cost well below earned premium and leaves room for growth.</p>
                </div>
                <div className="summary-block">
                  <h3>Reserve Coverage</h3>
                  <p>Booked reserves of {formatCurrency(finance.claimsReserved)} sit well above the modeled {formatCurrency(finance.totalReserveRequirement)} open-claim requirement, which gives the team cushion against severity drift.</p>
                </div>
                <div className="summary-block">
                  <h3>Profitability Outlook</h3>
                  <p>At a {formatPercent(finance.combinedRatio)} combined ratio, this book looks profitable today and disciplined enough to scale without eating margin.</p>
                </div>
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
                      <span>{task.claimId} · {stageLabel(task.stage)} · Due {formatDateTime(task.dueDate)}</span>
                    </div>
                    <div className="task-actions">
                      <input checked={task.status === "done"} onChange={(event) => updateTaskStatus(task, event.target.checked ? "done" : "pending")} type="checkbox" />
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
                    {selectedClaim.claimantName} · {selectedClaim.claimantAge}, {selectedClaim.claimantLocation} · {selectedClaim.policyNumber}
                  </p>
                </div>
                <div className="detail-head-meta">
                  <span className={`priority-badge ${selectedClaim.priority}`}>{selectedClaim.priority}</span>
                  <span className={`status-chip ${selectedClaim.coverageStatus}`}>{selectedClaim.coverageStatus}</span>
                </div>
              </div>

              <div className="progress-strip">
                {STAGES.map((stage, index) => {
                  const currentIndex = stageIndex(selectedClaim.stage);
                  const state = index < currentIndex ? "complete" : index === currentIndex ? "active" : "upcoming";
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
                  <div className="detail-section">
                    <h3>Incident Narrative</h3>
                    <p>{selectedClaim.incidentDescription}</p>
                  </div>

                  <div className="detail-section">
                    <h3>Vehicle / Vessel</h3>
                    <div className="key-value-list">
                      <KeyValue label="Asset Type" value={selectedClaim.assetType} />
                      <KeyValue label="Unit" value={`${selectedClaim.vehicleYear} ${selectedClaim.vehicleMake} ${selectedClaim.vehicleModel}`} />
                      <KeyValue label="Incident Date" value={formatDate(selectedClaim.incidentDate)} />
                      <KeyValue label="Adjuster" value={selectedClaim.adjusterAssigned} />
                    </div>
                  </div>

                  <div className="detail-section">
                    <h3>Document Checklist</h3>
                    <div className="checklist">
                      {selectedClaim.documentChecklist.map((document) => (
                        <label className="check-row" key={document.name}>
                          <div>
                            <strong>{document.name}</strong>
                            <span>{document.status === "received" ? "Received" : "Pending"} · {document.notes}</span>
                          </div>
                          <input checked={document.status === "received"} onChange={() => toggleDocumentStatus(document.name)} type="checkbox" />
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="detail-section">
                    <h3>Coverage Determination</h3>
                    <div className="decision-banner">
                      <span className={`status-chip ${selectedClaim.coverageStatus}`}>{selectedClaim.coverageStatus}</span>
                      <p>{coverage.reason}</p>
                    </div>
                    <div className="exclusions-panel">
                      <h4>Policy Context</h4>
                      <ul>
                        <li>{coverage.policy.policyType}</li>
                        <li>{coverage.policy.determination}</li>
                        <li>Exclusions: {coverage.policy.exclusions.join(", ")}</li>
                      </ul>
                    </div>
                  </div>

                  <div className="detail-section">
                    <h3>Timeline of Actions</h3>
                    <div className="timeline-list">
                      {selectedClaim.timeline.map((event) => (
                        <div className="timeline-item" key={`${selectedClaim.claimId}-${event.timestamp}-${event.title}`}>
                          <strong>{event.title}</strong>
                          <span>{formatDateTime(event.timestamp)}</span>
                          <p>{event.detail}</p>
                        </div>
                      ))}
                    </div>
                  </div>
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
                    <h3>Exposure</h3>
                    <div className="key-value-list">
                      <KeyValue label="Estimated Payout" value={selectedClaim.payoutLabel} />
                      <KeyValue label="Missing Docs" value={String(documentStatusMissingCount(selectedClaim))} />
                      <KeyValue label="Issue" value={selectedClaim.issue || "None"} />
                    </div>
                  </div>
                  <div className="summary-block">
                    <h3>Adjuster Notes</h3>
                    <p className="notes-copy">{selectedClaim.notes || "No notes entered."}</p>
                  </div>
                  <div className="summary-block">
                    <h3>Resolution</h3>
                    <div className="resolution-actions resolution-inline">
                      <button className="action-button" onClick={closeClaim} type="button">
                        Close Claim
                      </button>
                      <span>{selectedClaim.closed ? "Closed" : "Open"}</span>
                    </div>
                  </div>
                </div>
              </section>
            </section>
          ) : null}

          {activeTab === "agent" ? (
            <section className="screen-panel agent-screen">
              <div className="agent-layout">
                <aside className="agent-sidebar">
                  <div className="agent-stack">
                    <div className="summary-block">
                      <div className="section-head">
                        <h3>Claims Queue</h3>
                        <span>{claims.length} in scope</span>
                      </div>
                      <div className="agent-queue-list">
                        {claims.map((claim) => (
                          <button
                            key={claim.claimId}
                            className={`claim-row ${selectedClaimId === claim.claimId ? "selected" : ""}`}
                            onClick={() => setSelectedClaimId(claim.claimId)}
                            type="button"
                          >
                            <div className="claim-row-top">
                              <strong>{claim.claimId}</strong>
                              <span className={`priority-badge ${claim.priority}`}>{claim.priority}</span>
                            </div>
                            <div className="claimant-name">{claim.claimantName}</div>
                            <div className="claim-row-meta">
                              <span>{stageLabel(claim.stage)}</span>
                              <span>{claim.adjusterAssigned}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="summary-block">
                      <div className="section-head">
                        <h3>Tasks</h3>
                        <span>{agentTasks.length} active</span>
                      </div>
                      <div className="task-list compact-task-list">
                        {agentTasks.map((task) => (
                          <div className={`task-row compact ${task.overdue ? "overdue" : ""}`} key={task.id}>
                            <div className="task-main">
                              <strong>{task.title}</strong>
                              <span>{task.claimId} · Due {formatDateTime(task.dueDate)}</span>
                            </div>
                            <button className="secondary-button" onClick={() => loadAgentPrompt(task)} type="button">
                              Ask Agent
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </aside>

                <div className="agent-chat-shell">
                  <div className="section-head">
                    <h2>Agent Ops</h2>
                    <span>{providerLabel(llmProvider)} · {llmModel}</span>
                  </div>
                  <div className="scope-pill">{claims.length} claims in scope</div>
                  <div className="agent-chat-panel">
                    <div className="agent-chat-history">
                      {chatMessages.map((message, index) => (
                        <div className={`chat-bubble ${message.role}`} key={`${message.role}-${index}`}>
                          <div className="chat-message-meta">
                            {message.role === "assistant" ? (
                              <>
                                <span className="chat-avatar agent-avatar">
                                  <SunburstIcon />
                                </span>
                                <strong className="chat-meta-label">AI</strong>
                              </>
                            ) : (
                              <>
                                <span className="chat-avatar user-avatar" />
                                <strong className="chat-meta-label">You</strong>
                              </>
                            )}
                          </div>
                          <p>{safeText(message.content)}</p>
                          {message.meta ? <span>{message.meta}</span> : null}
                        </div>
                      ))}
                      {chatLoading ? (
                        <div className="typing-indicator">
                          <div className="typing-dots" aria-hidden="true">
                            <span />
                            <span />
                            <span />
                          </div>
                          <span>AI is thinking...</span>
                        </div>
                      ) : null}
                    </div>
                    {chatError ? <div className="chat-error">{chatError}</div> : null}
                    <div className="prompt-pill-row">
                      {AGENT_PROMPTS.map((prompt) => (
                        <button className="prompt-pill" key={prompt} onClick={() => setChatDraft(prompt)} type="button">
                          {prompt}
                        </button>
                      ))}
                    </div>
                    <form className="chat-inline-form" onSubmit={sendChat}>
                      <textarea
                        ref={chatInputRef}
                        className="chat-inline-input"
                        rows={1}
                        placeholder="Ask about blockers, exposure, or next actions..."
                        value={chatDraft}
                        onChange={handleChatInputChange}
                        onKeyDown={handleChatKeyDown}
                      />
                      <button aria-label="Send message" className="chat-send-button" type="submit">
                        <svg viewBox="0 0 16 16" aria-hidden="true">
                          <path
                            d="M3 8h8.2M8.4 3.4 13 8l-4.6 4.6"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>
                    </form>
                  </div>
                </div>

                <aside className="agent-activity-panel">
                  <div className="section-head">
                    <h3>Agent Activity</h3>
                    <span>Recent actions</span>
                  </div>
                  <div className="activity-feed">
                    {agentFeed.map((item, index) => (
                      <div className="activity-item" key={`${item.timestamp}-${index}`}>
                        <strong>{item.title}</strong>
                        <span>{formatDateTime(item.timestamp)}</span>
                        <p>{item.detail}</p>
                        <small>{(item.claims ?? []).map((c) => typeof c === "string" ? c : (c?.claimId ?? "")).join(", ")}</small>
                      </div>
                    ))}
                  </div>
                </aside>
              </div>
            </section>
          ) : null}
        </main>

        {showIntegrationsPanel ? (
          <aside className="integration-panel">
            <div className="section-head">
              <h2>Integrations</h2>
              <span>Mock system health</span>
            </div>
            <div className="integration-list">
              {INTEGRATIONS.map((integration) => (
                <div className="integration-row" key={integration.name}>
                  <div className="integration-meta">
                    <strong>{integration.name}</strong>
                    <span className="integration-category">{integration.category}</span>
                    <span className="integration-description">{integration.description}</span>
                  </div>
                  <span className={`integration-status ${integration.status}`}>
                    <i />
                    {statusLabel(integration.status)}
                  </span>
                </div>
              ))}
            </div>
          </aside>
        ) : null}
      </section>

      {activeTab !== "agent" ? (
        <section className={`chat-dock ${chatOpen ? "open" : "closed"}`}>
          <button className="chat-toggle" onClick={() => setChatOpen((current) => !current)} type="button">
            Agent Chat {chatOpen ? "−" : "+"}
          </button>
          {chatOpen ? (
            <div className="chat-panel">
              <div className="chat-messages">
                {chatMessages.map((message, index) => (
                  <div className={`chat-bubble ${message.role}`} key={`${message.role}-${index}`}>
                    <div className="chat-message-meta">
                      {message.role === "assistant" ? (
                        <>
                          <span className="chat-avatar agent-avatar">
                            <SunburstIcon />
                          </span>
                          <strong className="chat-meta-label">AI</strong>
                        </>
                      ) : (
                        <>
                          <span className="chat-avatar user-avatar" />
                          <strong className="chat-meta-label">You</strong>
                        </>
                      )}
                    </div>
                    <p>{safeText(message.content)}</p>
                    {message.meta ? <span>{message.meta}</span> : null}
                  </div>
                ))}
                {chatLoading ? (
                  <div className="typing-indicator">
                    <div className="typing-dots" aria-hidden="true">
                      <span />
                      <span />
                      <span />
                    </div>
                    <span>AI is thinking...</span>
                  </div>
                ) : null}
              </div>
              {chatError ? <div className="chat-error">{chatError}</div> : null}
              <form className="chat-form" onSubmit={sendChat}>
                <textarea
                  onKeyDown={handleChatKeyDown}
                  placeholder="Ask about blockers, exposure, or next actions..."
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
      ) : null}

      <div aria-hidden={!configOpen} className={`config-overlay ${configOpen ? "open" : ""}`} onClick={() => setConfigOpen(false)} />
      <aside className={`config-drawer ${configOpen ? "open" : ""}`} role="dialog" aria-label="Configuration">
        <div className="config-header">
          <div>
            <p className="kicker">Settings</p>
            <h2>Configuration</h2>
          </div>
          <button aria-label="Close configuration" className="config-close" onClick={() => setConfigOpen(false)} type="button">
            ×
          </button>
        </div>

        <section className="config-section">
          <h3>AI Settings</h3>
          <div className="config-grid">
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
                <option value="google">Google</option>
              </select>
            </label>
            <label className="inline-field">
              <span>Model</span>
              <select value={llmModel} onChange={(event) => setLlmModel(event.target.value)}>
                {MODEL_OPTIONS[llmProvider].map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <section className="config-section">
          <h3>Integration Health</h3>
          <div className="config-integration-list">
            {INTEGRATIONS.map((integration) => (
              <div className="config-integration-row" key={integration.name}>
                <div className="integration-meta">
                  <strong>{integration.name}</strong>
                  <span className="integration-category">{integration.category}</span>
                  <span className="integration-description">{integration.description}</span>
                  <span className={`integration-status ${integration.status}`}>
                    <i />
                    {statusLabel(integration.status)} · Last checked {integration.lastChecked}
                  </span>
                </div>
                <button className="configure-link" type="button">
                  Configure
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="config-section">
          <h3>System Info</h3>
          <div className="key-value-list">
            <KeyValue label="Persistence" value="Browser localStorage" />
            <KeyValue label="Environment" value="Demo" />
            <KeyValue label="Version" value="0.1.0" />
          </div>
        </section>
      </aside>
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

function MetricCard({ label, value, tone = "", detail = "" }) {
  return (
    <div className={`metric-card ${tone}`.trim()}>
      <span>{label}</span>
      <strong>{value}</strong>
      {detail ? <p>{detail}</p> : null}
    </div>
  );
}

function FinancialBarChart({ data }) {
  const maxValue = Math.max(...data.flatMap((item) => [item.premiums, item.claims]), 1);
  return (
    <svg className="finance-chart" viewBox="0 0 620 260" role="img" aria-label="Monthly premiums versus claims">
      {data.map((item, index) => {
        const premiumHeight = (item.premiums / maxValue) * 150;
        const claimHeight = (item.claims / maxValue) * 150;
        const groupX = 44 + index * 92;
        return (
          <g key={item.month}>
            <rect x={groupX} y={188 - premiumHeight} width="28" height={premiumHeight} rx="4" fill="#3D7A52" />
            <rect x={groupX + 34} y={188 - claimHeight} width="28" height={claimHeight} rx="4" fill="#C8922A" />
            <text x={groupX + 31} y={216} textAnchor="middle" fill="#7A756E" fontSize="12">
              {item.month}
            </text>
          </g>
        );
      })}
      <text x="44" y="238" fill="#7A756E" fontSize="12">
        Green = Premiums
      </text>
      <text x="180" y="238" fill="#7A756E" fontSize="12">
        Amber = Claims
      </text>
    </svg>
  );
}

export default App;
