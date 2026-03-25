// src/services/sourceFusion/manualObservations.js
// FINAL v1.0 — manual / voice intake -> observation builder
// goals:
// - let setup work with no source at all
// - treat manual text and future voice transcript as first-class observations
// - keep manual input highest-priority inside source fusion policies

import {
  arr,
  compactText,
  confidenceLabel,
  inferSocialPlatform,
  isLikelyBusinessWebsiteUrl,
  lower,
  normalizeObservedEmail,
  normalizeObservedPhone,
  normalizeObservedText,
  normalizeObservedUrl,
  obj,
  s,
  safeKeyPart,
  uniqBy,
  uniqStrings,
} from "./shared.js";

const LABEL_ALIASES = {
  company_name: [
    "name",
    "business name",
    "company",
    "company name",
    "brand",
    "brand name",
    "business",
  ],
  website_url: ["website", "site", "web", "url", "website url"],
  summary: [
    "about",
    "description",
    "summary",
    "brief",
    "overview",
    "about business",
    "business description",
  ],
  primary_email: ["email", "mail", "e-mail"],
  primary_phone: ["phone", "mobile", "telephone", "tel", "contact number", "number"],
  primary_address: ["address", "location", "branch", "office", "unvan", "ünvan"],
  working_hours: ["hours", "working hours", "opening hours", "schedule", "iş saatları"],
  service: ["service", "services", "offerings", "xidmet", "xidmət", "xidmətlər", "xidmetler"],
  product: ["product", "products", "packages", "package", "plans", "plan"],
  pricing_hint: ["pricing", "price", "prices", "pricing hint", "pricing model", "qiymet", "qiymət"],
  support_mode: ["support", "support mode", "contact mode", "sales mode"],
  booking_link: ["booking", "booking link", "book", "schedule link", "appointment link"],
  whatsapp_link: ["whatsapp", "whatsapp link", "wa", "wa.me"],
  instagram: ["instagram", "insta"],
  facebook: ["facebook", "fb"],
  linkedin: ["linkedin"],
  youtube: ["youtube"],
  tiktok: ["tiktok"],
  faq: ["faq", "question", "questions"],
};

const SOCIAL_HOST_RE =
  /\b(instagram\.com|facebook\.com|fb\.com|linkedin\.com|wa\.me|whatsapp\.com|t\.me|telegram\.me|youtube\.com|youtu\.be|x\.com|twitter\.com|tiktok\.com|pinterest\.com)\b/i;

const BOOKING_HOST_RE =
  /\b(calendly\.com|acuityscheduling\.com|squareup\.com|book|booking|schedule|appointment|reserve)\b/i;

function compactLines(text = "") {
  return s(text)
    .replace(/\r/g, "\n")
    .split(/\n+/)
    .map((line) => compactText(line, 500))
    .filter(Boolean);
}

function splitDelimitedList(text = "", { max = 24 } = {}) {
  return uniqStrings(
    s(text)
      .split(/\n+|[|•·▪●]+|;/g)
      .flatMap((part) => {
        const value = compactText(part, 220);
        if (!value) return [];
        if (
          value.includes(",") &&
          value.split(",").length >= 2 &&
          value.length <= 220 &&
          !/[.!?]/.test(value)
        ) {
          return value
            .split(",")
            .map((x) => compactText(x, 180))
            .filter(Boolean);
        }
        return [value];
      })
      .filter(Boolean)
  ).slice(0, max);
}

function takeSentencePrefix(text = "", maxSentences = 2, max = 420) {
  const value = compactText(text, 2200);
  if (!value) return "";

  const sentences = [];
  let rest = value;

  while (rest && sentences.length < maxSentences) {
    const match = rest.match(/^(.+?[.!?])(?:\s+|$)/);
    if (!match) {
      sentences.push(rest.trim());
      break;
    }

    sentences.push(match[1].trim());
    rest = rest.slice(match[0].length).trim();
  }

  return compactText(sentences.join(" "), max);
}

function extractEmails(text = "") {
  return uniqStrings(
    arr(
      compactText(text, 8000).match(
        /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi
      )
    ).map((item) => normalizeObservedEmail(item))
  ).filter((x) => /@/.test(x));
}

