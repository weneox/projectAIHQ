import { runWithTenantContext } from "../../db/tenantContext.js";
import { emitInboundAcceptedRealtime } from "./internal/responses.js";
import {
  findOrCreateThreadForIngest,
  insertInboundMessage,
} from "./internal/persistence.js";
import { refreshThread } from "./repository.js";

function s(value, fallback = "") {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "object") return fallback;
  return String(value).trim() || fallback;
}

function obj(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function cleanPhone(value = "") {
  return s(value).replace(/\s+/g, "");
}

function safeExternalId(value = "", fallback = "") {
  return s(value || fallback)
    .replace(/[^a-zA-Z0-9:_+.-]/g, "_")
    .slice(0, 220);
}

export function buildVoiceBusinessActionInboxText(requestRecord = {}) {
  const record = obj(requestRecord);
  const customer = obj(record.customer);
  const payload = obj(record.payload);

  const title = s(record.summary || "Voice request captured.");
  const requestType = s(record.requestType);
  const phone = s(customer.phone || payload.phone || payload.customerPhone);
  const name = s(customer.name || payload.customerName || payload.name);
  const actionName = s(record.actionName);
  const requestId = s(record.id || record.requestId);

  return [
    title,
    requestType ? `Type: ${requestType}` : "",
    actionName ? `Action: ${actionName}` : "",
    name ? `Customer: ${name}` : "",
    phone ? `Phone: ${phone}` : "",
    requestId ? `Request ID: ${requestId}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildVoiceBusinessActionInboxInput({
  requestRecord = {},
  result = {},
  runtimeConfig = {},
} = {}) {
  const record = obj(requestRecord);
  const customer = obj(record.customer);
  const payload = obj(record.payload);
  const requestId = s(record.id || result.requestId);
  const tenantKey = s(record.tenantKey || result.tenantKey || runtimeConfig.tenantKey);
  const tenantId = s(record.tenantId || result.tenantId);
  const callId = s(record.callId || result.callId);
  const sessionId = s(record.sessionId || result.sessionId);
  const phone = cleanPhone(customer.phone || payload.phone || payload.customerPhone);
  const customerName = s(customer.name || payload.customerName || payload.name || phone || "Voice caller");

  return {
    tenantId,
    tenantKey,
    channel: "voice",
    externalThreadId: safeExternalId(
      callId ? `voice:call:${callId}` : "",
      `voice:request:${requestId}`
    ),
    externalUserId: safeExternalId(phone || callId || requestId, "voice-caller"),
    externalUsername: phone || "",
    customerName,
    externalMessageId: safeExternalId(requestId, `voice-message:${Date.now()}`),
    text: buildVoiceBusinessActionInboxText(record),
    timestamp: Date.now(),
    meta: {
      source: "voice_business_action_sink",
      provider: "voice",
      platform: "voice",
      channel: "voice",
      requestId,
      callId,
      sessionId,
      requestType: s(record.requestType),
      businessFamily: s(record.businessFamily),
      priority: s(record.priority || "normal"),
      voice: {
        requestRecord: record,
        result: obj(result),
      },
      identity: {
        externalUserId: phone || callId || requestId,
        externalThreadId: callId || requestId,
        externalUsername: phone || "",
        customerName,
      },
    },
  };
}

export function createVoiceBusinessActionInboxSinkExecutor({
  db,
  wsHub = null,
} = {}) {
  return async function voiceBusinessActionInboxSinkExecutor({
    requestRecord = {},
    result = {},
    runtimeConfig = {},
  } = {}) {
    const input = buildVoiceBusinessActionInboxInput({
      requestRecord,
      result,
      runtimeConfig,
    });

    if (!db || typeof db.connect !== "function") {
      return {
        ok: false,
        sink: "inbox",
        status: "not_configured",
        requestId: input.externalMessageId,
        reasonCode: "voice_inbox_sink_db_unavailable",
        message: "Inbox sink database is not available.",
      };
    }

    if (!input.tenantId || !input.tenantKey || !input.externalThreadId || !input.externalUserId || !input.text) {
      return {
        ok: false,
        sink: "inbox",
        status: "not_configured",
        requestId: input.externalMessageId,
        reasonCode: "voice_inbox_sink_missing_required_input",
        message: "Inbox sink is missing required tenant/thread/message input.",
      };
    }

    return runWithTenantContext(
      {
        tenantId: input.tenantId,
        tenantKey: input.tenantKey,
        source: "voice.inbox_sink",
      },
      async () => {
        const client = await db.connect();
        let committed = false;

        try {
          await client.query("BEGIN");

          const threadResult = await findOrCreateThreadForIngest({
            client,
            tenantId: input.tenantId,
            tenantKey: input.tenantKey,
            channel: input.channel,
            externalThreadId: input.externalThreadId,
            externalUserId: input.externalUserId,
            externalUsername: input.externalUsername,
            customerName: input.customerName,
            meta: input.meta,
          });

          const message = await insertInboundMessage({
            client,
            threadId: threadResult.thread?.id,
            tenantId: input.tenantId,
            tenantKey: input.tenantKey,
            externalMessageId: input.externalMessageId,
            text: input.text,
            meta: input.meta,
            timestamp: input.timestamp,
          });

          await client.query("COMMIT");
          committed = true;

          const thread = await refreshThread(
            db,
            threadResult.thread?.id,
            threadResult.thread,
            input.tenantKey
          );

          emitInboundAcceptedRealtime({
            wsHub,
            threadWasCreated: threadResult.threadWasCreated,
            thread,
            message,
            tenantKey: input.tenantKey,
            tenantId: input.tenantId,
          });

          return {
            ok: true,
            sink: "inbox",
            status: message?.duplicate ? "skipped" : "delivered",
            requestId: input.externalMessageId,
            inboxThreadId: s(thread?.id || threadResult.thread?.id),
            inboxMessageId: s(message?.id),
            duplicate: message?.duplicate === true,
            deduped: message?.deduped === true,
            reasonCode: "",
            message: message?.duplicate
              ? "Voice request already exists in inbox."
              : "Voice request delivered to inbox.",
          };
        } catch (error) {
          if (!committed) {
            try {
              await client.query("ROLLBACK");
            } catch {}
          }

          return {
            ok: false,
            sink: "inbox",
            status: "failed",
            requestId: input.externalMessageId,
            reasonCode: "voice_inbox_sink_delivery_failed",
            errorMessage: s(error?.message || error),
            message: "Voice request could not be delivered to inbox.",
          };
        } finally {
          try {
            client.release();
          } catch {}
        }
      }
    );
  };
}
