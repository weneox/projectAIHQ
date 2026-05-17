import { arr, obj, s } from "../draftShared.js";

export const REVIEW_MESSAGE =
  "Setup drafts stay separate from approved truth and the strict runtime until a later review and approval step is completed.";

export const SETUP_ASSISTANT_NAMESPACE = "setup_assistant";
export const SETUP_ASSISTANT_SOURCE_TYPE = "setup_assistant";
export const SETUP_ASSISTANT_CURRENT_STEP = "business_model";

export const SETUP_BUSINESS_SECTION = "business";
export const SETUP_PHASE_BUSINESS_TRUTH = "business_truth";
export const SETUP_PHASE_REVIEW_AND_LAUNCH = "review_and_launch";

export const SOURCE_PRIORITY = {
  "": 0,
  manual: 1,
  facebook: 2,
  instagram: 2,
  google_maps: 3,
  website: 4,
};

export const WEBSITE_PATTERN =
  /\b((?:https?:\/\/)?(?:www\.)?[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+(?:\/[^\s]*)?)\b/i;

export function nowIso() {
  return new Date().toISOString();
}

export function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(obj(value), key);
}

export function slugify(value = "") {
  return s(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function normalizeWebsiteUrl(value = "") {
  const raw = s(value);
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.includes(".") && !raw.includes(" ")) return `https://${raw}`;
  return raw;
}

export function normalizeSourceType(value = "") {
  const type = s(value).toLowerCase();
  if (type === "facebook_page") return "facebook";
  return type;
}

export function buildUrlCandidate(value = "") {
  const text = s(value);
  if (!text || /\s/.test(text)) return "";
  if (/^https?:\/\//i.test(text)) return text;
  if (
    /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+(?:[/?#].*)?$/i.test(
      text
    )
  ) {
    return `https://${text}`;
  }
  return "";
}

export function safeParseUrl(value = "") {
  const candidate = buildUrlCandidate(value);
  if (!candidate) return null;

  try {
    return new URL(candidate);
  } catch {
    return null;
  }
}

export function normalizedHost(url = null) {
  return s(url?.host).toLowerCase().replace(/^www\./, "");
}

export function isGoogleMapsUrl(url = null) {
  const host = normalizedHost(url);
  const path = s(url?.pathname).toLowerCase();

  if (host === "maps.google.com") return true;
  if (host === "maps.app.goo.gl") return true;
  if (host === "g.page") return true;
  if (host === "goo.gl" && path.startsWith("/maps")) return true;
  if (
    (host === "google.com" || host.endsWith(".google.com")) &&
    path.startsWith("/maps")
  ) {
    return true;
  }

  return false;
}

export function isInstagramUrl(url = null) {
  const host = normalizedHost(url);
  return host === "instagram.com" || host === "instagr.am";
}

export function isFacebookUrl(url = null) {
  const host = s(url?.host).toLowerCase();
  return (
    host === "facebook.com" ||
    host === "www.facebook.com" ||
    host === "m.facebook.com" ||
    host === "fb.com" ||
    host === "www.fb.com"
  );
}

export function classifySetupSourceValue(value = "") {
  const text = s(value);
  if (!text) return "";
  if (/^@[\w.]{1,30}$/i.test(text)) return "instagram";

  const url = safeParseUrl(text);
  if (!url) return "";

  if (isGoogleMapsUrl(url)) return "google_maps";
  if (isInstagramUrl(url)) return "instagram";
  if (isFacebookUrl(url)) return "facebook";
  return "website";
}

export function sourceTypeLabel(value = "") {
  const type = normalizeSourceType(value);
  if (type === "google_maps") return "Google Maps";
  if (type === "instagram") return "Instagram";
  if (type === "facebook") return "Facebook";
  if (type === "website") return "Website";
  if (type === "manual") return "Manual note";
  return "Source";
}

export function buildRecognizedSourceCandidate(text = "") {
  const match = s(text).match(WEBSITE_PATTERN);
  if (!match?.[1]) return null;

  const value = normalizeWebsiteUrl(match[1]);
  const type = classifySetupSourceValue(value);
  if (!type) return null;

  return {
    type,
    value,
    raw: match[1],
  };
}

export function normalizeStringArray(value = [], limit = 24) {
  return arr(value)
    .map((item) => s(item))
    .filter(Boolean)
    .slice(0, limit);
}

export function uniqueStrings(value = [], limit = 24) {
  return Array.from(new Set(normalizeStringArray(value, limit))).slice(0, limit);
}

export function inferContactType(value = "") {
  const text = s(value).toLowerCase();
  if (!text) return "";
  if (text.includes("@")) return "email";
  if (text.includes("whatsapp")) return "whatsapp";
  if (text.includes("telegram")) return "telegram";
  if (
    text.includes("http") ||
    text.includes("www.") ||
    text.includes("instagram.com") ||
    text.includes("wa.me")
  ) {
    return "link";
  }
  if (/[0-9+() -]{6,}/.test(text)) return "phone";
  return "primary";
}

export function splitAnswerList(value = "", limit = 24) {
  return String(value || "")
    .split(/\n|,|;|\u2022/g)
    .map((item) => s(item))
    .filter(Boolean)
    .slice(0, limit);
}

export function hasNonManualSourceIdentity(sourceMetadata = {}) {
  const sourceType = normalizeSourceType(sourceMetadata.primarySourceType);
  if (!sourceType || sourceType === "manual") return false;
  return Boolean(
    s(sourceMetadata.primarySourceUrl) || arr(sourceMetadata.sourceLabels).length
  );
}

