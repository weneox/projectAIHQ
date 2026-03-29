export function s(value, fallback = "") {
  return String(value ?? fallback).trim();
}

export function n(value, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

export function arr(value, fallback = []) {
  return Array.isArray(value) ? value : fallback;
}

export function obj(value, fallback = {}) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : fallback;
}

export function bool(value, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

export function normalizePriority(value = "medium") {
  const next = s(value).toLowerCase();
  if (["critical", "high", "medium", "low"].includes(next)) return next;
  return "medium";
}

export function normalizeConfidence(value, fallback = 0.7) {
  const next = Number(value);
  if (!Number.isFinite(next)) return fallback;
  if (next < 0) return 0;
  if (next > 1) return 1;
  return next;
}

export function priorityWeight(value = "medium") {
  switch (normalizePriority(value)) {
    case "critical":
      return 400;
    case "high":
      return 300;
    case "medium":
      return 200;
    case "low":
      return 100;
    default:
      return 0;
  }
}

export function sortByPriorityAndTime(items = []) {
  return [...arr(items)].sort((a, b) => {
    const priorityDelta =
      priorityWeight(b?.priority) - priorityWeight(a?.priority);
    if (priorityDelta !== 0) return priorityDelta;

    const timeA = Date.parse(s(a?.timestamp));
    const timeB = Date.parse(s(b?.timestamp));

    if (Number.isFinite(timeA) && Number.isFinite(timeB)) {
      return timeB - timeA;
    }

    if (Number.isFinite(timeB)) return 1;
    if (Number.isFinite(timeA)) return -1;

    return s(a?.title).localeCompare(s(b?.title));
  });
}

export function toSurfaceFromPath(path = "", fallback = "workspace") {
  const next = s(path).toLowerCase();
  if (!next) return fallback;
  if (next.startsWith("/inbox")) return "inbox";
  if (
    next.startsWith("/comments") ||
    next.startsWith("/proposals") ||
    next.startsWith("/publish")
  ) {
    return "publish";
  }
  if (
    next.startsWith("/settings") ||
    next.startsWith("/executions") ||
    next.startsWith("/voice") ||
    next.startsWith("/incidents")
  ) {
    return "expert";
  }
  if (next.startsWith("/setup") || next.startsWith("/truth") || next === "/workspace") {
    return "workspace";
  }
  return fallback;
}
