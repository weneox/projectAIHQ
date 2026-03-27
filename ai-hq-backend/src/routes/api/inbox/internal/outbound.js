import { okJson, isDbReady, isUuid } from "../../../../utils/http.js";
import {
  findExistingOutboundMessage,
  findLatestAttemptByMessageId,
  getInboxThreadState,
  getThreadById,
  refreshThread,
  upsertInboxThreadState,
} from "../repository.js";
import { logInfo, resolveTenantRow, rollbackAndRelease } from "./shared.js";
import { parseOutboundRequest, validateOutboundRequest } from "./request.js";
import { persistOutboundMessage } from "./execution.js";
import { buildThreadStateForOutbound } from "./threadState.js";
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
      return okJson(res, { ok: false, error: "db disabled", dbDisabled: true });
    }

    const threadId = String(req.body?.threadId || "").trim();
    if (!threadId) return okJson(res, { ok: false, error: "threadId required" });
    if (!isUuid(threadId)) return okJson(res, { ok: false, error: "threadId must be uuid" });

    let client = null;

    try {
      const existingThread = await getThreadById(db, threadId);
      if (!existingThread) {
        return okJson(res, { ok: false, error: "thread not found" });
      }

      const input = parseOutboundRequest(req, existingThread);
      const validation = validateOutboundRequest(input);
      if (!validation.ok) return okJson(res, validation.response);

      if (input.externalMessageId) {
        const existingMessage = await findExistingOutboundMessage({
          db,
          tenantKey: input.tenantKey,
          threadId,
          externalMessageId: input.externalMessageId,
        });

        if (existingMessage) {
          return okJson(
            res,
            buildDuplicateOutboundResponse({
              thread: existingThread,
              message: existingMessage,
              attempt: await findLatestAttemptByMessageId(db, existingMessage.id),
              threadState: await getInboxThreadState(db, threadId),
            })
          );
        }
      }

      client = await db.connect();
      await client.query("BEGIN");

      const tenantRow = await resolveTenantRow(client, input.tenantKey);
      const tenantId = String(existingThread?.tenant_id || tenantRow?.id || "").trim();
      if (!tenantId) {
        await rollbackAndRelease(client);
        client = null;
        return okJson(res, {
          ok: false,
          error: "tenant not found",
          details: { tenantKey: input.tenantKey, threadId },
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

      const normalizedThread = await refreshThread(client, threadId, existingThread);
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

      await client.query("COMMIT");
      client.release();
      client = null;

      emitOutboundRealtime({
        wsHub,
        thread: normalizedThread,
        message: delivery.message,
        attempt: delivery.attempt,
        tenantKey: input.tenantKey,
        tenantId,
      });

      return okJson(
        res,
        buildOutboundSuccessResponse({
          thread: normalizedThread,
          threadState: nextThreadState,
          message: delivery.message,
          attempt: delivery.attempt,
        })
      );
    } catch (error) {
      if (client) await rollbackAndRelease(client);
      return okJson(res, {
        ok: false,
        error: "Error",
        details: { message: String(error?.message || error) },
      });
    }
  };
}
