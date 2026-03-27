import {
  arr,
  obj,
  s,
  evidenceList,
  candidateTitle,
  candidateCategory,
  candidateValue,
  candidateSource,
  candidateConfidence,
} from "../lib/setupStudioHelpers.js";
import {
  extractReviewMetadata,
  normalizeReviewState,
  sourceIdentityKey,
  firstNonEmpty,
} from "./shared.js";
import { safeDraftKey } from "./profile.js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function maybeUuid(value = "") {
  const x = s(value);
  return UUID_RE.test(x) ? x : "";
}

function metadataObject(item = {}) {
  const x = obj(item);
  return obj(x.metadataJson || x.metadata_json || x.metadata);
}

function pickKnowledgeCandidateUuid(item = {}) {
  const x = obj(item);
  const meta = metadataObject(x);
  const candidate = obj(x.candidate);

  return (
    maybeUuid(x.candidateId) ||
    maybeUuid(x.candidate_id) ||
    maybeUuid(x.knowledgeCandidateId) ||
    maybeUuid(x.knowledge_candidate_id) ||
    maybeUuid(x.reviewCandidateId) ||
    maybeUuid(x.review_candidate_id) ||
    maybeUuid(x.candidateUuid) ||
    maybeUuid(x.candidate_uuid) ||
    maybeUuid(x.uuid) ||
    maybeUuid(x.itemUuid) ||
    maybeUuid(x.item_uuid) ||
    maybeUuid(meta.candidateId) ||
    maybeUuid(meta.candidate_id) ||
    maybeUuid(meta.knowledgeCandidateId) ||
    maybeUuid(meta.knowledge_candidate_id) ||
    maybeUuid(meta.reviewCandidateId) ||
    maybeUuid(meta.review_candidate_id) ||
    maybeUuid(meta.candidateUuid) ||
    maybeUuid(meta.candidate_uuid) ||
    maybeUuid(meta.uuid) ||
    maybeUuid(candidate.id) ||
    maybeUuid(candidate.candidateId) ||
    maybeUuid(candidate.candidate_id) ||
    maybeUuid(x.id)
  );
}

function pickKnowledgeRowId(item = {}, fallbackPrefix = "knowledge") {
  const x = obj(item);

  return s(
    x.rowId ||
      x.row_id ||
      x.id ||
      x.key ||
      x.itemKey ||
      x.item_key ||
      x.title ||
      x.label ||
      `${fallbackPrefix}-${Math.random().toString(36).slice(2, 10)}`
  );
}

export function normalizeDraftServiceItem(item = {}) {
  const x = obj(item);

  return {
    id: s(x.id || x.key || x.title),
    key: s(x.key),
    title: s(x.title || x.name || x.label),
    valueText: s(x.description || x.valueText || x.value_text),
    description: s(x.description || x.valueText || x.value_text),
    category: s(x.category || "service"),
    sourceType: s(x.sourceType || x.source_type),
    status: s(x.status || "pending"),
    confidence:
      typeof x.confidence === "number"
        ? x.confidence
        : Number(x.confidence || 0) || 0,
    confidenceLabel: s(x.confidenceLabel || x.confidence_label),
    evidence: arr(x.evidence),
    metadataJson: obj(x.metadataJson || x.metadata_json),
    origin: s(x.origin || "setup_review_session"),
  };
}

export function normalizeDraftKnowledgeItem(item = {}) {
  const x = obj(item);
  const rowId = pickKnowledgeRowId(x, "draft-knowledge");
  const candidateId = pickKnowledgeCandidateUuid(x);

  return {
    id: rowId,
    rowId,
    candidateId,
    candidateUuid: candidateId,
    key: s(x.key || x.itemKey || x.item_key),
    title: s(x.title || x.label || x.key),
    valueText: s(
      x.valueText ||
        x.value_text ||
        x.normalizedText ||
        x.normalized_text ||
        x.description
    ),
    category: s(x.category || "general"),
    sourceType: s(x.sourceType || x.source_type),
    status: s(x.status || "pending"),
    confidence:
      typeof x.confidence === "number"
        ? x.confidence
        : Number(x.confidence || 0) || 0,
    confidenceLabel: s(x.confidenceLabel || x.confidence_label),
    evidence: arr(x.evidence),
    sourceEvidenceJson: arr(
      x.sourceEvidenceJson || x.source_evidence_json || x.evidence
    ),
    metadataJson: obj(x.metadataJson || x.metadata_json),
    origin: s(x.origin || "setup_review_session"),
  };
}

