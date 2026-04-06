// src/services/workspace/intakeAnalyze.js
// FINAL v1.1 — unified setup analyze for source + manual + future voice
// upgrades:
// - source + manual + current review draft observations merge more safely
// - derive services / FAQ draft items from merged business profile, not only candidates
// - allow partial success for weak but usable analyze results
// - keep one review draft that later finalizes into canonical truth

import {
  failSetupReviewSession,
  getCurrentSetupReview,
  getOrCreateActiveSetupReviewSession,
  markSetupReviewSessionProcessing,
  markSetupReviewSessionReady,
  patchSetupReviewDraft,
  updateSetupReviewSession,
} from "../../db/helpers/tenantSetupReview.js";

import {
  buildCandidatesFromSynthesis,
  synthesizeTenantBusinessFromObservations,
} from "../sourceFusion/index.js";

import {
  buildManualObservations,
  normalizeSetupIntakeInput,
} from "../sourceFusion/manualObservations.js";

import {
  buildDraftKnowledgeFromCandidate,
  buildDraftPayloadFromResult,
  buildDraftServiceFromCandidate,
  calculateCompleteness,
  calculateConfidenceSummary,
  isServiceLikeCandidate,
  mergeDraftItems,
  sanitizeSetupBusinessProfile,
  sanitizeSetupReviewDraft,
} from "./import/draft.js";

import {
  arr,
  buildRequestId,
  compactObject,
  mergeDeep,
  nowIso,
  obj,
  s,
  uniqStrings,
} from "./import/shared.js";

import {
  confidenceLabel,
  normalizeConfidence,
  normalizeObservedEmail,
  normalizeObservedPhone,
  normalizeObservedText,
  normalizeObservedUrl,
} from "../sourceFusion/shared.js";

function lower(v, d = "") {
  return s(v, d).toLowerCase();
}

function isUuid(value = "") {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    s(value)
  );
}

function safeUuidOrNull(value = "") {
  const x = s(value);
  return isUuid(x) ? x : null;
}

