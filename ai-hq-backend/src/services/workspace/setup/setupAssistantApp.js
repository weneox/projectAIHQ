import {
  getCurrentSetupReview,
  getOrCreateActiveSetupReviewSession,
  patchSetupReviewDraft,
  updateSetupReviewSession,
} from "../../../db/helpers/tenantSetupReview.js";
import {
  arr,
  compactDraftObject,
  mergeDraftState,
  obj,
  s,
  safeUuidOrNull,
} from "./draftShared.js";
import { auditSetupAction } from "./auditApp.js";
import { buildSetupAssistantServiceCatalog } from "./setupAssistantCatalog.js";
import {
  parseHoursNote,
  parsePricingNote,
  parseServicesNote,
  sanitizeStructuredHours,
} from "./setupAssistantParser.js";

const REVIEW_MESSAGE =
  "Setup drafts stay separate from approved truth and the strict runtime until a later review and approval step is completed.";

const SETUP_ASSISTANT_NAMESPACE = "setup_assistant";
const SETUP_ASSISTANT_SOURCE_TYPE = "setup_assistant";
const SETUP_ASSISTANT_CURRENT_STEP = "setup_assistant";

const SECTION_ORDER = [
  "profile",
  "services",
  "hours",
  "pricing",
  "contacts",
  "handoff",
];

const PROFILE_FIELDS_ORDER = ["company", "description", "website"];

const SECTION_META = {
  profile: {
    label: "Business profile",
    title: "Confirm who the business is",
    missing:
      "Add the core business identity so future AI replies can anchor on real business truth.",
    review:
      "Core identity exists, but some profile fields still need confirmation or polish.",
    ready: "Core business identity is captured in the draft.",
    prompt:
      "Confirm the business profile first: website, business name, and a reliable short description.",
    placeholder: "Paste a website or describe the business in one line",
  },
  company: {
    label: "Business name",
    title: "Confirm the business name",
    prompt: "What is the business name?",
    placeholder: "e.g. Neox Studio",
  },
  description: {
    label: "Business summary",
    title: "Describe what the business does",
    prompt: "In one or two lines, what does the business mainly do?",
    placeholder: "e.g. Premium AI automation and customer operations for local businesses.",
  },
  website: {
    label: "Website",
    title: "Add the main website",
    prompt: "What is the main website URL?",
    placeholder: "e.g. https://example.com",
  },
  services: {
    label: "Services",
    title: "Curate the service menu",
    missing:
      "Select the real services the business wants AI to talk about. Avoid giant generic lists.",
    review:
      "Services exist, but they still need confirmation, cleanup, or stronger structure.",
    ready: "Service coverage is already drafted in a structured form.",
    prompt:
      "List the core services in plain language, and I will convert them into structured service items.",
    placeholder: "e.g. Consultation, Tax filing, Payroll support",
  },
  hours: {
    label: "Business hours",
    title: "Lock in structured weekly hours",
    missing:
      "Business hours are still missing. Structured hours matter for accurate reply promises.",
    review:
      "Hours exist, but they still need confirmation before the system should rely on them.",
    ready: "Weekly hours are drafted in a structured schedule.",
    prompt:
      "Paste rough opening hours and I will convert them into a weekly schedule.",
    placeholder: "Mon-Fri 09:00-18:00; Sat 10:00-14:00; Sun closed",
  },
  pricing: {
    label: "Pricing",
    title: "Choose a safe pricing posture",
    missing:
      "Pricing still needs a structured reply policy so AI does not improvise unsafe price answers.",
    review:
      "Pricing posture exists, but it still needs confirmation or refinement.",
    ready: "Pricing has a structured public reply posture.",
    prompt:
      "Paste a rough pricing note and I will turn it into a structured pricing policy.",
    placeholder: "Starts from 50 AZN. Exact quotes depend on the service.",
  },
  contacts: {
    label: "Contacts",
    title: "Set the main customer contact lanes",
    missing:
      "At least one reliable public contact is needed so AI can hand customers to a real channel.",
    review:
      "Contacts exist, but they still need confirmation or stronger prioritization.",
    ready: "A reliable customer contact path is present in the draft.",
    prompt:
      "Add the best public contact routes for customers, like phone, WhatsApp, or email.",
    placeholder: "Phone +994..., WhatsApp link, support@company.com",
  },
  handoff: {
    label: "Operator handoff",
    title: "Define when AI should escalate",
    missing:
      "Operator handoff rules are still light. Capture the cases where AI should stop and bring in a human.",
    review:
      "Handoff rules exist, but they still need stronger escalation detail.",
    ready: "Operator escalation rules are present in the draft.",
    prompt:
      "Describe when AI should escalate to an operator or manager.",
    placeholder: "Complaints, urgent requests, custom quotes, payment disputes",
  },
};

const INTENT_ONLY_RESPONSES = {
  "i'll share the business name now.": "company",
  "let's start from the website.": "website",
  "let's use instagram as a source.": "company",
  "i want to write the business details manually.": "company",
  "i'll list the services now.": "services",
  "i want to paste a rough services note.": "services",
  "let's define pricing posture first.": "pricing",
  "let's skip services for now and continue.": "__skip__",
  "i'll share the working hours now.": "hours",
  "the business is appointment only.": "__appointment_only__",
  "the business is open 24/7.": "__always_open__",
  "pricing starts from a visible base amount.": "pricing",
  "exact pricing requires a quote.": "__quote_required__",
  "i want to define what ai can say publicly about pricing.": "pricing",
  "let's continue.": "__continue__",
  "i want to add more detail here.": "__continue__",
};

const WEBSITE_PATTERN =
  /\b((?:https?:\/\/)?(?:www\.)?[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+(?:\/[^\s]*)?)\b/i;

function nowIso() {
  return new Date().toISOString();
}

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(obj(value), key);
}