export function normalizeVisibleKnowledgeItem(item = {}) {
  const x = obj(item);
  const fallbackEvidence = arr(
    x.evidence || x.sourceEvidenceJson || x.source_evidence_json
  );
  const helperEvidence = arr(evidenceList(x));
  const allEvidence = fallbackEvidence.length ? fallbackEvidence : helperEvidence;
  const rowId = pickKnowledgeRowId(x, "visible-knowledge");
  const candidateId = pickKnowledgeCandidateUuid(x);

  return {
    id: rowId,
    rowId,
    candidateId,
    candidateUuid: candidateId,
    key: s(x.key || x.itemKey || x.item_key),
    title: s(x.title || x.label || candidateTitle(x)),
    valueText: s(
      x.valueText ||
        x.value_text ||
        x.normalizedText ||
        x.normalized_text ||
        x.description ||
        candidateValue(x)
    ),
    category: s(x.category || candidateCategory(x) || "general"),
    sourceType: s(x.sourceType || x.source_type),
    source: s(x.source || candidateSource(x) || x.sourceType || x.source_type),
    status: s(x.status || "pending"),
    confidence:
      typeof x.confidence === "number"
        ? x.confidence
        : Number(x.confidence || candidateConfidence(x) || 0) || 0,
    confidenceLabel: s(x.confidenceLabel || x.confidence_label),
    evidence: allEvidence,
    evidenceUrl: s(
      allEvidence[0]?.url ||
        allEvidence[0]?.source_url ||
        allEvidence[0]?.link ||
        allEvidence[0]?.pageUrl
    ),
    metadataJson: obj(x.metadataJson || x.metadata_json),
    origin: s(x.origin || "setup_review_session"),
  };
}

export function normalizeVisibleServiceItem(item = {}) {
  const x = obj(item);

  return {
    id: s(x.id || x.serviceId || x.key || x.title || x.name),
    key: s(x.key) || safeDraftKey(s(x.title || x.name || x.label), "service"),
    title: s(x.title || x.name || x.label),
    valueText: s(x.valueText || x.description || x.summary || x.notes),
    description: s(x.description || x.valueText || x.summary || x.notes),
    category: s(x.category || "service"),
    sourceType: s(x.sourceType || x.source_type),
    status: s(x.status || "pending"),
    confidence:
      typeof x.confidence === "number"
        ? x.confidence
        : Number(x.confidence || 0) || 0,
    confidenceLabel: s(x.confidenceLabel || x.confidence_label),
    evidence: arr(x.evidence),
    metadataJson: obj(x.metadataJson || x.metadata_json),
    origin: s(x.origin || "setup_review_session"),
  };
}

export function normalizeVisibleSourceItem(item = {}) {
  const x = obj(item);
  const role = s(x.role || x.sourceRole || x.source_role);
  const isPrimary =
    typeof x.isPrimary === "boolean"
      ? x.isPrimary
      : typeof x.primary === "boolean"
        ? x.primary
        : role.toLowerCase() === "primary";

  return {
    id: s(
      x.id || x.sourceId || x.source_id || x.key || x.url || x.sourceUrl
    ),
    sourceType: s(x.sourceType || x.source_type || x.type),
    label: s(
      x.label ||
        x.title ||
        x.name ||
        x.sourceLabel ||
        x.source_label ||
        x.sourceType ||
        x.source_type
    ),
    url: s(x.url || x.sourceUrl || x.source_url),
    status: s(x.status),
    runId: s(x.runId || x.run_id),
    snapshotId: s(x.snapshotId || x.snapshot_id),
    role,
    isPrimary,
    isSupporting: !isPrimary && role.toLowerCase() === "supporting",
    metadataJson: obj(x.metadataJson || x.metadata_json || x.metadata),
  };
}

