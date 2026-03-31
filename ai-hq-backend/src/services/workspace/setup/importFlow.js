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

async function defaultGetCurrentSetupReview(tenantId) {
  const reviewHelper = await import("../../../db/helpers/tenantSetupReview.js");
  return reviewHelper.getCurrentSetupReview(tenantId);
}

async function defaultListSetupReviewEvents(input) {
  const reviewHelper = await import("../../../db/helpers/tenantSetupReview.js");
  return reviewHelper.listSetupReviewEvents(input);
}

export function buildImportResponse({
  data,
  successMessage,
  acceptedMessage,
  partialMessage,
  errorCode,
  errorMessage,
}) {
  const mode = String(data?.mode || (data?.ok === false ? "error" : "success"))
    .trim()
    .toLowerCase();
  const isError = data?.ok === false || mode === "error";
  const isPartial = mode === "partial";
  const isAccepted =
    data?.accepted === true ||
    mode === "accepted" ||
    mode === "queued" ||
    mode === "running";

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
        partial: false,
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
  };
}

export async function enrichImportDataWithReview({ actor, data }, deps = {}) {
  const sanitizedData = data?.draft
    ? {
        ...data,
        draft: sanitizeSetupReviewDraft(data.draft),
        profile: sanitizeSetupBusinessProfile(
          obj(data.profile || data.draft?.businessProfile)
        ),
      }
    : data;

  if (!s(sanitizedData?.reviewSessionId) && !sanitizedData?.draft) return sanitizedData;

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

    return {
      ...sanitizedData,
      review: buildFrontendReviewShape({
        session: review?.session || null,
        draft: review?.draft || null,
        sources: arr(review?.sources),
        events,
      }),
    };
  } catch (err) {
    return {
      ...sanitizedData,
      reviewError: err?.message || "failed to load current review",
    };
  }
}
