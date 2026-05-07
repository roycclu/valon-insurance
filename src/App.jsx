import { useEffect, useMemo, useState } from "react";

const stageDefinitions = [
  { id: "intake", label: "Stage 1", title: "FNOL Intake" },
  { id: "triage", label: "Stage 2", title: "AI Triage" },
  { id: "documents", label: "Stage 3", title: "Document Collection" },
  { id: "coverage", label: "Stage 4", title: "Coverage Check" },
  { id: "escalation", label: "Stage 5", title: "Escalation" },
];

const emptyForm = {
  claimant_name: "",
  policy_number: "MC-204812",
  incident_date: "",
  incident_description: "",
  injury_involved: false,
  vehicle_damage_severity: "minor",
};

function App() {
  const [claims, setClaims] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [selectedClaimId, setSelectedClaimId] = useState(null);
  const [formState, setFormState] = useState(emptyForm);

  useEffect(() => {
    fetch("/api/claims")
      .then((response) => response.json())
      .then((data) => {
        setClaims(data.claims);
        setMetrics(data.metrics);
        setSelectedClaimId(data.claims[0]?.id ?? null);
      });
  }, []);

  const selectedClaim = useMemo(
    () => claims.find((claim) => claim.id === selectedClaimId) ?? claims[0] ?? null,
    [claims, selectedClaimId],
  );

  const replaceClaim = (updatedClaim, updatedMetrics) => {
    setClaims((current) =>
      current.map((claim) => (claim.id === updatedClaim.id ? updatedClaim : claim)),
    );
    setMetrics(updatedMetrics);
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    const response = await fetch("/api/claims", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formState),
    });
    const data = await response.json();
    setClaims((current) => [data.claim, ...current]);
    setMetrics(data.metrics);
    setSelectedClaimId(data.claim.id);
    setFormState(emptyForm);
  };

  const toggleDocument = async (documentKey, received) => {
    if (!selectedClaim) return;
    const response = await fetch(`/api/claims/${selectedClaim.id}/documents/${documentKey}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ received }),
    });
    const data = await response.json();
    replaceClaim(data.claim, data.metrics);
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Valon Claims Ops</p>
          <h1>Motorcycle Insurance Claims Workflow</h1>
        </div>
        <div className="topbar-meta">
          <span>AI-native adjudication demo</span>
          <span>{claims.length} active files</span>
        </div>
      </header>

      <section className="pipeline">
        {stageDefinitions.map((stage, index) => (
          <div className={`pipeline-stage ${stage.id}`} key={stage.id}>
            <span>{stage.label}</span>
            <strong>{stage.title}</strong>
            {index < stageDefinitions.length - 1 ? <i /> : null}
          </div>
        ))}
      </section>

      <section className="dashboard-grid">
        <aside className="claims-pane panel">
          <div className="panel-header">
            <h2>Claims Queue</h2>
            <span>Preloaded + live intake</span>
          </div>
          <div className="claims-list">
            {claims.map((claim) => (
              <button
                key={claim.id}
                className={`claim-card ${selectedClaim?.id === claim.id ? "selected" : ""}`}
                onClick={() => setSelectedClaimId(claim.id)}
                type="button"
              >
                <div className="claim-card-row">
                  <strong>{claim.id}</strong>
                  <span className={`pill ${claim.triage.priority.toLowerCase()}`}>
                    {claim.triage.priority}
                  </span>
                </div>
                <p>{claim.claimant_name}</p>
                <div className="claim-card-row muted">
                  <span>{claim.status}</span>
                  <span>{claim.policy_number}</span>
                </div>
              </button>
            ))}
          </div>
        </aside>

        <main className="detail-pane">
          <section className="metrics-grid">
            <MetricCard label="Active Claims" value={metrics?.active_claims ?? "--"} />
            <MetricCard label="Escalation Rate" value={`${metrics?.escalation_rate ?? "--"}%`} />
            <MetricCard
              label="Open Escalations"
              value={claims.filter((claim) => claim.escalation).length}
            />
            <MetricCard
              label="Claims by Status"
              value={
                metrics
                  ? Object.entries(metrics.claims_by_status)
                      .map(([key, value]) => `${key}: ${value}`)
                      .join(" / ")
                  : "--"
              }
            />
          </section>

          <section className="panel ops-summary">
            <div className="panel-header">
              <h2>Dashboard View</h2>
              <span>Operational throughput and status mix</span>
            </div>
            <div className="ops-summary-grid">
              <article className="summary-block">
                <h3>Average Time Per Stage</h3>
                <div className="summary-list">
                  {metrics
                    ? Object.entries(metrics.average_time_per_stage).map(([stage, value]) => (
                        <div className="summary-row" key={stage}>
                          <span>{stage}</span>
                          <strong>{value} min</strong>
                        </div>
                      ))
                    : <span className="muted-copy">Loading metrics...</span>}
                </div>
              </article>
              <article className="summary-block">
                <h3>Claims By Status</h3>
                <div className="summary-list">
                  {metrics
                    ? Object.entries(metrics.claims_by_status).map(([status, value]) => (
                        <div className="summary-row" key={status}>
                          <span>{status}</span>
                          <strong>{value}</strong>
                        </div>
                      ))
                    : <span className="muted-copy">Loading statuses...</span>}
                </div>
              </article>
              <article className="summary-block">
                <h3>Queue Signal</h3>
                <div className="summary-list">
                  <div className="summary-row">
                    <span>Highest Priority In Queue</span>
                    <strong>{claims.some((claim) => claim.triage.priority === "High") ? "High" : "Medium/Low"}</strong>
                  </div>
                  <div className="summary-row">
                    <span>Denied Coverage Files</span>
                    <strong>{claims.filter((claim) => claim.coverage.decision === "Denied").length}</strong>
                  </div>
                  <div className="summary-row">
                    <span>Docs Still Pending</span>
                    <strong>
                      {
                        claims.filter((claim) =>
                          claim.documents.some((document) => !document.received),
                        ).length
                      }
                    </strong>
                  </div>
                </div>
              </article>
            </div>
          </section>

          <section className="panel intake-panel">
            <div className="panel-header">
              <h2>New FNOL Intake</h2>
              <span>Uses demo policy records</span>
            </div>
            <form className="intake-form" onSubmit={onSubmit}>
              <label>
                Claimant Name
                <input
                  value={formState.claimant_name}
                  onChange={(event) => setFormState({ ...formState, claimant_name: event.target.value })}
                  required
                />
              </label>
              <label>
                Policy Number
                <select
                  value={formState.policy_number}
                  onChange={(event) => setFormState({ ...formState, policy_number: event.target.value })}
                >
                  <option value="MC-204812">MC-204812</option>
                  <option value="MC-557903">MC-557903</option>
                  <option value="MC-998401">MC-998401</option>
                </select>
              </label>
              <label>
                Incident Date
                <input
                  type="date"
                  value={formState.incident_date}
                  onChange={(event) => setFormState({ ...formState, incident_date: event.target.value })}
                  required
                />
              </label>
              <label className="full-span">
                Incident Description
                <textarea
                  value={formState.incident_description}
                  onChange={(event) => setFormState({ ...formState, incident_description: event.target.value })}
                  required
                />
              </label>
              <label>
                Injury Involved
                <select
                  value={String(formState.injury_involved)}
                  onChange={(event) =>
                    setFormState({ ...formState, injury_involved: event.target.value === "true" })
                  }
                >
                  <option value="false">No</option>
                  <option value="true">Yes</option>
                </select>
              </label>
              <label>
                Damage Severity
                <select
                  value={formState.vehicle_damage_severity}
                  onChange={(event) =>
                    setFormState({ ...formState, vehicle_damage_severity: event.target.value })
                  }
                >
                  <option value="minor">Minor</option>
                  <option value="moderate">Moderate</option>
                  <option value="severe">Severe</option>
                </select>
              </label>
              <button className="primary-button full-span" type="submit">
                Submit Claim Intake
              </button>
            </form>
          </section>

          {selectedClaim ? (
            <section className="panel workflow-panel">
              <div className="panel-header">
                <div>
                  <h2>{selectedClaim.id}</h2>
                  <span>
                    {selectedClaim.claimant_name} · {selectedClaim.created_at}
                  </span>
                </div>
                <span className={`pill ${selectedClaim.triage.priority.toLowerCase()}`}>
                  {selectedClaim.triage.priority} Priority
                </span>
              </div>

              <div className="workflow-grid">
                <StageCard title="Stage 1 — FNOL Intake">
                  <DetailItem label="Claimant" value={selectedClaim.claimant_name} />
                  <DetailItem label="Policy" value={selectedClaim.policy_number} />
                  <DetailItem label="Incident Date" value={selectedClaim.incident_date} />
                  <DetailItem label="Damage Severity" value={selectedClaim.vehicle_damage_severity} />
                  <DetailItem label="Injury" value={selectedClaim.injury_involved ? "Yes" : "No"} />
                  <p className="narrative">{selectedClaim.incident_description}</p>
                </StageCard>

                <StageCard title="Stage 2 — AI Triage">
                  <div className="decision-block">
                    <span className={`pill ${selectedClaim.triage.priority.toLowerCase()}`}>
                      {selectedClaim.triage.priority}
                    </span>
                    <p>{selectedClaim.triage.reasoning}</p>
                  </div>
                </StageCard>

                <StageCard title="Stage 3 — Document Collection">
                  <div className="document-list">
                    {selectedClaim.documents.map((document) => (
                      <label className="document-row" key={document.key}>
                        <div>
                          <strong>{document.label}</strong>
                          <span>{document.received ? "Received" : "Pending"}</span>
                        </div>
                        <input
                          checked={document.received}
                          onChange={(event) => toggleDocument(document.key, event.target.checked)}
                          type="checkbox"
                        />
                      </label>
                    ))}
                  </div>
                </StageCard>

                <StageCard title="Stage 4 — Coverage Check">
                  <DetailItem
                    label="Decision"
                    value={`${selectedClaim.coverage.decision} · ${selectedClaim.coverage.reason}`}
                  />
                  <DetailItem label="Policy Plan" value={selectedClaim.coverage.policy.plan_name} />
                  <DetailItem
                    label="Covered Incidents"
                    value={selectedClaim.coverage.policy.covered_incident_types.join(", ")}
                  />
                  <DetailItem
                    label="Exclusions"
                    value={selectedClaim.coverage.policy.exclusions.join(", ")}
                  />
                  {selectedClaim.coverage.flagged_exclusions.length ? (
                    <p className="flagged">
                      Flagged: {selectedClaim.coverage.flagged_exclusions.join(", ")}
                    </p>
                  ) : null}
                </StageCard>

                <StageCard title="Stage 5 — Escalation">
                  {selectedClaim.escalation ? (
                    <>
                      <DetailItem label="Assigned Adjuster" value={selectedClaim.escalation.assigned_adjuster} />
                      <DetailItem label="Queue Status" value={selectedClaim.escalation.queue_status} />
                      <DetailItem label="Reason" value={selectedClaim.escalation.reason} />
                      <DetailItem
                        label="SLA Timer"
                        value={`${selectedClaim.escalation.sla_minutes_remaining} min remaining`}
                      />
                    </>
                  ) : (
                    <p className="muted-copy">No escalation required. Claim remains in straight-through workflow.</p>
                  )}
                </StageCard>
              </div>
            </section>
          ) : null}
        </main>
      </section>
    </div>
  );
}

function MetricCard({ label, value }) {
  return (
    <article className="metric-card panel">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function StageCard({ title, children }) {
  return (
    <article className="stage-card">
      <h3>{title}</h3>
      <div>{children}</div>
    </article>
  );
}

function DetailItem({ label, value }) {
  return (
    <div className="detail-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export default App;
