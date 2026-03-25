import {
  arr,
  cleanInlineText,
  cleanSummaryText,
  compactText,
  dedupeSentences,
  dedupeTextList,
  lower,
  normalizeCompareText,
  obj,
  s,
  safeKeyPart,
  shouldKeepTextCandidate,
  uniq,
} from "./shared.js";

const EMAIL_RE = /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/gi;
const PHONE_RE = /(?:\+?\d[\d\s().-]{6,}\d)/gim;
const URL_RE =
  /\b((?:https?:\/\/)?(?:www\.)?[a-z0-9.-]+\.[a-z]{2,}(?:\/[^\s]*)?)\b/gi;
const PRICING_RE =
  /\b(price|pricing|from|starting|package|packages|plan|plans|tariff|tariffs|quote|consultation|\$|€|£|₼|\bazn\b|\busd\b|\beur\b)\b/i;
const ADDRESS_RE =
  /\b(address|location|office|branch|street|st\.?|avenue|ave\.?|road|rd\.?|floor|building|suite|baku|bak[ıi]|azerbaijan|azərbaycan|district|rayon|metro)\b/i;
const SERVICE_RE =
  /\b(service|services|product|products|package|packages|solution|solutions|automation|marketing|design|development|consulting|branding|seo|website|web|shop|store|beauty|spa|clinic|dental|academy|course|training|travel|tour|booking|repair|maintenance|delivery|catering|event|studio|agency)\b/i;

function extractEmails(text = "") {
  return uniq(
    [...s(text).matchAll(EMAIL_RE)]
      .map((m) => s(m?.[0]).toLowerCase())
      .filter(Boolean)
  );
}

function normalizePhone(raw = "") {
  const text = s(raw).replace(/[^\d+]/g, "");
  const digits = text.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 16) return "";
  if (/^(000|111|222|1234567)/.test(digits)) return "";
  return text.startsWith("+") ? `+${digits}` : digits;
}

function extractPhones(text = "") {
  return uniq(
    [...s(text).matchAll(PHONE_RE)]
      .map((m) => normalizePhone(m?.[0]))
      .filter(Boolean)
  );
}

function normalizeUrlCandidate(raw = "") {
  let url = s(raw).replace(/[),.;]+$/, "");
  if (!url) return "";
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }
  try {
    return new URL(url).toString();
  } catch {
    return "";
  }
}

function extractUrls(text = "") {
  return uniq(
    [...s(text).matchAll(URL_RE)]
      .map((m) => normalizeUrlCandidate(m?.[1] || m?.[0]))
      .filter(Boolean)
  );
}

