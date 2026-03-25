import crypto from "node:crypto";
import { normalizeUrl } from "../../../utils/http.js";
import { arr, lower, obj, s } from "../shared.js";

export { arr, lower, obj, s, normalizeUrl };

export const SOURCE_TABLES = ["tenant_sources", "sources"];
export const SOURCE_RUN_TABLES = ["tenant_source_sync_runs", "source_sync_runs"];
export const SUPPORTED_SOURCE_TYPES = new Set(["website", "google_maps", "instagram"]);

export function isUuid(value = "") {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    s(value)
  );
}

export function safeUuidOrNull(value = "") {
  const x = s(value);
  return isUuid(x) ? x : null;
}

export function looksLikeEmail(value = "") {
  const x = s(value);
  return !!x && /^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(x);
}

export function normalizeActorContext({
  requestedBy = "",
  requestedByUserId = "",
  requestedByEmail = "",
  requestedByName = "",
} = {}) {
  const rawRequestedBy = s(requestedBy);
  const userId = safeUuidOrNull(requestedByUserId) || safeUuidOrNull(rawRequestedBy);
  const email = looksLikeEmail(requestedByEmail)
    ? s(requestedByEmail)
    : looksLikeEmail(rawRequestedBy)
      ? rawRequestedBy
      : "";
  const name = s(requestedByName);

  return {
    rawRequestedBy,
    userId: userId || "",
    email,
    name,
    auditValue: userId || email || name || rawRequestedBy || "system",
  };
}

export function safeKeyPart(value = "", fallback = "item", max = 32) {
  const out = lower(value)
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, max);

  return out || fallback;
}

export function shortHash(value = "", len = 16) {
  return crypto.createHash("sha1").update(s(value)).digest("hex").slice(0, len);
}

export function hostnameFromUrl(url = "") {
  try {
    return new URL(normalizeUrl(url)).hostname.replace(/^www\./i, "");
  } catch {
    return "";
  }
}

export function instagramHandleFromUrl(url = "") {
  try {
    const u = new URL(normalizeUrl(url));
    if (!/instagram\.com$/i.test(u.hostname.replace(/^www\./i, ""))) return "";

    const parts = u.pathname
      .split("/")
      .map((x) => s(x))
      .filter(Boolean);

    const first = s(parts[0]).replace(/^@+/, "");
    if (!first) return "";
    if (["p", "reel", "tv", "stories", "explore", "accounts"].includes(lower(first))) {
      return "";
    }

    return first;
  } catch {
    return "";
  }
}

export function sourceTypeLabel(sourceType = "") {
  const x = lower(sourceType);
  if (x === "google_maps") return "Google Maps";
  if (x === "website") return "Website";
  if (x === "instagram") return "Instagram";
  return "Source";
}

export function sourceAuthorityClass(sourceType = "") {
  const x = lower(sourceType);

  if (x === "website") return "website";
  if (x === "google_maps") return "weak_public";
  if (x === "instagram") return "official_connected";

  return "unknown";
}

export function normalizeSourceType(value = "") {
  const x = lower(value);
  if (!SUPPORTED_SOURCE_TYPES.has(x)) {
    throw new Error(`Unsupported source type: ${value || "unknown"}`);
  }
  return x;
}

export function normalizeSourceRecord(item = null) {
  const x = obj(item);

  const sourceType = lower(x.sourceType || x.source_type || x.type);
  const url = normalizeUrl(x.url || x.sourceUrl || x.source_url || "");
  const label =
    s(x.label) ||
    s(x.title) ||
    s(x.name) ||
    s(x.displayName) ||
    s(x.display_name);

  if (!sourceType && !url && !label) return null;

  return {
    sourceType: sourceType || "",
    url: url || "",
    label,
    isPrimary:
      typeof x.isPrimary === "boolean"
        ? x.isPrimary
        : typeof x.primary === "boolean"
          ? x.primary
          : false,
  };
}

export function buildSourceDisplayName({ sourceType, url }) {
  const label = sourceTypeLabel(sourceType);

  if (lower(sourceType) === "instagram") {
    const handle = instagramHandleFromUrl(url);
    if (handle) return `${label} — @${handle}`.slice(0, 160);
  }

  const host = hostnameFromUrl(url);
  if (!host) return label;
  return `${label} — ${host}`.slice(0, 160);
}

export function normalizeIntakeContext({
  sourceType = "",
  url = "",
  note = "",
  sources = [],
  primarySource = null,
  metadataJson = {},
} = {}) {
  const normalizedType = normalizeSourceType(sourceType);
  const normalizedUrl = normalizeUrl(url);

  const normalizedSources = arr(sources)
    .map((item) => normalizeSourceRecord(item))
    .filter(Boolean);

  const normalizedPrimary =
    normalizeSourceRecord(primarySource) ||
    normalizedSources.find((item) => item.isPrimary) || {
      sourceType: normalizedType,
      url: normalizedUrl,
      label: buildSourceDisplayName({
        sourceType: normalizedType,
        url: normalizedUrl,
      }),
      isPrimary: true,
    };

  const allSources = [
    ...normalizedSources,
    {
      sourceType: normalizedType,
      url: normalizedUrl,
      label: buildSourceDisplayName({
        sourceType: normalizedType,
        url: normalizedUrl,
      }),
      isPrimary: true,
    },
  ]
    .map((item) => normalizeSourceRecord(item))
    .filter(Boolean);

  const dedupedSources = [];
  const seen = new Set();

  for (const item of allSources) {
    const key = `${lower(item.sourceType)}|${lower(item.url)}`;
    if (!key || seen.has(key)) continue;
    seen.add(key);

    dedupedSources.push({
      ...item,
      isPrimary:
        item.url === normalizedPrimary.url &&
        lower(item.sourceType) === lower(normalizedPrimary.sourceType),
    });
  }

  return {
    note: s(note),
    primarySource: {
      sourceType: s(normalizedPrimary.sourceType || normalizedType),
      url: s(normalizedPrimary.url || normalizedUrl),
      label:
        s(normalizedPrimary.label) ||
        buildSourceDisplayName({
          sourceType: normalizedPrimary.sourceType || normalizedType,
          url: normalizedPrimary.url || normalizedUrl,
        }),
      isPrimary: true,
    },
    sources: dedupedSources,
    sourceCount: dedupedSources.length,
    sourceTypes: [...new Set(dedupedSources.map((item) => lower(item.sourceType)).filter(Boolean))],
    metadataJson: obj(metadataJson),
  };
}

