import { clamp } from "../../../utils/http.js";
import { fixText } from "../../../utils/textFix.js";

export function s(v, d = "") {
  return String(v ?? d).trim();
}

export function normalizeRecipient(v) {
  return fixText(s(v || "ceo")) || "ceo";
}

export function normalizeUnreadOnly(v) {
  return s(v) === "1";
}

export function normalizeLimit(v) {
  return clamp(v ?? 50, 1, 200);
}

export function normalizeNotificationId(v) {
  return s(v);
}