import { arr, obj, s } from "../draftShared.js";

export const REVIEW_MESSAGE =
  "Setup drafts stay separate from approved truth and the strict runtime until a later review and approval step is completed.";

export const SETUP_ASSISTANT_NAMESPACE = "setup_assistant";
export const SETUP_ASSISTANT_SOURCE_TYPE = "setup_assistant";
export const SETUP_ASSISTANT_CURRENT_STEP = "business_model";

export const SETUP_BUSINESS_SECTION = "business";
export const SETUP_BEHAVIOR_SECTION = "assistant_behavior";

export const SETUP_PHASE_BUSINESS_TRUTH = "business_truth";
export const SETUP_PHASE_CONVERSATION_POLICY = "conversation_policy";
export const SETUP_PHASE_REVIEW_AND_LAUNCH = "review_and_launch";

export const SOURCE_PRIORITY = {
  "": 0,
  manual: 1,
  facebook: 2,
  instagram: 2,
  google_maps: 3,
  website: 4,
};

export const BEHAVIOR_POLICY_KEYS = [
  "pricing",
  "location",
  "booking",
  "contact",
  "handoff",
  "greeting",
  "closing",
  "tone",
];

export const PRICING_BEHAVIOR_MODES = [
  "answer_first",
  "answer_then_link",
  "link_first",
  "ask_service_first",
  "quote_first",
];

export const LOCATION_BEHAVIOR_MODES = [
  "text_only",
  "text_then_map",
  "map_first",
];

export const BOOKING_BEHAVIOR_MODES = [
  "best_available",
  "route_whatsapp",
  "route_instagram",
  "route_website",
  "collect_then_route",
];

export const CONTACT_BEHAVIOR_MODES = [
  "best_available",
  "whatsapp_first",
  "call_first",
  "email_first",
  "link_first",
];

export const HANDOFF_BEHAVIOR_MODES = [
  "contextual_handoff",
  "ask_then_handoff",
  "direct_handoff",
];

export const GREETING_BEHAVIOR_MODES = [
  "warm_professional",
  "brief_professional",
  "premium_concierge",
  "friendly_local",
];

export const CLOSING_BEHAVIOR_MODES = [
  "warm_invite",
  "brief_invite",
  "premium_invite",
  "soft_close",
];

export const TONE_BEHAVIOR_MODES = [
  "professional_reassuring",
  "warm_human",
  "premium_polished",
  "direct_clear",
];

export const MESSAGE_LENGTH_MODES = [
  "concise",
  "balanced",
  "detailed",
];

export const EMPATHY_LEVEL_MODES = [
  "light",
  "balanced",
  "high",
];

