import { fixText } from "../../../utils/textFix.js";
import { getDefaultTenantKey, resolveTenantKey } from "../../../tenancy/index.js";

export function asObj(x) {
  return x && typeof x === "object" && !Array.isArray(x) ? x : {};
}

export function asArr(x) {
  return Array.isArray(x) ? x : [];
}

export function clean(x) {
  return String(x || "").trim();
}

export function resolveTenant(v) {
  return resolveTenantKey(v, getDefaultTenantKey());
}

export function pickAspectRatioFromFormat(format) {
  const f = clean(format).toLowerCase();
  if (f === "reel") return "9:16";
  if (f === "image") return "4:5";
  return "1:1";
}

export function normalizeAspectRatio(v, format = "") {
  const x = clean(v);
  if (x === "1:1" || x === "4:5" || x === "9:16") return x;
  return pickAspectRatioFromFormat(format);
}

export function normalizeFormat(v) {
  const f = clean(v).toLowerCase();
  if (f === "image" || f === "carousel" || f === "reel") return f;
  return "carousel";
}

export function resolveRenderTenantKey(body, defaultTenantKey) {
  return (
    fixText(
      resolveTenant(
        clean(body?.tenantKey || body?.tenantId || defaultTenantKey)
      )
    ) || defaultTenantKey
  );
}