export function s(v, d = "") {
  return String(v ?? d).trim();
}

export function n(v, d = 0) {
  const x = Number(v);
  return Number.isFinite(x) ? x : d;
}

export function b(v, d = false) {
  if (typeof v === "boolean") return v;
  const x = String(v ?? "").trim().toLowerCase();
  if (!x) return d;
  if (["1", "true", "yes", "y", "on"].includes(x)) return true;
  if (["0", "false", "no", "n", "off"].includes(x)) return false;
  return d;
}

export function isObj(v) {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

export function toArray(v) {
  return Array.isArray(v) ? v : [];
}

export function normalizePhone(v) {
  return s(v).replace(/[^\\d+]/g, "");
}

export function isLiveVoiceStatus(v) {
  const x = String(v || "").trim().toLowerCase();
  return [
    "live",
    "active",
    "in_progress",
    "ongoing",
    "ringing",
    "queued",
    "bridged",
    "bot_active",
    "agent_ringing",
    "agent_whisper",
    "agent_live",
  ].includes(x);
}

export function sameTenant(a, b) {
  return s(a) === s(b);
}

export function normalizeTranscriptItem(input = {}) {
  return {
    ts: s(input.ts || new Date().toISOString()),
    role: s(input.role || "customer"),
    text: s(input.text),
  };
}
