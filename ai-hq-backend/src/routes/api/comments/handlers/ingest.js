import { okJson } from "../../../../utils/http.js";
import { getInternalTokenAuthResult } from "../../../../utils/auth.js";
import { deepFix } from "../../../../utils/textFix.js";
import { classifyComment } from "../../../../services/commentBrain.js";
import { createLeadFromComment } from "../lead.js";
import {
  getExistingCommentByExternalId,
  insertComment,
} from "../repository.js";
import { buildCommentActions } from "../state.js";
import {
  buildCommentTenantSummary,
  emitCommentCreatedRealtime,
  ensureCommentsDb,
  loadStrictCommentRuntime,
  parseIngestRequest,
  validateIngestRequest,
  writeCommentAudit,
} from "./shared.js";

export function ingestCommentHandler({
  db,
  wsHub,
  getRuntime,
  classify = classifyComment,
  createLead = createLeadFromComment,
  getExistingComment = getExistingCommentByExternalId,
  insert = insertComment,
  buildActions = buildCommentActions,
  auditWriter,
  emitEvent,
}) {
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

    const input = parseIngestRequest(req);
    const validation = validateIngestRequest(input);
    if (!validation.ok) {
      return okJson(res, validation.response);
    }

    try {
      if (!ensureCommentsDb(res, db)) {
        return;
      }

      const runtimeState = await loadStrictCommentRuntime({
        db,
        req,
        service: "comments.ingest",
        getRuntime,
      });
      if (!runtimeState.ok) {
        return okJson(res, runtimeState.response);
      }

      const { tenant, runtime } = runtimeState;

      const existing = await getExistingComment(
        db,
        input.tenantKey,
        input.channel,
        input.externalCommentId
      );

      if (existing) {
        let lead = null;
        try {
          lead = await createLead({
            db,
            wsHub,
            tenantKey: input.tenantKey,
            comment: existing,
            classification: existing.classification || {},
          });
        } catch {}

        const actions = buildActions({
          tenantKey: input.tenantKey,
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
          tenant: buildCommentTenantSummary(tenant),
        });
      }

      const classification = await classify({
        tenantKey: input.tenantKey,
        tenant,
        runtime,
        channel: input.channel,
        externalUserId: input.externalUserId,
        externalUsername: input.externalUsername,
        customerName: input.customerName,
        text: input.text,
      });

      const comment = await insert(db, {
        tenantKey: input.tenantKey,
        channel: input.channel,
        source: input.source,
        externalCommentId: input.externalCommentId,
        externalParentCommentId: input.externalParentCommentId,
        externalPostId: input.externalPostId,
        externalUserId: input.externalUserId,
        externalUsername: input.externalUsername,
        customerName: input.customerName,
        text: input.text,
        classification,
        raw: {
          platform: input.platform,
          timestamp: req.body?.timestamp ?? null,
          raw: input.raw,
          runtime: {
            brandName:
              runtime?.brandName ||
              runtime?.tenant?.profile?.brand_name ||
              runtime?.tenant?.brand?.displayName ||
              runtime?.tenant?.company_name ||
              input.tenantKey,
            services: runtime?.services || [],
            disabledServices: runtime?.disabledServices || [],
            tone: runtime?.tone || "",
            language: runtime?.language || "az",
          },
        },
        timestampMs: input.timestampMs,
      });

      emitCommentCreatedRealtime(wsHub, comment, emitEvent);

      await writeCommentAudit(
        db,
        {
          actor: "meta_gateway",
          action: "comment.ingested",
          objectType: "comment",
          objectId: String(comment?.id || ""),
          meta: {
            tenantKey: input.tenantKey,
            channel: input.channel,
            externalCommentId: input.externalCommentId,
            externalPostId: input.externalPostId,
            classification,
          },
        },
        auditWriter
      );

      let lead = null;
      try {
        lead = await createLead({
          db,
          wsHub,
          tenantKey: input.tenantKey,
          comment,
          classification,
        });
      } catch {}

      const actions = buildActions({
        tenantKey: input.tenantKey,
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
        tenant: buildCommentTenantSummary(tenant),
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
