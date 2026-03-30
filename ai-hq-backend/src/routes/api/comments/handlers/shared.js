import { okJson, isDbReady } from "../../../../utils/http.js";
import { deepFix, fixText } from "../../../../utils/textFix.js";
import {
  buildRuntimeAuthorityFailurePayload,
  getTenantBrainRuntime,
  isRuntimeAuthorityError,
} from "../../../../services/businessBrain/getTenantBrainRuntime.js";
import { resolveTenantKeyFromReq } from "../../../../tenancy/index.js";
import { emitRealtimeEvent } from "../../../../realtime/events.js";
import { writeAudit } from "../../../../utils/auditLog.js";
import { buildExecutionPolicySurfaceSummary } from "../../../../services/executionPolicy.js";
import {
  s,
  safeJson,
  normalizeTimestampMs,
  nowIso,
} from "../utils.js";

export function buildCommentRuntimePayload(runtimePack) {
  const serviceCatalog = Array.isArray(runtimePack?.serviceCatalog)
    ? runtimePack.serviceCatalog
    : Array.isArray(runtimePack?.servicesDetailed)
      ? runtimePack.servicesDetailed
      : [];

  const services = Array.isArray(runtimePack?.services)
    ? runtimePack.services
    : serviceCatalog
        .map((item) => s(item?.title || item?.name || item?.service_key || item))
        .filter(Boolean);

  const disabledServices = Array.isArray(runtimePack?.disabledServices)
    ? runtimePack.disabledServices
    : serviceCatalog
        .filter(
          (item) =>
            item &&
            (item.enabled === false ||
              item.visible_in_ai === false ||
              item.visibleInAi === false)
        )
        .map((item) => s(item?.title || item?.name || item?.service_key || ""))
        .filter(Boolean);

  return {
    executionPolicy: {
      comments: buildExecutionPolicySurfaceSummary({
        runtime: runtimePack,
        surface: "comments",
        channelType: "comments",
      }),
      inbox: buildExecutionPolicySurfaceSummary({
        runtime: runtimePack,
        surface: "inbox",
        channelType: "inbox",
      }),
      voice: buildExecutionPolicySurfaceSummary({
        runtime: runtimePack,
        surface: "voice",
        channelType: "voice",
      }),
    },
    ...runtimePack,
    tenant: runtimePack?.tenant || null,
    serviceCatalog,
    services,
    disabledServices,
    knowledgeEntries: Array.isArray(runtimePack?.knowledgeEntries)
      ? runtimePack.knowledgeEntries
      : [],
    responsePlaybooks: Array.isArray(runtimePack?.responsePlaybooks)
      ? runtimePack.responsePlaybooks
      : [],
    aiPolicy:
      runtimePack?.aiPolicy ||
      runtimePack?.ai_policy ||
      runtimePack?.tenant?.ai_policy ||
      {},
    commentPolicy:
      runtimePack?.commentPolicy ||
      runtimePack?.comment_policy ||
      runtimePack?.tenant?.comment_policy ||
      {},
    businessContext:
      s(runtimePack?.businessContext) ||
      s(runtimePack?.businessSummary) ||
      s(runtimePack?.companySummaryLong) ||
      s(runtimePack?.companySummaryShort) ||
      "",
    tone:
      s(runtimePack?.tone) ||
      s(runtimePack?.toneText) ||
      s(runtimePack?.tenant?.profile?.tone_of_voice) ||
      "professional",
    preferredCta:
      s(runtimePack?.preferredCta) ||
      s(runtimePack?.tenant?.profile?.preferred_cta) ||
      "",
    bannedPhrases: Array.isArray(runtimePack?.bannedPhrases)
      ? runtimePack.bannedPhrases
      : Array.isArray(runtimePack?.forbiddenClaims)
        ? runtimePack.forbiddenClaims
        : [],
    language:
      s(runtimePack?.language) ||
      s(runtimePack?.defaultLanguage) ||
      s(runtimePack?.outputLanguage) ||
      s(runtimePack?.tenant?.default_language) ||
      "az",
  };
}

