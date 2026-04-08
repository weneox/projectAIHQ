import express from "express";

import { safeAppendDecisionEvent } from "../../../db/helpers/decisionEvents.js";
import {
  applyExecutionPolicyToActions,
  buildExecutionPolicyDecisionAuditShape,
  mapExecutionOutcomeToDecisionEventType,
} from "../../../services/executionPolicy.js";
import { getTenantBrainRuntime } from "../../../services/businessBrain/getTenantBrainRuntime.js";
import { buildInboxActions } from "../../../services/inboxBrain.js";
import { emitRealtimeEvent } from "../../../realtime/events.js";
import { isDbReady, okJson } from "../../../utils/http.js";
import { applyInMemoryRateLimit } from "../../../utils/rateLimit.js";
import { fixText } from "../../../utils/textFix.js";
import { applyHandoffActions, persistLeadActions } from "../inbox/mutations.js";
import {
  findExistingInboundMessage,
  getInboxThreadState,
  getThreadById,
  upsertInboxThreadState,
} from "../inbox/repository.js";
import { normalizeMessage, normalizeThread, s } from "../inbox/shared.js";
import {
  findOrCreateThreadForIngest,
  insertInboundMessage,
  loadRecentMessages,
} from "../inbox/internal/persistence.js";
import { queueExecutionActions } from "../inbox/internal/execution.js";
import { emitIngestRealtime } from "../inbox/internal/responses.js";
import { loadStrictInboxRuntime } from "../inbox/internal/runtime.js";
import { rollbackAndRelease } from "../inbox/internal/shared.js";
import { buildThreadStateForDecision } from "../inbox/internal/threadState.js";
import {
  buildInstallContext,
  buildWidgetShell,
  normalizeWidgetConfig,
  normalizeUrl,
  resolveWebsiteWidgetTenant,
  resolveWidgetEnabled,
  validateWidgetInstallContext,
} from "./config.js";
import {
  issueWebsiteWidgetBootstrapToken,
  issueWebsiteWidgetSession,
  verifyWebsiteWidgetBootstrapToken,
  verifyWebsiteWidgetSessionToken,
} from "./session.js";

const WEBSITE_SOURCE = "website_widget";
const WEBSITE_THREAD_CHANNEL = "web";
const WEBSITE_RUNTIME_CHANNEL = "webchat";
const WEBSITE_PROVIDER = "website_widget";
const WEBSITE_TRANSCRIPT_LIMIT = 200;

function lower(value, fallback = "") {
  return s(value, fallback).toLowerCase();
}