export function normalizeVisibleEventItem(item = {}) {
  const x = obj(item);

  return {
    id: s(x.id || x.eventId || x.event_id || x.createdAt || x.type),
    type: s(x.type),
    title: s(x.title || x.name || x.type),
    message: s(x.message || x.description || x.summary),
    status: s(x.status),
    createdAt: s(x.createdAt || x.created_at),
    metadataJson: obj(x.metadataJson || x.metadata_json || x.metadata),
  };
}

function draftItemsToText(items = [], mode = "default") {
  return arr(items)
    .map((item) => {
      const x = obj(item);

      if (mode === "service") {
        return `${s(x.title)} | ${s(x.valueText || x.description)}`.trim();
      }

      return `${s(x.title)} | ${s(x.valueText)}`.trim();
    })
    .filter(Boolean)
    .join("\n");
}

export function deriveCanonicalReviewProjection(review = {}) {
  const session = review?.session || null;
  const sessionMeta = obj(review?.sessionMeta);
  const draft = obj(review?.draft);
  const draftSummary = obj(review?.reviewDraftSummary);
  const contributionSummary = obj(review?.contributionSummary);
  const fieldProvenance = obj(review?.fieldProvenance);

  const payloadProfile = obj(draft?.draftPayload?.profile);
  const businessProfile = obj(draft?.businessProfile);
  const mergedProfile = {
    ...businessProfile,
    ...payloadProfile,
  };

  const profileMeta = extractReviewMetadata(mergedProfile);
  const draftMeta = extractReviewMetadata(draft);

  const capabilities = obj(draft?.capabilities);
  const sourceSummary = obj(draft?.sourceSummary);
  const latestImport = obj(sourceSummary?.latestImport);

  const services = arr(draft?.services).map((item) =>
    normalizeDraftServiceItem(item)
  );
  const knowledgeItems = arr(draft?.knowledgeItems).map((item) =>
    normalizeDraftKnowledgeItem(item)
  );

  const faqItems = knowledgeItems.filter((item) =>
    ["faq", "faqs"].includes(s(item.category).toLowerCase())
  );

  const policyItems = knowledgeItems.filter((item) =>
    ["policy", "policies"].includes(s(item.category).toLowerCase())
  );

  const pendingReviewCount = knowledgeItems.filter((item) => {
    const status = s(item.status).toLowerCase();
    return !status || status === "pending" || status === "review";
  }).length;

  return {
    sourceId: s(
      session?.primarySourceId ||
        sourceSummary?.latestSourceId ||
        latestImport?.sourceId
    ),
    sourceRunId: s(sourceSummary?.latestRunId || latestImport?.runId),
    snapshotId: s(draft?.lastSnapshotId),
    quickSummary: s(
      draftSummary?.quickSummary ||
        draftSummary?.summary ||
        draftSummary?.description ||
        payloadProfile?.summaryShort ||
        payloadProfile?.companySummaryShort ||
        mergedProfile?.summaryShort ||
        mergedProfile?.description ||
        mergedProfile?.summaryLong
    ),
    overview: mergedProfile,
    capabilities,
    sections: {
      services,
      faqs: faqItems,
      policies: policyItems,
    },
    reviewQueue: knowledgeItems,
    existing: {},
    stats: {
      pendingReviewCount: Number(
        contributionSummary?.pendingReviewCount || pendingReviewCount
      ),
      knowledgeCount: Number(
        contributionSummary?.knowledgeCount || knowledgeItems.length
      ),
      serviceCount: Number(
        contributionSummary?.serviceCount || services.length
      ),
      warningCount: Number(
        contributionSummary?.warningCount ||
          arr(draftSummary?.warnings).length ||
          arr(draft?.warnings).length
      ),
    },
    completeness: Object.keys(obj(draftSummary?.completeness)).length
      ? obj(draftSummary.completeness)
      : obj(draft?.completeness),
    confidenceSummary: obj(draft?.confidenceSummary),
    warnings: arr(draftSummary?.warnings).length
      ? arr(draftSummary.warnings)
      : arr(draft?.warnings),
    rawDraft: draft,
    session,
    draft,
    sources: arr(review?.sources),
    events: arr(review?.events),
    bundleSources: arr(review?.bundleSources),
    contributionSummary,
    fieldProvenance,
    reviewDraftSummary: draftSummary,
    reviewRequired: !!(
      (draftSummary.reviewRequired ??
        draftMeta.reviewRequired ??
        profileMeta.reviewRequired) ||
        false
    ),
    reviewFlags: arr(draftSummary?.reviewFlags).length
      ? arr(draftSummary.reviewFlags)
      : arr(draftMeta.reviewFlags).length
      ? arr(draftMeta.reviewFlags)
      : arr(profileMeta.reviewFlags),
    fieldConfidence: Object.keys(obj(draftSummary?.fieldConfidence)).length
      ? obj(draftSummary.fieldConfidence)
      : Object.keys(draftMeta.fieldConfidence).length
      ? obj(draftMeta.fieldConfidence)
      : obj(profileMeta.fieldConfidence),
    mainLanguage: draftMeta.mainLanguage || profileMeta.mainLanguage || "",
    primaryLanguage:
      draftMeta.primaryLanguage || profileMeta.primaryLanguage || "",
    reviewSessionId: s(
      sessionMeta.sessionId || session?.id || session?.sessionId || session?.session_id
    ),
    reviewSessionStatus: s(
      sessionMeta.sessionStatus || session?.status || session?.reviewStatus
    ),
    reviewSessionRevision: s(
      sessionMeta.revision ||
        session?.revision ||
        session?.reviewRevision ||
        session?.version ||
        session?.etag
    ),
    reviewFreshness: s(sessionMeta.freshness || session?.freshness || "unknown"),
    reviewStale: !!(sessionMeta.stale || session?.stale || session?.isStale),
    reviewConflicted: !!(
      sessionMeta.conflicted || session?.conflicted || session?.conflict
    ),
    reviewConflictMessage: s(
      sessionMeta.conflictMessage ||
        session?.conflictMessage ||
        session?.conflict_message
    ),
  };
}