export const WEBSITE_PATTERN =
  /\b((?:https?:\/\/)?(?:www\.)?[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+(?:\/[^\s]*)?)\b/i;

const PRICING_TARGET_PATTERNS = [
  /\/pricing(?:\/|$)/i,
  /\/prices?(?:\/|$)/i,
  /\/price-list(?:\/|$)/i,
  /\/menu(?:\/|$)/i,
  /\bpricing\b/i,
  /\bprices?\b/i,
  /\bqiym[eə]t\b/i,
  /\bmenu\b/i,
];

const LOCATION_TARGET_PATTERNS = [
  /\/location(?:\/|$)/i,
  /\/locations(?:\/|$)/i,
  /\/find-us(?:\/|$)/i,
  /\/contact(?:\/|$)/i,
  /\bmap\b/i,
  /\bdirections?\b/i,
  /\bx[eə]rit[eə]\b/i,
  /\bgoogle maps\b/i,
];

const BOOKING_TARGET_PATTERNS = [
  /\/book(?:\/|$)/i,
  /\/booking(?:\/|$)/i,
  /\/reserve(?:\/|$)/i,
  /\/reservation(?:\/|$)/i,
  /\/appointment(?:\/|$)/i,
  /\bbook now\b/i,
  /\bappointment\b/i,
  /\breserve\b/i,
  /\bwa\.me\b/i,
];

const CONTACT_TARGET_PATTERNS = [
  /\/contact(?:\/|$)/i,
  /\bwhatsapp\b/i,
  /\btelegram\b/i,
  /\bemail\b/i,
  /\bcall\b/i,
  /\bphone\b/i,
  /\bdm\b/i,
];

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

export function normalizeBehaviorPolicyKey(value = "") {
  const key = s(value).toLowerCase();
  if (!key) return "";
  if (key === "pricing_policy") return "pricing";
  if (key === "location_policy") return "location";
  if (key === "booking_policy") return "booking";
  if (key === "contact_policy") return "contact";
  if (key === "handoff_policy") return "handoff";
  if (key === "greeting_policy") return "greeting";
  if (key === "closing_policy") return "closing";
  if (key === "tone_policy") return "tone";
  return BEHAVIOR_POLICY_KEYS.includes(key) ? key : "";
}

export function normalizePricingBehaviorMode(value = "") {
  const raw = s(value).toLowerCase();

  if (raw === "answer then link") return "answer_then_link";
  if (raw === "link first") return "link_first";
  if (raw === "ask service first") return "ask_service_first";
  if (raw === "quote first") return "quote_first";
  if (raw === "answer first") return "answer_first";

  if (PRICING_BEHAVIOR_MODES.includes(raw)) return raw;
  return "";
}

export function normalizeLocationBehaviorMode(value = "") {
  const raw = s(value).toLowerCase();

  if (raw === "text then map") return "text_then_map";
  if (raw === "map first") return "map_first";
  if (raw === "text only") return "text_only";
  if (
    (raw.includes("address") || raw.includes("unvan") || raw.includes("ünvan")) &&
    (raw.includes("map") || raw.includes("xerite") || raw.includes("xəritə"))
  ) {
    return "text_then_map";
  }

  if (LOCATION_BEHAVIOR_MODES.includes(raw)) return raw;
  return "";
}

export function normalizeBookingBehaviorMode(value = "") {
  const raw = s(value).toLowerCase();

  if (raw === "route whatsapp") return "route_whatsapp";
  if (raw === "route instagram") return "route_instagram";
  if (raw === "route website") return "route_website";
  if (raw === "collect then route") return "collect_then_route";
  if (raw === "best available") return "best_available";

  if (BOOKING_BEHAVIOR_MODES.includes(raw)) return raw;
  return "";
}

export function normalizeContactBehaviorMode(value = "") {
  const raw = s(value).toLowerCase();

  if (raw === "whatsapp first") return "whatsapp_first";
  if (raw === "call first") return "call_first";
  if (raw === "email first") return "email_first";
  if (raw === "link first") return "link_first";
  if (raw === "best available") return "best_available";

  if (CONTACT_BEHAVIOR_MODES.includes(raw)) return raw;
  return "";
}

export function normalizeHandoffBehaviorMode(value = "") {
  const raw = s(value).toLowerCase();

  if (raw === "contextual handoff") return "contextual_handoff";
  if (raw === "ask then handoff") return "ask_then_handoff";
  if (raw === "direct handoff") return "direct_handoff";

  if (HANDOFF_BEHAVIOR_MODES.includes(raw)) return raw;
  return "";
}

export function normalizeGreetingBehaviorMode(value = "") {
  const raw = s(value).toLowerCase();

  if (raw === "warm professional") return "warm_professional";
  if (raw === "brief professional") return "brief_professional";
  if (raw === "premium concierge") return "premium_concierge";
  if (raw === "friendly local") return "friendly_local";

  if (GREETING_BEHAVIOR_MODES.includes(raw)) return raw;
  return "";
}

export function normalizeClosingBehaviorMode(value = "") {
  const raw = s(value).toLowerCase();

  if (raw === "warm invite") return "warm_invite";
  if (raw === "brief invite") return "brief_invite";
  if (raw === "premium invite") return "premium_invite";
  if (raw === "soft close") return "soft_close";

  if (CLOSING_BEHAVIOR_MODES.includes(raw)) return raw;
  return "";
}

export function normalizeToneBehaviorMode(value = "") {
  const raw = s(value).toLowerCase();

  if (raw === "professional reassuring") return "professional_reassuring";
  if (raw === "warm human") return "warm_human";
  if (raw === "premium polished") return "premium_polished";
  if (raw === "direct clear") return "direct_clear";

  if (TONE_BEHAVIOR_MODES.includes(raw)) return raw;
  return "";
}

export function normalizeMessageLengthMode(value = "") {
  const raw = s(value).toLowerCase();
  if (MESSAGE_LENGTH_MODES.includes(raw)) return raw;
  return "";
}

export function normalizeEmpathyLevelMode(value = "") {
  const raw = s(value).toLowerCase();
  if (EMPATHY_LEVEL_MODES.includes(raw)) return raw;
  return "";
}

export function buildDefaultAssistantBehaviorDraft() {
  return {
    platformDefaults: {
      greetingMode: "warm_professional",
      closingMode: "warm_invite",
      toneMode: "professional_reassuring",
      messageLength: "balanced",
      empathyLevel: "balanced",
      emojiPolicy: "minimal",
      askOneQuestionAtATime: true,
      avoidHardSell: true,
      admitUncertainty: true,
      neverInventBusinessFacts: true,
      useCustomerProvidedNameCarefully: true,
      languageMode: "match_customer_when_safe",
      handoffPriority: "protect_trust",
    },

    tenantOverrides: {
      enabled: true,
      greetingOverrideActive: false,
      closingOverrideActive: false,
      toneOverrideActive: false,
    },

    greetingPolicy: {
      mode: "warm_professional",
      openingLine: "",
      followupLeadIn: "",
      mentionBusinessName: true,
      mentionChannelContext: false,
      note: "",
    },

    closingPolicy: {
      mode: "warm_invite",
      closingLine: "",
      includeNextStepPrompt: true,
      includeHumanOfferWhenRelevant: true,
      note: "",
    },

    tonePolicy: {
      mode: "professional_reassuring",
      messageLength: "balanced",
      empathyLevel: "balanced",
      shouldStayConcise: true,
      shouldAvoidOverexplaining: true,
      shouldSoundPremium: false,
      shouldSoundLocalFriendly: false,
      note: "",
    },

    pricingPolicy: {
      mode: "answer_then_link",
      publicAnswerAllowed: true,
      redirectEnabled: true,
      shouldSummarizeBeforeRedirect: true,
      askServiceFirst: false,
      preferredTargetType: "pricing_page",
      preferredTargetUrl: "",
      fallbackTargetUrl: "",
      note: "",
    },

    locationPolicy: {
      mode: "text_then_map",
      redirectEnabled: true,
      shouldSummarizeBeforeRedirect: true,
      preferredTargetType: "map",
      preferredTargetUrl: "",
      fallbackTargetUrl: "",
      note: "",
    },

    bookingPolicy: {
      mode: "best_available",
      redirectEnabled: true,
      collectLeadFirst: false,
      preferredTargetType: "booking",
      preferredTargetUrl: "",
      fallbackTargetUrl: "",
      note: "",
    },

    contactPolicy: {
      mode: "best_available",
      preferredChannel: "",
      preferredTargetType: "contact",
      preferredTargetUrl: "",
      fallbackTargetUrl: "",
      note: "",
    },

    handoffPolicy: {
      mode: "contextual_handoff",
      requiresReason: true,
      note: "",
    },
  };
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

export function inferTargetPurpose(value = "", label = "") {
  const text = `${s(value)} ${s(label)}`.trim();
  if (!text) return "general";

  if (isGoogleMapsUrl(safeParseUrl(text))) return "location";

  if (PRICING_TARGET_PATTERNS.some((pattern) => pattern.test(text))) {
    return "pricing";
  }
  if (LOCATION_TARGET_PATTERNS.some((pattern) => pattern.test(text))) {
    return "location";
  }
  if (BOOKING_TARGET_PATTERNS.some((pattern) => pattern.test(text))) {
    return "booking";
  }
  if (CONTACT_TARGET_PATTERNS.some((pattern) => pattern.test(text))) {
    return "contact";
  }

  return "general";
}

export function buildBehaviorTargetCandidate(value = "", label = "") {
  const url = normalizeWebsiteUrl(s(value));
  if (!url) return null;

  return {
    url,
    label: s(label),
    purpose: inferTargetPurpose(url, label),
    sourceType: classifySetupSourceValue(url) || "website",
  };
}

export function pickBehaviorTargetByPurpose(candidates = [], purpose = "") {
  const safePurpose = normalizeBehaviorPolicyKey(purpose) || s(purpose).toLowerCase();

  return (
    arr(candidates).find((item) => s(item.purpose).toLowerCase() === safePurpose) ||
    null
  );
}

export function mergeBehaviorTargetCandidates(...groups) {
  const out = [];
  const seen = new Set();

  for (const group of groups) {
    for (const item of arr(group)) {
      const row = obj(item);
      const key = s(row.url).toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push({
        url: s(row.url),
        label: s(row.label),
        purpose: s(row.purpose || inferTargetPurpose(row.url, row.label)),
        sourceType: s(row.sourceType || classifySetupSourceValue(row.url)),
      });
    }
  }

  return out;
}