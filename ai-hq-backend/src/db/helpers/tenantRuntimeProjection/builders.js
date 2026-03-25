import {
  s,
  arr,
  num,
  compactText,
  uniqueBy,
} from "./shared.js";

export function buildReadiness({
  profile,
  contacts,
  locations,
  services,
  products,
  faq,
  policies,
  channels,
  knowledge,
  facts,
}) {
  let score = 0;

  if (s(profile?.companyName || profile?.company_name)) score += 0.18;
  if (s(profile?.summaryShort || profile?.summary_short) || s(profile?.summaryLong || profile?.summary_long)) score += 0.16;
  if (arr(services).length > 0) score += 0.18;
  if (arr(contacts).length > 0) score += 0.12;
  if (arr(channels).length > 0) score += 0.10;
  if (arr(faq).length > 0) score += 0.08;
  if (arr(policies).length > 0) score += 0.08;
  if (arr(locations).length > 0) score += 0.04;
  if (arr(products).length > 0) score += 0.03;
  if (arr(knowledge).length > 0) score += 0.02;
  if (arr(facts).length > 0) score += 0.01;

  const normalized = Math.max(0, Math.min(1, Number(score.toFixed(4))));

  let label = "not_ready";
  if (normalized >= 0.85) label = "strong";
  else if (normalized >= 0.65) label = "ready";
  else if (normalized >= 0.35) label = "partial";

  return { score: normalized, label };
}

export function buildConfidence({
  synthesis,
  profile,
  capabilities,
  services,
  contacts,
  faq,
  policies,
}) {
  const synthesisConfidence = num(synthesis?.confidence, 0);
  const profileConfidence = num(profile?.confidence, 0);
  const capabilityWeight = capabilities ? 0.08 : 0;
  const coverageWeight =
    (arr(services).length > 0 ? 0.10 : 0) +
    (arr(contacts).length > 0 ? 0.08 : 0) +
    (arr(faq).length > 0 ? 0.07 : 0) +
    (arr(policies).length > 0 ? 0.07 : 0);

  const value = Math.max(
    0,
    Math.min(
      1,
      Number(
        (
          synthesisConfidence * 0.45 +
          profileConfidence * 0.35 +
          capabilityWeight +
          coverageWeight
        ).toFixed(4)
      )
    )
  );

  let label = "low";
  if (value >= 0.85) label = "very_high";
  else if (value >= 0.65) label = "high";
  else if (value >= 0.35) label = "medium";

  return { score: value, label };
}

export function buildRetrievalCorpus({
  profile,
  services,
  products,
  faq,
  policies,
  knowledge,
  facts,
}) {
  const out = [];

  if (s(profile.summaryShort || profile.summaryLong)) {
    out.push({
      type: "profile_summary",
      key: "profile:summary",
      text: compactText(
        [profile.summaryShort, profile.summaryLong, profile.valueProposition]
          .filter(Boolean)
          .join(" ")
      ),
    });
  }

  for (const item of arr(services)) {
    out.push({
      type: "service",
      key: item.serviceKey,
      text: compactText(
        [item.title, item.description, arr(item.highlights).join(" ")]
          .filter(Boolean)
          .join(" ")
      ),
    });
  }

  for (const item of arr(products)) {
    out.push({
      type: "product",
      key: item.productKey,
      text: compactText(
        [item.title, item.description, arr(item.highlights).join(" ")]
          .filter(Boolean)
          .join(" ")
      ),
    });
  }

  for (const item of arr(faq)) {
    out.push({
      type: "faq",
      key: item.faqKey,
      text: compactText(`${item.question} ${item.answer}`),
    });
  }

  for (const item of arr(policies)) {
    out.push({
      type: "policy",
      key: item.policyKey,
      text: compactText(
        [item.title, item.summaryText, item.policyText].filter(Boolean).join(" ")
      ),
    });
  }

  for (const item of arr(knowledge)) {
    out.push({
      type: "knowledge",
      key: item.canonicalKey || item.itemKey,
      text: compactText(
        [item.title, item.valueText, item.normalizedText].filter(Boolean).join(" ")
      ),
    });
  }

  for (const item of arr(facts)) {
    out.push({
      type: "fact",
      key: item.factKey,
      text: compactText([item.title, item.valueText].filter(Boolean).join(" ")),
    });
  }

  return uniqueBy(
    out.filter((x) => s(x.text)),
    (x) => `${x.type}:${x.key}`
  );
}