export function mapCurrentReviewToLegacyDraft(review = {}) {
  return deriveCanonicalReviewProjection(review);
}

export function buildManualSectionsFromReview(review = {}) {
  const draft = obj(review?.draft);
  const services = arr(draft?.services).map((item) =>
    normalizeDraftServiceItem(item)
  );
  const knowledgeItems = arr(draft?.knowledgeItems).map((item) =>
    normalizeDraftKnowledgeItem(item)
  );

  const faqs = knowledgeItems.filter((item) =>
    ["faq", "faqs"].includes(s(item.category).toLowerCase())
  );
  const policies = knowledgeItems.filter((item) =>
    ["policy", "policies"].includes(s(item.category).toLowerCase())
  );

  return {
    servicesText: draftItemsToText(services, "service"),
    faqsText: draftItemsToText(faqs, "faq"),
    policiesText: draftItemsToText(policies, "policy"),
  };
}

export function resolveReviewSourceInfo(review = {}) {
  const normalizedReview = normalizeReviewState(review);
  const draft = obj(normalizedReview?.draft);
  const sourceSummary = obj(draft?.sourceSummary);
  const latestImport = obj(sourceSummary?.latestImport);
  const payload = obj(draft?.draftPayload);
  const profile = obj(draft?.businessProfile || payload?.profile);
  const primarySource = obj(payload?.intakeContext?.primarySource);
  const bundlePrimarySource =
    arr(normalizedReview?.bundleSources).find((item) => {
      const x = obj(item);
      return !!(
        x.isPrimary ||
        x.primary ||
        s(x.role || x.sourceRole || x.source_role).toLowerCase() === "primary"
      );
    }) || obj(arr(normalizedReview?.bundleSources)[0]);
  const firstSource = obj(arr(normalizedReview?.sources)[0]);

  const sourceType = firstNonEmpty(
    bundlePrimarySource?.sourceType,
    bundlePrimarySource?.source_type,
    latestImport?.sourceType,
    sourceSummary?.primarySourceType,
    payload?.sourceType,
    primarySource?.sourceType,
    firstSource?.sourceType,
    firstSource?.source_type,
    profile?.sourceType,
    profile?.source_type
  );

  const sourceUrl = firstNonEmpty(
    bundlePrimarySource?.url,
    bundlePrimarySource?.sourceUrl,
    bundlePrimarySource?.source_url,
    latestImport?.sourceUrl,
    sourceSummary?.primarySourceUrl,
    payload?.sourceUrl,
    primarySource?.url,
    primarySource?.sourceUrl,
    firstSource?.url,
    firstSource?.sourceUrl,
    firstSource?.source_url,
    profile?.sourceUrl,
    profile?.source_url,
    profile?.websiteUrl,
    profile?.website_url
  );

  return {
    sourceType,
    sourceUrl,
  };
}

