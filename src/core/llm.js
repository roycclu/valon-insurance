// Direct browser-to-LLM callers — no backend required.
// Keys are read from .env via import.meta.env (ANTHROPIC_API_KEY, OPENAI_API_KEY).
// vite.config.js sets envPrefix to expose those names to the browser bundle.
// NOTE: keys are visible in the browser for anyone who inspects network traffic.
// This is acceptable for a local demo; do not deploy to a public URL with real keys.

const ANTHROPIC_ENDPOINT = "https://api.anthropic.com/v1/messages";
const OPENAI_ENDPOINT = "https://api.openai.com/v1/chat/completions";

const TRACE_KEY = "valon-agent-traces-v1";
const TRACE_LIMIT = 50;

// ---------- Anthropic ----------

export async function callAnthropic({ model, systemPrompt, messages }) {
  const apiKey = import.meta.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set in .env");

  const t0 = performance.now();
  const response = await fetch(ANTHROPIC_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      system: systemPrompt,
      messages: messages
        .filter((m) => {
          const c = String(m.content ?? "").trim();
          return c && c !== "Response incomplete — please try again.";
        })
        .map((m) => ({ role: m.role, content: m.content })),
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || `Anthropic error ${response.status}`);
  }

  const text = (data.content ?? [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

  return {
    text: text || "Response incomplete — please try again.",
    usage: {
      input_tokens: data.usage?.input_tokens ?? 0,
      output_tokens: data.usage?.output_tokens ?? 0,
    },
    latencyMs: Math.round(performance.now() - t0),
  };
}

// ---------- OpenAI ----------

export async function callOpenAI({ model, systemPrompt, messages }) {
  const apiKey = import.meta.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set in .env");

  const t0 = performance.now();
  const response = await fetch(OPENAI_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      // gpt-5 and other reasoning models require max_completion_tokens and
      // need extra budget for reasoning tokens; other models use max_tokens.
      ...(model.startsWith("gpt-5") || model.startsWith("o1") || model.startsWith("o3")
        ? { max_completion_tokens: 2000 }
        : { max_tokens: 1000 }),
      // OpenAI chat completions requires system as the first entry in messages,
      // not as a top-level field (unlike Anthropic).
      messages: [
        { role: "system", content: systemPrompt },
        ...messages
          .filter((m) => {
            const c = String(m.content ?? "").trim();
            return c && c !== "Response incomplete — please try again.";
          })
          .map((m) => ({ role: m.role, content: m.content })),
      ],
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || `OpenAI error ${response.status}`);
  }

  const text = (data.choices?.[0]?.message?.content ?? "").trim();

  return {
    text: text || "Response incomplete — please try again.",
    usage: {
      input_tokens: data.usage?.prompt_tokens ?? 0,
      output_tokens: data.usage?.completion_tokens ?? 0,
    },
    latencyMs: Math.round(performance.now() - t0),
  };
}

// ---------- Trace logger ----------

export function logTrace({ provider, model, promptSnippet, responseSnippet, latencyMs }) {
  let traces = [];
  try {
    traces = JSON.parse(window.localStorage.getItem(TRACE_KEY) ?? "[]");
    if (!Array.isArray(traces)) traces = [];
  } catch {
    traces = [];
  }

  const entry = {
    timestamp: new Date().toISOString(),
    provider,
    model,
    promptSnippet: String(promptSnippet ?? "").slice(0, 120),
    responseSnippet: String(responseSnippet ?? "").slice(0, 120),
    latencyMs,
  };

  window.localStorage.setItem(
    TRACE_KEY,
    JSON.stringify([entry, ...traces].slice(0, TRACE_LIMIT)),
  );
}
