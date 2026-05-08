// Vercel serverless function — Anthropic chat proxy.
// Keeps ANTHROPIC_API_KEY server-side; the browser never sees it.

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "ANTHROPIC_API_KEY is not configured" });
  }

  const { messages, system, model, max_tokens = 1024 } = req.body;

  const t0 = Date.now();

  let anthropicRes;
  try {
    anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({ model, max_tokens, system, messages }),
    });
  } catch (err) {
    return res.status(502).json({ error: `Upstream fetch failed: ${err.message}` });
  }

  const data = await anthropicRes.json();

  if (!anthropicRes.ok) {
    return res.status(anthropicRes.status).json({ error: data.error?.message || "Anthropic API error" });
  }

  const text = (data.content ?? [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

  return res.status(200).json({
    message: text || "Response incomplete — please try again.",
    usage: data.usage ?? {},
    latency_ms: Date.now() - t0,
  });
}