export function buildSourceKey({ sourceType, url }) {
  const normalizedType = normalizeSourceType(sourceType);
  const normalizedUrl = normalizeUrl(url);

  if (!normalizedUrl) {
    throw new Error("Valid source URL is required for source_key");
  }

  const host = safeKeyPart(hostnameFromUrl(normalizedUrl), "source", 28);
  const digest = shortHash(`${normalizedType}|${normalizedUrl}`, 16);

  return `${normalizedType}_${host}_${digest}`.slice(0, 120);
}

export function buildRunKey({ sourceId, sourceType, sourceUrl }) {
  const normalizedType = normalizeSourceType(sourceType);
  const normalizedUrl = normalizeUrl(sourceUrl);
  const sourcePart = safeKeyPart(sourceId, "source", 18);
  const hostPart = safeKeyPart(hostnameFromUrl(normalizedUrl), "host", 18);
  const timePart = Date.now().toString(36);
  const digest = shortHash(
    `${sourceId}|${normalizedType}|${normalizedUrl}|${timePart}`,
    12
  );

  return `run_${normalizedType}_${hostPart}_${sourcePart}_${timePart}_${digest}`.slice(
    0,
    140
  );
}

export function buildRequestId({ tenantId = "", tenantKey = "", sourceType = "", url = "" }) {
  return `imp_${shortHash(
    `${tenantId}|${tenantKey}|${sourceType}|${normalizeUrl(url)}|${Date.now()}`,
    20
  )}`;
}

export function buildSetupReviewTitle({ sourceType = "", url = "" }) {
  const label = sourceTypeLabel(sourceType);

  if (lower(sourceType) === "instagram") {
    const handle = instagramHandleFromUrl(url);
    return handle ? `${label} import — @${handle}` : `${label} import`;
  }

  const host = hostnameFromUrl(url);
  return host ? `${label} import — ${host}` : `${label} import`;
}

export function nowIso() {
  return new Date().toISOString();
}

export function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function cloneJson(value, fallback) {
  if (value === undefined) return fallback;

  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return fallback;
  }
}

export function compactObject(value = {}) {
  const input = obj(value);
  const out = {};

  for (const [key, raw] of Object.entries(input)) {
    if (raw == null) continue;

    if (Array.isArray(raw)) {
      if (raw.length) out[key] = raw;
      continue;
    }

    if (isPlainObject(raw)) {
      const nested = compactObject(raw);
      if (Object.keys(nested).length) out[key] = nested;
      continue;
    }

    if (typeof raw === "string") {
      const text = s(raw);
      if (text) out[key] = text;
      continue;
    }

    out[key] = raw;
  }

  return out;
}

export function mergeDeep(...items) {
  const out = {};

  for (const item of items) {
    const source = obj(item);

    for (const [key, raw] of Object.entries(source)) {
      if (raw === undefined || raw === null) continue;

      if (Array.isArray(raw)) {
        if (raw.length) out[key] = cloneJson(raw, []);
        continue;
      }

      if (isPlainObject(raw) && isPlainObject(out[key])) {
        out[key] = mergeDeep(out[key], raw);
        continue;
      }

      if (isPlainObject(raw)) {
        const cleaned = compactObject(raw);
        if (Object.keys(cleaned).length) out[key] = cleaned;
        continue;
      }

      if (typeof raw === "string") {
        const text = s(raw);
        if (text) out[key] = text;
        continue;
      }

      out[key] = raw;
    }
  }

  return out;
}

export function uniqStrings(values = []) {
  return [...new Set(arr(values).map((x) => s(x)).filter(Boolean))];
}

export function normalizeDraftKey(value = "", fallback = "item") {
  return safeKeyPart(value, fallback, 72);
}

export function sanitizeProfilePatch(input = {}) {
  const x = obj(input);

  const preferred =
    obj(x.profileJson) ||
    obj(x.profile_json) ||
    obj(x.businessProfile) ||
    obj(x.business_profile) ||
    obj(x.profile);

  if (Object.keys(preferred).length) {
    return compactObject(preferred);
  }

  const ignored = new Set([
    "tenantId",
    "tenantKey",
    "sourceId",
    "sourceRunId",
    "sourceType",
    "reviewSessionId",
    "createdAt",
    "updatedAt",
    "id",
  ]);

  const raw = {};

  for (const [key, value] of Object.entries(x)) {
    if (ignored.has(key)) continue;
    raw[key] = value;
  }

  return compactObject(raw);
}

export function sanitizeCapabilitiesPatch(input = {}) {
  const x = obj(input);

  const preferred =
    obj(x.capabilitiesJson) ||
    obj(x.capabilities_json) ||
    obj(x.capabilities) ||
    obj(x.signals);

  return compactObject(preferred);
}