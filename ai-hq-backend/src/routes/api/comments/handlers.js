// src/routes/api/comments/handlers.js

import { okJson, clamp, isDbReady, isUuid } from "../../../utils/http.js";
import {
  getInternalTokenAuthResult,
  getAuthTenantKey,
} from "../../../utils/auth.js";
import { deepFix, fixText } from "../../../utils/textFix.js";
import { writeAudit } from "../../../utils/auditLog.js";
import { emitRealtimeEvent } from "../../../realtime/events.js";
import { classifyComment } from "../../../services/commentBrain.js";
import {
  buildRuntimeAuthorityFailurePayload,
  getTenantBrainRuntime,
  isRuntimeAuthorityError,
} from "../../../services/businessBrain/getTenantBrainRuntime.js";
import { resolveTenantKeyFromReq } from "../../../tenancy/index.js";
import { getTenantByKey } from "./repository.js";

import {
  s,
  safeJson,
  normalizeTimestampMs,
  nowIso,
} from "./utils.js";
import {
  getCommentById,
  getExistingCommentByExternalId,
  insertComment,
  updateCommentState,
  listComments,
} from "./repository.js";
import { createLeadFromComment } from "./lead.js";
import { forwardCommentReplyToMetaGateway } from "./gateway.js";
import {
  buildCommentActions,
  mergeClassificationForReview,
  mergeClassificationForReply,
  mergeClassificationForIgnore,
} from "./state.js";