function captionBusinessLines(text = "") {
  const cleaned = cleanInlineText(
    s(text)
      .replace(/#[\p{L}\p{N}_-]+/gu, " ")
      .replace(/@[\p{L}\p{N}._-]+/gu, " ")
      .replace(/\bhttps?:\/\/\S+/gi, " ")
  );

  const parts = cleaned
    .split(/\n+|[•▪▫●◦]+|(?<=[.!?])\s+/)
    .map((x) => compactText(cleanInlineText(x), 220))
    .filter(Boolean);

  return dedupeTextList(
    parts.filter((line) => {
      if (!shouldKeepTextCandidate(line, 12)) return false;
      if (/\b(follow|like|share|dm us|send dm|click link|link in bio)\b/i.test(line)) {
        return false;
      }
      return true;
    }),
    { maxItems: 16, maxText: 220 }
  );
}

function buildPageLocationText(page = {}) {
  const location = obj(page?.location);
  return compactText(
    [
      s(location?.street),
      s(location?.city),
      s(location?.state),
      s(location?.country),
      s(location?.zip),
    ]
      .filter(Boolean)
      .join(", "),
    220
  );
}

function extractPricingHints(texts = []) {
  return dedupeTextList(
    arr(texts)
      .flatMap((text) => captionBusinessLines(text))
      .filter((line) => PRICING_RE.test(s(line))),
    { maxItems: 8, maxText: 180 }
  );
}

function extractAddressHints(texts = [], page = {}) {
  return dedupeTextList(
    [
      buildPageLocationText(page),
      ...arr(texts).flatMap((text) =>
        captionBusinessLines(text).filter((line) => ADDRESS_RE.test(s(line)))
      ),
    ],
    { maxItems: 4, maxText: 220 }
  );
}

function recurringServiceThemes(texts = [], page = {}) {
  const counts = new Map();
  const categoryHints = [
    s(page?.category),
    ...arr(page?.categoryList).map((item) => s(item?.name)),
  ].filter(Boolean);

  for (const text of [...categoryHints, ...arr(texts)]) {
    for (const line of captionBusinessLines(text)) {
      const normalized = normalizeCompareText(line);
      if (!normalized) continue;
      if (!SERVICE_RE.test(line) && !PRICING_RE.test(line) && line.split(/\s+/).length > 8) {
        continue;
      }
      counts.set(normalized, {
        count: Number(counts.get(normalized)?.count || 0) + 1,
        text: line,
      });
    }
  }

  return dedupeTextList(
    [
      ...categoryHints,
      ...[...counts.values()]
        .sort((a, b) => b.count - a.count || a.text.length - b.text.length)
        .filter((item) => item.count >= 2 || SERVICE_RE.test(item.text))
        .map((item) => item.text),
    ],
    { maxItems: 16, maxText: 180 }
  );
}

function inferCompanyName(extracted = {}) {
  const account = obj(extracted?.account);
  const page = obj(extracted?.page);

  const candidates = [
    s(account?.name),
    s(page?.name),
    s(account?.username).replace(/^@+/, ""),
  ].filter(Boolean);

  return candidates[0] || "";
}

function buildInstagramSocialUrl(username = "") {
  const handle = s(username).replace(/^@+/, "");
  return handle ? `https://instagram.com/${handle}` : "";
}

function detectWhatsappLinks(urls = []) {
  return uniq(
    arr(urls).filter((url) => /wa\.me|whatsapp\.com/i.test(s(url)))
  );
}

function detectBookingLinks(urls = []) {
  return uniq(
    arr(urls).filter((url) =>
      /calendly|acuityscheduling|setmore|book|booking|schedule|appointment/i.test(s(url))
    )
  );
}

export function buildInstagramSignals(extracted = {}) {
  const account = obj(extracted?.account);
  const page = obj(extracted?.page);
  const media = arr(extracted?.media);
  const biography = cleanSummaryText(account?.biography || "", account?.name || account?.username);
  const pageAbout = cleanSummaryText(page?.about || "", page?.name || account?.username);
  const profileWebsite = normalizeUrlCandidate(account?.website || page?.website || "");
  const captions = media
    .map((item) => cleanSummaryText(item?.caption || "", account?.name || account?.username))
    .filter(Boolean);

  const mediaPermalinks = media.map((item) => s(item?.permalink)).filter(Boolean);
  const urlsFromBio = extractUrls(biography);
  const urlsFromPage = extractUrls(`${pageAbout}\n${s(page?.website)}\n${s(page?.link)}`);
  const urlsFromCaptions = captions.flatMap((text) => extractUrls(text));
  const allUrls = uniq(
    [profileWebsite, ...urlsFromBio, ...urlsFromPage, ...urlsFromCaptions].filter(Boolean)
  );

  const emails = uniq([
    ...extractEmails(biography),
    ...extractEmails(pageAbout),
    ...arr(page?.emails).map((item) => s(item).toLowerCase()),
    ...captions.flatMap((text) => extractEmails(text)),
  ]);

  const phones = uniq([
    ...extractPhones(biography),
    ...extractPhones(pageAbout),
    normalizePhone(page?.phone || ""),
    ...captions.flatMap((text) => extractPhones(text)),
  ]);

  const categoryHints = [
    s(page?.category),
    ...arr(page?.categoryList).map((item) => s(item?.name)),
  ].filter(Boolean);
  const serviceHints = recurringServiceThemes(
    [biography, pageAbout, ...captions.slice(0, 10)],
    page
  );

  const summaryCandidates = dedupeTextList(
    [biography, pageAbout, ...captions.slice(0, 6)],
    { maxItems: 8, maxText: 320 }
  );
  const pricingHints = extractPricingHints([biography, pageAbout, ...captions.slice(0, 8)]);
  const addresses = extractAddressHints([biography, pageAbout, ...captions.slice(0, 8)], page);

  const username = s(account?.username).replace(/^@+/, "");
  const instagramUrl = buildInstagramSocialUrl(username);

  return {
    provider: s(extracted?.provider || "meta_graph"),
    sourceUrl: s(extracted?.sourceUrl),
    finalUrl: s(extracted?.finalUrl || instagramUrl || extracted?.sourceUrl),
    page,
    account: {
      id: s(account?.id),
      username,
      name: s(account?.name),
      biography,
      website: profileWebsite,
      profilePictureUrl: s(account?.profilePictureUrl),
      followersCount: Number(account?.followersCount || 0),
      followsCount: Number(account?.followsCount || 0),
      mediaCount: Number(account?.mediaCount || media.length || 0),
    },
    emails,
    phones,
    urls: allUrls,
    socialLinks: instagramUrl
      ? [{ platform: "instagram", url: instagramUrl }]
      : [],
    whatsappLinks: detectWhatsappLinks(allUrls),
    bookingLinks: detectBookingLinks(allUrls),
    summaryCandidates,
    serviceHints,
    categoryHints,
    pricingHints,
    addresses,
    captions: captions.slice(0, 10),
    media: media.map((item) => ({
      id: s(item?.id),
      caption: cleanInlineText(item?.caption || ""),
      mediaType: s(item?.mediaType),
      permalink: s(item?.permalink),
      mediaUrl: s(item?.mediaUrl),
      thumbnailUrl: s(item?.thumbnailUrl),
      timestamp: s(item?.timestamp),
    })),
    mediaPermalinks,
  };
}

export function synthesizeInstagramBusinessProfile(signals = {}) {
  const account = obj(signals?.account);
  const page = obj(signals?.page);
  const companyName = inferCompanyName({
    account,
    page,
  });

  const summaryShort =
    s(signals?.summaryCandidates?.[0]) ||
    s(account?.biography) ||
    "";

  const summaryLong = dedupeSentences(
    [s(account?.biography), ...arr(signals?.summaryCandidates).slice(0, 4)].join(". "),
    1400
  );

  return {
    companyName,
    displayName: companyName,
    companyTitle: companyName,
    summaryShort: compactText(summaryShort, 240),
    summaryLong: compactText(summaryLong, 1400),
    aboutSection: compactText(
      [s(account?.biography), s(page?.about)].filter(Boolean).join(". "),
      1400
    ),
    websiteUrl: s(account?.website || page?.website || arr(signals?.urls)[0]),
    primaryPhone: s(arr(signals?.phones)[0]),
    primaryEmail: s(arr(signals?.emails)[0]),
    primaryAddress: s(arr(signals?.addresses)[0]),
    mainLanguage: "",
    supportedLanguages: [],
    services: dedupeTextList(arr(signals?.serviceHints), {
      maxItems: 12,
      maxText: 160,
    }),
    products: dedupeTextList(arr(signals?.categoryHints), {
      maxItems: 6,
      maxText: 120,
    }),
    pricingHints: dedupeTextList(arr(signals?.pricingHints), {
      maxItems: 6,
      maxText: 180,
    }),
    pricingPolicy: "",
    supportMode: "instagram_dm",
    hours: [],
    emails: uniq(arr(signals?.emails).map((x) => s(x)).filter(Boolean)),
    phones: uniq(arr(signals?.phones).map((x) => s(x)).filter(Boolean)),
    addresses: uniq(arr(signals?.addresses).map((x) => s(x)).filter(Boolean)),
    socialLinks: arr(signals?.socialLinks),
    bookingLinks: uniq(arr(signals?.bookingLinks).map((x) => s(x)).filter(Boolean)),
    whatsappLinks: uniq(arr(signals?.whatsappLinks).map((x) => s(x)).filter(Boolean)),
    faqItems: [],
    policyHighlights: [],
    profilePictureUrl: s(account?.profilePictureUrl),
    followersCount: Number(account?.followersCount || 0),
    followsCount: Number(account?.followsCount || 0),
    mediaCount: Number(account?.mediaCount || 0),
    instagramUsername: s(account?.username),
    instagramUrl:
      s(arr(signals?.socialLinks)[0]?.url) || buildInstagramSocialUrl(account?.username),
  };
}

export function isWeakInstagramExtraction({
  extracted = {},
  profile = {},
  signals = {},
} = {}) {
  const score =
    (s(obj(extracted?.account)?.username) ? 2 : 0) +
    (s(profile?.companyName) ? 2 : 0) +
    (s(profile?.summaryShort || profile?.summaryLong) ? 4 : 0) +
    (s(profile?.websiteUrl) ? 3 : 0) +
    (arr(profile?.emails).length ? 3 : 0) +
    (arr(profile?.phones).length ? 3 : 0) +
    (arr(profile?.addresses).length ? 2 : 0) +
    Math.min(arr(signals?.serviceHints).length, 4) +
    Math.min(arr(signals?.pricingHints).length, 2) +
    Math.min(arr(extracted?.media).length, 3);

  return score < 6;
}

export function buildInstagramExtractionWarnings({
  extracted = {},
  signals = {},
  profile = {},
} = {}) {
  const out = [];

  if (!s(obj(extracted?.account)?.username)) out.push("missing_instagram_username");
  if (!s(profile?.companyName)) out.push("missing_company_name");
  if (!s(profile?.summaryShort) && !s(profile?.summaryLong)) {
    out.push("missing_profile_summary");
  }
  if (!s(profile?.websiteUrl)) out.push("missing_profile_website");
  if (!arr(signals?.emails).length) out.push("missing_contact_email");
  if (!arr(signals?.phones).length) out.push("missing_contact_phone");
  if (!arr(profile?.addresses).length) out.push("missing_location_signal");
  if (!arr(extracted?.media).length) out.push("missing_recent_media");
  if (!arr(signals?.serviceHints).length) out.push("missing_service_hints");
  if (!arr(signals?.pricingHints).length) out.push("missing_pricing_hints");

  return uniq(out);
}

export function buildInstagramObservations({
  source,
  run,
  extracted = {},
  profile = {},
} = {}) {
  const sourceId = s(source?.id);
  const sourceRunId = s(run?.id);
  const sourceType = "instagram";
  const account = obj(extracted?.account);
  const page = obj(extracted?.page);
  const media = arr(extracted?.media);

  const signals = buildInstagramSignals(extracted);

  const out = [];

  function pushObservation({
    observationGroup = "general",
    claimType = "",
    claimKey = "",
    rawValueText = "",
    rawValueJson = {},
    normalizedValueText = "",
    normalizedValueJson = {},
    evidenceText = "",
    pageUrl = "",
    pageTitle = "",
    confidence = 0.5,
    confidenceLabel = "medium",
    metadataJson = {},
  } = {}) {
    const text = s(normalizedValueText || rawValueText);
    const json = obj(normalizedValueJson || rawValueJson);

    if (!claimType && !claimKey && !text && !Object.keys(json).length) return;

    out.push({
      sourceId,
      sourceRunId,
      sourceType,
      observationGroup,
      claimType,
      claimKey: s(claimKey || safeKeyPart(`${claimType}_${text || JSON.stringify(json)}`)),
      rawValueText: s(rawValueText || text),
      rawValueJson: obj(rawValueJson),
      normalizedValueText: text,
      normalizedValueJson: json,
      evidenceText: compactText(evidenceText || text, 400),
      pageUrl: s(pageUrl || extracted?.finalUrl),
      pageTitle: s(pageTitle || `Instagram @${account?.username || ""}`),
      confidence,
      confidenceLabel,
      resolutionStatus: "pending",
      extractionMethod: "meta_graph",
      extractionModel: "",
      metadataJson: {
        provider: "meta_graph",
        ...obj(metadataJson),
      },
      firstSeenAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
    });
  }

  if (s(profile?.companyName)) {
    pushObservation({
      observationGroup: "company",
      claimType: "company_name",
      claimKey: "company_name",
      rawValueText: s(profile.companyName),
      normalizedValueText: s(profile.companyName),
      confidence: 0.92,
      confidenceLabel: "high",
      metadataJson: {
        sourceField: account?.name ? "account.name" : "account.username",
      },
    });
  }

  if (s(account?.username)) {
    pushObservation({
      observationGroup: "social",
      claimType: "instagram_username",
      claimKey: "instagram_username",
      rawValueText: s(account.username),
      normalizedValueText: s(account.username),
      confidence: 0.98,
      confidenceLabel: "very_high",
    });

    pushObservation({
      observationGroup: "social",
      claimType: "social_link",
      claimKey: "instagram_profile",
      rawValueText: s(profile?.instagramUrl),
      normalizedValueText: s(profile?.instagramUrl),
      normalizedValueJson: {
        platform: "instagram",
        url: s(profile?.instagramUrl),
      },
      confidence: 0.98,
      confidenceLabel: "very_high",
    });
  }

  if (s(account?.biography)) {
    pushObservation({
      observationGroup: "summary",
      claimType: "summary_short",
      claimKey: "instagram_bio_summary",
      rawValueText: s(account.biography),
      normalizedValueText: s(profile?.summaryShort || account.biography),
      evidenceText: s(account.biography),
      confidence: 0.78,
      confidenceLabel: "high",
    });

    pushObservation({
      observationGroup: "summary",
      claimType: "about_section",
      claimKey: "instagram_bio",
      rawValueText: s(account.biography),
      normalizedValueText: s(account.biography),
      confidence: 0.8,
      confidenceLabel: "high",
    });
  }

  if (s(profile?.websiteUrl)) {
    pushObservation({
      observationGroup: "contact",
      claimType: "website_url",
      claimKey: "website_url",
      rawValueText: s(profile.websiteUrl),
      normalizedValueText: s(profile.websiteUrl),
      confidence: 0.9,
      confidenceLabel: "high",
    });
  }

  for (const address of arr(profile?.addresses).slice(0, 3)) {
    pushObservation({
      observationGroup: "location",
      claimType: "primary_address",
      claimKey: `address_${safeKeyPart(address, "address")}`,
      rawValueText: s(address),
      normalizedValueText: s(address),
      normalizedValueJson: {
        address: s(address),
      },
      confidence: 0.72,
      confidenceLabel: "medium",
      evidenceText: s(page?.about || account?.biography),
    });
  }

  for (const email of arr(profile?.emails).slice(0, 4)) {
    pushObservation({
      observationGroup: "contact",
      claimType: "primary_email",
      claimKey: `email_${safeKeyPart(email)}`,
      rawValueText: s(email),
      normalizedValueText: s(email).toLowerCase(),
      confidence: 0.84,
      confidenceLabel: "high",
      evidenceText: s(account?.biography),
    });
  }

  for (const phone of arr(profile?.phones).slice(0, 4)) {
    pushObservation({
      observationGroup: "contact",
      claimType: "primary_phone",
      claimKey: `phone_${safeKeyPart(phone)}`,
      rawValueText: s(phone),
      normalizedValueText: s(phone),
      confidence: 0.82,
      confidenceLabel: "high",
      evidenceText: s(account?.biography),
    });
  }

  for (const item of arr(profile?.services).slice(0, 12)) {
    pushObservation({
      observationGroup: "service",
      claimType: "service",
      claimKey: `service_${safeKeyPart(item)}`,
      rawValueText: s(item),
      normalizedValueText: s(item),
      confidence: 0.62,
      confidenceLabel: "medium",
    });
  }

  for (const item of arr(profile?.pricingHints).slice(0, 6)) {
    pushObservation({
      observationGroup: "pricing",
      claimType: "pricing_hint",
      claimKey: `pricing_${safeKeyPart(item)}`,
      rawValueText: s(item),
      normalizedValueText: s(item),
      normalizedValueJson: {
        text: s(item),
      },
      confidence: 0.58,
      confidenceLabel: "medium",
    });
  }

  if (Number(account?.followersCount || 0) > 0) {
    pushObservation({
      observationGroup: "social",
      claimType: "followers_count",
      claimKey: "followers_count",
      rawValueText: String(Number(account.followersCount || 0)),
      normalizedValueJson: {
        followersCount: Number(account.followersCount || 0),
      },
      confidence: 0.96,
      confidenceLabel: "very_high",
    });
  }

  for (const item of media.slice(0, 6)) {
    const caption = cleanSummaryText(item?.caption || "", profile?.companyName || account?.username);
    if (!caption) continue;

    pushObservation({
      observationGroup: "content",
      claimType: "recent_post_caption",
      claimKey: `post_${safeKeyPart(item?.id || caption)}`,
      rawValueText: caption,
      normalizedValueText: caption,
      evidenceText: caption,
      pageUrl: s(item?.permalink || extracted?.finalUrl),
      pageTitle: s(`Instagram post @${account?.username || ""}`),
      confidence: 0.56,
      confidenceLabel: "medium",
      metadataJson: {
        mediaId: s(item?.id),
        mediaType: s(item?.mediaType),
        timestamp: s(item?.timestamp),
      },
    });
  }

  return out;
}

export function buildInstagramSyncQualitySummary({
  extracted = {},
  signals = {},
  profile = {},
  observationCount = 0,
} = {}) {
  const account = obj(extracted?.account);

  const signalCount =
    (s(profile?.companyName) ? 1 : 0) +
    (s(profile?.summaryShort || profile?.summaryLong) ? 1 : 0) +
    Math.min(arr(profile?.emails).length, 2) +
    Math.min(arr(profile?.phones).length, 2) +
    Math.min(arr(profile?.services).length, 6) +
    Math.min(arr(extracted?.media).length, 4);

  return {
    provider: "meta_graph",
    sourceType: "instagram",
    username: s(account?.username),
    finalUrl: s(extracted?.finalUrl),
    mediaCount: Number(account?.mediaCount || arr(extracted?.media).length || 0),
    followersCount: Number(account?.followersCount || 0),
    followsCount: Number(account?.followsCount || 0),
    hasBiography: !!s(account?.biography),
    hasWebsite: !!s(profile?.websiteUrl),
    contactEmailCount: arr(profile?.emails).length,
    contactPhoneCount: arr(profile?.phones).length,
    addressCount: arr(profile?.addresses).length,
    serviceHintCount: arr(profile?.services).length,
    pricingHintCount: arr(profile?.pricingHints).length,
    observationCount: Number(observationCount || 0),
    signalCount,
    profilePicturePresent: !!s(account?.profilePictureUrl),
  };
}