function extractPhones(text = "") {
  return uniqStrings(
    arr(
      compactText(text, 8000).match(
        /(?:\+?\d[\d\s().-]{6,}\d)/g
      )
    )
      .map((item) => normalizeObservedPhone(item))
      .filter((x) => x && x.replace(/[^\d]/g, "").length >= 7)
  );
}

function extractUrls(text = "") {
  const matches = arr(
    compactText(text, 8000).match(
      /((?:https?:\/\/|www\.)[^\s,;]+|(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s,;]*)?)/gi
    )
  );

  return uniqStrings(
    matches
      .map((item) => normalizeObservedUrl(item))
      .filter(Boolean)
      .filter((item) => !/@/.test(item))
  );
}

function normalizeSocialLinks(list = []) {
  return uniqBy(
    arr(list)
      .map((item) => {
        const x = obj(item);
        const url = normalizeObservedUrl(x.url || x.href || x.link || x.value);
        const platform = lower(x.platform || inferSocialPlatform(url, x.platform));
        if (!platform || !url) return null;
        if (!SOCIAL_HOST_RE.test(url)) return null;
        return { platform, url };
      })
      .filter(Boolean),
    (item) => `${lower(item.platform)}|${lower(item.url)}`
  ).slice(0, 12);
}

function normalizeFaqItems(list = []) {
  return uniqBy(
    arr(list)
      .map((item) => {
        if (typeof item === "string") {
          const question = compactText(item, 220);
          return question ? { question, answer: "" } : null;
        }

        const x = obj(item);
        const question = compactText(x.question || x.q || x.title, 220);
        const answer = compactText(x.answer || x.a || x.value || x.text, 900);
        if (!question) return null;

        return { question, answer };
      })
      .filter(Boolean),
    (item) => lower(item.question)
  ).slice(0, 12);
}

function inferLabelKey(label = "") {
  const x = lower(label);
  if (!x) return "";

  for (const [key, aliases] of Object.entries(LABEL_ALIASES)) {
    if (aliases.some((alias) => x === lower(alias))) return key;
  }

  return "";
}

function parseLabeledLines(text = "") {
  const buckets = {
    companyNames: [],
    websiteUrls: [],
    summaries: [],
    emails: [],
    phones: [],
    addresses: [],
    hours: [],
    services: [],
    products: [],
    pricingHints: [],
    supportModes: [],
    bookingLinks: [],
    whatsappLinks: [],
    socialLinks: [],
    faqItems: [],
    unlabeledLines: [],
  };

  const lines = compactLines(text);

  for (const line of lines) {
    const match = line.match(/^([^:—–-]{2,40})\s*[:—–-]\s*(.+)$/);
    if (!match) {
      buckets.unlabeledLines.push(line);
      continue;
    }

    const label = compactText(match[1], 80);
    const value = compactText(match[2], 700);
    const bucket = inferLabelKey(label);

    if (!bucket) {
      buckets.unlabeledLines.push(line);
      continue;
    }

    if (bucket === "company_name") buckets.companyNames.push(value);
    else if (bucket === "website_url") buckets.websiteUrls.push(value);
    else if (bucket === "summary") buckets.summaries.push(value);
    else if (bucket === "primary_email") buckets.emails.push(value);
    else if (bucket === "primary_phone") buckets.phones.push(value);
    else if (bucket === "primary_address") buckets.addresses.push(value);
    else if (bucket === "working_hours") buckets.hours.push(value);
    else if (bucket === "service") buckets.services.push(...splitDelimitedList(value, { max: 24 }));
    else if (bucket === "product") buckets.products.push(...splitDelimitedList(value, { max: 24 }));
    else if (bucket === "pricing_hint") buckets.pricingHints.push(...splitDelimitedList(value, { max: 12 }));
    else if (bucket === "support_mode") buckets.supportModes.push(value);
    else if (bucket === "booking_link") buckets.bookingLinks.push(value);
    else if (bucket === "whatsapp_link") buckets.whatsappLinks.push(value);
    else if (bucket === "faq") buckets.faqItems.push({ question: value, answer: "" });
    else if (["instagram", "facebook", "linkedin", "youtube", "tiktok"].includes(bucket)) {
      buckets.socialLinks.push({
        platform: bucket === "instagram" ? "instagram" : bucket,
        url: value,
      });
    } else {
      buckets.unlabeledLines.push(line);
    }
  }

  return buckets;
}

