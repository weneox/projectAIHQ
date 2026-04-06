import {
  sanitizeSetupBusinessProfile,
  sanitizeSetupReviewDraft,
} from "../import/draft.js";
import { buildFrontendReviewShape } from "./reviewShape.js";
import { arr, obj, s } from "./utils.js";
import { safeUuidOrNull } from "./draftShared.js";

function bool(value, fallback = false) {
  if (typeof value === "boolean") return value;
  const normalized = s(value).toLowerCase();
  if (!normalized) return fallback;
  if (["1", "true", "yes", "y", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "n", "off"].includes(normalized)) return false;
  return fallback;
}

function lower(value, fallback = "") {
  return s(value, fallback).toLowerCase();
}

async function defaultGetCurrentSetupReview(tenantId) {
  const reviewHelper = await import("../../../db/helpers/tenantSetupReview.js");
  return reviewHelper.getCurrentSetupReview(tenantId);
}

async function defaultListSetupReviewEvents(input) {
  const reviewHelper = await import("../../../db/helpers/tenantSetupReview.js");
  return reviewHelper.listSetupReviewEvents(input);
}

function sanitizeReviewRecord(review = {}, events = []) {
  const session = review?.session || null;
  const draft = review?.draft ? sanitizeSetupReviewDraft(review.draft) : null;
  const sources = arr(review?.sources);
  const safeEvents = arr(events);

  return {
    session,
    draft,
    sources,
    events: safeEvents,
    review: buildFrontendReviewShape({
      session,
      draft,
      sources,
      events: safeEvents,
    }),
    profile: draft
      ? sanitizeSetupBusinessProfile(obj(draft?.businessProfile))
      : {},
  };
}

function buildFallbackFrontendReview(data = {}) {
  const reviewSessionId = s(data?.reviewSessionId);
  const draft = data?.draft ? sanitizeSetupReviewDraft(data.draft) : null;

  if (!reviewSessionId && !draft) return null;

  const session = reviewSessionId
    ? {
        id: reviewSessionId,
        status: s(data?.reviewSessionStatus || "processing"),
        mode: "setup",
        currentStep: s(data?.stage || "source_sync"),
        metadata: {},
      }
    : null;

  return buildFrontendReviewShape({
    session,
    draft,
    sources: [],
    events: [],
  });
}

export function buildImportResponse({
  data,
  successMessage,
  acceptedMessage,
  partialMessage,
  errorCode,
  errorMessage,
}) {
  const mode = String(
    data?.mode || (data?.ok === false ? "error" : "success")
  )
    .trim()
    .toLowerCase();

  const isError = data?.ok === false || mode === "error";
  const isPartial = data?.partial === true || mode === "partial";
  const isAccepted =
    data?.accepted === true ||
    data?.pending === true ||
    ["accepted", "queued", "running", "processing"].includes(mode);

  if (isError) {
    return {
      status: 422,
      body: {
        ok: false,
        error: errorCode,
        reason: data?.error || errorMessage,
        ...data,
      },
    };
  }

  if (isAccepted) {
    return {
      status: 202,
      body: {
        ok: true,
        accepted: true,
        partial: isPartial,
        message: acceptedMessage || successMessage,
        ...data,
      },
    };
  }

  return {
    status: 200,
    body: {
      ok: true,
      partial: isPartial,
      message: isPartial ? partialMessage : successMessage,
      ...data,
    },
  };
}

export function buildImportArgs({ actor, body = {}, requestId = "" }) {
  const { user, tenant, tenantId, tenantKey, role } = actor || {};

  const userId =
    safeUuidOrNull(user?.id) ||
    safeUuidOrNull(user?.userId) ||
    safeUuidOrNull(user?.user_id) ||
    null;

  const userEmail = s(user?.email);
  const userName =
    s(user?.name) ||
    s(user?.full_name) ||
    s(user?.fullName) ||
    s(user?.display_name) ||
    s(user?.displayName);

  return {
    tenant,
    tenantId,
    tenantKey,
    role,
    requestedBy: userId || userEmail || userName || "system",
    requestedByUserId: userId,
    requestedByEmail: userEmail,
    requestedByName: userName,
    note: s(body?.note),
    requestId: s(requestId),
    sources: arr(body?.sources),
    primarySource: body?.primarySource || body?.primary_source || null,
    metadataJson: obj(body?.metadataJson || body?.metadata_json),
    allowSessionReuse: bool(
      body?.allowSessionReuse ??
        body?.allow_session_reuse ??
        body?.resumeExistingSession ??
        body?.resume_existing_session,
      false
    ),
    waitForCompletion: bool(
      body?.waitForCompletion ??
        body?.wait_for_completion ??
        body?.inline ??
        body?.runInline,
      false
    ),
  };
}

export async function enrichImportDataWithReview({ actor, data }, deps = {}) {
  const safeData = obj(data);
  const sanitizedDraft = safeData?.draft
    ? sanitizeSetupReviewDraft(safeData.draft)
    : null;

  const sanitizedProfile = sanitizeSetupBusinessProfile(
    obj(safeData.profile || sanitizedDraft?.businessProfile)
  );

  const sanitizedData = {
    ...safeData,
    draft: sanitizedDraft || safeData.draft || null,
    profile: sanitizedProfile,
    partial:
      safeData.partial === true || lower(safeData.mode) === "partial",
  };

  if (!s(sanitizedData?.reviewSessionId) && !sanitizedData?.draft) {
    return sanitizedData;
  }

  try {
    const getReview = deps.getCurrentSetupReview || defaultGetCurrentSetupReview;
    const listEvents = deps.listSetupReviewEvents || defaultListSetupReviewEvents;

    const review = await getReview(actor.tenantId);
    const events = s(review?.session?.id)
      ? await listEvents({
          sessionId: review.session.id,
          limit: 20,
        })
      : [];

    const normalizedReview = sanitizeReviewRecord(review, events);

    return {
      ...sanitizedData,
      draft: sanitizedData.draft || normalizedReview.draft || null,
      profile:
        Object.keys(obj(sanitizedData.profile)).length
          ? sanitizedData.profile
          : normalizedReview.profile,
      review: normalizedReview.review,
    };
  } catch (err) {
    return {
      ...sanitizedData,
      review:
        buildFallbackFrontendReview(sanitizedData) ||
        sanitizedData.review ||
        null,
      reviewError: err?.message || "failed to load current review",
    };
  }
}