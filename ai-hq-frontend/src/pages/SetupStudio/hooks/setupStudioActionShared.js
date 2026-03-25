import { arr, obj, s } from "../lib/setupStudioHelpers.js";
import { lowerText } from "../logic/helpers.js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function maybeUuid(value = "") {
  const x = s(value);
  return UUID_RE.test(x) ? x : "";
}

function pickDirectKnowledgeCandidateUuid(item = {}) {
  const x = obj(item);
  const candidate = obj(x.candidate);

  return (
    maybeUuid(x.candidateUuid) ||
    maybeUuid(x.candidate_uuid) ||
    maybeUuid(x.candidateId) ||
    maybeUuid(x.candidate_id) ||
    maybeUuid(x.knowledgeCandidateId) ||
    maybeUuid(x.knowledge_candidate_id) ||
    maybeUuid(x.reviewCandidateId) ||
    maybeUuid(x.review_candidate_id) ||
    maybeUuid(x.uuid) ||
    maybeUuid(candidate.id) ||
    maybeUuid(candidate.uuid) ||
    maybeUuid(candidate.candidateId) ||
    maybeUuid(candidate.candidate_id) ||
    ""
  );
}

function knowledgeSignature(item = {}) {
  const x = obj(item);
  const candidate = obj(x.candidate);

  const evidenceUrl = s(
    x.evidenceUrl ||
      x.evidence_url ||
      x.url ||
      x.link ||
      obj(arr(x.evidence)[0]).url ||
      obj(arr(x.evidence)[0]).pageUrl
  );

  return [
    s(x.rowId || x.row_id),
    s(x.id),
    s(x.key),
    s(x.itemKey || x.item_key),
    s(x.title || x.label),
    s(x.value || x.valueText || x.value_text || x.description),
    evidenceUrl,
    s(candidate.id || candidate.uuid || candidate.candidateId),
  ]
    .filter(Boolean)
    .join("::")
    .toLowerCase();
}

export function resolveKnowledgeCandidateUuid({
  item,
  visibleKnowledgeItems,
  pickKnowledgeCandidateId,
}) {
  const fromCtx = maybeUuid(
    typeof pickKnowledgeCandidateId === "function"
      ? pickKnowledgeCandidateId(item)
      : ""
  );

  if (fromCtx) return fromCtx;

  const direct = pickDirectKnowledgeCandidateUuid(item);
  if (direct) return direct;

  const targetSig = knowledgeSignature(item);
  const targetRowId = s(item?.rowId || item?.row_id);
  const targetId = s(item?.id);
  const targetTitle = s(item?.title || item?.label);
  const targetValue = s(
    item?.value || item?.valueText || item?.value_text || item?.description
  );

  const matched = arr(visibleKnowledgeItems).find((entry) => {
    const sig = knowledgeSignature(entry);

    if (targetSig && sig && targetSig === sig) return true;
    if (targetRowId && targetRowId === s(entry?.rowId || entry?.row_id)) {
      return true;
    }
    if (targetId && targetId === s(entry?.id)) return true;

    return (
      targetTitle &&
      targetValue &&
      targetTitle === s(entry?.title || entry?.label) &&
      targetValue ===
        s(
          entry?.value ||
            entry?.valueText ||
            entry?.value_text ||
            entry?.description
        )
    );
  });

  const matchedFromCtx = maybeUuid(
    typeof pickKnowledgeCandidateId === "function"
      ? pickKnowledgeCandidateId(matched)
      : ""
  );

  if (matchedFromCtx) return matchedFromCtx;

  return pickDirectKnowledgeCandidateUuid(matched);
}