function buildCommentRuntimePayload(runtimePack) {
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
        .filter((item) => item && (item.enabled === false || item.visible_in_ai === false || item.visibleInAi === false))
        .map((item) => s(item?.title || item?.name || item?.service_key || ""))
        .filter(Boolean);

  return {
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

export function ingestCommentHandler({ db, wsHub, getRuntime = getTenantBrainRuntime }) {
  return async function ingestComment(req, res) {
    const internalAuth = getInternalTokenAuthResult(req);
    if (!internalAuth.ok) {
      return res.status(
        internalAuth.code === "internal_token_not_configured" ? 500 : 401
      ).json({
        ok: false,
        error:
          internalAuth.code === "internal_token_not_configured"
            ? "internal_auth_misconfigured"
            : "unauthorized",
      });
    }

    const tenantKey = resolveTenantKeyFromReq(req);
    const source = s(req.body?.source || "meta") || "meta";
    const platform = s(req.body?.platform || "instagram") || "instagram";
    const channel = (s(req.body?.channel || platform || "instagram") || "instagram").toLowerCase();

    const externalCommentId = fixText(s(req.body?.externalCommentId || "")) || null;
    const externalParentCommentId = fixText(s(req.body?.externalParentCommentId || "")) || null;
    const externalPostId = fixText(s(req.body?.externalPostId || "")) || null;

    const externalUserId = fixText(s(req.body?.externalUserId || "")) || null;
    const externalUsername = fixText(s(req.body?.externalUsername || "")) || null;
    const customerName = fixText(s(req.body?.customerName || "")) || null;

    const text = fixText(s(req.body?.text || ""));
    const timestampMs = normalizeTimestampMs(req.body?.timestamp);
    const raw = safeJson(req.body?.raw, {});

    if (!externalCommentId) {
      return okJson(res, { ok: false, error: "externalCommentId required" });
    }

    if (!text) {
      return okJson(res, { ok: false, error: "text required" });
    }

    try {
      if (!isDbReady(db)) {
        return okJson(res, {
          ok: false,
          error: "db disabled",
          dbDisabled: true,
        });
      }

      let runtimePack = null;

      try {
        runtimePack = await getRuntime({
          db,
          tenantKey,
          authorityMode: "strict",
        });
      } catch (error) {
        if (isRuntimeAuthorityError(error)) {
          return okJson(
            res,
            buildRuntimeAuthorityFailurePayload(error, {
              service: "comments.ingest",
              tenantKey,
            })
          );
        }
        throw error;
      }

      const tenant = runtimePack?.tenant || (await getTenantByKey(db, tenantKey));
      const runtime = buildCommentRuntimePayload(runtimePack);

      const existing = await getExistingCommentByExternalId(
        db,
        tenantKey,
        channel,
        externalCommentId
      );

      if (existing) {
        let lead = null;

        try {
          lead = await createLeadFromComment({
            db,
            wsHub,
            tenantKey,
            comment: existing,
            classification: existing.classification || {},
          });
        } catch {}

        const actions = buildCommentActions({
          tenantKey,
          comment: existing,
          classification: existing.classification || {},
          lead,
        });

        return okJson(res, {
          ok: true,
          duplicate: true,
          deduped: true,
          comment: existing,
          classification: deepFix(existing.classification || {}),
          actions,
          lead,
          tenant: tenant
            ? {
                tenant_key: tenant.tenant_key,
                company_name:
                  tenant.company_name ||
                  tenant?.profile?.brand_name ||
                  tenant?.brand?.displayName ||
                  "",
                timezone: tenant.timezone,
              }
            : null,
        });
      }

      const classification = await classifyComment({
        tenantKey,
        tenant,
        runtime,
        channel,
        externalUserId,
        externalUsername,
        customerName,
        text,
      });

      const comment = await insertComment(db, {
        tenantKey,
        channel,
        source,
        externalCommentId,
        externalParentCommentId,
        externalPostId,
        externalUserId,
        externalUsername,
        customerName,
        text,
        classification,
        raw: {
          platform,
          timestamp: req.body?.timestamp ?? null,
          raw,
          runtime: {
            brandName:
              runtime?.brandName ||
              runtime?.tenant?.profile?.brand_name ||
              runtime?.tenant?.brand?.displayName ||
              runtime?.tenant?.company_name ||
              tenantKey,
            services: runtime?.services || [],
            disabledServices: runtime?.disabledServices || [],
            tone: runtime?.tone || "",
            language: runtime?.language || "az",
          },
        },
        timestampMs,
      });

        try {
          emitRealtimeEvent(wsHub, {
            type: "comment.created",
            audience: "operator",
            tenantKey: comment?.tenant_key || comment?.tenantKey,
            tenantId: comment?.tenant_id || comment?.tenantId,
            comment,
          });
        } catch {}

      try {
        await writeAudit(db, {
          actor: "meta_gateway",
          action: "comment.ingested",
          objectType: "comment",
          objectId: String(comment?.id || ""),
          meta: {
            tenantKey,
            channel,
            externalCommentId,
            externalPostId,
            classification,
          },
        });
      } catch {}

      let lead = null;

      try {
        lead = await createLeadFromComment({
          db,
          wsHub,
          tenantKey,
          comment,
          classification,
        });
      } catch {}

      const actions = buildCommentActions({
        tenantKey,
        comment,
        classification,
        lead,
      });

      return okJson(res, {
        ok: true,
        duplicate: false,
        deduped: false,
        comment,
        classification: deepFix(classification || {}),
        actions,
        lead,
        tenant: tenant
          ? {
              tenant_key: tenant.tenant_key,
              company_name:
                tenant.company_name ||
                tenant?.profile?.brand_name ||
                tenant?.brand?.displayName ||
                "",
              timezone: tenant.timezone,
            }
          : null,
      });
    } catch (e) {
      return okJson(res, {
        ok: false,
        error: "Error",
        details: { message: String(e?.message || e) },
      });
    }
  };
}

export function listCommentsHandler({ db }) {
  return async function listCommentsRoute(req, res) {
    const tenantKey = resolveTenantKeyFromReq(req);
    const channel = fixText(s(req.query?.channel || "")).toLowerCase();
    const category = fixText(s(req.query?.category || "")).toLowerCase();
    const q = fixText(s(req.query?.q || ""));
    const limit = clamp(Number(req.query?.limit ?? 50), 1, 200);

    try {
      if (!tenantKey) {
        return okJson(res, { ok: false, error: "missing authenticated tenant context" });
      }

      if (!isDbReady(db)) {
        return okJson(res, {
          ok: true,
          tenantKey,
          comments: [],
          dbDisabled: true,
        });
      }

      const comments = await listComments(db, {
        tenantKey,
        channel,
        category,
        q,
        limit,
      });

      return okJson(res, {
        ok: true,
        tenantKey,
        count: comments.length,
        comments,
      });
    } catch (e) {
      return okJson(res, {
        ok: false,
        error: "Error",
        details: { message: String(e?.message || e) },
      });
    }
  };
}

export function getCommentHandler({ db }) {
  return async function getCommentRoute(req, res) {
    const id = s(req.params.id || "");
    const tenantKey = getAuthTenantKey(req);
    if (!id) return okJson(res, { ok: false, error: "comment id required" });
    if (!isUuid(id)) return okJson(res, { ok: false, error: "comment id must be uuid" });

    try {
      if (!isDbReady(db)) {
        return okJson(res, {
          ok: true,
          comment: null,
          dbDisabled: true,
        });
      }

      const comment = await getCommentById(db, id);
      if (comment && tenantKey && s(comment.tenant_key) !== tenantKey) {
        return okJson(res, { ok: false, error: "comment not found" });
      }

      return okJson(res, {
        ok: true,
        found: !!comment,
        comment,
      });
    } catch (e) {
      return okJson(res, {
        ok: false,
        error: "Error",
        details: { message: String(e?.message || e) },
      });
    }
  };
}

export function reviewCommentHandler({ db, wsHub }) {
  return async function reviewCommentRoute(req, res) {
    const id = s(req.params.id || "");
    const tenantKey = getAuthTenantKey(req);
    const status = s(req.body?.status || "reviewed").toLowerCase();
    const actor = s(req.body?.actor || "operator");
    const note = s(req.body?.note || "");
    const reason = s(req.body?.reason || "");

    if (!id) return okJson(res, { ok: false, error: "comment id required" });
    if (!isUuid(id)) return okJson(res, { ok: false, error: "comment id must be uuid" });

    if (!["reviewed", "pending", "flagged", "approved", "manual_review"].includes(status)) {
      return okJson(res, { ok: false, error: "invalid review status" });
    }

    try {
      if (!isDbReady(db)) {
        return okJson(res, {
          ok: false,
          error: "db disabled",
          dbDisabled: true,
        });
      }

      const existing = await getCommentById(db, id);
      if (!existing) {
        return okJson(res, { ok: false, error: "comment not found" });
      }
      if (!tenantKey || s(existing.tenant_key) !== tenantKey) {
        return okJson(res, { ok: false, error: "comment not found" });
      }

      const nextClassification = mergeClassificationForReview(existing.classification, {
        status,
        actor,
        note,
        reason,
      });

      const nextRaw = {
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

      const comment = await updateCommentState(db, id, nextClassification, nextRaw);

        try {
          emitRealtimeEvent(wsHub, {
            type: "comment.updated",
            audience: "operator",
            tenantKey: comment?.tenant_key || comment?.tenantKey,
            tenantId: comment?.tenant_id || comment?.tenantId,
            comment,
          });
        } catch {}

      try {
        await writeAudit(db, {
          actor,
          action: "comment.reviewed",
          objectType: "comment",
          objectId: String(comment?.id || ""),
          meta: {
            status,
            note,
            reason,
          },
        });
      } catch {}

      return okJson(res, {
        ok: true,
        comment,
      });
    } catch (e) {
      return okJson(res, {
        ok: false,
        error: "Error",
        details: { message: String(e?.message || e) },
      });
    }
  };
}

export function replyCommentHandler({ db, wsHub }) {
  return async function replyCommentRoute(req, res) {
    const id = s(req.params.id || "");
    const tenantKey = getAuthTenantKey(req);
    const replyText = s(req.body?.replyText || req.body?.text || "");
    const actor = s(req.body?.actor || "operator");
    const approved = req.body?.approved !== false;
    const executeNow = req.body?.executeNow !== false;

    if (!id) return okJson(res, { ok: false, error: "comment id required" });
    if (!isUuid(id)) return okJson(res, { ok: false, error: "comment id must be uuid" });
    if (!replyText) return okJson(res, { ok: false, error: "replyText required" });

    try {
      if (!isDbReady(db)) {
        return okJson(res, {
          ok: false,
          error: "db disabled",
          dbDisabled: true,
        });
      }

      const existing = await getCommentById(db, id);
      if (!existing) {
        return okJson(res, { ok: false, error: "comment not found" });
      }
      if (!tenantKey || s(existing.tenant_key) !== tenantKey) {
        return okJson(res, { ok: false, error: "comment not found" });
      }

      let sendResult = null;
      let sent = false;
      let sendError = "";

      if (executeNow) {
        sendResult = await forwardCommentReplyToMetaGateway({
          tenantKey: existing.tenant_key,
          channel: existing.channel,
          comment: existing,
          actions: [
            {
              type: "reply_comment",
              channel: s(existing.channel || "instagram").toLowerCase() || "instagram",
              commentId: s(existing.external_comment_id || ""),
              text: replyText,
              meta: {
                tenantKey: s(existing.tenant_key || ""),
                commentId: s(existing.id || ""),
                externalCommentId: s(existing.external_comment_id || ""),
                externalPostId: s(existing.external_post_id || ""),
                actor: s(actor || "operator"),
              },
            },
          ],
        });

        sent = Boolean(sendResult?.ok);
        sendError = sent ? "" : s(sendResult?.error || "");
      }

      const nextClassification = mergeClassificationForReply(existing.classification, {
        replyText,
        actor,
        approved,
        sent,
        provider: sendResult?.json || null,
        sendError,
      });

      const nextRaw = {
        ...(deepFix(existing.raw || {})),
        reply: {
          ...(safeJson(existing.raw?.reply, {})),
          text: replyText,
          actor,
          approved: Boolean(approved),
          sent: Boolean(sent),
          error: sendError,
          provider: sendResult?.json || null,
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

      const comment = await updateCommentState(db, id, nextClassification, nextRaw);

        try {
          emitRealtimeEvent(wsHub, {
            type: "comment.updated",
            audience: "operator",
            tenantKey: comment?.tenant_key || comment?.tenantKey,
            tenantId: comment?.tenant_id || comment?.tenantId,
            comment,
          });
        } catch {}

      try {
        await writeAudit(db, {
          actor,
          action: sent ? "comment.reply_sent" : "comment.reply_saved",
          objectType: "comment",
          objectId: String(comment?.id || ""),
          meta: {
            approved: Boolean(approved),
            replyText,
            executeNow: Boolean(executeNow),
            sent: Boolean(sent),
            sendError,
            gatewayStatus: Number(sendResult?.status || 0),
          },
        });
      } catch {}

      return okJson(res, {
        ok: true,
        comment,
        replyQueued: false,
        replySaved: true,
        replySent: Boolean(sent),
        replyError: sendError || null,
        gateway: sendResult
          ? {
              ok: Boolean(sendResult.ok),
              status: Number(sendResult.status || 0),
              error: sendResult.error || null,
              skipped: Boolean(sendResult.skipped),
            }
          : null,
      });
    } catch (e) {
      return okJson(res, {
        ok: false,
        error: "Error",
        details: { message: String(e?.message || e) },
      });
    }
  };
}

export function ignoreCommentHandler({ db, wsHub }) {
  return async function ignoreCommentRoute(req, res) {
    const id = s(req.params.id || "");
    const tenantKey = getAuthTenantKey(req);
    const actor = s(req.body?.actor || "operator");
    const note = s(req.body?.note || "");

    if (!id) return okJson(res, { ok: false, error: "comment id required" });
    if (!isUuid(id)) return okJson(res, { ok: false, error: "comment id must be uuid" });

    try {
      if (!isDbReady(db)) {
        return okJson(res, {
          ok: false,
          error: "db disabled",
          dbDisabled: true,
        });
      }

      const existing = await getCommentById(db, id);
      if (!existing) {
        return okJson(res, { ok: false, error: "comment not found" });
      }
      if (!tenantKey || s(existing.tenant_key) !== tenantKey) {
        return okJson(res, { ok: false, error: "comment not found" });
      }

      const nextClassification = mergeClassificationForIgnore(existing.classification, {
        actor,
        note,
      });

      const nextRaw = {
        ...(deepFix(existing.raw || {})),
        moderation: {
          ...(safeJson(existing.raw?.moderation, {})),
          status: "ignored",
          actor,
          note,
          updatedAt: nowIso(),
        },
      };

      const comment = await updateCommentState(db, id, nextClassification, nextRaw);

        try {
          emitRealtimeEvent(wsHub, {
            type: "comment.updated",
            audience: "operator",
            tenantKey: comment?.tenant_key || comment?.tenantKey,
            tenantId: comment?.tenant_id || comment?.tenantId,
            comment,
          });
        } catch {}

      try {
        await writeAudit(db, {
          actor,
          action: "comment.ignored",
          objectType: "comment",
          objectId: String(comment?.id || ""),
          meta: {
            note,
          },
        });
      } catch {}

      return okJson(res, {
        ok: true,
        comment,
      });
    } catch (e) {
      return okJson(res, {
        ok: false,
        error: "Error",
        details: { message: String(e?.message || e) },
      });
    }
  };
}
