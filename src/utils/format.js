export function formatDate(value) {
  if (!value) return "--";
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

export function formatDateTime(value) {
  if (!value) return "--";
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatPercent(value) {
  return `${value.toFixed(1)}%`;
}

export function formatInteger(value) {
  return new Intl.NumberFormat("en-US").format(value);
}

export function providerLabel(value) {
  return value === "openai" ? "OpenAI" : value === "google" ? "Google" : "Anthropic";
}

export function statusLabel(value) {
  if (value === "not-configured") return "Not configured";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