function dedupeObservationRows(rows = []) {
  const seen = new Set();

  return arr(rows).filter((item) => {
    const key = [
      lower(item.claimType || item.claim_type),
      lower(item.claimKey || item.claim_key),
      lower(
        item.normalizedValueText ||
          item.normalized_value_text ||
          item.rawValueText ||
          item.raw_value_text
      ),
      lower(JSON.stringify(obj(item.normalizedValueJson || item.normalized_value_json))),
    ].join("|");

    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeConfidenceScore(value = 0, fallback = 0.82) {
  return normalizeConfidence(value, fallback);
}

function makeSyntheticObservationBase({
  sourceId = "",
  sourceRunId = "",
  sourceType = "",
  sourceUrl = "",
  pageTitle = "",
  metadataJson = {},
} = {}) {
  return {
    sourceId: s(sourceId),
    sourceRunId: s(sourceRunId),
    sourceType: s(sourceType || "manual"),
    sourceUrl: s(sourceUrl),
    pageTitle: s(pageTitle),
    metadataJson: obj(metadataJson),
  };
}

function pushSyntheticObservation(out = [], base = {}, payload = {}) {
  const rawValueText = s(payload.rawValueText);
  const rawValueJson = obj(payload.rawValueJson);

  if (!rawValueText && !Object.keys(rawValueJson).length) return;

  const confidence = normalizeConfidenceScore(payload.confidence, 0.82);

  out.push({
    sourceId: base.sourceId,
    sourceRunId: base.sourceRunId,
    sourceType: base.sourceType,
    observationGroup: s(payload.observationGroup || "review_draft"),
    claimType: s(payload.claimType),
    claimKey: s(payload.claimKey),
    rawValueText,
    rawValueJson,
    normalizedValueText: s(payload.normalizedValueText),
    normalizedValueJson: obj(payload.normalizedValueJson),
    evidenceText: s(payload.evidenceText || "Current setup review draft"),
    pageUrl: s(base.sourceUrl),
    pageTitle: s(base.pageTitle),
    confidence,
    confidenceLabel: confidenceLabel(confidence),
    resolutionStatus: "pending",
    extractionMethod: "setup_review_draft",
    extractionModel: "setup_review_draft_v1",
    metadataJson: {
      ...obj(base.metadataJson),
      ...obj(payload.metadataJson),
    },
    firstSeenAt: new Date().toISOString(),
    lastSeenAt: new Date().toISOString(),
  });
}

function extractSourceInfo({ session = {}, draft = {}, sources = [] } = {}) {
  const summary = obj(draft?.sourceSummary);
  const latestImport = obj(summary.latestImport);
  const latestAnalyze = obj(summary.latestAnalyze);
  const payload = obj(draft?.draftPayload);

  const primarySourceId =
    session?.primarySourceId ||
    summary.primarySourceId ||
    latestImport.sourceId ||
    null;

  const primarySourceType =
    s(session?.primarySourceType) ||
    s(summary?.primarySourceType) ||
    s(latestImport.sourceType) ||
    s(latestAnalyze.sourceType);

  const latestRunId = summary.latestRunId || latestImport.runId || null;

  const sourceUrl =
    s(summary.primarySourceUrl) ||
    s(latestImport.sourceUrl) ||
    s(latestAnalyze.sourceUrl) ||
    s(payload.sourceUrl);

  return {
    primarySourceId: safeUuidOrNull(primarySourceId),
    primarySourceType,
    latestRunId: safeUuidOrNull(latestRunId),
    sourceUrl,
    sources: arr(sources),
  };
}

function buildReviewDraftSourceObservations({ session = {}, draft = {}, sources = [] } = {}) {
  const safeDraft = sanitizeSetupReviewDraft(draft);
  const payloadProfile = sanitizeSetupBusinessProfile(obj(safeDraft?.draftPayload?.profile));
  const draftProfile = sanitizeSetupBusinessProfile(obj(safeDraft?.businessProfile));
  const profile = Object.keys(payloadProfile).length ? payloadProfile : draftProfile;

  const sourceInfo = extractSourceInfo({ session, draft, sources });
  const sourceType = s(sourceInfo.primarySourceType || "manual");
  const sourceUrl =
    s(sourceInfo.sourceUrl) ||
    s(profile.websiteUrl || profile.website || profile.googleMapsSeedUrl);

  const fieldConfidence = obj(profile.fieldConfidence);
  const scoreFor = (key, fallback = 0.82) =>
    normalizeConfidenceScore(
      fieldConfidence?.[key]?.score ?? fieldConfidence?.[key],
      fallback
    );

  const base = makeSyntheticObservationBase({
    sourceId: sourceInfo.primarySourceId || "",
    sourceRunId: sourceInfo.latestRunId || "",
    sourceType,
    sourceUrl,
    pageTitle: s(
      profile.companyTitle ||
        profile.displayName ||
        profile.companyName ||
        profile.name
    ),
    metadataJson: {
      origin: "current_setup_review_draft",
    },
  });

  const out = [];

  const companyName = s(
    profile.companyName ||
      profile.companyTitle ||
      profile.displayName ||
      profile.name
  );

  if (companyName) {
    pushSyntheticObservation(out, base, {
      observationGroup: "identity",
      claimType: "company_name",
      claimKey: "company_name",
      rawValueText: companyName,
      rawValueJson: { company_name: companyName },
      normalizedValueText: normalizeObservedText(companyName),
      normalizedValueJson: { company_name: companyName },
      evidenceText: "Current setup draft business name",
      confidence: scoreFor("companyName", 0.86),
    });
  }

  const websiteUrl = normalizeObservedUrl(
    profile.websiteUrl || profile.website || ""
  );
  if (websiteUrl) {
    pushSyntheticObservation(out, base, {
      observationGroup: "identity",
      claimType: "website_url",
      claimKey: "website_url",
      rawValueText: websiteUrl,
      rawValueJson: { url: websiteUrl },
      normalizedValueText: websiteUrl,
      normalizedValueJson: { url: websiteUrl },
      evidenceText: "Current setup draft website URL",
      confidence: scoreFor("websiteUrl", 0.84),
    });
  }

  const summaryShort = s(
    profile.summaryShort ||
      profile.shortDescription ||
      profile.companySummaryShort
  );

  if (summaryShort) {
    pushSyntheticObservation(out, base, {
      observationGroup: "summary",
      claimType: "summary_short",
      claimKey: "summary_short",
      rawValueText: summaryShort,
      rawValueJson: { summary: summaryShort },
      normalizedValueText: normalizeObservedText(summaryShort),
      normalizedValueJson: { summary: summaryShort },
      evidenceText: "Current setup draft short summary",
      confidence: scoreFor("summaryShort", 0.8),
    });
  }

  const summaryLong = s(
    profile.summaryLong ||
      profile.description ||
      profile.companySummaryLong
  );

  if (summaryLong) {
    pushSyntheticObservation(out, base, {
      observationGroup: "summary",
      claimType: "summary_long",
      claimKey: "summary_long",
      rawValueText: summaryLong,
      rawValueJson: { summary: summaryLong },
      normalizedValueText: normalizeObservedText(summaryLong),
      normalizedValueJson: { summary: summaryLong },
      evidenceText: "Current setup draft long summary",
      confidence: scoreFor("summaryLong", 0.78),
    });
  }

  const primaryEmail = normalizeObservedEmail(profile.primaryEmail || profile.email || "");
  if (primaryEmail && /@/.test(primaryEmail)) {
    pushSyntheticObservation(out, base, {
      observationGroup: "contact",
      claimType: "primary_email",
      claimKey: `email_${primaryEmail}`,
      rawValueText: primaryEmail,
      rawValueJson: { email: primaryEmail },
      normalizedValueText: primaryEmail,
      normalizedValueJson: { email: primaryEmail },
      evidenceText: "Current setup draft email",
      confidence: scoreFor("primaryEmail", 0.84),
    });
  }

  const primaryPhone = normalizeObservedPhone(profile.primaryPhone || profile.phone || "");
  if (primaryPhone) {
    pushSyntheticObservation(out, base, {
      observationGroup: "contact",
      claimType: "primary_phone",
      claimKey: `phone_${primaryPhone.replace(/[^\d]/g, "")}`,
      rawValueText: primaryPhone,
      rawValueJson: { phone: primaryPhone },
      normalizedValueText: primaryPhone,
      normalizedValueJson: { phone: primaryPhone },
      evidenceText: "Current setup draft phone",
      confidence: scoreFor("primaryPhone", 0.84),
    });
  }

  const primaryAddress = s(profile.primaryAddress || profile.address || "");
  if (primaryAddress) {
    pushSyntheticObservation(out, base, {
      observationGroup: "location",
      claimType: "primary_address",
      claimKey: `address_${normalizeObservedText(primaryAddress)}`,
      rawValueText: primaryAddress,
      rawValueJson: { address: primaryAddress },
      normalizedValueText: normalizeObservedText(primaryAddress),
      normalizedValueJson: { address: normalizeObservedText(primaryAddress) },
      evidenceText: "Current setup draft address",
      confidence: scoreFor("primaryAddress", 0.8),
    });
  }

  for (const item of arr(profile.hours)) {
    const normalized = normalizeObservedText(item);
    if (!normalized) continue;

    pushSyntheticObservation(out, base, {
      observationGroup: "hours",
      claimType: "working_hours",
      claimKey: `hours_${normalized}`,
      rawValueText: item,
      rawValueJson: { hours: item },
      normalizedValueText: normalized,
      normalizedValueJson: { hours: normalized },
      evidenceText: "Current setup draft working hours",
      confidence: 0.82,
    });
  }

  const serviceRows = uniqStrings([
    ...arr(profile.services),
    ...arr(draft?.services).map((item) => s(item?.title || item?.name || item?.label)),
  ]);

  for (const item of serviceRows) {
    const normalized = normalizeObservedText(item);
    if (!normalized) continue;

    pushSyntheticObservation(out, base, {
      observationGroup: "offerings",
      claimType: "service",
      claimKey: `service_${normalized}`,
      rawValueText: item,
      rawValueJson: { service: item },
      normalizedValueText: normalized,
      normalizedValueJson: { service: item },
      evidenceText: "Current setup draft service",
      confidence: 0.82,
    });
  }

  for (const item of arr(profile.products)) {
    const normalized = normalizeObservedText(item);
    if (!normalized) continue;

    pushSyntheticObservation(out, base, {
      observationGroup: "offerings",
      claimType: "product",
      claimKey: `product_${normalized}`,
      rawValueText: item,
      rawValueJson: { product: item },
      normalizedValueText: normalized,
      normalizedValueJson: { product: item },
      evidenceText: "Current setup draft product",
      confidence: 0.8,
    });
  }

  for (const item of arr(profile.pricingHints)) {
    const normalized = normalizeObservedText(item);
    if (!normalized) continue;

    pushSyntheticObservation(out, base, {
      observationGroup: "pricing",
      claimType: "pricing_hint",
      claimKey: `pricing_${normalized}`,
      rawValueText: item,
      rawValueJson: { text: item },
      normalizedValueText: normalized,
      normalizedValueJson: { text: item },
      evidenceText: "Current setup draft pricing hint",
      confidence: 0.78,
    });
  }

  const pricingPolicy = s(profile.pricingPolicy || profile.pricingText || "");
  if (pricingPolicy) {
    pushSyntheticObservation(out, base, {
      observationGroup: "pricing",
      claimType: "pricing_policy",
      claimKey: "pricing_policy",
      rawValueText: pricingPolicy,
      rawValueJson: { policy: pricingPolicy },
      normalizedValueText: normalizeObservedText(pricingPolicy),
      normalizedValueJson: { policy: pricingPolicy },
      evidenceText: "Current setup draft pricing policy",
      confidence: 0.78,
    });
  }

  const supportMode = s(profile.supportMode || "");
  if (supportMode) {
    pushSyntheticObservation(out, base, {
      observationGroup: "support",
      claimType: "support_mode",
      claimKey: "support_mode",
      rawValueText: supportMode,
      rawValueJson: { support_mode: supportMode },
      normalizedValueText: normalizeObservedText(supportMode),
      normalizedValueJson: { support_mode: supportMode },
      evidenceText: "Current setup draft support mode",
      confidence: 0.78,
    });
  }

  for (const item of arr(profile.socialLinks)) {
    const platform = s(item?.platform);
    const url = normalizeObservedUrl(item?.url);
    if (!platform || !url) continue;

    pushSyntheticObservation(out, base, {
      observationGroup: "social",
      claimType: "social_link",
      claimKey: `${lower(platform)}_${url}`,
      rawValueText: url,
      rawValueJson: { platform, url },
      normalizedValueText: url,
      normalizedValueJson: { platform: lower(platform), url },
      evidenceText: "Current setup draft social link",
      confidence: 0.82,
    });
  }

  for (const urlRaw of arr(profile.bookingLinks)) {
    const url = normalizeObservedUrl(urlRaw);
    if (!url) continue;

    pushSyntheticObservation(out, base, {
      observationGroup: "booking",
      claimType: "booking_link",
      claimKey: `booking_${url}`,
      rawValueText: url,
      rawValueJson: { url },
      normalizedValueText: url,
      normalizedValueJson: { url },
      evidenceText: "Current setup draft booking link",
      confidence: 0.82,
    });
  }

  for (const urlRaw of arr(profile.whatsappLinks)) {
    const url = normalizeObservedUrl(urlRaw);
    if (!url) continue;

    pushSyntheticObservation(out, base, {
      observationGroup: "booking",
      claimType: "whatsapp_link",
      claimKey: `whatsapp_${url}`,
      rawValueText: url,
      rawValueJson: { url },
      normalizedValueText: url,
      normalizedValueJson: { url },
      evidenceText: "Current setup draft WhatsApp link",
      confidence: 0.84,
    });
  }

  for (const item of arr(profile.faqItems)) {
    const question = s(item?.question);
    const answer = s(item?.answer);
    if (!question) continue;

    pushSyntheticObservation(out, base, {
      observationGroup: "faq",
      claimType: "faq",
      claimKey: `faq_${normalizeObservedText(question)}`,
      rawValueText: answer ? `${question} — ${answer}` : question,
      rawValueJson: { question, answer },
      normalizedValueText: normalizeObservedText(question),
      normalizedValueJson: { question, answer },
      evidenceText: "Current setup draft FAQ",
      confidence: 0.8,
    });
  }

  return dedupeObservationRows(out);
}

function buildAnalyzeSourceType({ session = {}, draft = {}, manualIntake = {} } = {}) {
  const sourceInfo = extractSourceInfo({ session, draft });
  if (s(sourceInfo.primarySourceType)) return s(sourceInfo.primarySourceType);
  if (manualIntake?.hasAnyInput) return "manual";
  return "manual";
}

function buildManualSourceLabel(sourceType = "") {
  if (sourceType === "manual") return "Manual";
  if (sourceType === "google_maps") return "Google Maps";
  if (sourceType === "website") return "Website";
  if (sourceType === "instagram") return "Instagram";
  return "Source";
}

function hasExistingReviewSignal(review = {}) {
  const draft = obj(review?.draft);
  const payload = obj(draft?.draftPayload);
  const profile = obj(payload.profile);

  return (
    !!s(review?.session?.id) ||
    !!s(review?.session?.primarySourceType) ||
    !!s(draft?.sourceSummary?.primarySourceType) ||
    Object.keys(obj(draft?.businessProfile)).length > 0 ||
    Object.keys(profile).length > 0 ||
    arr(draft?.services).length > 0 ||
    arr(draft?.knowledgeItems).length > 0
  );
}

function buildLatestAnalyzeBlock({
  requestId = "",
  sourceType = "",
  sourceUrl = "",
  manualInput = {},
  sourceObservationCount = 0,
  manualObservationCount = 0,
  totalObservationCount = 0,
  candidateCount = 0,
  warnings = [],
} = {}) {
  return {
    at: nowIso(),
    mode: "unified_intake_analyze",
    requestId: s(requestId),
    sourceType: s(sourceType),
    sourceUrl: s(sourceUrl),
    manualInputPresent: !!manualInput?.hasManualText,
    voiceInputPresent: !!manualInput?.hasVoiceTranscript,
    structuredAnswerCount: Number(manualInput?.answersCount || 0),
    sourceObservationCount: Number(sourceObservationCount || 0),
    manualObservationCount: Number(manualObservationCount || 0),
    totalObservationCount: Number(totalObservationCount || 0),
    candidateCount: Number(candidateCount || 0),
    warningCount: arr(warnings).length,
  };
}

function buildProfileDerivedServices(profile = {}, sourceType = "") {
  return arr(profile?.services)
    .map((title, index) => {
      const cleanTitle = s(title);
      if (!cleanTitle) return null;

      return {
        key: `derived_service_${sourceType || "manual"}_${index + 1}_${cleanTitle
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "_")
          .replace(/^_+|_+$/g, "") || "item"}`,
        title: cleanTitle,
        description: "",
        category: "service",
        sourceType: s(sourceType),
        origin: "setup_review_candidate",
        confidence: 0.45,
        confidenceLabel: "derived",
        status: "pending",
        reviewReason: "derived_from_merged_profile",
        evidence: [],
      };
    })
    .filter(Boolean);
}

function buildProfileDerivedKnowledge(profile = {}, sourceType = "") {
  return arr(profile?.faqItems)
    .map((item, index) => {
      const question = s(item?.question);
      const answer = s(item?.answer);
      if (!question) return null;

      return {
        key: `derived_knowledge_${sourceType || "manual"}_${index + 1}_${question
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "_")
          .replace(/^_+|_+$/g, "") || "item"}`,
        category: "faq",
        title: question,
        valueText: answer,
        valueJson: obj(item),
        normalizedText: answer,
        normalizedJson: obj(item),
        confidence: 0.45,
        confidenceLabel: "derived",
        status: "pending",
        reviewReason: "derived_from_merged_profile",
        sourceType: s(sourceType),
        evidence: [],
        origin: "setup_review_candidate",
      };
    })
    .filter(Boolean);
}

function buildAnalyzeWarnings({
  currentWarnings = [],
  manualWarnings = [],
  businessProfile = {},
  services = [],
  knowledgeItems = [],
} = {}) {
  const profile = obj(businessProfile);

  const warnings = [
    ...arr(currentWarnings),
    ...arr(manualWarnings),
  ];

  const hasIdentity = !!(
    s(profile.companyName) ||
    s(profile.displayName) ||
    s(profile.companySummaryShort) ||
    s(profile.companySummaryLong)
  );

  const hasContact = !!(
    s(profile.primaryPhone) ||
    s(profile.primaryEmail) ||
    s(profile.primaryAddress) ||
    arr(profile.socialLinks).length ||
    arr(profile.whatsappLinks).length ||
    arr(profile.bookingLinks).length
  );

  const hasServices =
    arr(services).length > 0 || arr(profile.services).length > 0;

  const hasKnowledge =
    arr(knowledgeItems).length > 0 || arr(profile.faqItems).length > 0;

  if (!hasIdentity) warnings.push("setup_identity_signals_weak");
  if (!hasContact) warnings.push("setup_contact_signals_weak");
  if (!hasServices) warnings.push("setup_service_signals_weak");
  if (!hasKnowledge) warnings.push("setup_knowledge_signals_weak");

  return uniqStrings(warnings);
}

function shouldMarkAnalyzePartial({ completeness = {}, warnings = [] } = {}) {
  if (Number(completeness?.score || 0) < 2) return true;

  return arr(warnings).some((item) =>
    [
      "setup_identity_signals_weak",
      "setup_contact_signals_weak",
      "setup_service_signals_weak",
    ].includes(s(item))
  );
}

function buildIntakeDraftPayload({
  currentDraft = {},
  session = {},
  sourceType = "",
  sourceUrl = "",
  requestId = "",
  synthesis = {},
  manualInput = {},
  warnings = [],
  candidateCount = 0,
  sourceObservationCount = 0,
  manualObservationCount = 0,
  totalObservationCount = 0,
  businessProfileOverride = null,
}) {
  const currentPayload = obj(currentDraft?.draftPayload);

  const result = {
    mode: "success",
    stage: "intake_analyze",
    warnings: arr(warnings),
    profile: obj(synthesis?.profile),
    signals: {
      intake: {
        manualInputPresent: !!manualInput?.hasManualText,
        voiceInputPresent: !!manualInput?.hasVoiceTranscript,
        structuredAnswerCount: Number(manualInput?.answersCount || 0),
        sourceObservationCount: Number(sourceObservationCount || 0),
        manualObservationCount: Number(manualObservationCount || 0),
        totalObservationCount: Number(totalObservationCount || 0),
        sourceTypes: uniqStrings([
          s(sourceType),
          ...arr(currentDraft?.sourceSummary?.sourceTypes),
          manualInput?.hasAnyInput ? "manual" : "",
        ]),
      },
      sourceFusion: obj(synthesis),
    },
    extracted: obj(currentPayload.extracted),
    snapshot: obj(currentPayload.snapshot),
    candidateCount: Number(candidateCount || 0),
  };

  const collector = {
    candidateCount: Number(candidateCount || 0),
    observationCount: Number(totalObservationCount || 0),
    snapshotCount: currentDraft?.lastSnapshotId ? 1 : 0,
    lastSnapshotId: currentDraft?.lastSnapshotId || null,
  };

  const draftPayloadFromAnalyze = buildDraftPayloadFromResult({
    session,
    result,
    requestId,
    sourceType,
    sourceUrl,
    intakeContext: {
      analyzeMode: "unified_intake_analyze",
      manualInputPresent: !!manualInput?.hasManualText,
      voiceInputPresent: !!manualInput?.hasVoiceTranscript,
      structuredAnswerCount: Number(manualInput?.answersCount || 0),
      sourceObservationCount: Number(sourceObservationCount || 0),
      manualObservationCount: Number(manualObservationCount || 0),
      totalObservationCount: Number(totalObservationCount || 0),
    },
    collector,
    businessProfileOverride,
  });

  const latestAnalyze = buildLatestAnalyzeBlock({
    requestId,
    sourceType,
    sourceUrl,
    manualInput,
    sourceObservationCount,
    manualObservationCount,
    totalObservationCount,
    candidateCount,
    warnings,
  });

  const nextPayload = mergeDeep(
    currentPayload,
    draftPayloadFromAnalyze,
    {
      sourceType,
      sourceLabel: buildManualSourceLabel(sourceType),
      sourceAuthorityClass:
        sourceType === "manual" ? "manual" : s(draftPayloadFromAnalyze.sourceAuthorityClass),
      latestAnalyze,
      intake: compactObject({
        note: s(manualInput.note),
        manualText: s(manualInput.manualText),
        voiceTranscript: s(manualInput.voiceTranscript),
        answers: obj(manualInput.answers),
        answersCount: Number(manualInput.answersCount || 0),
        hasManualText: !!manualInput.hasManualText,
        hasVoiceTranscript: !!manualInput.hasVoiceTranscript,
        hasStructuredAnswers: !!manualInput.hasStructuredAnswers,
      }),
      signals: mergeDeep(obj(currentPayload.signals), obj(draftPayloadFromAnalyze.signals), {
        intake: mergeDeep(
          obj(currentPayload.signals?.intake),
          obj(draftPayloadFromAnalyze.signals?.intake),
          { latestAnalyze }
        ),
      }),
      profile: mergeDeep(
        obj(currentPayload.profile),
        obj(draftPayloadFromAnalyze.profile)
      ),
      extracted: obj(currentPayload.extracted),
      snapshot: obj(currentPayload.snapshot),
      latestImport: obj(currentPayload.latestImport),
    }
  );

  if (sourceType === "manual") {
    nextPayload.sourceLabel = "Manual";
    nextPayload.sourceAuthorityClass = "manual";
  }

  return nextPayload;
}

function buildSourceSummaryPatch({
  currentDraft = {},
  sourceType = "",
  sourceUrl = "",
  requestId = "",
  manualInput = {},
  sourceObservationCount = 0,
  manualObservationCount = 0,
  totalObservationCount = 0,
  candidateCount = 0,
  warnings = [],
} = {}) {
  const currentSummary = obj(currentDraft?.sourceSummary);

  return mergeDeep(currentSummary, {
    primarySourceType:
      s(currentSummary.primarySourceType) || (sourceType === "manual" ? "manual" : sourceType),
    primarySourceUrl: s(currentSummary.primarySourceUrl) || s(sourceUrl),
    latestAnalyze: buildLatestAnalyzeBlock({
      requestId,
      sourceType,
      sourceUrl,
      manualInput,
      sourceObservationCount,
      manualObservationCount,
      totalObservationCount,
      candidateCount,
      warnings,
    }),
  });
}

function buildDiffFromCanonicalPatch({
  currentDraft = {},
  requestId = "",
  sourceType = "",
  sourceUrl = "",
  synthesis = {},
  manualInput = {},
} = {}) {
  return mergeDeep(obj(currentDraft?.diffFromCanonical), {
    pendingReview: true,
    lastDraftAt: nowIso(),
    latestRequestId: s(requestId),
    latestSourceType: s(sourceType),
    latestSourceUrl: s(sourceUrl),
    latestMode: "success",
    latestStage: "intake_analyze",
    manualInputPresent:
      !!manualInput?.hasManualText ||
      !!manualInput?.hasVoiceTranscript ||
      !!manualInput?.hasStructuredAnswers,
    reviewRequired: !!synthesis?.reviewRequired,
    reviewFlags: arr(synthesis?.reviewFlags),
    fieldConfidence: obj(synthesis?.fieldConfidence),
  });
}

function normalizeAnalyzeInput({ currentDraft = {}, body = {} } = {}) {
  const stored = normalizeSetupIntakeInput(obj(currentDraft?.draftPayload?.intake));
  const incoming = normalizeSetupIntakeInput(body);

  return {
    note: s(incoming.note || stored.note),
    manualText: s(incoming.manualText || stored.manualText),
    voiceTranscript: s(incoming.voiceTranscript || stored.voiceTranscript),
    answers: mergeDeep(obj(stored.answers), obj(incoming.answers)),
    answersCount:
      Number(incoming.answersCount || 0) > 0
        ? Number(incoming.answersCount || 0)
        : Number(stored.answersCount || 0),
    hasManualText: !!s(incoming.manualText || stored.manualText),
    hasVoiceTranscript: !!s(incoming.voiceTranscript || stored.voiceTranscript),
    hasStructuredAnswers:
      Object.keys(mergeDeep(obj(stored.answers), obj(incoming.answers))).length > 0,
    hasAnyInput:
      !!s(incoming.manualText || stored.manualText) ||
      !!s(incoming.voiceTranscript || stored.voiceTranscript) ||
      Object.keys(mergeDeep(obj(stored.answers), obj(incoming.answers))).length > 0,
  };
}

export async function runSetupIntakeAnalyze({
  db,
  actor = {},
  body = {},
} = {}) {
  const tenantId = s(actor?.tenantId);
  const tenantKey = s(actor?.tenantKey);
  const userId =
    safeUuidOrNull(actor?.user?.id) ||
    safeUuidOrNull(actor?.user?.userId) ||
    safeUuidOrNull(actor?.user?.user_id) ||
    null;

  if (!tenantId && !tenantKey) {
    throw new Error("tenant context is required");
  }

  let session = null;

  try {
    const initialReview = await getCurrentSetupReview(tenantId);
    const initialDraft = sanitizeSetupReviewDraft(obj(initialReview?.draft));

    const manualInput = normalizeAnalyzeInput({
      currentDraft: initialDraft,
      body,
    });

    if (!manualInput.hasAnyInput && !hasExistingReviewSignal(initialReview)) {
      throw new Error(
        "manual text, voice transcript, answers, or at least one imported source is required before analyze"
      );
    }

    const draftSourceType = buildAnalyzeSourceType({
      session: initialReview?.session,
      draft: initialReview?.draft,
      manualIntake: manualInput,
    });

    const sourceInfo = extractSourceInfo({
      session: initialReview?.session,
      draft: initialReview?.draft,
      sources: initialReview?.sources,
    });

    const requestId = buildRequestId({
      tenantId,
      tenantKey,
      sourceType: draftSourceType || "manual",
      url: sourceInfo.sourceUrl || "manual",
    });

    session = await getOrCreateActiveSetupReviewSession({
      tenantId,
      mode: "setup",
      primarySourceType:
        s(initialReview?.session?.primarySourceType) ||
        (draftSourceType === "manual" ? "manual" : draftSourceType),
      primarySourceId: sourceInfo.primarySourceId || null,
      startedBy: userId || null,
      currentStep: "intake_analyze",
      title:
        s(initialReview?.session?.title) ||
        (draftSourceType === "manual"
          ? "Manual business setup"
          : "Setup review"),
      notes: s(manualInput.note) || s(initialReview?.session?.notes),
      metadata: {
        lastAnalyzeRequestId: requestId,
        lastAnalyzeMode: "unified_intake_analyze",
        lastAnalyzeAt: nowIso(),
        lastManualInputPresent: !!manualInput.hasManualText,
        lastVoiceInputPresent: !!manualInput.hasVoiceTranscript,
        lastStructuredAnswerCount: Number(manualInput.answersCount || 0),
      },
      ensureDraft: true,
    });

    await markSetupReviewSessionProcessing(session.id, {
      currentStep: "intake_analyze",
      payload: {
        requestId,
        sourceType: draftSourceType,
      },
    });

    const currentReview = await getCurrentSetupReview(tenantId);
    const currentDraft = sanitizeSetupReviewDraft(obj(currentReview?.draft));

    const sourceObservations = buildReviewDraftSourceObservations({
      session: currentReview?.session || session,
      draft: sanitizeSetupReviewDraft(currentReview?.draft || currentDraft),
      sources: currentReview?.sources,
    });

    const manualResult = buildManualObservations({
      manualText: manualInput.manualText,
      voiceTranscript: manualInput.voiceTranscript,
      answers: manualInput.answers,
      note: manualInput.note,
      sourceId: sourceInfo.primarySourceId || "",
      sourceRunId: sourceInfo.latestRunId || "",
    });

    const manualObservations = arr(manualResult.observations);
    const manualWarnings = arr(manualResult.warnings);

    const allObservations = dedupeObservationRows([
      ...sourceObservations,
      ...manualObservations,
    ]);

    if (!allObservations.length) {
      throw new Error("no valid observations were produced for setup analyze");
    }

    const synthesis = synthesizeTenantBusinessFromObservations({
      observations: allObservations,
    });

    const sourceIdForCandidates = sourceInfo.primarySourceId || "";
    const sourceRunIdForCandidates = sourceInfo.latestRunId || "";

    const candidateRows = buildCandidatesFromSynthesis({
      tenantId,
      tenantKey,
      sourceId: sourceIdForCandidates,
      sourceRunId: sourceRunIdForCandidates,
      synthesis,
    });

    const derivedServices = arr(candidateRows)
      .filter((item) => isServiceLikeCandidate(item))
      .map((item) =>
        buildDraftServiceFromCandidate(item, draftSourceType || "manual")
      )
      .filter(Boolean);

    const derivedKnowledgeItems = arr(candidateRows)
      .filter((item) => !isServiceLikeCandidate(item))
      .map((item) =>
        buildDraftKnowledgeFromCandidate(item, draftSourceType || "manual")
      )
      .filter(Boolean);

    const nextDraftPayloadPreview = buildDraftPayloadFromResult({
      session: currentReview?.session || session,
      result: {
        mode: "success",
        stage: "intake_analyze",
        warnings: manualWarnings,
        profile: obj(synthesis?.profile),
        signals: {
          sourceFusion: obj(synthesis),
        },
      },
      requestId,
      sourceType: draftSourceType || "manual",
      sourceUrl: sourceInfo.sourceUrl || "",
      intakeContext: {
        analyzeMode: "unified_intake_analyze",
      },
      collector: {
        candidateCount: candidateRows.length,
        observationCount: allObservations.length,
        snapshotCount: currentDraft?.lastSnapshotId ? 1 : 0,
        lastSnapshotId: currentDraft?.lastSnapshotId || null,
      },
    });

    const nextBusinessProfile = sanitizeSetupBusinessProfile(
      mergeDeep(
        obj(currentDraft.businessProfile),
        obj(nextDraftPayloadPreview.profile)
      )
    );

    const profileDerivedServices = buildProfileDerivedServices(
      nextBusinessProfile,
      draftSourceType || "manual"
    );

    const profileDerivedKnowledge = buildProfileDerivedKnowledge(
      nextBusinessProfile,
      draftSourceType || "manual"
    );

    const nextCapabilities = mergeDeep(
      obj(currentDraft.capabilities),
      obj(synthesis.capabilities)
    );

    const nextServices = mergeDraftItems(
      arr(currentDraft.services),
      [...derivedServices, ...profileDerivedServices],
      ["key", "title"]
    );

    const nextKnowledgeItems = mergeDraftItems(
      arr(currentDraft.knowledgeItems),
      [...derivedKnowledgeItems, ...profileDerivedKnowledge],
      ["key", "title", "category"]
    );

    const warnings = buildAnalyzeWarnings({
      currentWarnings: currentDraft.warnings,
      manualWarnings,
      businessProfile: nextBusinessProfile,
      services: nextServices,
      knowledgeItems: nextKnowledgeItems,
    });

    const completeness = calculateCompleteness({
      businessProfile: nextBusinessProfile,
      services: nextServices,
      knowledgeItems: nextKnowledgeItems,
      warnings,
    });

    const partial = shouldMarkAnalyzePartial({
      completeness,
      warnings,
    });

    const nextDraftPayload = buildIntakeDraftPayload({
      currentDraft,
      session: currentReview?.session || session,
      sourceType: draftSourceType || "manual",
      sourceUrl: sourceInfo.sourceUrl || "",
      requestId,
      synthesis,
      manualInput,
      warnings,
      candidateCount: candidateRows.length,
      sourceObservationCount: sourceObservations.length,
      manualObservationCount: manualObservations.length,
      totalObservationCount: allObservations.length,
      businessProfileOverride: nextBusinessProfile,
    });

    const nextSourceSummary = buildSourceSummaryPatch({
      currentDraft,
      sourceType: draftSourceType || "manual",
      sourceUrl: sourceInfo.sourceUrl || "",
      requestId,
      manualInput,
      sourceObservationCount: sourceObservations.length,
      manualObservationCount: manualObservations.length,
      totalObservationCount: allObservations.length,
      candidateCount: candidateRows.length,
      warnings,
    });

    const nextDiffFromCanonical = buildDiffFromCanonicalPatch({
      currentDraft,
      requestId,
      sourceType: draftSourceType || "manual",
      sourceUrl: sourceInfo.sourceUrl || "",
      synthesis,
      manualInput,
    });

    const confidenceSummary = calculateConfidenceSummary({
      services: nextServices,
      knowledgeItems: nextKnowledgeItems,
    });

    const activeSessionId = s(currentReview?.session?.id || session.id);

    const draft = await patchSetupReviewDraft({
      sessionId: activeSessionId,
      tenantId,
      patch: {
        draftPayload: nextDraftPayload,
        businessProfile: nextBusinessProfile,
        capabilities: nextCapabilities,
        services: nextServices,
        knowledgeItems: nextKnowledgeItems,
        channels: arr(currentDraft.channels),
        sourceSummary: nextSourceSummary,
        warnings,
        completeness,
        confidenceSummary,
        diffFromCanonical: nextDiffFromCanonical,
        lastSnapshotId: currentDraft.lastSnapshotId || null,
      },
      bumpVersion: true,
    });

    await updateSetupReviewSession(activeSessionId, {
      metadata: mergeDeep(obj(currentReview?.session?.metadata), {
        lastAnalyzeRequestId: requestId,
        lastAnalyzeMode: "unified_intake_analyze",
        lastAnalyzeAt: nowIso(),
        lastSourceType: draftSourceType || "manual",
        lastSourceUrl: sourceInfo.sourceUrl || "",
        lastManualInputPresent: !!manualInput.hasManualText,
        lastVoiceInputPresent: !!manualInput.hasVoiceTranscript,
        lastStructuredAnswerCount: Number(manualInput.answersCount || 0),
        lastObservationCount: allObservations.length,
        lastCandidateCount: candidateRows.length,
        lastAnalyzePartial: partial,
      }),
      currentStep: "review",
      notes: s(manualInput.note) || s(currentReview?.session?.notes),
      primarySourceType:
        s(currentReview?.session?.primarySourceType) ||
        (draftSourceType === "manual" ? "manual" : draftSourceType),
      primarySourceId: sourceInfo.primarySourceId || null,
    });

    await markSetupReviewSessionReady(activeSessionId, {
      currentStep: "review",
      payload: {
        requestId,
        sourceType: draftSourceType || "manual",
        candidateCount: candidateRows.length,
        sourceObservationCount: sourceObservations.length,
        manualObservationCount: manualObservations.length,
        totalObservationCount: allObservations.length,
        partial,
      },
    });

    return {
      ok: true,
      mode: partial ? "partial" : "success",
      partial,
      stage: "intake_analyze",
      requestId,
      reviewSessionId: activeSessionId,
      reviewSessionStatus: "ready",
      sourceType: draftSourceType || "manual",
      sourceLabel: buildManualSourceLabel(draftSourceType || "manual"),
      sourceAuthorityClass:
        draftSourceType === "manual"
          ? "manual"
          : s(nextDraftPayload.sourceAuthorityClass),
      sourceUrl: s(sourceInfo.sourceUrl || ""),
      draft: sanitizeSetupReviewDraft(draft),
      profile: sanitizeSetupBusinessProfile(nextBusinessProfile),
      signals: mergeDeep(obj(nextDraftPayload.signals), {
        intake: {
          latestAnalyze: buildLatestAnalyzeBlock({
            requestId,
            sourceType: draftSourceType || "manual",
            sourceUrl: sourceInfo.sourceUrl || "",
            manualInput,
            sourceObservationCount: sourceObservations.length,
            manualObservationCount: manualObservations.length,
            totalObservationCount: allObservations.length,
            candidateCount: candidateRows.length,
            warnings,
          }),
        },
      }),
      snapshot: obj(nextDraftPayload.snapshot),
      extracted: obj(nextDraftPayload.extracted),
      warnings,
      shouldReview: true,
      debug: {
        requestId,
        sourceObservationCount: sourceObservations.length,
        manualObservationCount: manualObservations.length,
        totalObservationCount: allObservations.length,
        candidateCount: candidateRows.length,
        hasManualText: !!manualInput.hasManualText,
        hasVoiceTranscript: !!manualInput.hasVoiceTranscript,
        structuredAnswerCount: Number(manualInput.answersCount || 0),
        partial,
      },
    };
  } catch (error) {
    if (session?.id) {
      try {
        await failSetupReviewSession(session.id, error, {
          currentStep: "intake_analyze",
          payload: {
            message: error?.message || "setup analyze failed",
          },
        });
      } catch {
        // ignore secondary failure
      }
    }

    throw error;
  }
}

export const __test__ = {
  buildReviewDraftSourceObservations,
};