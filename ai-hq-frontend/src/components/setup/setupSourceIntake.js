function s(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function lower(value, fallback = "") {
  return s(value, fallback).toLowerCase();
}

function buildUrlCandidate(value = "") {
  const text = s(value);
  if (!text || /\s/.test(text)) return "";
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(text)) return text;
  if (
    /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+(?:[/?#].*)?$/i.test(
      text
    )
  ) {
    return `https://${text}`;
  }
  return "";
}

function safeParseUrl(value = "") {
  const candidate = buildUrlCandidate(value);
  if (!candidate) return null;

  try {
    return new URL(candidate);
  } catch {
    return null;
  }
}

function urlHost(url = null) {
  return lower(url?.host).replace(/^www\./, "");
}

function isGoogleMapsUrl(url = null) {
  const host = urlHost(url);
  const path = lower(url?.pathname);

  if (host === "maps.google.com") return true;
  if (host === "maps.app.goo.gl") return true;
  if (host === "g.page") return true;
  if (host === "goo.gl" && path.startsWith("/maps")) return true;
  if ((host === "google.com" || host.endsWith(".google.com")) && path.startsWith("/maps")) {
    return true;
  }

  return false;
}

function isInstagramUrl(url = null) {
  const host = urlHost(url);
  return host === "instagram.com" || host === "instagr.am";
}

function isFacebookUrl(url = null) {
  const host = lower(url?.host);
  return (
    host === "facebook.com" ||
    host === "www.facebook.com" ||
    host === "m.facebook.com" ||
    host === "fb.com" ||
    host === "www.fb.com"
  );
}

export function classifySetupSourceInput(value = "") {
  const text = s(value);
  if (!text) return "manual";
  if (/^@[\w.]{1,30}$/i.test(text)) return "instagram";

  const url = safeParseUrl(text);
  if (!url) return "manual";

  if (isGoogleMapsUrl(url)) return "google_maps";
  if (isInstagramUrl(url)) return "instagram";
  if (isFacebookUrl(url)) return "facebook";
  return "website";
}

export function normalizeSetupSourceValue(type = "", value = "") {
  const sourceType = lower(type);
  const text = s(value);
  if (!text) return "";

  if (sourceType === "instagram" && /^@[\w.]{1,30}$/i.test(text)) {
    return `https://instagram.com/${text.replace(/^@/, "")}`;
  }

  return buildUrlCandidate(text) || text;
}

export function resolveSetupSourceInput(value = "") {
  const type = classifySetupSourceInput(value);

  return {
    type,
    value: normalizeSetupSourceValue(type, value),
    isImportedSource:
      type === "website" || type === "google_maps" || type === "instagram",
  };
}