function slugify(value = "") {
  return s(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function normalizeWebsiteUrl(value = "") {
  const raw = s(value);
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.includes(".") && !raw.includes(" ")) return `https://${raw}`;
  return raw;
}

function normalizeStringArray(value = [], limit = 24) {
  return arr(value)
    .map((item) => s(item))
    .filter(Boolean)
    .slice(0, limit);
}

function uniqueStrings(value = [], limit = 24) {
  return Array.from(new Set(normalizeStringArray(value, limit))).slice(0, limit);
}

function inferContactType(value = "") {
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

function splitAnswerList(value = "", limit = 24) {
  return String(value || "")
    .split(/\n|,|;|\u2022/g)
    .map((item) => s(item))
    .filter(Boolean)
    .slice(0, limit);
}

function sanitizeBusinessProfile(value = {}) {
  const source = obj(value);
  return compactDraftObject({
    companyName: s(
      source.companyName ||
        source.company_name ||
        source.displayName ||
        source.companyTitle ||
        source.name
    ),
    description: s(
      source.description ||
        source.summary ||
        source.summaryLong ||
        source.companySummaryLong ||
        source.summaryShort ||
        source.companySummaryShort
    ),
    websiteUrl: normalizeWebsiteUrl(
      source.websiteUrl || source.website_url || source.website
    ),
  });
}

function sanitizeServiceItem(value = {}) {
  const source = obj(value);
  const title = s(source.title || source.name || source.label);
  if (!title) return null;

  return compactDraftObject({
    key: s(source.key || source.serviceKey || source.service_key) || slugify(title),
    title,
    summary: s(
      source.summary || source.description || source.detail || source.notes
    ),
    category: s(source.category || "general").toLowerCase() || "general",
    priceLabel: s(
      source.priceLabel ||
        source.price_label ||
        source.price ||
        source.priceRange
    ),
    aliases: uniqueStrings(source.aliases, 12),
    availabilityStatus:
      s(source.availabilityStatus || source.availability_status).toLowerCase() ||
      "available",
    operatorNotes: s(source.operatorNotes || source.operator_notes),
  });
}

function sanitizeServices(value = []) {
  const out = [];
  const seen = new Set();

  for (const item of arr(value)) {
    const normalized = sanitizeServiceItem(item);
    if (!normalized) continue;
    const dedupeKey = `${s(normalized.key).toLowerCase()}|${s(
      normalized.title
    ).toLowerCase()}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    out.push(normalized);
  }

  return out.slice(0, 100);
}

function sanitizeContactItem(value = {}) {
  const source = obj(value);
  const type = s(
    source.type || source.channel || inferContactType(source.value)
  ).toLowerCase();
  const label = s(source.label || source.title);
  const entryValue = s(source.value || source.contact || source.address);
  if (!type && !label && !entryValue) return null;

  return compactDraftObject({
    type,
    label,
    value: entryValue,
    preferred: source.preferred === true,
    visibility: s(source.visibility || source.scope).toLowerCase() || "public",
  });
}

function sanitizeContacts(value = []) {
  return arr(value)
    .map(sanitizeContactItem)
    .filter(Boolean)
    .slice(0, 100);
}

function normalizeCurrency(value = "") {
  const upper = s(value).toUpperCase();
  if (!upper) return "";
  if (upper === "$") return "USD";
  if (upper === "\u20ac") return "EUR";
  if (upper === "\u20bc") return "AZN";
  if (upper === "\u00a3") return "GBP";
  return upper;
}

function sanitizePerServicePricingItem(value = {}) {
  const source = obj(value);
  const title = s(source.title || source.serviceTitle);
  const serviceKey = s(source.serviceKey || source.service_key || slugify(title));
  if (!title && !serviceKey) return null;

  return compactDraftObject({
    serviceKey: serviceKey || slugify(title),
    title,
    mode: s(source.mode || "fixed_price").toLowerCase(),
    startingAt:
      source.startingAt ?? source.starting_at ?? source.startingPrice ?? null,
    minPrice: source.minPrice ?? source.min_price ?? null,
    maxPrice: source.maxPrice ?? source.max_price ?? null,
    priceLabel: s(source.priceLabel || source.price_label || source.price),
  });
}

function sanitizePricingPosture(value = {}) {
  const source = obj(value);
  const legacyMode = s(source.mode || source.posture || source.model).toLowerCase();
  const pricingMode =
    s(source.pricingMode || source.pricing_mode).toLowerCase() ||
    (legacyMode === "quote_based" ? "quote_required" : legacyMode);
  const publicSummary =
    s(source.publicSummary || source.public_summary) ||
    s(source.summary || source.description);

  return compactDraftObject({
    pricingMode,
    currency: normalizeCurrency(source.currency || "AZN") || "AZN",
    publicSummary,
    startingAt:
      source.startingAt ?? source.starting_at ?? source.priceFrom ?? null,
    minPrice: source.minPrice ?? source.min_price ?? null,
    maxPrice: source.maxPrice ?? source.max_price ?? null,
    perServicePricing: arr(source.perServicePricing || source.per_service_pricing)
      .map(sanitizePerServicePricingItem)
      .filter(Boolean)
      .slice(0, 40),
    allowPublicPriceReplies:
      typeof source.allowPublicPriceReplies === "boolean"
        ? source.allowPublicPriceReplies
        : typeof source.allow_public_price_replies === "boolean"
        ? source.allow_public_price_replies
        : pricingMode && !["operator_only", "quote_required"].includes(pricingMode),
    requiresOperatorForExactQuote:
      typeof source.requiresOperatorForExactQuote === "boolean"
        ? source.requiresOperatorForExactQuote
        : typeof source.requires_operator_for_exact_quote === "boolean"
        ? source.requires_operator_for_exact_quote
        : ["quote_required", "operator_only", "variable_by_service", "promotional"].includes(
            pricingMode
          ),
    pricingNotes: s(
      source.pricingNotes || source.pricing_notes || source.notes || source.summary
    ),
    pricingConfidence: s(
      source.pricingConfidence || source.pricing_confidence
    ).toLowerCase(),
    operatorEscalationRules: uniqueStrings(
      source.operatorEscalationRules || source.operator_escalation_rules,
      12
    ),
  });
}

function sanitizeHandoffRules(value = {}) {
  const source = obj(value);
  return compactDraftObject({
    enabled:
      source.enabled === true ||
      Boolean(
        s(source.summary || source.description || source.notes) ||
          arr(source.triggers).length
      ),
    summary: s(source.summary || source.description || source.notes),
    triggers: uniqueStrings(source.triggers, 24),
    channels: uniqueStrings(source.channels, 12),
    escalationTarget: s(
      source.escalationTarget || source.escalation_target || source.target
    ),
  });
}

function sanitizeProgress(value = {}) {
  const source = obj(value);
  return compactDraftObject({
    skippedQuestions: uniqueStrings(source.skippedQuestions, 32),
    lastAnsweredStep: s(source.lastAnsweredStep).toLowerCase(),
    currentQuestionKey: s(source.currentQuestionKey).toLowerCase(),
    updatedAt: source.updatedAt || null,
  });
}

function sanitizeSourceMetadata(value = {}) {
  const source = obj(value);
  return compactDraftObject({
    primarySourceType: s(source.primarySourceType || source.primary_source_type),
    primarySourceUrl: s(source.primarySourceUrl || source.primary_source_url),
    sourceLabels: uniqueStrings(source.sourceLabels, 12),
    evidenceSummary: uniqueStrings(source.evidenceSummary, 12),
    warningCount: Number(source.warningCount || 0) || 0,
    sourceCount: Number(source.sourceCount || 0) || 0,
  });
}

function sanitizeAssistantState(value = {}) {
  const source = obj(value);
  return compactDraftObject({
    activeSection: s(source.activeSection || source.active_section).toLowerCase(),
    lastParsedPricingNote: s(
      source.lastParsedPricingNote || source.last_parsed_pricing_note
    ),
    lastParsedHoursNote: s(
      source.lastParsedHoursNote || source.last_parsed_hours_note
    ),
    lastParsedServicesNote: s(
      source.lastParsedServicesNote || source.last_parsed_services_note
    ),
    lastUpdatedSection: s(
      source.lastUpdatedSection || source.last_updated_section
    ).toLowerCase(),
  });
}

function sanitizeSetupAssistantCore(value = {}) {
  return {
    businessProfile: sanitizeBusinessProfile(
      obj(value.businessProfile || value.business_profile)
    ),
    services: sanitizeServices(value.services),
    contacts: sanitizeContacts(value.contacts),
    hours: sanitizeStructuredHours(value.hours),
    pricingPosture: sanitizePricingPosture(
      obj(value.pricingPosture || value.pricing_posture || value.pricing)
    ),
    handoffRules: sanitizeHandoffRules(
      obj(value.handoffRules || value.handoff_rules || value.handoff)
    ),
    sourceMetadata: sanitizeSourceMetadata(
      obj(value.sourceMetadata || value.source_metadata)
    ),
    assistantState: sanitizeAssistantState(
      obj(value.assistantState || value.assistant_state)
    ),
    progress: sanitizeProgress(value.progress),
  };
}

function mergeBusinessProfile(left = {}, right = {}) {
  return sanitizeBusinessProfile({
    ...obj(left),
    ...obj(right),
  });
}

function mergePricingPosture(left = {}, right = {}) {
  return sanitizePricingPosture({
    ...obj(left),
    ...obj(right),
    perServicePricing:
      right.perServicePricing !== undefined
        ? right.perServicePricing
        : left.perServicePricing,
  });
}

function mergeHandoffRules(left = {}, right = {}) {
  return sanitizeHandoffRules({
    ...obj(left),
    ...obj(right),
  });
}

function mergeSourceMetadata(left = {}, right = {}) {
  return sanitizeSourceMetadata({
    ...obj(left),
    ...obj(right),
    sourceLabels:
      right.sourceLabels !== undefined ? right.sourceLabels : left.sourceLabels,
    evidenceSummary:
      right.evidenceSummary !== undefined
        ? right.evidenceSummary
        : left.evidenceSummary,
  });
}

function mergeAssistantState(left = {}, right = {}) {
  return sanitizeAssistantState({
    ...obj(left),
    ...obj(right),
  });
}

function mergeProgress(left = {}, right = {}) {
  return sanitizeProgress({
    ...obj(left),
    ...obj(right),
    skippedQuestions: uniqueStrings(
      [...arr(left.skippedQuestions), ...arr(right.skippedQuestions)],
      32
    ),
  });
}

function mergeSetupAssistantCore(left = {}, right = {}) {
  const a = sanitizeSetupAssistantCore(left);
  const b = sanitizeSetupAssistantCore(right);

  return {
    businessProfile: mergeBusinessProfile(a.businessProfile, b.businessProfile),
    services: b.services.length ? sanitizeServices(b.services) : a.services,
    contacts: b.contacts.length ? sanitizeContacts(b.contacts) : a.contacts,
    hours:
      b.hours.length && b.hours.some((row) => row.enabled || row.closed || row.notes)
        ? sanitizeStructuredHours(b.hours)
        : a.hours,
    pricingPosture: mergePricingPosture(a.pricingPosture, b.pricingPosture),
    handoffRules: mergeHandoffRules(a.handoffRules, b.handoffRules),
    sourceMetadata: mergeSourceMetadata(a.sourceMetadata, b.sourceMetadata),
    assistantState: mergeAssistantState(a.assistantState, b.assistantState),
    progress: mergeProgress(a.progress, b.progress),
  };
}

function buildContactsFromAnswer(answer = "") {
  const items = splitAnswerList(answer, 12).map((item, index) => ({
    type: inferContactType(item),
    label: index === 0 ? "Primary" : `Contact ${index + 1}`,
    value: item,
    preferred: index === 0,
    visibility: "public",
  }));

  return sanitizeContacts(items);
}

function buildHandoffFromAnswer(answer = "") {
  const text = s(answer);
  if (!text) return {};
  return sanitizeHandoffRules({
    enabled: true,
    summary: text,
    triggers: splitAnswerList(text, 24),
  });
}

function extractWebsiteCandidate(text = "") {
  const match = s(text).match(WEBSITE_PATTERN);
  if (!match?.[1]) return "";
  return normalizeWebsiteUrl(match[1]);
}

function stripWebsiteFromText(text = "") {
  const value = s(text);
  const website = extractWebsiteCandidate(value);
  if (!website) return value;

  return s(value.replace(WEBSITE_PATTERN, " ").replace(/\s{2,}/g, " "));
}

function splitProfileLines(text = "") {
  return String(text || "")
    .split(/\n+/)
    .map((item) => s(item))
    .filter(Boolean);
}

function parseProfileAnswer(answer = "", current = {}) {
  const text = s(answer);
  const profile = obj(current.businessProfile);
  if (!text) return {};

  const websiteUrl = extractWebsiteCandidate(text);
  const stripped = stripWebsiteFromText(text);
  const lines = splitProfileLines(stripped);
  const out = {};

  if (!profile.websiteUrl && websiteUrl) {
    out.websiteUrl = websiteUrl;
  }

  if (!lines.length) {
    return compactDraftObject(out);
  }

  if (lines.length >= 2) {
    if (!profile.companyName) {
      out.companyName = lines[0];
    }
    if (!profile.description) {
      out.description = lines.slice(1).join(" ");
    }
    return compactDraftObject(out);
  }

  const single = lines[0];
  const split = single.split(/\s[-–—:]\s/).map((item) => s(item)).filter(Boolean);

  if (split.length >= 2) {
    if (!profile.companyName) {
      out.companyName = split[0];
    }
    if (!profile.description) {
      out.description = split.slice(1).join(" - ");
    }
    return compactDraftObject(out);
  }

  if (!profile.companyName && !profile.description) {
    const words = single.split(/\s+/).filter(Boolean);
    if (words.length <= 6 && !/[.!?]/.test(single)) {
      out.companyName = single;
    } else {
      out.description = single;
    }
    return compactDraftObject(out);
  }

  if (!profile.companyName) {
    out.companyName = single;
  } else if (!profile.description) {
    out.description = single;
  }

  return compactDraftObject(out);
}

function buildAllDayHoursPatch() {
  return sanitizeStructuredHours(
    ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"].map(
      (day) => ({
        day,
        enabled: true,
        closed: false,
        allDay: true,
        appointmentOnly: false,
        openTime: "",
        closeTime: "",
        notes: "",
      })
    )
  );
}

function buildAppointmentOnlyHoursPatch() {
  return sanitizeStructuredHours(
    ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"].map(
      (day) => ({
        day,
        enabled: false,
        closed: false,
        allDay: false,
        appointmentOnly: true,
        openTime: "",
        closeTime: "",
        notes: "Appointment only",
      })
    )
  );
}

function deriveProfileNextMissingField(profile = {}) {
  const safe = obj(profile);

  if (!s(safe.companyName)) return "company";
  if (!s(safe.description)) return "description";
  if (!s(safe.websiteUrl)) return "website";
  return "profile";
}

function buildStepIntentPatch(step = "") {
  const safeStep = s(step).toLowerCase();
  if (!safeStep) return {};

  return compactDraftObject({
    progress: {
      currentQuestionKey: safeStep,
      updatedAt: nowIso(),
    },
    assistantState: {
      activeSection: safeStep,
    },
  });
}

function resolveIntentOnlyPatch(step = "", answer = "", current = {}) {
  const safeStep = s(step).toLowerCase();
  const normalizedAnswer = s(answer).toLowerCase();
  const intent = INTENT_ONLY_RESPONSES[normalizedAnswer];

  if (!intent) return {};

  if (intent === "__skip__") {
    return compactDraftObject({
      progress: {
        skippedQuestions: [safeStep || "services"],
        lastAnsweredStep: safeStep || "services",
        currentQuestionKey: safeStep || "services",
        updatedAt: nowIso(),
      },
      assistantState: {
        activeSection: safeStep || "services",
      },
    });
  }

  if (intent === "__continue__") {
    if (safeStep === "profile") {
      return buildStepIntentPatch(
        deriveProfileNextMissingField(obj(current.businessProfile))
      );
    }
    return buildStepIntentPatch(safeStep || "profile");
  }

  if (intent === "__always_open__") {
    return compactDraftObject({
      hours: buildAllDayHoursPatch(),
      assistantState: {
        activeSection: "hours",
        lastUpdatedSection: "hours",
      },
    });
  }

  if (intent === "__appointment_only__") {
    return compactDraftObject({
      hours: buildAppointmentOnlyHoursPatch(),
      assistantState: {
        activeSection: "hours",
        lastUpdatedSection: "hours",
      },
    });
  }

  if (intent === "__quote_required__") {
    return compactDraftObject({
      pricingPosture: sanitizePricingPosture({
        pricingMode: "quote_required",
        publicSummary: "Exact pricing requires a quote.",
        requiresOperatorForExactQuote: true,
        allowPublicPriceReplies: false,
      }),
      assistantState: {
        activeSection: "pricing",
        lastUpdatedSection: "pricing",
      },
    });
  }

  if (intent === "company" || intent === "description" || intent === "website") {
    return buildStepIntentPatch(intent);
  }

  if (intent === "services" || intent === "pricing" || intent === "hours") {
    return buildStepIntentPatch(intent);
  }

  return {};
}

function deriveServicesFromReviewDraft(reviewDraft = {}) {
  const profile = obj(reviewDraft.businessProfile);
  const payloadProfile = obj(obj(reviewDraft.draftPayload).profile);

  return sanitizeServices([
    ...arr(reviewDraft.services).map((item) => ({
      key: s(item.key || item.serviceKey || item.service_key || item.id),
      title: s(item.title || item.name || item.label || item.value_text),
      summary: s(item.description || item.summary || item.value_text),
      category: s(item.category || "general"),
    })),
    ...arr(payloadProfile.services).map((title) => ({
      key: slugify(title),
      title: s(title),
      category: "general",
    })),
    ...arr(profile.services).map((title) => ({
      key: slugify(title),
      title: s(title),
      category: "general",
    })),
  ]);
}

function deriveContactsFromReviewDraft(reviewDraft = {}) {
  const profile = obj(reviewDraft.businessProfile);
  const payloadProfile = obj(obj(reviewDraft.draftPayload).profile);

  return sanitizeContacts([
    s(profile.primaryPhone || payloadProfile.primaryPhone)
      ? {
          type: "phone",
          label: "Phone",
          value: s(profile.primaryPhone || payloadProfile.primaryPhone),
          preferred: true,
          visibility: "public",
        }
      : null,
    s(profile.primaryEmail || payloadProfile.primaryEmail)
      ? {
          type: "email",
          label: "Email",
          value: s(profile.primaryEmail || payloadProfile.primaryEmail),
          visibility: "public",
        }
      : null,
    ...arr(payloadProfile.whatsappLinks).map((item, index) => ({
      type: "whatsapp",
      label: index === 0 ? "WhatsApp" : `WhatsApp ${index + 1}`,
      value: s(item),
      visibility: "public",
    })),
  ]);
}

function deriveHoursFromReviewDraft(reviewDraft = {}) {
  const profile = obj(reviewDraft.businessProfile);
  const payloadProfile = obj(obj(reviewDraft.draftPayload).profile);
  const rawHours = uniqueStrings([...arr(profile.hours), ...arr(payloadProfile.hours)]);
  if (!rawHours.length) return sanitizeStructuredHours([]);
  return parseHoursNote(rawHours.join("\n"));
}

function derivePricingFromReviewDraft(reviewDraft = {}, derivedServices = []) {
  const profile = obj(reviewDraft.businessProfile);
  const payloadProfile = obj(obj(reviewDraft.draftPayload).profile);
  const note = uniqueStrings([
    s(profile.pricingPolicy),
    s(payloadProfile.pricingPolicy),
    ...arr(profile.pricingHints),
    ...arr(payloadProfile.pricingHints),
  ]).join(". ");

  if (!note) return sanitizePricingPosture({});
  return parsePricingNote(note, {}, derivedServices);
}

function buildSourceMetadataFromReview(review = {}) {
  const draft = obj(review.draft);
  const summary = obj(draft.sourceSummary);
  const latestImport = obj(summary.latestImport);
  const latestAnalyze = obj(summary.latestAnalyze);
  const sources = arr(review.sources);
  const sourceLabels = uniqueStrings([
    ...sources.map((item) =>
      s(item.label || item.sourceLabel || item.sourceType || item.role)
    ),
    s(latestImport.sourceLabel),
    s(summary.primarySourceType),
  ]);
  const evidenceSummary = uniqueStrings([
    summary.primarySourceUrl ? `Primary source: ${summary.primarySourceUrl}` : "",
    latestImport.sourceUrl ? `Latest import: ${latestImport.sourceUrl}` : "",
    latestAnalyze.sourceType ? `Last analyze: ${latestAnalyze.sourceType}` : "",
    Number(draft.warningCount || arr(draft.warnings).length) > 0
      ? `${Number(draft.warningCount || arr(draft.warnings).length)} warnings need review`
      : "",
  ]);

  return sanitizeSourceMetadata({
    primarySourceType:
      summary.primarySourceType || latestImport.sourceType || latestAnalyze.sourceType,
    primarySourceUrl: summary.primarySourceUrl || latestImport.sourceUrl,
    sourceLabels,
    evidenceSummary,
    warningCount: Number(draft.warningCount || arr(draft.warnings).length || 0),
    sourceCount: sources.length || arr(summary.imports).length,
  });
}

function buildSetupAssistantSeedFromReview(review = {}) {
  const reviewDraft = obj(review.draft);
  const payloadProfile = obj(obj(reviewDraft.draftPayload).profile);
  const businessProfile = sanitizeBusinessProfile({
    ...payloadProfile,
    ...obj(reviewDraft.businessProfile),
  });
  const services = deriveServicesFromReviewDraft(reviewDraft);

  return {
    businessProfile,
    services,
    contacts: deriveContactsFromReviewDraft(reviewDraft),
    hours: deriveHoursFromReviewDraft(reviewDraft),
    pricingPosture: derivePricingFromReviewDraft(reviewDraft, services),
    handoffRules: sanitizeHandoffRules({}),
    sourceMetadata: buildSourceMetadataFromReview(review),
    assistantState: sanitizeAssistantState({}),
    progress: sanitizeProgress({}),
  };
}

function deriveWebsitePrefillDraft(core = {}) {
  const businessProfile = obj(core.businessProfile);
  const sourceMetadata = obj(core.sourceMetadata);
  const websiteUrl = s(
    businessProfile.websiteUrl || sourceMetadata.primarySourceUrl
  );

  return {
    supported: true,
    mode: "source_or_manual_url",
    status: websiteUrl ? "captured" : "awaiting_input",
    websiteUrl,
    scanSuggested: Boolean(websiteUrl),
  };
}

function buildSectionStatus(draft = {}) {
  const businessProfile = obj(draft.businessProfile);
  const pricing = obj(draft.pricingPosture);
  const handoff = obj(draft.handoffRules);
  const enabledHours = arr(draft.hours).filter(
    (item) =>
      item.enabled === true || item.allDay === true || item.appointmentOnly === true
  );

  const sections = {
    profile: {
      completed: Boolean(
        s(businessProfile.companyName) &&
          s(businessProfile.description) &&
          s(businessProfile.websiteUrl)
      ),
      partial: Boolean(
        s(businessProfile.companyName) ||
          s(businessProfile.description) ||
          s(businessProfile.websiteUrl)
      ),
      metric: [
        s(businessProfile.companyName) ? "name" : "",
        s(businessProfile.websiteUrl) ? "website" : "",
        s(businessProfile.description) ? "summary" : "",
      ]
        .filter(Boolean)
        .join(" / "),
    },
    services: {
      completed: arr(draft.services).length > 0,
      partial: arr(draft.services).length > 0,
      metric: `${arr(draft.services).length} drafted`,
    },
    hours: {
      completed: enabledHours.length > 0,
      partial: arr(draft.hours).some(
        (item) => item.enabled === true || item.closed === true || s(item.notes)
      ),
      metric: enabledHours.length
        ? `${enabledHours.length} days scheduled`
        : "not scheduled",
    },
    pricing: {
      completed: Boolean(s(pricing.pricingMode) && s(pricing.publicSummary)),
      partial: Boolean(
        s(pricing.pricingMode) ||
          s(pricing.publicSummary) ||
          pricing.minPrice != null ||
          pricing.startingAt != null
      ),
      metric: s(pricing.pricingMode) || "not set",
    },
    contacts: {
      completed: arr(draft.contacts).length > 0,
      partial: arr(draft.contacts).length > 0,
      metric: `${arr(draft.contacts).length} contact routes`,
    },
    handoff: {
      completed: Boolean(
        handoff.enabled === true ||
          s(handoff.summary) ||
          arr(handoff.triggers).length
      ),
      partial: Boolean(s(handoff.summary) || arr(handoff.triggers).length),
      metric: arr(handoff.triggers).length
        ? `${arr(handoff.triggers).length} triggers`
        : s(handoff.summary)
        ? "configured"
        : "recommended",
    },
  };

  return Object.fromEntries(
    Object.entries(sections).map(([key, value]) => [
      key,
      {
        ...value,
        status: value.completed ? "ready" : value.partial ? "needs_review" : "missing",
      },
    ])
  );
}

function buildConfirmationBlockers(draft = {}, sectionStatus = {}) {
  const sourceMetadata = obj(draft.sourceMetadata);

  return SECTION_ORDER.filter((key) => sectionStatus[key]?.status !== "ready").map(
    (key) => ({
      key,
      label: SECTION_META[key].label,
      title: SECTION_META[key].title,
      severity: sectionStatus[key]?.status === "missing" ? "high" : "medium",
      reason:
        sectionStatus[key]?.status === "missing"
          ? SECTION_META[key].missing
          : SECTION_META[key].review,
      metric: s(sectionStatus[key]?.metric),
      sourceHint:
        key === "profile" && s(sourceMetadata.primarySourceType)
          ? `Signals already exist from ${sourceMetadata.primarySourceType}.`
          : key === "services" && arr(sourceMetadata.evidenceSummary).length
          ? arr(sourceMetadata.evidenceSummary)[0]
          : "",
    })
  );
}

function buildSummary(draft = {}) {
  const sectionStatus = buildSectionStatus(draft);
  const completionCount = Object.values(sectionStatus).filter(
    (item) => item.status === "ready"
  ).length;
  const confirmationBlockers = buildConfirmationBlockers(draft, sectionStatus);
  const hasAnyDraft =
    completionCount > 0 ||
    Object.values(sectionStatus).some((item) => item.partial === true);
  const readyForReview = ["profile", "services", "hours", "pricing", "contacts"].every(
    (key) => sectionStatus[key]?.status === "ready"
  );

  return {
    hasAnyDraft,
    readyForReview,
    readyForApproval: false,
    completionCount,
    totalSections: SECTION_ORDER.length,
    blockerCount: confirmationBlockers.length,
    sectionStatus,
    confirmationBlockers,
    servicesCount: arr(draft.services).length,
    contactsCount: arr(draft.contacts).length,
    hoursConfiguredCount: arr(draft.hours).filter(
      (item) =>
        item.enabled === true || item.allDay === true || item.appointmentOnly === true
    ).length,
  };
}

function buildReviewState(draft = {}, summary = {}) {
  return {
    status: summary.hasAnyDraft ? "draft_in_progress" : "awaiting_input",
    readyForReview: summary.readyForReview === true,
    readyForApproval: false,
    finalizeAvailable: summary.readyForReview === true,
    message:
      summary.readyForReview === true
        ? "The setup draft is structurally complete enough to be finalized into approved truth and strict runtime."
        : REVIEW_MESSAGE,
  };
}

function buildAssistantSections(draft = {}, summary = {}, servicesCatalog = {}) {
  return SECTION_ORDER.map((key) => {
    const meta = SECTION_META[key];
    const status = obj(summary.sectionStatus)[key]?.status || "missing";

    return {
      key,
      label: meta.label,
      title: meta.title,
      status,
      summary:
        status === "ready"
          ? meta.ready
          : status === "needs_review"
          ? meta.review
          : meta.missing,
      metric: s(obj(summary.sectionStatus)[key]?.metric),
      suggestedCount:
        key === "services" ? arr(servicesCatalog.suggestedServices).length : 0,
    };
  });
}

function resolveProfileQuestion(profile = {}, progress = {}) {
  const currentQuestionKey = s(progress.currentQuestionKey).toLowerCase();
  const safeProfile = obj(profile);

  if (
    currentQuestionKey === "company" &&
    !s(safeProfile.companyName)
  ) {
    return {
      key: "company",
      label: SECTION_META.company.label,
      prompt: SECTION_META.company.prompt,
      placeholder: SECTION_META.company.placeholder,
    };
  }

  if (
    currentQuestionKey === "description" &&
    !s(safeProfile.description)
  ) {
    return {
      key: "description",
      label: SECTION_META.description.label,
      prompt: SECTION_META.description.prompt,
      placeholder: SECTION_META.description.placeholder,
    };
  }

  if (
    currentQuestionKey === "website" &&
    !s(safeProfile.websiteUrl)
  ) {
    return {
      key: "website",
      label: SECTION_META.website.label,
      prompt: SECTION_META.website.prompt,
      placeholder: SECTION_META.website.placeholder,
    };
  }

  if (!s(safeProfile.companyName)) {
    return {
      key: "company",
      label: SECTION_META.company.label,
      prompt: SECTION_META.company.prompt,
      placeholder: SECTION_META.company.placeholder,
    };
  }

  if (!s(safeProfile.description)) {
    return {
      key: "description",
      label: SECTION_META.description.label,
      prompt: SECTION_META.description.prompt,
      placeholder: SECTION_META.description.placeholder,
    };
  }

  if (!s(safeProfile.websiteUrl)) {
    return {
      key: "website",
      label: SECTION_META.website.label,
      prompt: SECTION_META.website.prompt,
      placeholder: SECTION_META.website.placeholder,
    };
  }

  return {
    key: "profile",
    label: SECTION_META.profile.label,
    prompt: SECTION_META.profile.prompt,
    placeholder: SECTION_META.profile.placeholder,
  };
}

function getNextQuestion(summary = {}, draft = {}, progress = {}) {
  if (summary.readyForReview === true) {
    return null;
  }

  const sectionStatus = obj(summary.sectionStatus);

  if (sectionStatus.profile?.status !== "ready") {
    return resolveProfileQuestion(obj(draft.businessProfile), progress);
  }

  const blocker = arr(summary.confirmationBlockers)[0];
  if (!blocker) return null;

  const meta = SECTION_META[blocker.key] || SECTION_META.profile;
  return {
    key: blocker.key,
    label: meta.label,
    prompt: meta.prompt,
    placeholder: meta.placeholder,
  };
}

function resolveSessionCurrentStep(review = {}, setup = {}, nextQuestion = null) {
  const storedSession = obj(review.session);
  const assistantState = obj(setup.assistantState);

  return (
    s(
      storedSession.currentStep ||
        assistantState.activeSection ||
        obj(setup.progress).currentQuestionKey ||
        nextQuestion?.key ||
        SETUP_ASSISTANT_CURRENT_STEP
    ) || SETUP_ASSISTANT_CURRENT_STEP
  );
}

function safeDraftVersion(draftRow = {}) {
  const version = Number(draftRow.version || 1);
  return Number.isFinite(version) && version > 0 ? version : 1;
}

function buildStoredSetupAssistantPayload(value = {}, seed = {}) {
  const mergedCore = mergeSetupAssistantCore(seed, value);
  const summary = buildSummary(mergedCore);
  const review = buildReviewState(mergedCore, summary);

  return {
    ...mergedCore,
    websitePrefill: deriveWebsitePrefillDraft(mergedCore),
    review,
    namespace: SETUP_ASSISTANT_NAMESPACE,
    sourceType: SETUP_ASSISTANT_SOURCE_TYPE,
  };
}

function normalizeStoredSetupAssistantPayload(value = {}, seed = {}) {
  return buildStoredSetupAssistantPayload(obj(value), seed);
}

function pickAliasedField(source = {}, aliases = []) {
  for (const key of aliases) {
    if (hasOwn(source, key)) {
      return {
        provided: true,
        value: source[key],
      };
    }
  }

  return {
    provided: false,
    value: undefined,
  };
}

function normalizeDirectPatchBody(body = {}) {
  const root = obj(body?.draft)
    ? obj(body.draft)
    : obj(body?.setup)
    ? obj(body.setup)
    : obj(body);

  const out = {};

  const businessProfile = pickAliasedField(root, [
    "businessProfile",
    "business_profile",
  ]);
  if (businessProfile.provided) {
    out.businessProfile = sanitizeBusinessProfile(obj(businessProfile.value));
  }

  const services = pickAliasedField(root, ["services"]);
  if (services.provided) {
    out.services = sanitizeServices(services.value);
  }

  const contacts = pickAliasedField(root, ["contacts"]);
  if (contacts.provided) {
    out.contacts = sanitizeContacts(contacts.value);
  }

  const hours = pickAliasedField(root, ["hours"]);
  if (hours.provided) {
    out.hours = sanitizeStructuredHours(hours.value);
  }

  const pricingPosture = pickAliasedField(root, [
    "pricingPosture",
    "pricing_posture",
    "pricing",
  ]);
  if (pricingPosture.provided) {
    out.pricingPosture = sanitizePricingPosture(obj(pricingPosture.value));
  }

  const handoffRules = pickAliasedField(root, [
    "handoffRules",
    "handoff_rules",
    "handoff",
  ]);
  if (handoffRules.provided) {
    out.handoffRules = sanitizeHandoffRules(obj(handoffRules.value));
  }

  const sourceMetadata = pickAliasedField(root, [
    "sourceMetadata",
    "source_metadata",
  ]);
  if (sourceMetadata.provided) {
    out.sourceMetadata = sanitizeSourceMetadata(obj(sourceMetadata.value));
  }

  const assistantState = pickAliasedField(root, [
    "assistantState",
    "assistant_state",
  ]);
  if (assistantState.provided) {
    out.assistantState = sanitizeAssistantState(obj(assistantState.value));
  }

  return compactDraftObject(out);
}

function isMessageSkip(body = {}) {
  return body?.skip === true || s(body?.intent).toLowerCase() === "skip";
}

function patchFromAnswer(step = "", answer = "", current = {}) {
  const key = s(step).toLowerCase();
  const text = s(answer);
  const currentDraft = obj(current);

  if (!key || !text) return {};

  switch (key) {
    case "profile":
      return {
        businessProfile: parseProfileAnswer(text, currentDraft),
        assistantState: {
          lastUpdatedSection: "profile",
          activeSection: "profile",
        },
      };
    case "website":
      return {
        businessProfile: {
          websiteUrl: normalizeWebsiteUrl(text),
        },
        assistantState: {
          lastUpdatedSection: "profile",
          activeSection: "website",
        },
      };
    case "company":
      return {
        businessProfile: {
          companyName: text,
        },
        assistantState: {
          lastUpdatedSection: "profile",
          activeSection: "company",
        },
      };
    case "description":
      return {
        businessProfile: {
          description: text,
        },
        assistantState: {
          lastUpdatedSection: "profile",
          activeSection: "description",
        },
      };
    case "services":
      return {
        services: parseServicesNote(text, currentDraft.services),
        assistantState: {
          lastParsedServicesNote: text,
          lastUpdatedSection: "services",
          activeSection: "services",
        },
      };
    case "contact":
    case "contacts":
      return {
        contacts: buildContactsFromAnswer(text),
        assistantState: {
          lastUpdatedSection: "contacts",
          activeSection: "contacts",
        },
      };
    case "hours":
      return {
        hours: parseHoursNote(text, currentDraft.hours),
        assistantState: {
          lastParsedHoursNote: text,
          lastUpdatedSection: "hours",
          activeSection: "hours",
        },
      };
    case "pricing":
      return {
        pricingPosture: parsePricingNote(
          text,
          currentDraft.pricingPosture,
          currentDraft.services
        ),
        assistantState: {
          lastParsedPricingNote: text,
          lastUpdatedSection: "pricing",
          activeSection: "pricing",
        },
      };
    case "handoff":
      return {
        handoffRules: buildHandoffFromAnswer(text),
        assistantState: {
          lastUpdatedSection: "handoff",
          activeSection: "handoff",
        },
      };
    default:
      return {};
  }
}

function normalizeAnswerPatchBody(body = {}, current = {}) {
  const step = s(body.step || body.questionKey || body.field).toLowerCase();
  const answer = s(body.answer || body.message || body.text || body.value);

  if (isMessageSkip(body)) {
    if (!step) return {};
    return {
      progress: {
        skippedQuestions: [step],
        lastAnsweredStep: step,
        currentQuestionKey: step,
        updatedAt: nowIso(),
      },
      assistantState: {
        activeSection: step,
      },
    };
  }

  const intentOnlyPatch = resolveIntentOnlyPatch(step, answer, current);
  if (Object.keys(intentOnlyPatch).length > 0) {
    return intentOnlyPatch;
  }

  const answerPatch = patchFromAnswer(step, answer, current);
  if (!Object.keys(answerPatch).length) return {};

  const activeSection =
    s(obj(answerPatch.assistantState).activeSection) || step || "profile";

  return compactDraftObject({
    ...answerPatch,
    progress: {
      lastAnsweredStep: step,
      currentQuestionKey: activeSection,
      updatedAt: nowIso(),
    },
  });
}

export function normalizeSetupAssistantDraftPatchBody(body = {}, current = {}) {
  const directPatch = normalizeDirectPatchBody(body);
  const answerPatch = normalizeAnswerPatchBody(body, current);
  return mergeDraftState(directPatch, answerPatch);
}

function removeSkippedIfAnswered(skipped = [], patch = {}) {
  const nextSkipped = new Set(arr(skipped).map((item) => s(item).toLowerCase()));

  if (patch.businessProfile?.websiteUrl) {
    nextSkipped.delete("website");
    nextSkipped.delete("profile");
  }
  if (patch.businessProfile?.companyName) {
    nextSkipped.delete("company");
    nextSkipped.delete("profile");
  }
  if (patch.businessProfile?.description) {
    nextSkipped.delete("description");
    nextSkipped.delete("profile");
  }
  if (patch.services !== undefined && arr(patch.services).length > 0)
    nextSkipped.delete("services");
  if (patch.contacts !== undefined && arr(patch.contacts).length > 0)
    nextSkipped.delete("contacts");
  if (patch.hours !== undefined) nextSkipped.delete("hours");
  if (
    patch.pricingPosture !== undefined &&
    Object.keys(obj(patch.pricingPosture)).length > 0
  ) {
    nextSkipped.delete("pricing");
  }
  if (
    patch.handoffRules !== undefined &&
    Object.keys(obj(patch.handoffRules)).length > 0
  ) {
    nextSkipped.delete("handoff");
  }

  return Array.from(nextSkipped);
}

export function mergeSetupAssistantDraft(current = {}, patch = {}, seed = {}) {
  const existing = normalizeStoredSetupAssistantPayload(current, seed);
  const existingProgress = obj(existing.progress);
  const patchProgress = obj(patch.progress);

  const mergedSkipped = uniqueStrings(
    [
      ...arr(existingProgress.skippedQuestions),
      ...arr(patchProgress.skippedQuestions),
    ],
    32
  );

  const normalizedSkipped = removeSkippedIfAnswered(mergedSkipped, patch);
  const nextQuestionKey =
    s(obj(patch.assistantState).activeSection) ||
    s(patchProgress.currentQuestionKey) ||
    s(existingProgress.currentQuestionKey) ||
    s(patchProgress.lastAnsweredStep) ||
    s(existingProgress.lastAnsweredStep);

  const next = {
    ...mergeSetupAssistantCore(existing, patch),
    progress: sanitizeProgress({
      ...existingProgress,
      ...patchProgress,
      skippedQuestions: normalizedSkipped,
      currentQuestionKey: nextQuestionKey,
      updatedAt: nowIso(),
    }),
    assistantState: sanitizeAssistantState({
      ...obj(existing.assistantState),
      ...obj(patch.assistantState),
      activeSection:
        s(obj(patch.assistantState).activeSection) ||
        s(obj(existing.assistantState).activeSection) ||
        nextQuestionKey,
      lastUpdatedSection:
        s(obj(patch.assistantState).lastUpdatedSection) ||
        s(obj(existing.assistantState).lastUpdatedSection),
    }),
  };

  return buildStoredSetupAssistantPayload(next, seed);
}

function readStoredSetupAssistantDraftPayload(draftPayload = {}) {
  const payload = obj(draftPayload);
  return obj(payload.setupAssistant || payload.onboarding);
}

function stripLegacySetupAssistantPayloadKeys(draftPayload = {}) {
  const payload = obj(draftPayload);
  const { onboarding, ...rest } = payload;
  return rest;
}

export function buildSetupAssistantSessionPayload(review = {}) {
  const session = obj(review.session);
  const draftRow = obj(review.draft);
  const draftPayload = obj(draftRow.draftPayload);
  const seed = buildSetupAssistantSeedFromReview(review);
  const setup = normalizeStoredSetupAssistantPayload(
    readStoredSetupAssistantDraftPayload(draftPayload),
    seed
  );
  const summary = buildSummary(setup);
  const servicesCatalog = buildSetupAssistantServiceCatalog({
    businessProfile: setup.businessProfile,
    currentServices: setup.services,
    sourceServices: seed.services,
  });
  const nextQuestion = getNextQuestion(summary, setup, obj(setup.progress));

  return {
    session: {
      id: s(session.id),
      status: s(session.status || "draft").toLowerCase(),
      mode: s(session.mode || "setup").toLowerCase(),
      currentStep: resolveSessionCurrentStep(review, setup, nextQuestion),
      startedAt: session.startedAt || session.started_at || null,
      updatedAt:
        session.updatedAt ||
        session.updated_at ||
        draftRow.updatedAt ||
        draftRow.updated_at ||
        null,
      draftVersion: safeDraftVersion(draftRow),
      reviewSessionId: s(session.id),
      draftOnly: true,
      storageModel: "tenant_setup_review",
      sourceType: SETUP_ASSISTANT_SOURCE_TYPE,
      namespace: SETUP_ASSISTANT_NAMESPACE,
    },
    setup: {
      status: summary.hasAnyDraft ? "draft_in_progress" : "awaiting_input",
      draftOnly: true,
      sourceType: SETUP_ASSISTANT_SOURCE_TYPE,
      namespace: SETUP_ASSISTANT_NAMESPACE,
      summary,
      websitePrefill: obj(setup.websitePrefill),
      review: obj(setup.review),
      assistant: {
        mode: "structured_v2",
        nextQuestion,
        confirmationBlockers: arr(summary.confirmationBlockers),
        sections: buildAssistantSections(setup, summary, servicesCatalog),
        completion: {
          ready: summary.readyForReview === true,
          action: summary.readyForReview
            ? {
                id: "finalize_setup",
                label: "Finish setup",
                intent: "finalize_review",
              }
            : null,
          message:
            summary.readyForReview === true
              ? "The draft is complete enough to finalize into approved truth and strict runtime."
              : REVIEW_MESSAGE,
        },
        quickCapture: Object.fromEntries(
          SECTION_ORDER.map((key) => [
            key,
            {
              step: key,
              label: SECTION_META[key].label,
              placeholder: SECTION_META[key].placeholder,
            },
          ])
        ),
        servicesCatalog,
        sourceInsights: arr(obj(setup.sourceMetadata).evidenceSummary),
      },
      draft: {
        businessProfile: obj(setup.businessProfile),
        services: arr(setup.services),
        contacts: arr(setup.contacts),
        hours: arr(setup.hours),
        pricingPosture: obj(setup.pricingPosture),
        handoffRules: obj(setup.handoffRules),
        sourceMetadata: obj(setup.sourceMetadata),
        assistantState: obj(setup.assistantState),
        progress: obj(setup.progress),
        version: safeDraftVersion(draftRow),
        updatedAt: draftRow.updatedAt || draftRow.updated_at || null,
      },
    },
  };
}

function resolveStartedBy(actor = {}) {
  return (
    safeUuidOrNull(actor?.user?.id) ||
    safeUuidOrNull(actor?.user?.userId) ||
    safeUuidOrNull(actor?.user?.user_id) ||
    null
  );
}

function isDatabaseNotInitializedError(error) {
  const message = s(error?.message).toLowerCase();
  return message.includes("database is not initialized");
}

async function maybeUpdateReviewSessionStep({
  reviewSessionId,
  nextQuestion,
  deps = {},
}) {
  const injectedUpdateSession = deps.updateSetupReviewSession;
  const updateSession =
    typeof injectedUpdateSession === "function"
      ? injectedUpdateSession
      : updateSetupReviewSession;

  if (typeof updateSession !== "function" || !s(reviewSessionId)) return;

  try {
    await updateSession(reviewSessionId, {
      currentStep: s(
        nextQuestion?.key || SETUP_ASSISTANT_CURRENT_STEP
      ).toLowerCase(),
    });
  } catch (error) {
    if (
      typeof injectedUpdateSession !== "function" &&
      isDatabaseNotInitializedError(error)
    ) {
      return;
    }
    throw error;
  }
}

export async function startSetupAssistantSession({ db, actor }, deps = {}) {
  const getCurrentReview = deps.getCurrentSetupReview || getCurrentSetupReview;
  const getOrCreateSession =
    deps.getOrCreateActiveSetupReviewSession ||
    getOrCreateActiveSetupReviewSession;
  const audit = deps.auditSetupAction || auditSetupAction;

  let review = await getCurrentReview(actor.tenantId);
  let created = false;

  if (!review?.session?.id) {
    await getOrCreateSession({
      tenantId: actor.tenantId,
      mode: "setup",
      currentStep: SETUP_ASSISTANT_CURRENT_STEP,
      startedBy: resolveStartedBy(actor),
      title: "Setup assistant v2",
      notes: "",
      metadata: {
        setupAssistantShell: true,
        setupAssistantNamespace: "draftPayload.setupAssistant",
        setupAssistantDraftOnly: true,
        runtimeActivationDeferred: true,
        truthApprovalDeferred: true,
        sourceType: SETUP_ASSISTANT_SOURCE_TYPE,
        namespace: SETUP_ASSISTANT_NAMESPACE,
      },
      ensureDraft: true,
    });
    review = await getCurrentReview(actor.tenantId);
    created = true;
  }

  const payload = buildSetupAssistantSessionPayload(review);

  await audit(
    db,
    actor,
    created
      ? "setup_assistant.session.started"
      : "setup_assistant.session.reused",
    "tenant_setup_review_session",
    s(review?.session?.id),
    {
      reviewSessionId: s(review?.session?.id),
      currentStep: s(
        payload?.session?.currentStep || SETUP_ASSISTANT_CURRENT_STEP
      ),
      source: "home_widget",
      sourceType: SETUP_ASSISTANT_SOURCE_TYPE,
      namespace: SETUP_ASSISTANT_NAMESPACE,
      draftOnly: true,
    }
  );

  return {
    status: 200,
    body: {
      ok: true,
      created,
      message: created
        ? "Setup assistant session started"
        : "Setup assistant session loaded",
      ...payload,
    },
  };
}

export async function loadCurrentSetupAssistantSession(
  { db, actor },
  deps = {}
) {
  const getCurrentReview = deps.getCurrentSetupReview || getCurrentSetupReview;
  const review = await getCurrentReview(actor.tenantId);

  if (!review?.session?.id) {
    return {
      status: 404,
      body: {
        ok: false,
        error: "SetupAssistantSessionNotFound",
        reason: "no active setup assistant session was found",
        session: null,
        setup: null,
      },
    };
  }

  return {
    status: 200,
    body: {
      ok: true,
      ...buildSetupAssistantSessionPayload(review),
    },
  };
}

export async function updateSetupAssistantDraft(
  { db, actor, body = {} },
  deps = {}
) {
  const getCurrentReview = deps.getCurrentSetupReview || getCurrentSetupReview;
  const patchReviewDraft =
    deps.patchSetupReviewDraft ||
    deps.patchReview ||
    patchSetupReviewDraft;
  const audit = deps.auditSetupAction || auditSetupAction;

  const review = await getCurrentReview(actor.tenantId);

  if (!review?.session?.id) {
    return {
      status: 404,
      body: {
        ok: false,
        error: "SetupAssistantSessionNotFound",
        reason: "start a setup assistant session before updating the draft",
      },
    };
  }

  const existingDraftPayload = obj(review?.draft?.draftPayload);
  const seed = buildSetupAssistantSeedFromReview(review);
  const currentSetupAssistant = normalizeStoredSetupAssistantPayload(
    readStoredSetupAssistantDraftPayload(existingDraftPayload),
    seed
  );
  const patch = normalizeSetupAssistantDraftPatchBody(body, currentSetupAssistant);

  if (!Object.keys(patch).length) {
    return {
      status: 400,
      body: {
        ok: false,
        error: "SetupAssistantDraftInvalid",
        reason: "no valid setup assistant draft fields were provided",
      },
    };
  }

  const mergedSetupAssistant = mergeSetupAssistantDraft(
    currentSetupAssistant,
    patch,
    seed
  );

  const nextSummary = buildSummary(mergedSetupAssistant);
  const nextQuestion = getNextQuestion(
    nextSummary,
    mergedSetupAssistant,
    obj(mergedSetupAssistant.progress)
  );

  const nextDraftPayload = mergeDraftState(
    stripLegacySetupAssistantPayloadKeys(existingDraftPayload),
    {
      setupAssistant: {
        ...mergedSetupAssistant,
        updatedAt: nowIso(),
        namespace: SETUP_ASSISTANT_NAMESPACE,
        sourceType: SETUP_ASSISTANT_SOURCE_TYPE,
      },
    }
  );

  await patchReviewDraft({
    sessionId: review.session.id,
    tenantId: actor.tenantId,
    patch: {
      draftPayload: nextDraftPayload,
    },
    bumpVersion: true,
  });

  await maybeUpdateReviewSessionStep({
    reviewSessionId: review.session.id,
    nextQuestion,
    deps,
  });

  const refreshed = await getCurrentReview(actor.tenantId);

  await audit(
    db,
    actor,
    "setup_assistant.draft.updated",
    "tenant_setup_review_session",
    s(refreshed?.session?.id || review.session.id),
    {
      reviewSessionId: s(refreshed?.session?.id || review.session.id),
      draftVersion: Number(
        refreshed?.draft?.version || review?.draft?.version || 0
      ),
      updatedFields: Object.keys(patch),
      source: "home_widget",
      sourceType: SETUP_ASSISTANT_SOURCE_TYPE,
      namespace: SETUP_ASSISTANT_NAMESPACE,
      draftOnly: true,
      messageMode: Boolean(
        s(body.step || body.questionKey || body.field) &&
          (s(body.answer || body.message || body.text || body.value) ||
            isMessageSkip(body))
      ),
      skipped: isMessageSkip(body),
      nextQuestion: s(nextQuestion?.key),
    }
  );

  return {
    status: 200,
    body: {
      ok: true,
      message: "Setup assistant draft updated",
      ...buildSetupAssistantSessionPayload(refreshed),
    },
  };
}

export const __test__ = {
  buildConfirmationBlockers,
  buildSetupAssistantSeedFromReview,
  buildSetupAssistantSessionPayload,
  buildStoredSetupAssistantPayload,
  getNextQuestion,
  mergeSetupAssistantDraft,
  normalizeSetupAssistantDraftPatchBody,
  patchFromAnswer,
  parseProfileAnswer,
  resolveIntentOnlyPatch,
};