export function buildCommentTenantSummary(tenant) {
  if (!tenant) return null;

  return {
    tenant_key: tenant.tenant_key,
    company_name:
      tenant.company_name ||
      tenant?.profile?.brand_name ||
      tenant?.brand?.displayName ||
      "",
    timezone: tenant.timezone,
  };
}

export function emitCommentCreatedRealtime(
  wsHub,
  comment,
  emitEvent = emitRealtimeEvent
) {
  try {
    emitEvent(wsHub, {
      type: "comment.created",
      audience: "operator",
      tenantKey: comment?.tenant_key || comment?.tenantKey,
      tenantId: comment?.tenant_id || comment?.tenantId,
      comment,
    });
  } catch {}
}

export function emitCommentUpdatedRealtime(
  wsHub,
  comment,
  emitEvent = emitRealtimeEvent
) {
  try {
    emitEvent(wsHub, {
      type: "comment.updated",
      audience: "operator",
      tenantKey: comment?.tenant_key || comment?.tenantKey,
      tenantId: comment?.tenant_id || comment?.tenantId,
      comment,
    });
  } catch {}
}

export async function writeCommentAudit(
  db,
  payload,
  auditWriter = writeAudit
) {
  try {
    await auditWriter(db, payload);
  } catch {}
}

export async function loadStrictCommentRuntime({
  db,
  req,
  service,
  getRuntime = getTenantBrainRuntime,
}) {
  const tenantKey = resolveTenantKeyFromReq(req);

  try {
    const runtimePack = await getRuntime({
      db,
      tenantKey,
      authorityMode: "strict",
    });

    const tenant = runtimePack?.tenant || null;
    if (!tenant?.id && !tenant?.tenant_key) {
      return {
        ok: false,
        tenantKey,
        response: {
          ok: false,
          error: "runtime_authority_unavailable",
          details: {
            service,
            message:
              "Approved runtime authority did not provide an authoritative tenant payload.",
            authority: runtimePack?.authority || null,
          },
        },
      };
    }

    return {
      ok: true,
      tenantKey,
      tenant,
      runtimePack,
      runtime: buildCommentRuntimePayload(runtimePack),
    };
  } catch (error) {
    if (isRuntimeAuthorityError(error)) {
      return {
        ok: false,
        tenantKey,
        response: buildRuntimeAuthorityFailurePayload(error, {
          service,
          tenantKey,
        }),
      };
    }
    throw error;
  }
}

export function buildOwnedCommentLookupHandler({
  getCommentById,
  onMissingTenant = () => ({ ok: false, error: "comment not found" }),
}) {
  return async function loadOwnedComment({ db, id, tenantKey }) {
    const existing = await getCommentById(db, id);
    if (!existing) {
      return { ok: false, response: { ok: false, error: "comment not found" } };
    }
    if (!tenantKey || s(existing.tenant_key) !== tenantKey) {
      return { ok: false, response: onMissingTenant() };
    }
    return { ok: true, comment: existing };
  };
}

export function parseIngestRequest(req) {
  const tenantKey = resolveTenantKeyFromReq(req);
  const source = s(req.body?.source || "meta") || "meta";
  const platform = s(req.body?.platform || "instagram") || "instagram";
  const channel = (
    s(req.body?.channel || platform || "instagram") || "instagram"
  ).toLowerCase();

  const externalCommentId = fixText(s(req.body?.externalCommentId || "")) || null;
  const externalParentCommentId =
    fixText(s(req.body?.externalParentCommentId || "")) || null;
  const externalPostId = fixText(s(req.body?.externalPostId || "")) || null;
  const externalUserId = fixText(s(req.body?.externalUserId || "")) || null;
  const externalUsername = fixText(s(req.body?.externalUsername || "")) || null;
  const customerName = fixText(s(req.body?.customerName || "")) || null;
  const text = fixText(s(req.body?.text || ""));
  const timestampMs = normalizeTimestampMs(req.body?.timestamp);
  const raw = safeJson(req.body?.raw, {});

  return {
    tenantKey,
    source,
    platform,
    channel,
    externalCommentId,
    externalParentCommentId,
    externalPostId,
    externalUserId,
    externalUsername,
    customerName,
    text,
    timestampMs,
    raw,
  };
}

