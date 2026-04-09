export function s(value, fallback = "") {
  return String(value ?? fallback).trim();
}

export function compactSentence(value, fallback = "", maxLength = 180) {
  const text = s(value, fallback);
  if (!text) return "";
  const first = text.split(/(?<=[.!?])\s+/)[0] || text;
  return first.length > maxLength
    ? `${first.slice(0, maxLength - 3).trim()}...`
    : first;
}

export function normalizeNavigationAction(action = null, fallback = null) {
  const primary = action && typeof action === "object" ? action : {};
  const secondary = fallback && typeof fallback === "object" ? fallback : {};
  const path = s(
    primary.path || primary.target?.path || secondary.path || secondary.target?.path
  );
  const label = s(primary.label || secondary.label);

  if (!path && !label) return null;

  return {
    label: label || "Open",
    path: path || "/home",
  };
}

export function toneFromReadiness(state = null) {
  const status = s(state?.status).toLowerCase();
  if (status === "ready" || status === "success") return "success";
  if (status === "attention" || status === "warning") return "warning";
  if (status === "blocked" || status === "danger" || status === "error") {
    return "danger";
  }
  return "info";
}
