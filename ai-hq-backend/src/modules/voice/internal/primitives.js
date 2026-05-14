import { s } from "../shared.js";

export function obj(v) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : {};
}

export function arr(v) {
  return Array.isArray(v) ? v : [];
}

export function firstNonEmpty(...values) {
  for (const value of values) {
    const normalized = s(value);
    if (normalized) return normalized;
  }
  return "";
}

export function pickBoolean(...values) {
  for (const value of values) {
    if (typeof value === "boolean") return value;
  }
  return false;
}

export function pickArray(...values) {
  for (const value of values) {
    if (Array.isArray(value)) return value;
  }
  return [];
}

export function lower(v) {
  return s(v).toLowerCase();
}