export function reviewStateMatchesSource(
  review = {},
  sourceType = "",
  sourceUrl = ""
) {
  const expectedKey = sourceIdentityKey(sourceType, sourceUrl);
  const reviewInfo = resolveReviewSourceInfo(review);
  const reviewKey = sourceIdentityKey(reviewInfo.sourceType, reviewInfo.sourceUrl);

  if (!expectedKey || !reviewKey) return false;
  return expectedKey === reviewKey;
}

export function mergeItemsByKey(
  existing = [],
  incoming = [],
  keys = ["key", "title", "category"]
) {
  const map = new Map();

  const buildKey = (item = {}) =>
    keys
      .map((key) => s(item?.[key]).toLowerCase())
      .filter(Boolean)
      .join("|");

  for (const item of arr(existing)) {
    const stableKey = buildKey(item) || JSON.stringify(item);
    map.set(stableKey, { ...obj(item) });
  }

  for (const item of arr(incoming)) {
    const stableKey = buildKey(item) || JSON.stringify(item);
    if (!map.has(stableKey)) {
      map.set(stableKey, { ...obj(item) });
      continue;
    }

    map.set(stableKey, {
      ...obj(map.get(stableKey)),
      ...obj(item),
    });
  }

  return [...map.values()];
}

function parseServicesText(value = "") {
  return s(value)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [namePart, ...rest] = line.split("|");
      const name = s(namePart);
      const description = s(rest.join("|"));
      return {
        name: name || description,
        description: description || name,
      };
    })
    .filter((item) => s(item.name) || s(item.description));
}

function parseFaqsText(value = "") {
  return s(value)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [questionPart, ...rest] = line.split("|");
      const question = s(questionPart);
      const answer = s(rest.join("|"));
      return {
        question: question || answer,
        answer: answer || question,
      };
    })
    .filter((item) => s(item.question) || s(item.answer));
}

function parsePoliciesText(value = "") {
  return s(value)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [titlePart, ...rest] = line.split("|");
      const title = s(titlePart);
      const description = s(rest.join("|"));
      return {
        title: title || description,
        description: description || title,
      };
    })
    .filter((item) => s(item.title) || s(item.description));
}

export function buildServiceDraftItemsFromManual(value = "", existing = []) {
  const manual = parseServicesText(value).map((item) => ({
    key: safeDraftKey(s(item.name), "service"),
    title: s(item.name),
    description: s(item.description),
    valueText: s(item.description),
    category: "service",
    origin: "manual_setup",
    status: "approved",
  }));

  return mergeItemsByKey(existing, manual, ["key", "title"]);
}

