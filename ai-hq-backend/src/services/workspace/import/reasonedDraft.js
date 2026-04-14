// ai-hq-backend/src/services/workspace/import/reasonedDraft.js

import {
  arr,
  obj,
  s,
  lower,
  compactObject,
  uniqStrings,
  hostnameFromUrl,
} from "./shared.js";

const GENERIC_SERVICE_TOKENS = new Set([
  "service",
  "services",
  "product",
  "products",
  "solution",
  "solutions",
  "offering",
  "offerings",
  "website",
  "websites",
  "site",
  "sites",
  "sayt",
  "saytlar",
  "vebsayt",
  "vebsaytlar",
  "xidmet",
  "xidmetler",
  "xidmət",
  "xidmətlər",
  "package",
  "packages",
  "plan",
  "plans",
]);

const NAV_MENU_TOKENS = new Set([
  "home",
  "about",
  "about us",
  "services",
  "service",
  "portfolio",
  "team",
  "reviews",
  "review",
  "blog",
  "contact",
  "menu",
  "main menu",
  "ana",
  "ana səhifə",
  "ana sehife",
  "haqqımızda",
  "haqqimizda",
  "xidmət",
  "xidmətlər",
  "xidmet",
  "xidmetler",
  "komanda",
  "rəylər",
  "reyler",
  "bloq",
  "əlaqə",
  "elaqe",
  "menyu",
]);

const STRONG_SERVICE_HINTS = [
  "ai",
  "automation",
  "chatbot",
  "assistant",
  "website development",
  "web development",
  "software development",
  "mobile development",
  "seo",
  "smm",
  "marketing",
  "branding",
  "design",
  "ui",
  "ux",
  "crm",
  "erp",
  "integration",
  "e-commerce",
  "consulting",
  "analytics",
  "support",
  "call center",
  "voice",
  "whatsapp",
  "instagram automation",
  "facebook automation",
];

const BAD_SERVICE_PATTERNS = [
  /https?:\/\//i,
  /www\./i,
  /@[a-z0-9_]/i,
  /^[a-z0-9.-]+\.[a-z]{2,}$/i,
  /\b(instagram\.com|facebook\.com|linkedin\.com|wa\.me|whatsapp\.com|t\.me|telegram\.me|youtube\.com|youtu\.be|x\.com|twitter\.com|tiktok\.com)\b/i,
  /\b(phone|email|address|contact|hours|working hours|pricing|price|policy|faq)\b/i,
];

const BAD_SUMMARY_PATTERNS = [
  /find local businesses,\s*view maps and get driving directions in google maps/i,
  /view maps and get driving directions/i,
  /\bgoogle maps\b/i,
];

const BAD_KNOWLEDGE_PATTERNS = [
  /find local businesses,\s*view maps and get driving directions in google maps/i,
  /\btestimonial\b/i,
  /\breviews?\b/i,
  /\bread more\b/i,
  /\blearn more\b/i,
  /\bbook now\b/i,
  /\bget started\b/i,
];

const QUESTION_START_RE =
  /^(what|how|why|when|where|which|can|do|does|is|are|niyə|niye|necə|nece|nə|ne|harada|hansı|hansi|kim|какой|как|что|почему|где|когда|можно|нужно)\b/i;