export function validateIngestRequest(input) {
  if (!input.externalCommentId) {
    return { ok: false, response: { ok: false, error: "externalCommentId required" } };
  }
  if (!input.text) {
    return { ok: false, response: { ok: false, error: "text required" } };
  }
  return { ok: true };
}

export function ensureCommentsDb(res, db, { disabledOk = false, tenantKey = "" } = {}) {
  if (isDbReady(db)) return true;

  okJson(
    res,
    disabledOk
      ? {
          ok: true,
          tenantKey,
          comments: [],
          dbDisabled: true,
        }
      : {
          ok: false,
          error: "db disabled",
          dbDisabled: true,
        }
  );
  return false;
}

export function buildReviewRaw(existing, { status, actor, note, reason }) {
  return {
    ...(deepFix(existing.raw || {})),
    moderation: {
      ...(safeJson(existing.raw?.moderation, {})),
      status,
      actor,
      note,
      reason,
      updatedAt: nowIso(),
    },
  };
}

export function buildReplyRaw(
  existing,
  {
    replyText,
    actor,
    approved,
    sent,
    provider,
    sendError,
    errorCode = "",
    deliveryStatus = "",
    executionId = "",
    providerMessageId = "",
  }
) {
  return {
    ...(deepFix(existing.raw || {})),
    reply: {
      ...(safeJson(existing.raw?.reply, {})),
      text: replyText,
      actor,
      approved: Boolean(approved),
      sent: Boolean(sent),
      error: sendError,
      errorCode,
      provider: provider || null,
      delivery: {
        ...(safeJson(existing.raw?.reply?.delivery, {})),
        status: deliveryStatus,
        executionId,
        providerMessageId,
        updatedAt: nowIso(),
      },
      createdAt: safeJson(existing.raw?.reply, {}).createdAt || nowIso(),
      updatedAt: nowIso(),
    },
    moderation: {
      ...(safeJson(existing.raw?.moderation, {})),
      status: "replied",
      actor,
      approved: Boolean(approved),
      updatedAt: nowIso(),
    },
  };
}

export function buildReplyPendingRaw(
  existing,
  {
    replyText,
    actor,
    approved,
    executionId = "",
  }
) {
  return {
    ...(deepFix(existing.raw || {})),
    reply: {
      ...(safeJson(existing.raw?.reply, {})),
      text: s(replyText || safeJson(existing.raw?.reply, {}).text || ""),
      actor: s(actor || safeJson(existing.raw?.reply, {}).actor || "operator"),
      approved: Boolean(approved),
      sent: false,
      error: "",
      errorCode: "",
      provider: null,
      delivery: {
        ...(safeJson(existing.raw?.reply?.delivery, {})),
        status: "pending",
        executionId: s(executionId || ""),
        providerMessageId: "",
        sentAt: "",
        deadLetter: false,
        updatedAt: nowIso(),
      },
      createdAt: safeJson(existing.raw?.reply, {}).createdAt || nowIso(),
      updatedAt: nowIso(),
    },
    moderation: {
      ...(safeJson(existing.raw?.moderation, {})),
      status: "replied",
      actor: s(actor || safeJson(existing.raw?.moderation, {}).actor || "operator"),
      approved: Boolean(approved),
      updatedAt: nowIso(),
    },
  };
}

export function buildIgnoreRaw(existing, { actor, note }) {
  return {
    ...(deepFix(existing.raw || {})),
    moderation: {
      ...(safeJson(existing.raw?.moderation, {})),
      status: "ignored",
      actor,
      note,
      updatedAt: nowIso(),
    },
  };
}
