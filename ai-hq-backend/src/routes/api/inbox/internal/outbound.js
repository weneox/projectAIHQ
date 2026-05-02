import { okJson, isDbReady, isUuid } from "../../../../utils/http.js";
import { setTenantContext } from "../../../../db/tenantContext.js";
import {
  commitTenantUsageReservation,
} from "../../../../db/helpers/tenantUsage.js";
import { enforceTenantQuota } from "../../../../services/tenantQuota.js";
import {
  findExistingOutboundMessage,
  findLatestAttemptByMessageId,
  getInboxThreadState,
  listOutboundAttemptCorrelationsByMessageIds,
  getThreadById,
  refreshThread,
  upsertInboxThreadState,
} from "../repository.js";
import { logInfo, resolveTenantRow, rollbackAndRelease } from "./shared.js";
import { parseOutboundRequest, validateOutboundRequest } from "./request.js";
import { persistOutboundMessage } from "./execution.js";
import { buildThreadStateForOutbound } from "./threadState.js";
import { withMessageOutboundAttemptCorrelation } from "../shared.js";
import {
  buildDuplicateOutboundResponse,
  buildOutboundSuccessResponse,
  emitOutboundRealtime,
} from "./responses.js";

export function createInboxOutboundHandler({ db, wsHub }) {
  return async function inboxOutboundHandler(req, res) {
    logInfo("inbox-outbound internal hit", {
      path: req.originalUrl || req.url || req.path,
      hasInternalToken: Boolean(req.headers["x-internal-token"]),
    });

    if (!isDbReady(db)) {
      return res.status(503).json({ ok: false, error: "db disabled", dbDisabled: true });
    }

    const threadId = String(req.body?.threadId || "").trim();
    if (!threadId) return res.status(400).json({ ok: false, error: "threadId required" });
    if (!isUuid(threadId)) return res.status(400).json({ ok: false, error: "threadId must be uuid" });

    let client = null;

    try {
      const requestedTenantKey = String(req.body?.tenantKey || req.body?.tenant_key || "").trim();
      if (!requestedTenantKey) {
        return res.status(400).json({ ok: false, error: "tenantKey required" });
      }
      const tenantRow = await resolveTenantRow(db, requestedTenantKey);
      const resolvedTenantId = String(tenantRow?.id || "").trim();
      if (!resolvedTenantId) {
        return res.status(404).json({
          ok: false,
          error: "tenant not found",
          details: { tenantKey: requestedTenantKey, threadId },
        });
      }

      setTenantContext({
        tenantId: resolvedTenantId,
        tenantKey: requestedTenantKey,
        requestId: req.requestId,
        source: "internal.inbox.outbound",
      });
      const existingThread = await getThreadById(db, threadId, {
        tenantId: resolvedTenantId,
        tenantKey: requestedTenantKey,
      });
      if (!existingThread) {
        return res.status(404).json({ ok: false, error: "thread not found" });
      }

      const input = parseOutboundRequest(req, existingThread);
      const validation = validateOutboundRequest(input);
      if (!validation.ok) return res.status(400).json(validation.response);
      if (String(input.tenantKey || "").toLowerCase() !== requestedTenantKey.toLowerCase()) {
        return res.status(403).json({ ok: false, error: "tenant/thread mismatch" });
      }
      setTenantContext({
        tenantId: existingThread?.tenant_id || "",
        tenantKey: input.tenantKey,
        requestId: req.requestId,
        source: "internal.inbox.outbound",
      });

      if (input.externalMessageId) {
        const existingMessage = await findExistingOutboundMessage({
          db,
          tenantKey: input.tenantKey,
          threadId,
          externalMessageId: input.externalMessageId,
        });

        if (existingMessage) {
          const correlations = await listOutboundAttemptCorrelationsByMessageIds(
            db,
            [existingMessage.id],
            { threadId, tenantKey: input.tenantKey }
          );
          return okJson(
            res,
            buildDuplicateOutboundResponse({
              thread: existingThread,
              message: withMessageOutboundAttemptCorrelation(
                existingMessage,
                correlations.get(existingMessage.id) || null
              ),
              attempt: await findLatestAttemptByMessageId(
                db,
                existingMessage.id,
                input.tenantKey
              ),
              threadState: await getInboxThreadState(db, threadId),
            })
          );
        }
      }

      client = await db.connect();
      await client.query("BEGIN");

      const tenantId = String(existingThread?.tenant_id || resolvedTenantId).trim();
      setTenantContext({
        tenantId,
        tenantKey: input.tenantKey,
        requestId: req.requestId,
        source: "internal.inbox.outbound",
      });
      if (!tenantId) {
        await rollbackAndRelease(client);
        client = null;
        return res.status(404).json({
          ok: false,
          error: "tenant not found",
          details: { tenantKey: input.tenantKey, threadId },
        });
      }

      req.auth = {
        ...(req.auth || {}),
        tenantId,
        tenantKey: input.tenantKey,
        planKey: tenantRow?.plan_key || "starter",
        _serverControlled: true,
      };

      const quota = await enforceTenantQuota({
        db: client,
        req,
        res,
        profile: {
          metric: "messages_out",
          cost: 1,
          class: "outbound_message",
        },
      });
      if (quota?.ok === false) {
        await rollbackAndRelease(client);
        client = null;
        return res.status(quota.status || 429).json({
          ok: false,
          error: quota.error || "Tenant quota exceeded",
          code: quota.code || "tenant_quota_exceeded",
          requestId: req.requestId || null,
          quota: quota.quota,
        });
      }

      const delivery = await persistOutboundMessage({
        client,
        thread: existingThread,
        tenantId,
        tenantKey: input.tenantKey,
        channel: input.channel,
        recipientId: input.recipientId,
        senderType: input.senderType,
        externalMessageId: input.externalMessageId,
        requestedMessageType: input.requestedMessageType,
        storageMessageType: input.messageType,
        text: input.text,
        attachments: input.attachments,
        meta: {
          ...input.meta,
          operatorName: String(req.body?.operatorName || "").trim(),
        },
        provider: input.provider,
        maxAttempts: input.maxAttempts,
        enqueueExecution: !input.externalMessageId,
      });

      const normalizedThread = await refreshThread(client, threadId, existingThread, {
        tenantId,
        tenantKey: input.tenantKey,
      });
      const priorThreadState = await getInboxThreadState(client, threadId);
      const nextThreadState = await upsertInboxThreadState(
        client,
        buildThreadStateForOutbound({
          thread: normalizedThread,
          tenantKey: input.tenantKey,
          priorState: priorThreadState,
          message: delivery.message,
          senderType: input.senderType,
          messageType: delivery.messageType,
          meta: delivery.mergedMeta,
        })
      );

      await commitTenantUsageReservation(client, {
        ...(quota?.reservation || {}),
        meta: {
          ...(quota?.reservation?.meta || {}),
          channel: input.channel,
          threadId,
          messageId: delivery.message?.id || "",
          attemptId: delivery.attempt?.id || "",
        },
      });

      await client.query("COMMIT");
      client.release();
      client = null;

      emitOutboundRealtime({
        wsHub,
        thread: normalizedThread,
        message: withMessageOutboundAttemptCorrelation(delivery.message, {
          message_id: delivery.message?.id,
          attempt_ids: delivery.attempt?.id ? [delivery.attempt.id] : [],
        }),
        attempt: delivery.attempt,
        tenantKey: input.tenantKey,
        tenantId,
      });

      return okJson(
        res,
        buildOutboundSuccessResponse({
          thread: normalizedThread,
          threadState: nextThreadState,
          message: withMessageOutboundAttemptCorrelation(delivery.message, {
            message_id: delivery.message?.id,
            attempt_ids: delivery.attempt?.id ? [delivery.attempt.id] : [],
          }),
          attempt: delivery.attempt,
        })
      );
    } catch (error) {
      if (client) await rollbackAndRelease(client);
      logInfo("inbox outbound failed", {
        threadId,
        error: String(error?.message || error),
      });
      return res.status(500).json({
        ok: false,
        error: "inbox_outbound_failed",
        details: { message: String(error?.message || error) },
      });
    }
  };
}
