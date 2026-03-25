// src/services/workspace/shared.js
// FINAL v1.2 — shared helpers for workspace services

export function s(v, d = "") {
  return String(v ?? d).trim();
}

export function num(v, d = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

export function arr(v, fallback = []) {
  return Array.isArray(v) ? v : fallback;
}

export function obj(v, fallback = {}) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : fallback;
}

export function lower(v) {
  return s(v).toLowerCase();
}

export function bool(v) {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v > 0;

  const x = lower(v);
  if (!x) return false;
  if (["0", "false", "no", "n", "off", "disabled", "inactive"].includes(x)) {
    return false;
  }

  return ["1", "true", "yes", "y", "on", "enabled", "active"].includes(x);
}

export function uniq(list = []) {
  return [...new Set(arr(list).map((x) => s(x)).filter(Boolean))];
}

export function compactText(text = "", max = 400) {
  const x = s(text).replace(/\s+/g, " ").trim();
  if (!x) return "";
  if (x.length <= max) return x;
  return `${x.slice(0, max - 1).trim()}…`;
}

export function extractItems(value) {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return [];

  const candidates = [
    value.items,
    value.rows,
    value.results,
    value.data,
    value.entries,
    value.candidates,
    value.services,
    value.playbooks,
    value.sources,
    value.knowledge,
  ];

  for (const item of candidates) {
    if (Array.isArray(item)) return item;
  }

  return [];
}

export function normalizeStringArray(value) {
  if (Array.isArray(value)) {
    return uniq(value.map((x) => s(x)).filter(Boolean));
  }

  const raw = s(value);
  if (!raw) return [];

  if (raw.startsWith("[") && raw.endsWith("]")) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return uniq(parsed.map((x) => s(x)).filter(Boolean));
      }
    } catch {
      // noop
    }
  }

  return uniq(
    raw
      .split(/[,\n|/]/)
      .map((x) => s(x))
      .filter(Boolean)
  );
}

export function pickDateValue(row) {
  const x = obj(row, {});
  return s(
    x.finished_at ||
      x.completed_at ||
      x.updated_at ||
      x.created_at ||
      x.synced_at ||
      x.last_synced_at
  );
}