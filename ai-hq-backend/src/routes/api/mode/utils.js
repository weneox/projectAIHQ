import { cfg } from "../../../config.js";
import { fixText } from "../../../utils/textFix.js";

export function s(v, d = "") {
  return String(v ?? d).trim();
}

export function normalizeMode(x) {
  const v = s(x).toLowerCase();
  return v === "auto" ? "auto" : "manual";
}

export function resolveTenantKey(input) {
  return fixText(s(input || cfg.tenant.defaultTenantKey || "default")) || "default";
}