function inferCompanyNameFromFreeText(text = "") {
  const lines = compactLines(text);
  const first = lines[0] || "";
  if (!first) return "";
  if (first.length < 2 || first.length > 72) return "";
  if (/[:]/.test(first)) return "";
  if (/^https?:/i.test(first) || /@/.test(first)) return "";
  if (/(\d{1,2}[:.]\d{2}|\+?\d{7,})/.test(first)) return "";
  return first;
}

function normalizeAnswers(answers = {}) {
  const x = obj(answers);

  const socialObject = obj(x.socials || x.socialAccounts || {});
  const socialLinks = normalizeSocialLinks([
    ...arr(x.socialLinks),
    ...arr(x.social_links),
    ...Object.entries(socialObject).map(([platform, url]) => ({
      platform,
      url,
    })),
    { platform: "instagram", url: x.instagram || x.instagramUrl || x.instagram_url },
    { platform: "facebook", url: x.facebook || x.facebookUrl || x.facebook_url },
    { platform: "linkedin", url: x.linkedin || x.linkedinUrl || x.linkedin_url },
    { platform: "youtube", url: x.youtube || x.youtubeUrl || x.youtube_url },
    { platform: "tiktok", url: x.tiktok || x.tiktokUrl || x.tiktok_url },
  ]);

  return {
    companyNames: uniqStrings([
      x.companyName,
      x.businessName,
      x.name,
      x.brandName,
      x.company,
      x.business,
    ]),
    websiteUrls: uniqStrings([
      x.website,
      x.websiteUrl,
      x.website_url,
      x.url,
      x.site,
    ]),
    summaries: uniqStrings([
      x.summary,
      x.description,
      x.about,
      x.brief,
      x.overview,
    ]),
    emails: uniqStrings([
      x.email,
      x.primaryEmail,
      x.primary_email,
      ...arr(x.emails),
    ]),
    phones: uniqStrings([
      x.phone,
      x.primaryPhone,
      x.primary_phone,
      x.mobile,
      x.whatsappNumber,
      ...arr(x.phones),
    ]),
    addresses: uniqStrings([
      x.address,
      x.primaryAddress,
      x.primary_address,
      x.location,
      ...arr(x.addresses),
    ]),
    hours: uniqStrings([
      x.hours,
      x.workingHours,
      x.working_hours,
      x.schedule,
      ...arr(x.hoursList),
    ]),
    services: uniqStrings([
      ...splitDelimitedList(x.services || "", { max: 24 }),
      ...arr(x.services),
      ...arr(x.serviceList),
    ]),
    products: uniqStrings([
      ...splitDelimitedList(x.products || "", { max: 24 }),
      ...arr(x.products),
      ...arr(x.productList),
      ...arr(x.packages),
    ]),
    pricingHints: uniqStrings([
      ...splitDelimitedList(x.pricing || "", { max: 12 }),
      ...splitDelimitedList(x.pricingHints || "", { max: 12 }),
      ...arr(x.pricingHints),
      ...arr(x.prices),
    ]),
    supportModes: uniqStrings([
      x.supportMode,
      x.contactMode,
      x.salesMode,
    ]),
    bookingLinks: uniqStrings([
      x.booking,
      x.bookingUrl,
      x.booking_url,
      x.scheduleUrl,
      x.schedule_url,
      ...arr(x.bookingLinks),
    ]),
    whatsappLinks: uniqStrings([
      x.whatsapp,
      x.whatsappUrl,
      x.whatsapp_url,
      x.whatsappLink,
      ...arr(x.whatsappLinks),
    ]),
    socialLinks,
    faqItems: normalizeFaqItems(x.faqItems || x.faq || []),
  };
}

function isWhatsappUrl(url = "") {
  return /\b(wa\.me|whatsapp\.com)\b/i.test(url);
}

function isBookingUrl(url = "") {
  return BOOKING_HOST_RE.test(url);
}