export function currentReviewConcurrencyMeta(review = {}, discoveryState = {}) {
  const session = obj(review?.session);
  const draft = obj(review?.draft);
  const concurrency = obj(review?.concurrency);

  return {
    sessionId: s(
      session.id ||
        concurrency.sessionId ||
        discoveryState?.reviewSessionId
    ),
    sessionStatus: s(
      session.status ||
        concurrency.sessionStatus ||
        discoveryState?.reviewSessionStatus
    ),
    revision: s(
      draft.version ||
        concurrency.draftVersion ||
        discoveryState?.reviewSessionRevision
    ),
    freshness: s(session.freshness || discoveryState?.reviewFreshness || "unknown"),
    stale: !!(
      session.stale ||
      session.isStale ||
      discoveryState?.reviewStale ||
      s(session.freshness || discoveryState?.reviewFreshness).toLowerCase() ===
        "stale"
    ),
    conflicted: !!(
      session.conflicted ||
      session.conflict ||
      discoveryState?.reviewConflicted ||
      s(session.freshness || discoveryState?.reviewFreshness).toLowerCase() ===
        "conflict"
    ),
    message: s(
      session.conflictMessage ||
        session.conflict_message ||
        discoveryState?.reviewConflictMessage
    ),
  };
}

export function buildReviewConcurrencyPayload(meta = {}) {
  const payload = {};

  if (s(meta.sessionId)) payload.sessionId = s(meta.sessionId);
  if (s(meta.revision)) payload.draftVersion = s(meta.revision);
  return payload;
}

export function parseReviewConcurrencyError(error, meta = {}) {
  const message = String(error?.message || error || "").trim();
  const payload = obj(error?.payload);
  const code = s(error?.code || payload?.code || payload?.error).toUpperCase();
  const lowered = lowerText(message);
  const hasBaselineDriftPayload =
    Object.keys(obj(payload?.baseline)).length > 0 ||
    Object.keys(obj(payload?.current)).length > 0;
  const staleByBackend =
    code === "SETUP_REVIEW_BASELINE_DRIFT" || hasBaselineDriftPayload;
  const mismatchByBackend =
    code === "SETUP_REVIEW_SESSION_MISMATCH" ||
    code === "SETUP_REVIEW_DRAFT_VERSION_MISMATCH";
  const conflicted =
    mismatchByBackend ||
    (!staleByBackend &&
      /conflict|revision mismatch|version mismatch|precondition|409|412/.test(
        lowered
      ));
  const stale =
    staleByBackend ||
    (!conflicted &&
      /stale|expired|out[_ -]?of[_ -]?date|outdated|baseline drift/.test(
        lowered
      ));

  return {
    sessionId: s(meta.sessionId),
    sessionStatus: s(meta.sessionStatus),
    revision: s(meta.revision),
    freshness: conflicted
      ? "conflict"
      : stale
        ? "stale"
        : s(meta.freshness || "unknown"),
    stale,
    conflicted,
    message: s(payload?.reason || message),
  };
}

export function createSetupStudioActionState(ctx) {
  const {
    createEmptyReviewState,
    createEmptyLegacyDraft,
    setCurrentReview,
    setReviewDraft,
    setDiscoveryState,
  } = ctx;

  function clearActiveReviewSession() {
    const empty = createEmptyReviewState();
    setCurrentReview(empty);
    setReviewDraft(createEmptyLegacyDraft());
    return empty;
  }

  function setReviewSyncIssue(issue = {}) {
    setDiscoveryState((prev) => ({
      ...prev,
      reviewSessionId: s(issue.sessionId || prev.reviewSessionId),
      reviewSessionStatus: s(issue.sessionStatus || prev.reviewSessionStatus),
      reviewSessionRevision: s(issue.revision || prev.reviewSessionRevision),
      reviewFreshness: s(issue.freshness || prev.reviewFreshness || "unknown"),
      reviewStale: !!issue.stale,
      reviewConflicted: !!issue.conflicted,
      reviewConflictMessage: s(issue.message || issue.conflictMessage),
    }));
  }

  return {
    clearActiveReviewSession,
    setReviewSyncIssue,
  };
}