export function buildKnowledgeDraftItemsFromManual({
  faqsText = "",
  policiesText = "",
  existing = [],
}) {
  const preserved = arr(existing).filter((item) => {
    const category = s(item.category).toLowerCase();
    return (
      category !== "faq" &&
      category !== "faqs" &&
      category !== "policy" &&
      category !== "policies"
    );
  });

  const faqItems = parseFaqsText(faqsText).map((item) => ({
    key: safeDraftKey(s(item.question), "faq"),
    title: s(item.question),
    valueText: s(item.answer),
    normalizedText: s(item.answer),
    category: "faq",
    origin: "manual_setup",
    status: "approved",
  }));

  const policyItems = parsePoliciesText(policiesText).map((item) => ({
    key: safeDraftKey(s(item.title), "policy"),
    title: s(item.title),
    valueText: s(item.description),
    normalizedText: s(item.description),
    category: "policy",
    origin: "manual_setup",
    status: "approved",
  }));

  return mergeItemsByKey(preserved, [...faqItems, ...policyItems], [
    "key",
    "title",
    "category",
  ]);
}

export function deriveVisibleKnowledgeItems({
  currentReview = {},
  discoveryState = {},
}) {
  const currentDraftItems = arr(currentReview?.draft?.knowledgeItems).map((item) =>
    normalizeVisibleKnowledgeItem(item)
  );

  const snapshotItems = arr(
    discoveryState?.snapshot?.knowledgeItems ||
      discoveryState?.snapshot?.items ||
      discoveryState?.importedKnowledgeItems
  ).map((item) => normalizeVisibleKnowledgeItem(item));

  const merged = mergeItemsByKey(currentDraftItems, snapshotItems, [
    "candidateId",
    "key",
    "title",
    "category",
  ]);

  return merged.map((item) => normalizeVisibleKnowledgeItem(item));
}

export function deriveVisibleServiceItems({
  currentReview = {},
  discoveryState = {},
}) {
  const currentDraftServices = arr(currentReview?.draft?.services).map((item) =>
    normalizeVisibleServiceItem(item)
  );

  const snapshotServices = [
    ...arr(discoveryState?.importedServices),
    ...arr(
      discoveryState?.snapshot?.services ||
        discoveryState?.profile?.services ||
        discoveryState?.signals?.sourceFusion?.profile?.services ||
        discoveryState?.signals?.website?.offerings?.services
    ),
  ].map((item) =>
    typeof item === "string"
      ? normalizeVisibleServiceItem({ title: item, description: item })
      : normalizeVisibleServiceItem(item)
  );

  const merged = mergeItemsByKey(
    currentDraftServices,
    snapshotServices,
    ["id", "key", "title", "category"]
  );

  return merged.map((item) => normalizeVisibleServiceItem(item));
}

export function deriveVisibleSources({
  currentReview = {},
  discoveryState = {},
}) {
  const reviewSources = arr(
    currentReview?.bundleSources?.length
      ? currentReview.bundleSources
      : currentReview?.sources
  ).map((item) =>
    normalizeVisibleSourceItem(item)
  );

  const intakeSources = arr(discoveryState?.intakeContext?.sources).map((item) =>
    normalizeVisibleSourceItem(item)
  );

  const primarySource = obj(discoveryState?.intakeContext?.primarySource);
  const directStateSource =
    s(discoveryState?.lastUrl) || s(discoveryState?.sourceId)
      ? [
          normalizeVisibleSourceItem({
            id: discoveryState?.sourceId,
            sourceType: discoveryState?.lastSourceType,
            label: discoveryState?.sourceLabel,
            url: discoveryState?.lastUrl,
            runId: discoveryState?.sourceRunId,
            snapshotId: discoveryState?.snapshotId,
            status: discoveryState?.mode,
          }),
        ]
      : [];

  const incoming = [
    ...intakeSources,
    ...(Object.keys(primarySource).length
      ? [normalizeVisibleSourceItem(primarySource)]
      : []),
    ...directStateSource,
  ];

  const merged = mergeItemsByKey(reviewSources, incoming, [
    "id",
    "sourceType",
    "url",
    "label",
  ]);

  return merged
    .map((item) => normalizeVisibleSourceItem(item))
    .filter((item) => item.id || item.url || item.label || item.sourceType);
}

export function deriveVisibleEvents(currentReview = {}) {
  return arr(currentReview?.events)
    .map((item) => normalizeVisibleEventItem(item))
    .filter((item) => item.id || item.type || item.message || item.createdAt);
}