function buildNormalizedManualIntake({
  manualText = "",
  voiceTranscript = "",
  answers = {},
  note = "",
} = {}) {
  const safeManualText = compactText(manualText, 12000);
  const safeVoiceTranscript = compactText(voiceTranscript, 12000);
  const safeAnswers = obj(answers);
  const structured = normalizeAnswers(safeAnswers);

  const parsedManual = parseLabeledLines(safeManualText);
  const parsedVoice = parseLabeledLines(safeVoiceTranscript);

  const combinedText = compactText(
    [safeManualText, safeVoiceTranscript].filter(Boolean).join("\n\n"),
    24000
  );

  const detectedEmails = extractEmails(combinedText);
  const detectedPhones = extractPhones(combinedText);
  const detectedUrls = extractUrls(combinedText);

  const socialLinks = normalizeSocialLinks([
    ...structured.socialLinks,
    ...parsedManual.socialLinks,
    ...parsedVoice.socialLinks,
    ...detectedUrls
      .filter((url) => SOCIAL_HOST_RE.test(url) && !isWhatsappUrl(url))
      .map((url) => ({
        platform: inferSocialPlatform(url),
        url,
      })),
  ]);

  const bookingLinks = uniqStrings([
    ...structured.bookingLinks,
    ...parsedManual.bookingLinks,
    ...parsedVoice.bookingLinks,
    ...detectedUrls.filter((url) => isBookingUrl(url) && !isWhatsappUrl(url)),
  ])
    .map((url) => normalizeObservedUrl(url))
    .filter(Boolean);

  const whatsappLinks = uniqStrings([
    ...structured.whatsappLinks,
    ...parsedManual.whatsappLinks,
    ...parsedVoice.whatsappLinks,
    ...detectedUrls.filter((url) => isWhatsappUrl(url)),
  ])
    .map((url) => normalizeObservedUrl(url))
    .filter(Boolean);

  const businessWebsiteUrls = uniqStrings([
    ...structured.websiteUrls,
    ...parsedManual.websiteUrls,
    ...parsedVoice.websiteUrls,
    ...detectedUrls.filter(
      (url) => isLikelyBusinessWebsiteUrl(url) && !SOCIAL_HOST_RE.test(url)
    ),
  ])
    .map((url) => normalizeObservedUrl(url))
    .filter(Boolean);

  const summaryCandidates = uniqStrings([
    ...structured.summaries,
    ...parsedManual.summaries,
    ...parsedVoice.summaries,
    compactText(
      [
        ...parsedManual.unlabeledLines,
        ...parsedVoice.unlabeledLines,
      ].join(" "),
      4000
    ),
  ]).filter(Boolean);

  const summaryLong = compactText(summaryCandidates.join(" "), 1800);
  const summaryShort = takeSentencePrefix(summaryLong, 2, 420);

  const companyNames = uniqStrings([
    ...structured.companyNames,
    ...parsedManual.companyNames,
    ...parsedVoice.companyNames,
    inferCompanyNameFromFreeText(safeManualText),
    inferCompanyNameFromFreeText(safeVoiceTranscript),
  ]);

  const answersCount = Object.values(safeAnswers).filter((value) => {
    if (Array.isArray(value)) return value.length > 0;
    if (value && typeof value === "object") return Object.keys(value).length > 0;
    return !!s(value);
  }).length;

  return {
    note: compactText(note, 800),
    manualText: safeManualText,
    voiceTranscript: safeVoiceTranscript,
    answers: safeAnswers,

    companyNames,
    websiteUrls: businessWebsiteUrls,
    summaries: summaryCandidates,
    summaryShort,
    summaryLong,

    emails: uniqStrings([
      ...structured.emails,
      ...parsedManual.emails,
      ...parsedVoice.emails,
      ...detectedEmails,
    ]).map((email) => normalizeObservedEmail(email)).filter((x) => /@/.test(x)),

    phones: uniqStrings([
      ...structured.phones,
      ...parsedManual.phones,
      ...parsedVoice.phones,
      ...detectedPhones,
    ]).map((phone) => normalizeObservedPhone(phone)).filter((x) => x && x.replace(/[^\d]/g, "").length >= 7),

    addresses: uniqStrings([
      ...structured.addresses,
      ...parsedManual.addresses,
      ...parsedVoice.addresses,
    ]),

    hours: uniqStrings([
      ...structured.hours,
      ...parsedManual.hours,
      ...parsedVoice.hours,
    ]),

    services: uniqStrings([
      ...structured.services,
      ...parsedManual.services,
      ...parsedVoice.services,
    ]).slice(0, 24),

    products: uniqStrings([
      ...structured.products,
      ...parsedManual.products,
      ...parsedVoice.products,
    ]).slice(0, 24),

    pricingHints: uniqStrings([
      ...structured.pricingHints,
      ...parsedManual.pricingHints,
      ...parsedVoice.pricingHints,
    ]).slice(0, 12),

    supportModes: uniqStrings([
      ...structured.supportModes,
      ...parsedManual.supportModes,
      ...parsedVoice.supportModes,
    ]).slice(0, 6),

    socialLinks,
    bookingLinks,
    whatsappLinks,
    faqItems: normalizeFaqItems([
      ...structured.faqItems,
      ...parsedManual.faqItems,
      ...parsedVoice.faqItems,
    ]),

    answersCount,
    hasManualText: !!safeManualText,
    hasVoiceTranscript: !!safeVoiceTranscript,
    hasStructuredAnswers: answersCount > 0,
    hasAnyInput:
      !!safeManualText ||
      !!safeVoiceTranscript ||
      answersCount > 0,
  };
}

