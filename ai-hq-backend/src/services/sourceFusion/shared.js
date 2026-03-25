// src/services/sourceFusion/shared.js
// FINAL v3.0 — core shared helpers for source fusion

function s(v, d = "") {
  return String(v ?? d).trim();
}

function arr(v, fallback = []) {
  return Array.isArray(v) ? v : fallback;
}

function obj(v, fallback = {}) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : fallback;
}

function lower(v) {
  return s(v).toLowerCase();
}

function n(v, d = 0) {
  const x = Number(v);
  return Number.isFinite(x) ? x : d;
}

function compactText(text = "", max = 800) {
  const x = s(text).replace(/\s+/g, " ").trim();
  if (!x) return "";
  if (x.length <= max) return x;

  const slice = x.slice(0, max - 1);
  const lastSpace = slice.lastIndexOf(" ");
  const safeSlice =
    lastSpace >= Math.floor(max * 0.65) ? slice.slice(0, lastSpace) : slice;

  return `${safeSlice.trim()}…`;
}

function uniqStrings(list = []) {
  const out = [];
  const seen = new Set();

  for (const item of arr(list)) {
    const x = s(item);
    if (!x) continue;

    const key = lower(x);
    if (seen.has(key)) continue;

    seen.add(key);
    out.push(x);
  }

  return out;
}

function uniqBy(list = [], keyFn = (x) => x) {
  const out = [];
  const seen = new Set();

  for (const item of arr(list)) {
    const key = s(keyFn(item));
    if (!key || seen.has(key)) continue;

    seen.add(key);
    out.push(item);
  }

  return out;
}

function normalizeConfidence(v, d = 0) {
  const x = Number(v);
  if (!Number.isFinite(x)) return d;
  if (x < 0) return 0;
  if (x > 1 && x <= 100) return x / 100;
  if (x > 1) return 1;
  return x;
}

function confidenceLabel(v = 0) {
  const x = normalizeConfidence(v, 0);
  if (x >= 0.92) return "very_high";
  if (x >= 0.8) return "high";
  if (x >= 0.6) return "medium";
  return "low";
}

function safeKeyPart(x = "", fallback = "item", max = 72) {
  const v = lower(x)
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, max);

  return v || fallback;
}

function normalizeCompareText(text = "") {
  return lower(text)
    .replace(/&/g, " and ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeObservedText(text = "") {
  return compactText(normalizeCompareText(text), 400);
}

function normalizeObservedEmail(email = "") {
  return lower(email);
}

function normalizeObservedPhone(raw = "") {
  const source = s(raw);
  if (!source) return "";

  const digits = source.replace(/[^\d]/g, "");
  if (!digits) return "";

  if (digits.startsWith("994") && digits.length === 12) {
    return `+${digits}`;
  }

  if (digits.length === 10 && digits.startsWith("0")) {
    return `+994${digits.slice(1)}`;
  }

  if (digits.length === 9) {
    return `+994${digits}`;
  }

  if (source.includes("+")) {
    return `+${digits}`;
  }

  return digits;
}

function normalizeObservedUrl(raw = "") {
  const input = s(raw);
  if (!input) return "";

  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(input)
    ? input
    : `https://${input.replace(/^\/+/, "")}`;

  try {
    const u = new URL(withScheme);

    const dropParams = new Set([
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_term",
      "utm_content",
      "utm_id",
      "fbclid",
      "gclid",
      "gbraid",
      "wbraid",
      "mc_cid",
      "mc_eid",
      "ref",
      "ref_src",
      "source",
      "share",
      "igshid",
      "mibextid",
      "trk",
      "tracking",
      "_hsenc",
      "_hsmi",
    ]);

    for (const key of [...u.searchParams.keys()]) {
      const lk = lower(key);
      if (
        dropParams.has(lk) ||
        lk.startsWith("utm_") ||
        lk.startsWith("ga_") ||
        lk.startsWith("pk_")
      ) {
        u.searchParams.delete(key);
      }
    }

    u.hash = "";

    const pathname = u.pathname.replace(/\/+$/, "") || "/";
    const search = u.searchParams.toString();

    return `${u.protocol}//${u.host.toLowerCase()}${pathname}${search ? `?${search}` : ""}`;
  } catch {
    return input;
  }
}

function isTruthyUrl(value = "") {
  const x = s(value);
  if (!x) return false;

  try {
    const u = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(x) ? x : `https://${x}`);
    return !!u.protocol && !!u.hostname;
  } catch {
    return false;
  }
}

function hostnameOf(value = "") {
  try {
    const u = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(s(value)) ? s(value) : `https://${s(value)}`);
    return u.hostname.toLowerCase();
  } catch {
    return "";
  }
}

function isLikelyBusinessWebsiteUrl(value = "") {
  const url = normalizeObservedUrl(value);
  if (!isTruthyUrl(url)) return false;

  const host = hostnameOf(url);
  if (!host) return false;

  if (
    host === "schema.org" ||
    host.endsWith(".schema.org") ||
    host === "google.com" ||
    host.endsWith(".google.com") ||
    host === "maps.app.goo.gl" ||
    host.endsWith(".googleusercontent.com") ||
    host === "instagram.com" ||
    host === "www.instagram.com" ||
    host === "facebook.com" ||
    host === "www.facebook.com" ||
    host === "m.facebook.com" ||
    host === "wa.me" ||
    host === "api.whatsapp.com" ||
    host === "linkedin.com" ||
    host === "www.linkedin.com" ||
    host === "youtube.com" ||
    host === "www.youtube.com" ||
    host === "youtu.be" ||
    host === "tiktok.com" ||
    host === "www.tiktok.com" ||
    host === "x.com" ||
    host === "twitter.com"
  ) {
    return false;
  }

  return true;
}

function inferSocialPlatform(url = "", fallback = "") {
  const explicit = lower(fallback);
  if (explicit) return explicit;

  const host = hostnameOf(url);

  if (host.includes("instagram")) return "instagram";
  if (host.includes("facebook")) return "facebook";
  if (host.includes("wa.me") || host.includes("whatsapp")) return "whatsapp";
  if (host.includes("tiktok")) return "tiktok";
  if (host.includes("linkedin")) return "linkedin";
  if (host.includes("youtube") || host.includes("youtu.be")) return "youtube";
  if (host.includes("x.com") || host.includes("twitter")) return "x";

  return "social";
}

export {
  arr,
  compactText,
  confidenceLabel,
  hostnameOf,
  inferSocialPlatform,
  isLikelyBusinessWebsiteUrl,
  isTruthyUrl,
  lower,
  n,
  normalizeCompareText,
  normalizeConfidence,
  normalizeObservedEmail,
  normalizeObservedPhone,
  normalizeObservedText,
  normalizeObservedUrl,
  obj,
  s,
  safeKeyPart,
  uniqBy,
  uniqStrings,
};