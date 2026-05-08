// Anthropic calls are proxied through /api/chat (Vercel serverless) — key stays server-side.
// OpenAI calls remain direct browser-to-API (key read from import.meta.env).

const OPENAI_ENDPOINT = "https://api.openai.com/v1/chat/completions";

const TRACE_KEY = "valon-agent-traces-v1";
const TRACE_LIMIT = 50;

// ---------- Anthropic (via /api/chat proxy) ----------

export async function callAnthropic({ model, systemPrompt, messages }) {
  const t0 = performance.now();
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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
    throw new Error(data.error || `Proxy error ${response.status}`);
  }

  return {
    text: data.message,
    usage: {
      input_tokens: data.usage?.input_tokens ?? 0,
      output_tokens: data.usage?.output_tokens ?? 0,
    },
    latencyMs: data.latency_ms ?? Math.round(performance.now() - t0),
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