function obj(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function uniq(values = []) {
  return [...new Set(arr(values).map((item) => s(item)).filter(Boolean))];
}

function nowIso() {
  return new Date().toISOString();
}

function truncate(value, limit = 280) {
  const text = fixText(s(value));
  if (!text || text.length <= limit) return text;
  return `${text.slice(0, Math.max(0, limit - 3))}...`;
}

function normalizeRequestIp(req) {
  const forwarded = s(req?.headers?.["x-forwarded-for"]);
  if (forwarded) return forwarded.split(",")[0].trim().toLowerCase();
  return s(req?.ip || req?.socket?.remoteAddress || "unknown").toLowerCase();
}

function normalizeVisitor(req) {
  const source = obj(obj(req?.body).visitor);

  return {
    name: truncate(source.name, 120),
    email: truncate(source.email, 160),
    phone: truncate(source.phone, 80),
  };
}

function resolveRequestedWidgetId(req) {
  const body = obj(req?.body);
  const query = obj(req?.query);

  return lower(
    body.widgetId ||
      body.widget_id ||
      body.publicWidgetId ||
      body.public_widget_id ||
      query.widgetId ||
      query.widget_id
  );
}

function resolveRateLimitTenantKey(req) {
  const body = obj(req?.body);
  const sessionToken = s(body.sessionToken);
  const bootstrapToken = s(body.bootstrapToken);

  const verifiedSession = verifyWebsiteWidgetSessionToken(sessionToken);
  if (verifiedSession.ok) {
    return lower(verifiedSession.payload?.tenantKey);
  }

  const verifiedBootstrap = verifyWebsiteWidgetBootstrapToken(bootstrapToken);
  if (verifiedBootstrap.ok) {
    return lower(verifiedBootstrap.payload?.tenantKey);
  }

  return lower(body.tenantKey || obj(req?.query).tenantKey);
}

function sessionPageContext(payload = {}) {
  return {
    url: s(payload?.pageUrl),
    title: s(payload?.pageTitle),
    referrer: s(payload?.pageReferrer),
    origin: s(payload?.installOrigin),
    host: s(payload?.installHost),
  };
}

function sessionValidationContext(payload = {}) {
  return {
    ok: true,
    matchedBy: s(payload?.matchedBy),
    matchedValue: s(payload?.matchedValue),
  };
}

function resolveSessionFromBootstrap({
  tenant = {},
  bootstrapPayload = {},
  providedToken = "",
} = {}) {
  const verified = verifyWebsiteWidgetSessionToken(providedToken);

  if (
    verified.ok &&
    lower(verified.payload?.tenantKey) === lower(tenant.tenantKey) &&
    s(verified.payload?.tenantId || tenant.id) === s(tenant.id) &&
    lower(verified.payload?.widgetId) === lower(bootstrapPayload.widgetId) &&
    lower(verified.payload?.installOrigin || bootstrapPayload.installOrigin) ===
      lower(bootstrapPayload.installOrigin)
  ) {
    return issueWebsiteWidgetSession({
      ...verified.payload,
      tenantId: tenant.id,
      tenantKey: tenant.tenantKey,
      widgetId: bootstrapPayload.widgetId,
      installId: bootstrapPayload.installId,
      installOrigin: bootstrapPayload.installOrigin,
      installHost: bootstrapPayload.installHost,
      pageUrl: bootstrapPayload.pageUrl,
      pageTitle: bootstrapPayload.pageTitle,
      pageReferrer: bootstrapPayload.pageReferrer,
      matchedBy: bootstrapPayload.matchedBy,
      matchedValue: bootstrapPayload.matchedValue,
    });
  }

  return issueWebsiteWidgetSession({
    tenantId: tenant.id,
    tenantKey: tenant.tenantKey,
    widgetId: bootstrapPayload.widgetId,
    threadId: "",
    installId: bootstrapPayload.installId,
    installOrigin: bootstrapPayload.installOrigin,
    installHost: bootstrapPayload.installHost,
    pageUrl: bootstrapPayload.pageUrl,
    pageTitle: bootstrapPayload.pageTitle,
    pageReferrer: bootstrapPayload.pageReferrer,
    matchedBy: bootstrapPayload.matchedBy,
    matchedValue: bootstrapPayload.matchedValue,
  });
}

async function resolveTenantFromSession(db, providedToken = "") {
  const verified = verifyWebsiteWidgetSessionToken(providedToken);
  if (!verified.ok) {
    return {
      ok: false,
      error: verified.error || "website_widget_session_invalid",
    };
  }

  const payload = verified.payload || {};
  const tenant = await resolveWebsiteWidgetTenant(db, {
    tenantKey: payload.tenantKey,
  });

  if (!tenant?.id) {
    return {
      ok: false,
      error: "tenant not found",
    };
  }

  const widgetConfig = normalizeWidgetConfig(tenant.widgetConfig, {
    defaultEnabled: true,
  });

  if (!widgetConfig.publicWidgetId) {
    return {
      ok: false,
      error: "website_widget_unconfigured",
      details: {
        message:
          "Website chat is not configured yet. Save the widget settings to re-enable public sessions.",
      },
    };
  }

  if (lower(widgetConfig.publicWidgetId) !== lower(payload.widgetId)) {
    return {
      ok: false,
      error: "website_widget_session_invalid",
      details: {
        message:
          "This website widget session no longer matches the current tenant widget installation.",
      },
    };
  }

  if (!resolveWidgetEnabled(tenant)) {
    return {
      ok: false,
      error: "website_widget_disabled",
      details: {
        message: "Website chat is disabled for this tenant.",
      },
    };
  }

  const refreshed = issueWebsiteWidgetSession({
    ...payload,
    tenantId: tenant.id,
    tenantKey: tenant.tenantKey,
    widgetId: widgetConfig.publicWidgetId,
  });

  return {
    ok: true,
    tenant,
    session: refreshed,
  };
}

function buildThreadMeta({ session, page, validation, visitor }) {
  return {
    source: WEBSITE_SOURCE,
    websiteWidget: {
      widgetId: s(session?.widgetId),
      installId: s(session?.installId),
      sessionId: s(session?.sessionId),
      visitorId: s(session?.visitorId),
      validatedAt: nowIso(),
      validation: {
        ok: validation?.ok === true,
        matchedBy: s(validation?.matchedBy),
        matchedValue: s(validation?.matchedValue),
      },
      page: {
        url: s(page?.url),
        title: truncate(page?.title, 180),
        referrer: s(page?.referrer),
        origin: s(page?.origin),
        host: s(page?.host),
      },
      visitor: {
        name: truncate(visitor?.name, 120),
        email: truncate(visitor?.email, 160),
        phone: truncate(visitor?.phone, 80),
      },
    },
  };
}

function buildMessageMeta({
  session,
  page,
  validation,
  visitor,
  clientMessageId,
} = {}) {
  return {
    source: WEBSITE_SOURCE,
    public: true,
    websiteWidget: {
      widgetId: s(session?.widgetId),
      installId: s(session?.installId),
      sessionId: s(session?.sessionId),
      visitorId: s(session?.visitorId),
      clientMessageId: s(clientMessageId),
      validation: {
        ok: validation?.ok === true,
        matchedBy: s(validation?.matchedBy),
        matchedValue: s(validation?.matchedValue),
      },
      page: {
        url: s(page?.url),
        title: truncate(page?.title, 180),
        referrer: s(page?.referrer),
        origin: s(page?.origin),
      },
      visitor: {
        name: truncate(visitor?.name, 120),
        email: truncate(visitor?.email, 160),
        phone: truncate(visitor?.phone, 80),
      },
    },
  };
}

function buildWidgetAutomation({
  runtimeState,
  summary = null,
  fallbackReasonCode = "",
} = {}) {
  if (!runtimeState?.ok) {
    const reasonCode =
      s(runtimeState?.response?.details?.authority?.reasonCode) ||
      s(runtimeState?.response?.reasonCode) ||
      s(fallbackReasonCode) ||
      "runtime_authority_unavailable";

    return {
      available: false,
      mode: "blocked_until_repair",
      summary:
        "AI replies are unavailable until approved truth and runtime authority are ready.",
      reasonCodes: [reasonCode],
    };
  }

  const surfaceSummary =
    summary || obj(runtimeState?.runtime?.executionPolicy?.inbox);
  const lowRiskOutcome = lower(surfaceSummary.lowRiskOutcome || "");
  const reasonCodes = uniq(surfaceSummary.reasonCodes);

  if (
    surfaceSummary.blockedUntilRepair ||
    lowRiskOutcome === "blocked_until_repair"
  ) {
    return {
      available: false,
      mode: "blocked_until_repair",
      summary:
        "AI replies are unavailable until runtime health and approved truth are restored.",
      reasonCodes,
    };
  }

  if (surfaceSummary.blocked || lowRiskOutcome === "blocked") {
    return {
      available: false,
      mode: "blocked",
      summary: "AI replies are blocked for this conversation surface right now.",
      reasonCodes,
    };
  }

  if (
    surfaceSummary.handoffRequired ||
    lowRiskOutcome === "handoff_required"
  ) {
    return {
      available: false,
      mode: "handoff_required",
      summary:
        "Messages will be routed to an operator when this chat needs human review.",
      reasonCodes,
    };
  }

  if (
    surfaceSummary.humanReviewRequired ||
    ["allowed_with_human_review", "operator_only"].includes(lowRiskOutcome)
  ) {
    return {
      available: false,
      mode: "operator_only",
      summary:
        "AI assistance is limited here, so the conversation may wait for an operator reply.",
      reasonCodes,
    };
  }

  return {
    available: true,
    mode: "assistant_available",
    summary:
      "AI replies are available within approved truth and runtime guardrails.",
    reasonCodes,
  };
}

function toPublicThread(thread = {}) {
  const normalized = normalizeThread(thread);

  return {
    id: s(normalized.id),
    status: s(normalized.status || "open"),
    channel: s(normalized.channel),
    customerName: s(normalized.customer_name || normalized.customerName),
    handoffActive: normalized.handoff_active === true,
    handoffReason: s(normalized.handoff_reason || normalized.handoffReason),
    updatedAt: normalized.updated_at || normalized.updatedAt || null,
  };
}

function toPublicMessage(message = {}) {
  const normalized = normalizeMessage(message);
  const delivery = obj(obj(normalized.meta).delivery);
  const senderType = lower(normalized.sender_type || normalized.senderType || "");
  const direction = lower(normalized.direction);
  const role =
    direction === "inbound"
      ? "visitor"
      : senderType === "operator" || senderType === "agent"
        ? "operator"
        : senderType === "system"
          ? "system"
          : "assistant";

  return {
    id: s(normalized.id),
    direction,
    role,
    senderType,
    messageType: s(normalized.message_type || normalized.messageType || "text"),
    text: s(normalized.text),
    sentAt: normalized.sent_at || normalized.sentAt || null,
    createdAt: normalized.created_at || normalized.createdAt || null,
    deliveryStatus: s(delivery.status || ""),
    pending: direction === "outbound" && !(normalized.sent_at || normalized.sentAt),
  };
}

function isPublicVisibleMessage(message = {}) {
  const direction = lower(message.direction);
  if (direction === "inbound") return true;

  const delivery = lower(obj(obj(message.meta).delivery).status);
  return Boolean(message.sent_at || message.sentAt || delivery === "sent");
}

async function loadWebsiteTranscript(db, threadId, tenantKey) {
  if (!threadId) return [];

  const result = await db.query(
    `
    select
      id,
      thread_id,
      tenant_key,
      direction,
      sender_type,
      external_message_id,
      message_type,
      text,
      attachments,
      meta,
      sent_at,
      created_at
    from inbox_messages
    where thread_id = $1::uuid
      and tenant_key = $2::text
    order by sent_at asc nulls last, created_at asc
    limit $3::int
    `,
    [threadId, tenantKey, WEBSITE_TRANSCRIPT_LIMIT]
  );

  return (result.rows || [])
    .map(normalizeMessage)
    .filter(isPublicVisibleMessage)
    .map(toPublicMessage);
}

function buildConversationMode({
  executionResults = [],
  handoffResults = [],
  automation = {},
} = {}) {
  if (
    arr(executionResults).some((item) => s(item?.actionType) === "send_message")
  ) {
    return "assistant_replied";
  }

  if (handoffResults.length) return "operator_only";
  if (!automation.available) return automation.mode || "operator_only";
  return "awaiting_reply";
}

function buildFallbackActions(outcome = "", reasonCodes = []) {
  const safeOutcome = lower(outcome);
  if (!safeOutcome) return [];

  const handoffReason =
    safeOutcome === "blocked_until_repair"
      ? "runtime_authority_unavailable"
      : `website_widget_${safeOutcome}`;

  return [
    {
      type: "handoff",
      reason: handoffReason,
      priority:
        safeOutcome === "allowed_with_human_review" ||
        safeOutcome === "operator_only"
          ? "normal"
          : "high",
      meta: {
        actor: WEBSITE_SOURCE,
        reasonCodes,
      },
    },
    {
      type: "no_reply",
      reason: `execution_policy_${safeOutcome}`,
      meta: {
        executionPolicyOutcome: safeOutcome,
        reasonCodes,
      },
    },
  ];
}

function websiteWidgetRateLimit(policyName, maxRequests, windowMs = 60_000) {
  return function widgetRateLimit(req, res, next) {
    return applyInMemoryRateLimit(req, res, next, {
      policyName,
      maxRequests,
      windowMs,
      keyFn: (request) => {
        const widgetId = resolveRequestedWidgetId(request);
        const tenantKey = resolveRateLimitTenantKey(request);
        const install = buildInstallContext(request);
        const session = verifyWebsiteWidgetSessionToken(
          s(obj(request?.body).sessionToken)
        );

        return [
          widgetId || tenantKey || "unknown",
          lower(
            session.ok
              ? session.payload?.installOrigin || session.payload?.installHost
              : install.requestOrigin ||
                  install.requestRefererOrigin ||
                  install.page.origin ||
                  install.page.host
          ),
          normalizeRequestIp(request),
        ].join("::");
      },
    });
  };
}

async function processWebsiteWidgetMessage({
  db,
  wsHub,
  tenant,
  session,
  page,
  validation,
  visitor,
  text,
  clientMessageId,
  getRuntime,
  buildActions,
  persistLead,
  applyHandoff,
}) {
  let client = null;

  try {
    client = await db.connect();
    await client.query("BEGIN");

    const existingThread =
      s(session.threadId) &&
      (await getThreadById(client, session.threadId, tenant.tenantKey));
    const externalThreadId =
      s(existingThread?.external_thread_id) || `website:${session.sessionId}`;
    const externalMessageId = `website:${session.sessionId}:${clientMessageId}`;

    const { thread, threadWasCreated } = await findOrCreateThreadForIngest({
      client,
      tenantId: tenant.id,
      tenantKey: tenant.tenantKey,
      channel: WEBSITE_THREAD_CHANNEL,
      externalThreadId,
      externalUserId: session.visitorId,
      externalUsername: visitor.email || visitor.name || null,
      customerName:
        visitor.name || existingThread?.customer_name || "Website visitor",
      meta: buildThreadMeta({
        session,
        page,
        validation,
        visitor,
      }),
    });

    const duplicateMessage = await findExistingInboundMessage({
      db: client,
      tenantKey: tenant.tenantKey,
      threadId: thread.id,
      externalMessageId,
    });

    if (duplicateMessage) {
      await client.query("COMMIT");
      client.release();
      client = null;

      const refreshedSession = issueWebsiteWidgetSession({
        ...session,
        tenantId: tenant.id,
        tenantKey: tenant.tenantKey,
        threadId: thread.id,
      });

      return {
        ok: true,
        duplicate: true,
        session: refreshedSession.payload,
        sessionToken: refreshedSession.token,
        widget: buildWidgetShell(tenant, { available: true }),
        thread: toPublicThread(thread),
        messages: [toPublicMessage(duplicateMessage)],
        automation: {
          available: true,
          mode: "assistant_available",
          summary: "",
          reasonCodes: [],
        },
        delivery: {
          mode: "awaiting_reply",
        },
      };
    }

    const message = await insertInboundMessage({
      client,
      threadId: thread.id,
      tenantKey: tenant.tenantKey,
      externalMessageId,
      text,
      meta: buildMessageMeta({
        session,
        page,
        validation,
        visitor,
        clientMessageId,
      }),
      timestamp: Date.now(),
    });

    const recentMessages = await loadRecentMessages(client, thread.id);
    const priorThreadState = await getInboxThreadState(client, thread.id);
    const runtimeState = await loadStrictInboxRuntime({
      client,
      getRuntime,
      tenantKey: tenant.tenantKey,
      threadState: priorThreadState,
      service: "website_widget.message",
      channelType: WEBSITE_RUNTIME_CHANNEL,
    });

    let executionResults = [];
    let leadResults = [];
    let handoffResults = [];
    let finalThread = thread;
    let actions = [];
    let automation = buildWidgetAutomation({ runtimeState });
    let brainWithPolicy = {
      intent: "",
      leadScore: 0,
      executionPolicy: {
        strictestOutcome:
          automation.mode === "blocked_until_repair"
            ? "blocked_until_repair"
            : "operator_only",
        reasonCodes: automation.reasonCodes,
      },
      trace: {
        source: WEBSITE_SOURCE,
      },
    };

    if (runtimeState.ok) {
      const { tenant: authoritativeTenant, runtime } = runtimeState;
      const brain = await buildActions({
        text,
        channel: WEBSITE_RUNTIME_CHANNEL,
        externalUserId: session.visitorId,
        tenantKey: tenant.tenantKey,
        thread,
        message,
        tenant: authoritativeTenant,
        recentMessages,
        customerContext: {
          websiteVisitor: visitor,
        },
        formData: {},
        leadContext: {},
        conversationContext: {
          website: {
            pageUrl: page.url,
            pageTitle: page.title,
            referrer: page.referrer,
            origin: page.origin,
            sessionId: session.sessionId,
            visitorId: session.visitorId,
          },
        },
        tenantContext: {
          runtime,
          websiteWidget: {
            validatedOrigin: validation?.matchedValue || "",
            widgetId: session.widgetId,
          },
        },
        services: runtime.serviceCatalog,
        knowledgeEntries: runtime.knowledgeEntries,
        responsePlaybooks: runtime.responsePlaybooks,
        threadState: runtime.threadState || null,
        runtime,
      });

      const proposedActions = arr(brain?.actions);
      const executionPolicy = applyExecutionPolicyToActions({
        runtime,
        actions: proposedActions,
        surface: "inbox",
        channelType: WEBSITE_RUNTIME_CHANNEL,
        currentState: {
          handoffActive:
            runtime?.threadState?.handoffActive ??
            runtime?.threadState?.handoff_active ??
            thread?.handoff_active,
        },
      });

      brainWithPolicy = {
        ...brain,
        proposedActions,
        executionPolicy: executionPolicy.summary,
      };

      automation = buildWidgetAutomation({
        runtimeState,
        summary: executionPolicy.summary,
      });

      const strictestOutcome = lower(executionPolicy.summary.strictestOutcome);
      const fallbackActions =
        executionPolicy.actions.length === 0 &&
        [
          "allowed_with_human_review",
          "handoff_required",
          "operator_only",
          "blocked",
          "blocked_until_repair",
        ].includes(strictestOutcome)
          ? buildFallbackActions(
              strictestOutcome,
              executionPolicy.summary.reasonCodes
            )
          : [];

      actions = executionPolicy.actions.length
        ? executionPolicy.actions
        : fallbackActions;

      await safeAppendDecisionEvent(client, {
        ...buildExecutionPolicyDecisionAuditShape({
          tenantId: authoritativeTenant?.id || tenant.id,
          tenantKey: tenant.tenantKey,
          source: "website_widget.message",
          actor: "system",
          surface: "inbox",
          channelType: WEBSITE_RUNTIME_CHANNEL,
          runtime,
          summary: executionPolicy.summary,
          actions: proposedActions,
          currentState: {
            handoffActive:
              runtime?.threadState?.handoffActive ??
              runtime?.threadState?.handoff_active ??
              thread?.handoff_active,
          },
        }),
        decisionContext: {
          threadId: s(thread?.id),
          messageId: s(message?.id),
          sessionId: s(session?.sessionId),
          visitorId: s(session?.visitorId),
          proposedActionCount: proposedActions.length,
          allowedActionCount: executionPolicy.summary.allowedActionCount,
          filteredActionCount: executionPolicy.summary.filteredActionCount,
        },
      });

      if (
        executionPolicy.summary.strictestOutcome &&
        mapExecutionOutcomeToDecisionEventType(
          executionPolicy.summary.strictestOutcome
        ) !== "execution_policy_decision"
      ) {
        await safeAppendDecisionEvent(client, {
          ...buildExecutionPolicyDecisionAuditShape({
            tenantId: authoritativeTenant?.id || tenant.id,
            tenantKey: tenant.tenantKey,
            source: "website_widget.message",
            actor: "system",
            surface: "inbox",
            channelType: WEBSITE_RUNTIME_CHANNEL,
            runtime,
            summary: executionPolicy.summary,
            actions: proposedActions,
          }),
          eventType: mapExecutionOutcomeToDecisionEventType(
            executionPolicy.summary.strictestOutcome
          ),
          decisionContext: {
            threadId: s(thread?.id),
            messageId: s(message?.id),
            sessionId: s(session?.sessionId),
            visitorId: s(session?.visitorId),
          },
        });
      }

      leadResults = await persistLead({
        db,
        client,
        wsHub,
        tenantKey: tenant.tenantKey,
        actions,
      });

      handoffResults = await applyHandoff({
        db,
        client,
        wsHub,
        threadId: thread.id,
        actions,
      });

      executionResults = await queueExecutionActions({
        client,
        thread,
        tenantId: authoritativeTenant?.id || tenant.id,
        tenantKey: tenant.tenantKey,
        channel: WEBSITE_THREAD_CHANNEL,
        provider: WEBSITE_PROVIDER,
        actions,
      });

      const refreshedThread = await client.query(
        `
        select
          id,
          tenant_id,
          tenant_key,
          channel,
          external_thread_id,
          external_user_id,
          external_username,
          customer_name,
          status,
          last_message_at,
          last_inbound_at,
          last_outbound_at,
          unread_count,
          assigned_to,
          labels,
          meta,
          handoff_active,
          handoff_reason,
          handoff_priority,
          handoff_at,
          handoff_by,
          created_at,
          updated_at
        from inbox_threads
        where id = $1::uuid
        limit 1
        `,
        [thread.id]
      );

      finalThread =
        handoffResults[handoffResults.length - 1]?.thread ||
        normalizeThread(refreshedThread.rows?.[0] || thread);
    } else {
      actions = buildFallbackActions(
        automation.mode === "blocked_until_repair"
          ? "blocked_until_repair"
          : "operator_only",
        automation.reasonCodes
      );

      handoffResults = await applyHandoff({
        db,
        client,
        wsHub,
        threadId: thread.id,
        actions,
      });

      finalThread = handoffResults[handoffResults.length - 1]?.thread || thread;

      await safeAppendDecisionEvent(client, {
        tenantId: tenant.id,
        tenantKey: tenant.tenantKey,
        eventType: "blocked_action_outcome",
        actor: "system",
        source: "website_widget.message",
        surface: "inbox",
        channelType: WEBSITE_RUNTIME_CHANNEL,
        policyOutcome: "blocked_until_repair",
        reasonCodes: automation.reasonCodes,
        healthState: {
          status: "blocked",
          reasonCode:
            automation.reasonCodes[0] || "runtime_authority_unavailable",
        },
        affectedSurfaces: ["inbox"],
        decisionContext: {
          threadId: s(thread.id),
          messageId: s(message.id),
          sessionId: s(session.sessionId),
          visitorId: s(session.visitorId),
        },
      });
    }

    await upsertInboxThreadState(
      client,
      buildThreadStateForDecision({
        thread: finalThread,
        tenant: {
          id: tenant.id,
          tenant_key: tenant.tenantKey,
        },
        tenantKey: tenant.tenantKey,
        priorState: priorThreadState,
        brain: brainWithPolicy,
        actions,
        leadResults,
        handoffResults,
        executionResults,
      })
    );

    await client.query("COMMIT");
    client.release();
    client = null;

    emitIngestRealtime({
      wsHub,
      threadWasCreated,
      thread: finalThread,
      message,
      executionResults,
      tenantKey: tenant.tenantKey,
      tenantId: tenant.id,
    });

    try {
      emitRealtimeEvent(wsHub, {
        type: "inbox.thread.updated",
        audience: "operator",
        tenantKey: finalThread?.tenant_key || tenant?.tenantKey,
        tenantId: finalThread?.tenant_id || tenant?.id,
        thread: finalThread,
      });
    } catch {}

    const refreshedSession = issueWebsiteWidgetSession({
      ...session,
      tenantId: tenant.id,
      tenantKey: tenant.tenantKey,
      threadId: finalThread.id,
    });

    const publicMessages = [
      toPublicMessage(message),
      ...executionResults
        .map((item) => item?.message)
        .filter(Boolean)
        .filter(isPublicVisibleMessage)
        .map(toPublicMessage),
    ].sort((a, b) => {
      const left = new Date(a.sentAt || a.createdAt || 0).getTime();
      const right = new Date(b.sentAt || b.createdAt || 0).getTime();
      return left - right;
    });

    return {
      ok: true,
      duplicate: false,
      session: refreshedSession.payload,
      sessionToken: refreshedSession.token,
      widget: buildWidgetShell(tenant, automation),
      automation,
      thread: toPublicThread(finalThread),
      messages: publicMessages,
      delivery: {
        mode: buildConversationMode({
          executionResults,
          handoffResults,
          automation,
        }),
      },
    };
  } catch (error) {
    if (client) await rollbackAndRelease(client);
    throw error;
  }
}

export function createWebsiteWidgetHandlers({
  db,
  wsHub,
  getRuntime = getTenantBrainRuntime,
  buildActions = buildInboxActions,
  persistLead = persistLeadActions,
  applyHandoff = applyHandoffActions,
} = {}) {
  async function issueWidgetInstallToken(req, res) {
    const widgetId = resolveRequestedWidgetId(req);

    try {
      if (!isDbReady(db)) {
        return okJson(res, {
          ok: false,
          error: "db disabled",
          dbDisabled: true,
        });
      }

      if (!widgetId) {
        return okJson(res, {
          ok: false,
          error: "widgetId required",
        });
      }

      const tenant = await resolveWebsiteWidgetTenant(db, {
        publicWidgetId: widgetId,
      });
      if (!tenant?.id) {
        return okJson(res, {
          ok: false,
          error: "website_widget_not_found",
        });
      }

      const installContext = buildInstallContext(req);
      const validation = validateWidgetInstallContext(tenant, installContext);
      if (!validation.ok) {
        return okJson(res, {
          ok: false,
          error: validation.reasonCode,
          details: {
            message: validation.detail,
          },
        });
      }

      const installOrigin =
        installContext.requestOrigin ||
        installContext.requestRefererOrigin ||
        installContext.page.origin;
      const installHost =
        normalizeUrl(installOrigin)?.hostname || installContext.page.host;
      const bootstrap = issueWebsiteWidgetBootstrapToken({
        tenantId: tenant.id,
        tenantKey: tenant.tenantKey,
        widgetId,
        installOrigin,
        installHost,
        pageUrl: installContext.page.url,
        pageTitle: installContext.page.title,
        pageReferrer: installContext.page.referrer,
        matchedBy: validation.matchedBy,
        matchedValue: validation.matchedValue,
      });

      return okJson(res, {
        ok: true,
        widgetId,
        bootstrapToken: bootstrap.token,
        expiresAt: new Date(bootstrap.payload.expiresAt).toISOString(),
      });
    } catch (error) {
      return okJson(res, {
        ok: false,
        error: "Error",
        details: {
          message: s(error?.message || error),
        },
      });
    }
  }

  async function bootstrapWebsiteWidget(req, res) {
    const body = obj(req.body);
    const widgetId = resolveRequestedWidgetId(req);
    const providedSessionToken = s(body.sessionToken);
    const bootstrapToken = s(body.bootstrapToken);

    try {
      if (!isDbReady(db)) {
        return okJson(res, {
          ok: false,
          error: "db disabled",
          dbDisabled: true,
        });
      }

      if (!widgetId) {
        return okJson(res, {
          ok: false,
          error: "widgetId required",
        });
      }

      if (!bootstrapToken) {
        return okJson(res, {
          ok: false,
          error: "bootstrapToken required",
        });
      }

      const verifiedBootstrap = verifyWebsiteWidgetBootstrapToken(bootstrapToken);
      if (!verifiedBootstrap.ok) {
        return okJson(res, {
          ok: false,
          error: verifiedBootstrap.error,
        });
      }

      if (lower(verifiedBootstrap.payload?.widgetId) !== lower(widgetId)) {
        return okJson(res, {
          ok: false,
          error: "website_widget_install_mismatch",
        });
      }

      const tenant = await resolveWebsiteWidgetTenant(db, {
        publicWidgetId: widgetId,
      });
      if (!tenant?.id) {
        return okJson(res, {
          ok: false,
          error: "tenant not found",
        });
      }

      const currentConfig = normalizeWidgetConfig(tenant.widgetConfig, {
        defaultEnabled: true,
      });
      if (!resolveWidgetEnabled(tenant)) {
        return okJson(res, {
          ok: false,
          error: "website_widget_disabled",
          details: {
            message: "Website chat is disabled for this tenant.",
          },
        });
      }

      if (lower(currentConfig.publicWidgetId) !== lower(widgetId)) {
        return okJson(res, {
          ok: false,
          error: "website_widget_install_mismatch",
        });
      }

      const session = resolveSessionFromBootstrap({
        tenant,
        bootstrapPayload: verifiedBootstrap.payload,
        providedToken: providedSessionToken,
      });

      const thread =
        s(session.payload.threadId) &&
        (await getThreadById(db, session.payload.threadId, tenant.tenantKey));
      const threadState =
        thread?.id && (await getInboxThreadState(db, thread.id));
      const runtimeState = await loadStrictInboxRuntime({
        client: db,
        getRuntime,
        tenantKey: tenant.tenantKey,
        threadState: threadState || null,
        service: "website_widget.bootstrap",
        channelType: WEBSITE_RUNTIME_CHANNEL,
      });
      const automation = buildWidgetAutomation({ runtimeState });
      const messages =
        thread?.id && lower(thread.channel) === WEBSITE_THREAD_CHANNEL
          ? await loadWebsiteTranscript(db, thread.id, tenant.tenantKey)
          : [];

      return okJson(res, {
        ok: true,
        session: session.payload,
        sessionToken: session.token,
        widget: buildWidgetShell(tenant, automation),
        automation,
        thread:
          thread?.id && lower(thread.channel) === WEBSITE_THREAD_CHANNEL
            ? toPublicThread(thread)
            : null,
        messages,
      });
    } catch (error) {
      return okJson(res, {
        ok: false,
        error: "Error",
        details: {
          message: s(error?.message || error),
        },
      });
    }
  }

  async function postWebsiteWidgetMessage(req, res) {
    const body = obj(req.body);
    const visitor = normalizeVisitor(req);
    const text = truncate(body.text || obj(body.message).text, 4000);
    const clientMessageId =
      s(body.messageId || obj(body.message).id) ||
      `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    try {
      if (!isDbReady(db)) {
        return okJson(res, {
          ok: false,
          error: "db disabled",
          dbDisabled: true,
        });
      }

      if (!text) {
        return okJson(res, {
          ok: false,
          error: "message required",
        });
      }

      const sessionState = await resolveTenantFromSession(
        db,
        s(body.sessionToken)
      );
      if (!sessionState.ok) {
        return okJson(res, {
          ok: false,
          error: sessionState.error,
          details: sessionState.details || {},
        });
      }

      const response = await processWebsiteWidgetMessage({
        db,
        wsHub,
        tenant: sessionState.tenant,
        session: sessionState.session.payload,
        page: sessionPageContext(sessionState.session.payload),
        validation: sessionValidationContext(sessionState.session.payload),
        visitor,
        text,
        clientMessageId,
        getRuntime,
        buildActions,
        persistLead,
        applyHandoff,
      });

      return okJson(res, response);
    } catch (error) {
      return okJson(res, {
        ok: false,
        error: "Error",
        details: {
          message: s(error?.message || error),
        },
      });
    }
  }

  async function getWebsiteWidgetTranscript(req, res) {
    try {
      if (!isDbReady(db)) {
        return okJson(res, {
          ok: false,
          error: "db disabled",
          dbDisabled: true,
        });
      }

      const sessionState = await resolveTenantFromSession(
        db,
        s(obj(req.body).sessionToken)
      );
      if (!sessionState.ok) {
        return okJson(res, {
          ok: false,
          error: sessionState.error,
          details: sessionState.details || {},
        });
      }

      const tenant = sessionState.tenant;
      const session = sessionState.session;
      const thread =
        s(session.payload.threadId) &&
        (await getThreadById(db, session.payload.threadId, tenant.tenantKey));

      if (!thread?.id || lower(thread.channel) !== WEBSITE_THREAD_CHANNEL) {
        const refreshed = issueWebsiteWidgetSession({
          ...session.payload,
          tenantId: tenant.id,
          tenantKey: tenant.tenantKey,
          threadId: "",
        });

        return okJson(res, {
          ok: true,
          session: refreshed.payload,
          sessionToken: refreshed.token,
          thread: null,
          messages: [],
        });
      }

      const messages = await loadWebsiteTranscript(db, thread.id, tenant.tenantKey);

      return okJson(res, {
        ok: true,
        session: session.payload,
        sessionToken: session.token,
        thread: toPublicThread(thread),
        messages,
      });
    } catch (error) {
      return okJson(res, {
        ok: false,
        error: "Error",
        details: {
          message: s(error?.message || error),
        },
      });
    }
  }

  return {
    issueWidgetInstallToken,
    bootstrapWebsiteWidget,
    postWebsiteWidgetMessage,
    getWebsiteWidgetTranscript,
  };
}

export function websiteWidgetRoutes(options = {}) {
  const handlers = createWebsiteWidgetHandlers(options);
  const router = express.Router();

  router.post(
    "/public/widget/install-token",
    websiteWidgetRateLimit("website_widget_install_token", 30),
    handlers.issueWidgetInstallToken
  );
  router.post(
    "/public/widget/bootstrap",
    websiteWidgetRateLimit("website_widget_bootstrap", 30),
    handlers.bootstrapWebsiteWidget
  );
  router.post(
    "/public/widget/message",
    websiteWidgetRateLimit("website_widget_message", 40),
    handlers.postWebsiteWidgetMessage
  );
  router.post(
    "/public/widget/transcript",
    websiteWidgetRateLimit("website_widget_transcript", 120),
    handlers.getWebsiteWidgetTranscript
  );

  return router;
}

export const __test__ = {
  buildInstallContext,
  buildWidgetAutomation,
  buildFallbackActions,
  buildWidgetShell,
  normalizeWidgetConfig,
  toPublicMessage,
  toPublicThread,
  validateWidgetInstallContext,
};
