import { arr, lower, obj, s } from "../shared.js";

export { arr, lower, obj, s };

export function compactObject(input = {}) {
  const out = {};
  for (const [key, value] of Object.entries(obj(input))) {
    if (value === undefined) continue;
    if (value === null) {
      out[key] = null;
      continue;
    }
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed) continue;
      out[key] = trimmed;
      continue;
    }
    if (Array.isArray(value)) {
      out[key] = value;
      continue;
    }
    if (typeof value === "object") {
      const nested = compactObject(value);
      if (Object.keys(nested).length) out[key] = nested;
      continue;
    }
    out[key] = value;
  }
  return out;
}

export function mergeDeep(...items) {
  const result = {};

  for (const item of items) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;

    for (const [key, value] of Object.entries(item)) {
      if (Array.isArray(value)) {
        result[key] = value.map((entry) =>
          entry && typeof entry === "object" && !Array.isArray(entry)
            ? mergeDeep(entry)
            : entry
        );
        continue;
      }

      if (value && typeof value === "object") {
        result[key] = mergeDeep(
          result[key] && typeof result[key] === "object" && !Array.isArray(result[key])
            ? result[key]
            : {},
          value
        );
        continue;
      }

      if (value !== undefined) {
        result[key] = value;
      }
    }
  }

  return result;
}

export function toFiniteNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