function makeObservationBase({
  sourceId = "",
  sourceRunId = "",
  pageTitle = "",
  metadataJson = {},
} = {}) {
  return {
    sourceId: s(sourceId),
    sourceRunId: s(sourceRunId),
    sourceType: "manual",
    pageUrl: "",
    pageTitle: s(pageTitle || "Manual business input"),
    metadataJson: obj(metadataJson),
  };
}

function pushObservation(out = [], base = {}, payload = {}) {
  const text = s(payload.rawValueText);
  const jsonValue = obj(payload.rawValueJson);

  if (!text && !Object.keys(jsonValue).length) return;

  const confidence = Number(payload.confidence ?? 0.95);

  out.push({
    sourceId: base.sourceId,
    sourceRunId: base.sourceRunId,
    sourceType: "manual",
    observationGroup: s(payload.observationGroup || "manual"),
    claimType: s(payload.claimType),
    claimKey: s(payload.claimKey),
    rawValueText: text,
    rawValueJson: jsonValue,
    normalizedValueText: s(payload.normalizedValueText),
    normalizedValueJson: obj(payload.normalizedValueJson),
    evidenceText: s(payload.evidenceText || "User-provided manual setup input"),
    pageUrl: "",
    pageTitle: base.pageTitle,
    confidence,
    confidenceLabel: confidenceLabel(confidence),
    resolutionStatus: "pending",
    extractionMethod: s(payload.extractionMethod || "manual_intake"),
    extractionModel: s(payload.extractionModel || "manual_intake_v1"),
    metadataJson: {
      ...obj(base.metadataJson),
      ...obj(payload.metadataJson),
      input_kind: "manual",
    },
    firstSeenAt: new Date().toISOString(),
    lastSeenAt: new Date().toISOString(),
  });
}

