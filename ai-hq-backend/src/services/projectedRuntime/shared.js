export function s(v, d = "") {
  return String(v ?? d).trim();
}

export function lower(v, d = "") {
  return s(v, d).toLowerCase();
}

export function arr(v) {
  return Array.isArray(v) ? v : [];
}

export function obj(v) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : {};
}