function cleanText(value = "", max = 320) {
  const text = s(value)
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!text) return "";
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1)).trim()}…`;
}

function normalizeText(value = "") {
  return lower(
    cleanText(value, 1200)
      .replace(/[^\p{L}\p{N}\s/+-]+/gu, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

function uniqueBy(list = [], getKey = (item) => item) {
  const seen = new Set();
  const out = [];

  for (const item of arr(list)) {
    const rawKey =
      typeof getKey === "function" ? getKey(item) : obj(item)?.[getKey];
    const key =
      typeof rawKey === "string"
        ? rawKey
        : rawKey == null
          ? ""
          : JSON.stringify(rawKey);

    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }

  return out;
}

function looksLikeMenuGarbage(value = "") {
  const normalized = normalizeText(value);
  if (!normalized) return false;

  const words = normalized.split(" ").filter(Boolean);
  let hits = 0;
  for (const token of NAV_MENU_TOKENS) {
    if (normalized.includes(lower(token))) hits += 1;
  }

  if (hits >= 4 && words.length <= 18) return true;
  if (hits >= 5) return true;
  return false;
}

function looksLikeBadSummary(value = "") {
  const text = cleanText(value, 1200);
  if (!text) return true;
  if (looksLikeMenuGarbage(text)) return true;
  return BAD_SUMMARY_PATTERNS.some((pattern) => pattern.test(text));
}

function looksLikeContactOrUrl(value = "") {
  const text = cleanText(value, 320);
  if (!text) return false;

  return (
    /https?:\/\//i.test(text) ||
    /www\./i.test(text) ||
    /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(text) ||
    /@/.test(text) ||
    /\+\d{6,}/.test(text)
  );
}

function serviceHintScore(value = "") {
  const normalized = normalizeText(value);
  if (!normalized) return 0;

  let score = 0;
  for (const token of STRONG_SERVICE_HINTS) {
    if (normalized.includes(lower(token))) score += 1;
  }
  return score;
}

function looksLikeCompanyLeak(value = "", { companyName = "", sourceUrl = "" } = {}) {
  const text = normalizeText(value);
  if (!text) return false;

  const safeCompany = normalizeText(companyName);
  const host = normalizeText(hostnameFromUrl(sourceUrl));

  if (safeCompany && text === safeCompany) return true;
  if (host && (text === host || text === `${host} com` || text === `${host} az`)) {
    return true;
  }

  return false;
}

function sanitizeServiceTitle(value = "") {
  return cleanText(
    s(value)
      .replace(
        /^(service|services|our services|xidmət|xidmətlər|xidmet|xidmetler|product|products)\s*[:|—–-]+\s*/i,
        ""
      )
      .replace(/\s*[|,:;]+$/, "")
      .trim(),
    180
  );
}

function classifyServiceCandidate(value = "", context = {}) {
  const title = sanitizeServiceTitle(value);
  const normalized = normalizeText(title);

  if (!title) {
    return { accepted: false, reason: "empty" };
  }

  if (looksLikeCompanyLeak(title, context)) {
    return { accepted: false, reason: "company_or_domain_leak", title };
  }

  if (looksLikeMenuGarbage(title)) {
    return { accepted: false, reason: "navigation_noise", title };
  }

  if (looksLikeContactOrUrl(title)) {
    return { accepted: false, reason: "contact_or_url_noise", title };
  }

  if (BAD_SERVICE_PATTERNS.some((pattern) => pattern.test(title))) {
    return { accepted: false, reason: "non_service_pattern", title };
  }

  const words = normalized.split(" ").filter(Boolean);
  if (!words.length) {
    return { accepted: false, reason: "empty_normalized", title };
  }

  if (words.length === 1 && GENERIC_SERVICE_TOKENS.has(words[0])) {
    return { accepted: false, reason: "generic_single_word", title };
  }

  if (words.length > 10) {
    return { accepted: false, reason: "too_long_for_service", title };
  }

  const hintScore = serviceHintScore(title);
  const confidence =
    hintScore >= 3 ? 0.86 : hintScore === 2 ? 0.74 : hintScore === 1 ? 0.62 : 0.48;

  if (hintScore === 0 && words.length <= 2) {
    return { accepted: false, reason: "weak_service_signal", title };
  }

  return {
    accepted: true,
    title,
    confidence,
    confidenceLabel: hintScore >= 2 ? "reasoned_strong" : "reasoned_tentative",
    reason:
      hintScore >= 2
        ? "service_signal_supported"
        : "service_signal_weak_but_plausible",
  };
}

function isQuestionLike(value = "") {
  const text = cleanText(value, 220);
  if (!text) return false;
  if (/[?؟]$/.test(text)) return true;
  return QUESTION_START_RE.test(text);
}

function normalizeKnowledgeCandidate(item = {}) {
  const x = obj(item);

  const category = cleanText(
    x.category || x.candidateGroup || x.type || "general",
    80
  );

  const title = cleanText(
    x.title || x.question || x.valueJson?.question || x.normalizedJson?.question,
    220
  );

  const valueText = cleanText(
    x.valueText ||
      x.answer ||
      x.valueJson?.answer ||
      x.normalizedText ||
      x.normalizedJson?.answer,
    700
  );

  return compactObject({
    category,
    title,
    valueText,
    confidence:
      typeof x.confidence === "number" ? x.confidence : Number(x.confidence || 0) || 0,
    confidenceLabel: cleanText(x.confidenceLabel, 40),
  });
}

function shouldRejectKnowledge(item = {}) {
  const title = cleanText(item.title, 220);
  const valueText = cleanText(item.valueText, 700);
  const joined = cleanText([title, valueText].filter(Boolean).join(" | "), 1200);

  if (!joined) return { rejected: true, reason: "empty" };
  if (looksLikeMenuGarbage(joined)) return { rejected: true, reason: "navigation_noise" };
  if (BAD_KNOWLEDGE_PATTERNS.some((pattern) => pattern.test(joined))) {
    return { rejected: true, reason: "promotional_or_placeholder_noise" };
  }

  if (title && isQuestionLike(title)) {
    return { rejected: false, reason: "faq_like" };
  }

  if (
    /\b(pricing|price|qiymət|qiymet|hours|working hours|contact|phone|email|whatsapp|booking|handoff|policy)\b/i.test(
      joined
    )
  ) {
    return { rejected: false, reason: "operational_fact" };
  }

  if (!valueText && !title) return { rejected: true, reason: "empty_payload" };
  return { rejected: false, reason: "general_knowledge" };
}

function summarizeBusiness({
  companyName = "",
  services = [],
  summary = "",
  sourceType = "",
  primaryPhone = "",
  primaryEmail = "",
} = {}) {
  const safeSummary = cleanText(summary, 420);

  if (safeSummary && !looksLikeBadSummary(safeSummary)) {
    return safeSummary;
  }

  const parts = [];
  const serviceList = arr(services).slice(0, 4).join(", ");

  if (companyName && serviceList) {
    parts.push(`${companyName} appears to offer ${serviceList}.`);
  } else if (serviceList) {
    parts.push(`The business appears to offer ${serviceList}.`);
  } else if (companyName) {
    parts.push(`${companyName} has been identified from the provided source.`);
  }

  if (primaryPhone || primaryEmail) {
    parts.push("Direct contact details were found in the source.");
  }

  if (!parts.length && sourceType) {
    parts.push(`The draft was synthesized from the provided ${sourceType} source.`);
  }

  return cleanText(parts.join(" "), 420);
}

function buildUnknowns({
  businessProfile = {},
  services = [],
  knowledgeItems = [],
} = {}) {
  const profile = obj(businessProfile);
  const out = [];

  if (!arr(services).length) out.push("services_unclear");
  if (!cleanText(profile.pricingPolicy || profile.pricingText, 320)) {
    out.push("pricing_unclear");
  }
  if (!arr(profile.hours).length) out.push("hours_unclear");
  if (!cleanText(profile.primaryPhone || profile.primaryEmail, 160)) {
    out.push("contact_route_unclear");
  }
  if (
    !arr(knowledgeItems).some((item) =>
      /\b(handoff|escalat|operator|human)\b/i.test(
        `${item.title || ""} ${item.valueText || ""}`
      )
    )
  ) {
    out.push("handoff_policy_unclear");
  }

  return uniqStrings(out);
}

function buildFollowupQuestions({
  unknowns = [],
  services = [],
  businessProfile = {},
} = {}) {
  const profile = obj(businessProfile);
  const out = [];

  if (arr(services).length === 0 || arr(unknowns).includes("services_unclear")) {
    out.push({
      key: "services_clarification",
      question: "What are the core services you want the assistant to describe first?",
    });
  }

  if (arr(unknowns).includes("pricing_unclear")) {
    out.push({
      key: "pricing_clarification",
      question: "Do you want the assistant to mention fixed prices, price ranges, or only invite users to request a quote?",
    });
  }

  if (arr(unknowns).includes("hours_unclear")) {
    out.push({
      key: "hours_clarification",
      question: "What working hours should the assistant rely on?",
    });
  }

  if (arr(unknowns).includes("handoff_policy_unclear")) {
    out.push({
      key: "handoff_clarification",
      question: "In which cases should the assistant hand the conversation to a human?",
    });
  }

  if (!cleanText(profile.primaryPhone || profile.primaryEmail, 160)) {
    out.push({
      key: "contact_clarification",
      question: "What is the main contact route the assistant should offer: phone, WhatsApp, Instagram DM, or email?",
    });
  }

  return uniqueBy(out, "key");
}

function buildReasoningSummary({
  sourceType = "",
  sourceUrl = "",
  services = [],
  rejections = [],
  unknowns = [],
  usedAgentKernel = false,
} = {}) {
  const host = cleanText(hostnameFromUrl(sourceUrl), 120);
  const sourceLabel = cleanText(sourceType || "source", 40);
  const serviceText = arr(services)
    .slice(0, 4)
    .map((item) => item.title)
    .filter(Boolean)
    .join(", ");

  const parts = [];

  if (host) {
    parts.push(`The draft was synthesized from ${sourceLabel} evidence for ${host}.`);
  } else {
    parts.push(`The draft was synthesized from the provided ${sourceLabel} evidence.`);
  }

  if (serviceText) {
    parts.push(`Accepted service candidates: ${serviceText}.`);
  } else {
    parts.push("No trustworthy service list could be confirmed from the raw evidence.");
  }

  if (arr(rejections).length) {
    const topReasons = uniqStrings(arr(rejections).map((item) => item.reason)).slice(0, 3);
    if (topReasons.length) {
      parts.push(`Rejected noisy fields because they looked like ${topReasons.join(", ")}.`);
    }
  }

  if (arr(unknowns).length) {
    parts.push(`Open gaps remain: ${arr(unknowns).join(", ")}.`);
  }

  parts.push(
    usedAgentKernel
      ? "An agent reasoning pass was used before the final critic pass."
      : "A deterministic critic pass was used because no agent reasoning result was available."
  );

  return cleanText(parts.join(" "), 900);
}

function buildEvidencePack({
  sourceType = "",
  sourceUrl = "",
  rawBusinessProfile = {},
  candidateServices = [],
  candidateKnowledge = [],
  collector = {},
  result = {},
  intakeContext = {},
} = {}) {
  const profile = obj(rawBusinessProfile);

  return compactObject({
    source: {
      sourceType: cleanText(sourceType, 24),
      sourceUrl: cleanText(sourceUrl, 320),
      hostname: cleanText(hostnameFromUrl(sourceUrl), 120),
    },
    businessProfile: compactObject({
      companyName: cleanText(
        profile.companyName || profile.displayName || profile.companyTitle,
        160
      ),
      summaryShort: cleanText(
        profile.companySummaryShort || profile.summaryShort || profile.shortDescription,
        420
      ),
      summaryLong: cleanText(
        profile.companySummaryLong || profile.summaryLong || profile.description,
        1200
      ),
      services: arr(profile.services).map((item) => cleanText(item, 180)).filter(Boolean),
      products: arr(profile.products).map((item) => cleanText(item, 180)).filter(Boolean),
      pricingHints: arr(profile.pricingHints).map((item) => cleanText(item, 220)).filter(Boolean),
      pricingPolicy: cleanText(profile.pricingPolicy || profile.pricingText, 320),
      primaryPhone: cleanText(profile.primaryPhone || profile.phone, 80),
      primaryEmail: cleanText(profile.primaryEmail || profile.email, 160),
      primaryAddress: cleanText(profile.primaryAddress || profile.address, 220),
      hours: arr(profile.hours).map((item) => cleanText(item, 180)).filter(Boolean),
      faqItems: arr(profile.faqItems).slice(0, 10),
      socialLinks: arr(profile.socialLinks).slice(0, 10),
    }),
    candidates: {
      services: arr(candidateServices)
        .map((item) => cleanText(item?.title || item?.valueText || item, 180))
        .filter(Boolean)
        .slice(0, 20),
      knowledge: arr(candidateKnowledge)
        .map((item) =>
          compactObject({
            category: cleanText(item?.category || item?.candidateGroup, 80),
            title: cleanText(item?.title || item?.valueJson?.question, 220),
            valueText: cleanText(
              item?.valueText || item?.valueJson?.answer || item?.normalizedText,
              360
            ),
          })
        )
        .filter((item) => item.title || item.valueText)
        .slice(0, 20),
    },
    counts: {
      collectorCandidateCount: Number(collector?.candidateCount || 0),
      collectorObservationCount: Number(collector?.observationCount || 0),
      warningsCount: arr(result?.warnings).length,
    },
    intakeContext: compactObject(obj(intakeContext)),
  });
}

async function tryRunAgentKernel({
  agentKernel = null,
  runBusinessDraftSynthesis = null,
  evidencePack = {},
} = {}) {
  const directRunner =
    typeof runBusinessDraftSynthesis === "function"
      ? runBusinessDraftSynthesis
      : typeof agentKernel?.runBusinessDraftSynthesis === "function"
        ? agentKernel.runBusinessDraftSynthesis.bind(agentKernel)
        : typeof agentKernel?.runReasonedDraftSynthesis === "function"
          ? agentKernel.runReasonedDraftSynthesis.bind(agentKernel)
          : null;

  if (directRunner) {
    return directRunner({
      task: "synthesize_setup_review_draft",
      schema: "reasoned_setup_draft.v1",
      evidence: evidencePack,
    });
  }

  if (typeof agentKernel?.run === "function") {
    return agentKernel.run({
      agentKey: "business_draft_synthesizer",
      task: "synthesize_setup_review_draft",
      schema: "reasoned_setup_draft.v1",
      input: {
        evidence: evidencePack,
        requirements: {
          thinkFirst: true,
          rejectNoise: true,
          preserveUnknowns: true,
          doNotInventFacts: true,
          optimizeForChatbotRuntime: true,
        },
      },
    });
  }

  return null;
}

function normalizeAgentOutput(output = {}) {
  const x = obj(output);

  return compactObject({
    businessProfile: obj(
      x.businessProfile || x.profile || x.business_profile || x.profile_patch
    ),
    services: arr(x.services),
    knowledgeItems: arr(x.knowledgeItems || x.knowledge || x.knowledge_items),
    warnings: arr(x.warnings).map((item) => cleanText(item, 220)).filter(Boolean),
    unknowns: arr(x.unknowns).map((item) => cleanText(item, 80)).filter(Boolean),
    rejections: arr(x.rejections).map((item) =>
      compactObject({
        kind: cleanText(item?.kind || item?.type, 40),
        value: cleanText(item?.value || item?.title || item, 220),
        reason: cleanText(item?.reason, 80),
      })
    ),
    followupQuestions: arr(x.followupQuestions || x.followup_questions).map((item) =>
      compactObject({
        key: cleanText(item?.key, 60),
        question: cleanText(item?.question || item, 220),
      })
    ),
    reasoningSummary: cleanText(
      x.reasoningSummary || x.reasoning_summary || x.summary,
      900
    ),
  });
}

function buildDeterministicDraft({
  sourceType = "",
  sourceUrl = "",
  rawBusinessProfile = {},
  candidateServices = [],
  candidateKnowledge = [],
} = {}) {
  const rawProfile = obj(rawBusinessProfile);
  const companyName = cleanText(
    rawProfile.companyName || rawProfile.displayName || rawProfile.companyTitle,
    160
  );

  const serviceInputs = [
    ...arr(rawProfile.services),
    ...arr(rawProfile.products),
    ...arr(candidateServices).map((item) => item?.title || item?.valueText || item),
  ];

  const serviceDecisions = uniqueBy(
    serviceInputs.map((value) =>
      classifyServiceCandidate(value, {
        companyName,
        sourceUrl,
      })
    ),
    (item) => `${item.accepted}|${item.title || item.reason}`
  );

  const acceptedServices = arr(serviceDecisions)
    .filter((item) => item.accepted)
    .slice(0, 10)
    .map((item) =>
      compactObject({
        title: item.title,
        category: "service",
        confidence: item.confidence,
        confidenceLabel: item.confidenceLabel,
        reasoning: item.reason,
        origin: "reasoned_draft",
        sourceType: cleanText(sourceType, 24),
      })
    );

  const rejectedServices = arr(serviceDecisions)
    .filter((item) => !item.accepted)
    .slice(0, 20)
    .map((item) =>
      compactObject({
        kind: "service",
        value: cleanText(item.title || "", 180),
        reason: cleanText(item.reason, 80),
      })
    );

  const knowledgeInputs = [
    ...arr(candidateKnowledge).map((item) => normalizeKnowledgeCandidate(item)),
    ...arr(rawProfile.faqItems).map((item) =>
      compactObject({
        category: "faq",
        title: cleanText(item?.question, 220),
        valueText: cleanText(item?.answer, 700),
        confidence: 0.54,
        confidenceLabel: "reasoned_faq",
      })
    ),
    cleanText(rawProfile.pricingPolicy || rawProfile.pricingText, 320)
      ? {
          category: "pricing_policy",
          title: "Pricing policy",
          valueText: cleanText(rawProfile.pricingPolicy || rawProfile.pricingText, 320),
          confidence: 0.58,
          confidenceLabel: "reasoned_operational",
        }
      : null,
  ].filter(Boolean);

  const knowledgeItems = uniqueBy(
    knowledgeInputs
      .map((item) => {
        const decision = shouldRejectKnowledge(item);
        if (decision.rejected) {
          return {
            rejected: true,
            item,
            reason: decision.reason,
          };
        }

        return {
          rejected: false,
          item: compactObject({
            category: cleanText(item.category || "general", 80),
            title: cleanText(item.title || "Knowledge item", 220),
            valueText: cleanText(item.valueText, 700),
            confidence:
              typeof item.confidence === "number"
                ? item.confidence
                : Number(item.confidence || 0) || 0.5,
            confidenceLabel: cleanText(item.confidenceLabel || "reasoned", 40),
            origin: "reasoned_draft",
            sourceType: cleanText(sourceType, 24),
            reasoning: decision.reason,
          }),
          reason: decision.reason,
        };
      })
      .filter(Boolean),
    (item) =>
      `${item.rejected}|${normalizeText(item?.item?.title)}|${normalizeText(
        item?.item?.valueText
      )}`
  );

  const acceptedKnowledge = knowledgeItems
    .filter((item) => !item.rejected)
    .map((item) => item.item)
    .slice(0, 16);

  const rejectedKnowledge = knowledgeItems
    .filter((item) => item.rejected)
    .map((item) =>
      compactObject({
        kind: "knowledge",
        value: cleanText(item.item?.title || item.item?.valueText, 220),
        reason: cleanText(item.reason, 80),
      })
    )
    .slice(0, 20);

  const businessProfile = compactObject({
    companyName,
    displayName: companyName,
    companyTitle: cleanText(rawProfile.companyTitle || companyName, 160),
    websiteUrl: cleanText(rawProfile.websiteUrl || rawProfile.website || sourceUrl, 320),
    primaryPhone: cleanText(rawProfile.primaryPhone || rawProfile.phone, 80),
    primaryEmail: cleanText(rawProfile.primaryEmail || rawProfile.email, 160),
    primaryAddress: cleanText(rawProfile.primaryAddress || rawProfile.address, 220),
    companySummaryShort: summarizeBusiness({
      companyName,
      services: acceptedServices.map((item) => item.title),
      summary:
        rawProfile.companySummaryShort ||
        rawProfile.summaryShort ||
        rawProfile.shortDescription,
      sourceType,
      primaryPhone: rawProfile.primaryPhone || rawProfile.phone,
      primaryEmail: rawProfile.primaryEmail || rawProfile.email,
    }),
    companySummaryLong: cleanText(
      rawProfile.companySummaryLong ||
        rawProfile.summaryLong ||
        rawProfile.description,
      1200
    ),
    services: acceptedServices.map((item) => item.title),
    products: [],
    pricingHints: arr(rawProfile.pricingHints).map((item) => cleanText(item, 220)).filter(Boolean),
    pricingPolicy: cleanText(rawProfile.pricingPolicy || rawProfile.pricingText, 320),
    hours: arr(rawProfile.hours).map((item) => cleanText(item, 180)).filter(Boolean).slice(0, 10),
    socialLinks: arr(rawProfile.socialLinks).slice(0, 10),
    whatsappLinks: arr(rawProfile.whatsappLinks).slice(0, 8),
    bookingLinks: arr(rawProfile.bookingLinks).slice(0, 8),
    faqItems: acceptedKnowledge
      .filter((item) => lower(item.category) === "faq")
      .map((item) =>
        compactObject({
          question: item.title,
          answer: item.valueText,
        })
      ),
    supportedLanguages: arr(rawProfile.supportedLanguages).slice(0, 8),
    mainLanguage: cleanText(
      rawProfile.mainLanguage || rawProfile.primaryLanguage || rawProfile.language,
      24
    ),
    primaryLanguage: cleanText(
      rawProfile.primaryLanguage || rawProfile.mainLanguage || rawProfile.language,
      24
    ),
    sourceType: cleanText(sourceType, 24),
    sourceUrl: cleanText(sourceUrl, 320),
  });

  const warnings = [];
  if (!acceptedServices.length) {
    warnings.push("reasoned_draft_services_not_confident");
  }
  if (
    arr(rejectedServices).some((item) => item.reason === "company_or_domain_leak")
  ) {
    warnings.push("reasoned_draft_rejected_company_or_domain_as_service");
  }

  return {
    businessProfile,
    services: acceptedServices,
    knowledgeItems: acceptedKnowledge,
    warnings,
    rejections: [...rejectedServices, ...rejectedKnowledge],
  };
}

function postProcessReasonedDraft({
  raw = {},
  sourceType = "",
  sourceUrl = "",
  rawBusinessProfile = {},
} = {}) {
  const input = obj(raw);
  const deterministic = buildDeterministicDraft({
    sourceType,
    sourceUrl,
    rawBusinessProfile,
    candidateServices: arr(input.services),
    candidateKnowledge: arr(input.knowledgeItems),
  });

  const draftBusinessProfile = compactObject({
    ...obj(deterministic.businessProfile),
    ...obj(input.businessProfile),
  });

  const services = uniqueBy(
    [
      ...arr(input.services),
      ...arr(deterministic.services),
    ]
      .map((item) => {
        const title = cleanText(item?.title || item, 180);
        const decision = classifyServiceCandidate(title, {
          companyName:
            draftBusinessProfile.companyName ||
            rawBusinessProfile.companyName ||
            rawBusinessProfile.displayName,
          sourceUrl,
        });

        if (!decision.accepted) return null;

        return compactObject({
          title: decision.title,
          category: cleanText(item?.category || "service", 40),
          confidence:
            typeof item?.confidence === "number"
              ? item.confidence
              : decision.confidence,
          confidenceLabel: cleanText(
            item?.confidenceLabel || decision.confidenceLabel,
            40
          ),
          reasoning: cleanText(item?.reasoning || decision.reason, 120),
          origin: "reasoned_draft",
          sourceType: cleanText(sourceType, 24),
        });
      })
      .filter(Boolean),
    (item) => normalizeText(item.title)
  ).slice(0, 12);

  const knowledgeItems = uniqueBy(
    [
      ...arr(input.knowledgeItems),
      ...arr(deterministic.knowledgeItems),
    ]
      .map((item) => {
        const normalized = normalizeKnowledgeCandidate(item);
        const decision = shouldRejectKnowledge(normalized);
        if (decision.rejected) return null;

        return compactObject({
          category: cleanText(normalized.category || "general", 80),
          title: cleanText(normalized.title || "Knowledge item", 220),
          valueText: cleanText(normalized.valueText, 700),
          confidence:
            typeof normalized.confidence === "number"
              ? normalized.confidence
              : 0.5,
          confidenceLabel: cleanText(
            normalized.confidenceLabel || "reasoned",
            40
          ),
          reasoning: cleanText(decision.reason, 120),
          origin: "reasoned_draft",
          sourceType: cleanText(sourceType, 24),
        });
      })
      .filter(Boolean),
    (item) => `${normalizeText(item.category)}|${normalizeText(item.title)}`
  ).slice(0, 16);

  const rejections = uniqueBy(
    [
      ...arr(deterministic.rejections),
      ...arr(input.rejections).map((item) =>
        compactObject({
          kind: cleanText(item?.kind || item?.type, 40),
          value: cleanText(item?.value || item?.title || item, 220),
          reason: cleanText(item?.reason, 80),
        })
      ),
    ].filter(Boolean),
    (item) => `${normalizeText(item.kind)}|${normalizeText(item.value)}|${normalizeText(item.reason)}`
  );

  const businessProfile = compactObject({
    ...draftBusinessProfile,
    services: services.map((item) => item.title),
    faqItems: knowledgeItems
      .filter((item) => lower(item.category) === "faq")
      .map((item) =>
        compactObject({
          question: item.title,
          answer: item.valueText,
        })
      ),
    companySummaryShort: summarizeBusiness({
      companyName:
        draftBusinessProfile.companyName || draftBusinessProfile.displayName,
      services: services.map((item) => item.title),
      summary:
        draftBusinessProfile.companySummaryShort ||
        draftBusinessProfile.summaryShort ||
        draftBusinessProfile.shortDescription,
      sourceType,
      primaryPhone:
        draftBusinessProfile.primaryPhone || draftBusinessProfile.phone,
      primaryEmail:
        draftBusinessProfile.primaryEmail || draftBusinessProfile.email,
    }),
  });

  const unknowns = uniqueBy(
    [
      ...arr(input.unknowns).map((item) => cleanText(item, 80)).filter(Boolean),
      ...buildUnknowns({
        businessProfile,
        services,
        knowledgeItems,
      }),
    ],
    (item) => item
  );

  const followupQuestions = uniqueBy(
    [
      ...arr(input.followupQuestions).map((item) =>
        compactObject({
          key: cleanText(item?.key, 60),
          question: cleanText(item?.question || item, 220),
        })
      ),
      ...buildFollowupQuestions({
        unknowns,
        services,
        businessProfile,
      }),
    ].filter((item) => item.question),
    "key"
  );

  const warnings = uniqStrings(
    [
      ...arr(input.warnings).map((item) => cleanText(item, 220)).filter(Boolean),
      ...arr(deterministic.warnings),
    ].filter(Boolean)
  );

  const reasoningSummary =
    cleanText(input.reasoningSummary, 900) ||
    buildReasoningSummary({
      sourceType,
      sourceUrl,
      services,
      rejections,
      unknowns,
      usedAgentKernel: false,
    });

  return {
    businessProfile,
    services,
    knowledgeItems,
    warnings,
    unknowns,
    rejections,
    followupQuestions,
    reasoningSummary,
  };
}

export async function buildReasonedDraft({
  sourceType = "",
  sourceUrl = "",
  rawBusinessProfile = {},
  candidateServices = [],
  candidateKnowledge = [],
  collector = {},
  result = {},
  intakeContext = {},
  agentKernel = null,
  runBusinessDraftSynthesis = null,
} = {}) {
  const evidencePack = buildEvidencePack({
    sourceType,
    sourceUrl,
    rawBusinessProfile,
    candidateServices,
    candidateKnowledge,
    collector,
    result,
    intakeContext,
  });

  let agentOutput = null;
  let agentError = "";

  try {
    agentOutput = await tryRunAgentKernel({
      agentKernel,
      runBusinessDraftSynthesis,
      evidencePack,
    });
  } catch (error) {
    agentError = cleanText(error?.stack || error?.message || String(error), 500);
  }

  const normalizedAgentOutput = normalizeAgentOutput(agentOutput);
  const usedAgentKernel =
    !!agentOutput &&
    (Object.keys(obj(normalizedAgentOutput.businessProfile)).length > 0 ||
      arr(normalizedAgentOutput.services).length > 0 ||
      arr(normalizedAgentOutput.knowledgeItems).length > 0);

  const postProcessed = postProcessReasonedDraft({
    raw: usedAgentKernel
      ? normalizedAgentOutput
      : buildDeterministicDraft({
          sourceType,
          sourceUrl,
          rawBusinessProfile,
          candidateServices,
          candidateKnowledge,
        }),
    sourceType,
    sourceUrl,
    rawBusinessProfile,
  });

  const reasoningSummary = buildReasoningSummary({
    sourceType,
    sourceUrl,
    services: postProcessed.services,
    rejections: postProcessed.rejections,
    unknowns: postProcessed.unknowns,
    usedAgentKernel,
  });

  return {
    schema: "reasoned_setup_draft.v1",
    usedAgentKernel,
    businessProfile: postProcessed.businessProfile,
    services: postProcessed.services,
    knowledgeItems: postProcessed.knowledgeItems,
    warnings: uniqStrings(
      [
        ...arr(postProcessed.warnings),
        agentError ? "reasoned_draft_agent_kernel_failed_fallback_used" : "",
      ].filter(Boolean)
    ),
    unknowns: postProcessed.unknowns,
    rejections: postProcessed.rejections,
    followupQuestions: postProcessed.followupQuestions,
    reasoningSummary,
    evidenceStats: {
      rawServiceCount:
        arr(rawBusinessProfile?.services).length +
        arr(rawBusinessProfile?.products).length +
        arr(candidateServices).length,
      acceptedServiceCount: arr(postProcessed.services).length,
      rawKnowledgeCount:
        arr(rawBusinessProfile?.faqItems).length + arr(candidateKnowledge).length,
      acceptedKnowledgeCount: arr(postProcessed.knowledgeItems).length,
      rejectionCount: arr(postProcessed.rejections).length,
      collectorCandidateCount: Number(collector?.candidateCount || 0),
      collectorObservationCount: Number(collector?.observationCount || 0),
    },
    agent: compactObject({
      attempted: !!agentKernel || typeof runBusinessDraftSynthesis === "function",
      used: usedAgentKernel,
      error: agentError,
    }),
    evidencePack,
  };
}

export const __test__ = {
  buildDeterministicDraft,
  buildEvidencePack,
  buildFollowupQuestions,
  buildReasoningSummary,
  buildUnknowns,
  classifyServiceCandidate,
  looksLikeCompanyLeak,
  looksLikeContactOrUrl,
  looksLikeMenuGarbage,
  normalizeKnowledgeCandidate,
  sanitizeServiceTitle,
  shouldRejectKnowledge,
};