function dedupeObservationRows(rows = []) {
  const seen = new Set();

  return arr(rows).filter((item) => {
    const key = [
      lower(item.claimType),
      lower(item.claimKey),
      lower(item.normalizedValueText || item.rawValueText),
    ].join("|");

    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function buildManualObservations({
  manualText = "",
  voiceTranscript = "",
  answers = {},
  note = "",
  sourceId = "",
  sourceRunId = "",
} = {}) {
  const intake = buildNormalizedManualIntake({
    manualText,
    voiceTranscript,
    answers,
    note,
  });

  const warnings = [];
  if (!intake.hasAnyInput) {
    warnings.push("manual_input_empty");
  }

  const companyName = s(intake.companyNames[0]);
  const websiteUrl = s(intake.websiteUrls[0]);
  const summaryShort = s(intake.summaryShort);
  const summaryLong = s(intake.summaryLong);
  const primaryEmail = s(intake.emails[0]);
  const primaryPhone = s(intake.phones[0]);
  const primaryAddress = s(intake.addresses[0]);
  const supportMode = s(intake.supportModes[0]);

  const base = makeObservationBase({
    sourceId,
    sourceRunId,
    pageTitle: companyName || "Manual business input",
    metadataJson: {
      has_manual_text: intake.hasManualText,
      has_voice_transcript: intake.hasVoiceTranscript,
      has_structured_answers: intake.hasStructuredAnswers,
      structured_answer_count: intake.answersCount,
    },
  });

  const out = [];

  if (companyName) {
    pushObservation(out, base, {
      observationGroup: "identity",
      claimType: "company_name",
      claimKey: "company_name",
      rawValueText: companyName,
      rawValueJson: { company_name: companyName },
      normalizedValueText: normalizeObservedText(companyName),
      normalizedValueJson: { company_name: companyName },
      evidenceText: "Business name provided by user",
      confidence: 0.99,
    });
  }

  if (websiteUrl) {
    const normalized = normalizeObservedUrl(websiteUrl);
    if (normalized) {
      pushObservation(out, base, {
        observationGroup: "identity",
        claimType: "website_url",
        claimKey: "website_url",
        rawValueText: normalized,
        rawValueJson: { url: normalized },
        normalizedValueText: normalized,
        normalizedValueJson: { url: normalized },
        evidenceText: "Website URL provided by user",
        confidence: 0.98,
      });
    }
  }

  if (summaryShort) {
    pushObservation(out, base, {
      observationGroup: "summary",
      claimType: "summary_short",
      claimKey: "summary_short",
      rawValueText: summaryShort,
      rawValueJson: { summary: summaryShort },
      normalizedValueText: normalizeObservedText(summaryShort),
      normalizedValueJson: { summary: summaryShort },
      evidenceText: "Short business summary provided by user",
      confidence: 0.95,
    });
  }

  if (summaryLong) {
    pushObservation(out, base, {
      observationGroup: "summary",
      claimType: "summary_long",
      claimKey: "summary_long",
      rawValueText: summaryLong,
      rawValueJson: { summary: summaryLong },
      normalizedValueText: normalizeObservedText(summaryLong),
      normalizedValueJson: { summary: summaryLong },
      evidenceText: "Business description provided by user",
      confidence: 0.93,
    });
  }

  if (primaryEmail) {
    pushObservation(out, base, {
      observationGroup: "contact",
      claimType: "primary_email",
      claimKey: `email_${safeKeyPart(primaryEmail, "email")}`,
      rawValueText: primaryEmail,
      rawValueJson: { email: primaryEmail },
      normalizedValueText: normalizeObservedEmail(primaryEmail),
      normalizedValueJson: { email: normalizeObservedEmail(primaryEmail) },
      evidenceText: "Email provided by user",
      confidence: 0.98,
    });
  }

  if (primaryPhone) {
    pushObservation(out, base, {
      observationGroup: "contact",
      claimType: "primary_phone",
      claimKey: `phone_${safeKeyPart(primaryPhone, "phone")}`,
      rawValueText: primaryPhone,
      rawValueJson: { phone: primaryPhone },
      normalizedValueText: normalizeObservedPhone(primaryPhone),
      normalizedValueJson: { phone: normalizeObservedPhone(primaryPhone) },
      evidenceText: "Phone number provided by user",
      confidence: 0.98,
    });
  }

  if (primaryAddress) {
    pushObservation(out, base, {
      observationGroup: "location",
      claimType: "primary_address",
      claimKey: `address_${safeKeyPart(primaryAddress, "address")}`,
      rawValueText: primaryAddress,
      rawValueJson: { address: primaryAddress },
      normalizedValueText: normalizeObservedText(primaryAddress),
      normalizedValueJson: { address: normalizeObservedText(primaryAddress) },
      evidenceText: "Address provided by user",
      confidence: 0.96,
    });
  }

  for (const item of intake.hours) {
    const normalized = normalizeObservedText(item);
    if (!normalized) continue;

    pushObservation(out, base, {
      observationGroup: "hours",
      claimType: "working_hours",
      claimKey: `hours_${safeKeyPart(normalized, "hours")}`,
      rawValueText: item,
      rawValueJson: { hours: item },
      normalizedValueText: normalized,
      normalizedValueJson: { hours: normalized },
      evidenceText: "Working hours provided by user",
      confidence: 0.96,
    });
  }

  for (const item of intake.services) {
    const normalized = normalizeObservedText(item);
    if (!normalized) continue;

    pushObservation(out, base, {
      observationGroup: "offerings",
      claimType: "service",
      claimKey: `service_${safeKeyPart(normalized, "service")}`,
      rawValueText: item,
      rawValueJson: { service: item },
      normalizedValueText: normalized,
      normalizedValueJson: { service: item },
      evidenceText: "Service provided by user",
      confidence: 0.97,
    });
  }

  for (const item of intake.products) {
    const normalized = normalizeObservedText(item);
    if (!normalized) continue;

    pushObservation(out, base, {
      observationGroup: "offerings",
      claimType: "product",
      claimKey: `product_${safeKeyPart(normalized, "product")}`,
      rawValueText: item,
      rawValueJson: { product: item },
      normalizedValueText: normalized,
      normalizedValueJson: { product: item },
      evidenceText: "Product or package provided by user",
      confidence: 0.95,
    });
  }

  for (const item of intake.pricingHints) {
    const normalized = normalizeObservedText(item);
    if (!normalized) continue;

    pushObservation(out, base, {
      observationGroup: "pricing",
      claimType: "pricing_hint",
      claimKey: `pricing_${safeKeyPart(normalized, "pricing")}`,
      rawValueText: item,
      rawValueJson: { text: item },
      normalizedValueText: normalized,
      normalizedValueJson: { text: item },
      evidenceText: "Pricing hint provided by user",
      confidence: 0.94,
    });
  }

  if (supportMode) {
    pushObservation(out, base, {
      observationGroup: "support",
      claimType: "support_mode",
      claimKey: "support_mode",
      rawValueText: supportMode,
      rawValueJson: { support_mode: supportMode },
      normalizedValueText: normalizeObservedText(supportMode),
      normalizedValueJson: { support_mode: supportMode },
      evidenceText: "Support/contact mode provided by user",
      confidence: 0.92,
    });
  }

  for (const item of intake.socialLinks) {
    const platform = s(item.platform);
    const url = normalizeObservedUrl(item.url);
    if (!platform || !url) continue;

    pushObservation(out, base, {
      observationGroup: "social",
      claimType: "social_link",
      claimKey: `${safeKeyPart(platform, "social")}_${safeKeyPart(url, "url")}`,
      rawValueText: url,
      rawValueJson: { platform, url },
      normalizedValueText: url,
      normalizedValueJson: { platform: lower(platform), url },
      evidenceText: `${platform} link provided by user`,
      confidence: 0.97,
    });
  }

  for (const urlRaw of intake.bookingLinks) {
    const url = normalizeObservedUrl(urlRaw);
    if (!url) continue;

    pushObservation(out, base, {
      observationGroup: "booking",
      claimType: "booking_link",
      claimKey: `booking_${safeKeyPart(url, "booking")}`,
      rawValueText: url,
      rawValueJson: { url },
      normalizedValueText: url,
      normalizedValueJson: { url },
      evidenceText: "Booking link provided by user",
      confidence: 0.97,
    });
  }

  for (const urlRaw of intake.whatsappLinks) {
    const url = normalizeObservedUrl(urlRaw);
    if (!url) continue;

    pushObservation(out, base, {
      observationGroup: "booking",
      claimType: "whatsapp_link",
      claimKey: `whatsapp_${safeKeyPart(url, "whatsapp")}`,
      rawValueText: url,
      rawValueJson: { url },
      normalizedValueText: url,
      normalizedValueJson: { url },
      evidenceText: "WhatsApp link provided by user",
      confidence: 0.98,
    });
  }

  for (const item of intake.faqItems) {
    const question = s(item.question);
    const answer = s(item.answer);
    if (!question) continue;

    pushObservation(out, base, {
      observationGroup: "faq",
      claimType: "faq",
      claimKey: `faq_${safeKeyPart(question, "faq")}`,
      rawValueText: answer ? `${question} — ${answer}` : question,
      rawValueJson: { question, answer },
      normalizedValueText: normalizeObservedText(question),
      normalizedValueJson: { question, answer },
      evidenceText: "FAQ provided by user",
      confidence: answer ? 0.94 : 0.88,
    });
  }

  return {
    intake,
    observations: dedupeObservationRows(out),
    warnings,
  };
}

export function normalizeSetupIntakeInput(input = {}) {
  const x = obj(input);

  return buildNormalizedManualIntake({
    manualText: x.manualText || x.manual_text || x.text || "",
    voiceTranscript:
      x.voiceTranscript || x.voice_transcript || x.transcript || "",
    answers: obj(x.answers || x.answerMap || x.answer_map),
    note: x.note || "",
  });
}