export function buildRuntimeContextText({
  identity,
  profile,
  contacts,
  locations,
  services,
  products,
  faq,
  policies,
  knowledge,
  facts,
}) {
  const parts = [
    identity.displayName || identity.companyName,
    profile.summaryShort,
    profile.summaryLong,
    profile.valueProposition,
    profile.targetAudience,
    ...services.map((x) =>
      [x.title, x.description, arr(x.highlights).join(" ")].filter(Boolean).join(" — ")
    ),
    ...products.map((x) => [x.title, x.description].filter(Boolean).join(" — ")),
    ...faq.map((x) => `${x.question} ${x.answer}`),
    ...policies.map((x) =>
      [x.title, x.summaryText, x.policyText].filter(Boolean).join(" — ")
    ),
    ...contacts.map((x) => `${x.channel} ${x.label} ${x.value}`),
    ...locations.map((x) => `${x.title} ${x.city} ${x.addressLine}`),
    ...knowledge.map((x) =>
      [x.title, x.valueText, x.normalizedText].filter(Boolean).join(" — ")
    ),
    ...facts.map((x) => [x.title, x.valueText].filter(Boolean).join(" — ")),
  ];

  return compactText(parts.filter(Boolean).join("\n"), 24000);
}

export function buildInboxJson(capabilities, services, contacts, channelPolicies) {
  const dmPolicy =
    arr(channelPolicies).find((x) =>
      ["instagram", "messenger", "whatsapp"].includes(x.channel)
    ) || null;

  return {
    enabled:
      capabilities.supportsInstagramDm ||
      capabilities.supportsFacebookMessenger ||
      capabilities.supportsWhatsapp,
    replyStyle: capabilities.replyStyle,
    replyLength: capabilities.replyLength,
    pricingMode: capabilities.pricingMode,
    canCaptureLeads: capabilities.canCaptureLeads,
    handoffEnabled: capabilities.handoffEnabled,
    contactCaptureMode: dmPolicy?.contactCaptureMode || "inherit",
    escalationMode: dmPolicy?.escalationMode || "inherit",
    serviceCount: arr(services).length,
    contactCount: arr(contacts).length,
  };
}

export function buildCommentsJson(capabilities, faq, channelPolicies) {
  const commentsPolicy = arr(channelPolicies).find((x) => x.channel === "comments") || null;

  return {
    enabled: capabilities.supportsComments,
    aiReplyEnabled: commentsPolicy?.aiReplyEnabled ?? true,
    publicReplyMode: commentsPolicy?.publicReplyMode || "inherit",
    replyStyle: commentsPolicy?.replyStyle || capabilities.replyStyle,
    maxReplySentences: commentsPolicy?.maxReplySentences ?? 2,
    faqCount: arr(faq).length,
  };
}

export function buildContentJson(profile, capabilities, services, products, socialAccounts) {
  return {
    enabled: true,
    toneProfile: profile.toneProfile,
    replyStyle: capabilities.replyStyle,
    ctaStyle: capabilities.ctaStyle,
    targetAudience: profile.targetAudience,
    valueProposition: profile.valueProposition,
    serviceCount: arr(services).length,
    productCount: arr(products).length,
    activeSocialPlatforms: uniqueBy(arr(socialAccounts), (x) => x.platform).map(
      (x) => x.platform
    ),
  };
}

export function buildVoiceJson(capabilities, channels, contacts) {
  return {
    enabled:
      capabilities.supportsVoice ||
      arr(channels).some((x) => x.channelType === "voice"),
    supportsCalls:
      capabilities.supportsVoice ||
      arr(channels).some((x) => x.supportsCalls),
    canOfferCallback: capabilities.canOfferCallback,
    canOfferConsultation: capabilities.canOfferConsultation,
    primaryPhone:
      arr(contacts).find((x) => x.isPrimary && x.channel === "phone")?.value ||
      arr(contacts).find((x) => x.channel === "phone")?.value ||
      "",
  };
}

export function buildLeadCaptureJson(capabilities, channelPolicies, contacts) {
  const strongestPolicy =
    arr(channelPolicies).find((x) => x.contactCaptureMode !== "inherit") || null;

  return {
    enabled: capabilities.canCaptureLeads,
    canCapturePhone: capabilities.canCapturePhone,
    canCaptureEmail: capabilities.canCaptureEmail,
    contactCaptureMode: strongestPolicy?.contactCaptureMode || "inherit",
    availableContactChannels: uniqueBy(
      arr(contacts).filter((x) => x.enabled),
      (x) => `${x.channel}:${x.value}`
    ).map((x) => x.channel),
  };
}

export function buildHandoffJson(capabilities, channelPolicies) {
  const strongestPolicy =
    arr(channelPolicies).find((x) => x.escalationMode !== "inherit") || null;

  return {
    enabled: capabilities.handoffEnabled,
    autoOnHumanRequest: capabilities.autoHandoffOnHumanRequest,
    autoOnLowConfidence: capabilities.autoHandoffOnLowConfidence,
    escalationMode: strongestPolicy?.escalationMode || "inherit",
  };
}