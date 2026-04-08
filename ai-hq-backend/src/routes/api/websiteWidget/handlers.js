import express from "express";

import { safeAppendDecisionEvent } from "../../../db/helpers/decisionEvents.js";
import {
  buildExecutionPolicyDecisionAuditShape,
  applyExecutionPolicyToActions,
  mapExecutionOutcomeToDecisionEventType,
} from "../../../services/executionPolicy.js";
import { getTenantBrainRuntime } from "../../../services/businessBrain/getTenantBrainRuntime.js";
import { buildInboxActions } from "../../../services/inboxBrain.js";
import { emitRealtimeEvent } from "../../../realtime/events.js";
import { applyInMemoryRateLimit } from "../../../utils/rateLimit.js";
import { isDbReady, okJson } from "../../../utils/http.js";
import { fixText } from "../../../utils/textFix.js";
import {
  applyHandoffActions,
  persistLeadActions,
} from "../inbox/mutations.js";
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
import { buildThreadStateForDecision } from "../inbox/internal/threadState.js";
import { loadStrictInboxRuntime } from "../inbox/internal/runtime.js";
import { emitIngestRealtime } from "../inbox/internal/responses.js";
import { rollbackAndRelease } from "../inbox/internal/shared.js";
import {
  issueWebsiteWidgetSession,
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

function normalizeAllowedOrigins(config = {}) {
  const source =
    config.allowedOrigins ||
    config.allowed_origins ||
    config.origins ||
    config.publicOrigins ||
    config.public_origins;

  if (Array.isArray(source)) {
    return source.map((item) => s(item).toLowerCase()).filter(Boolean);
  }

  if (typeof source === "string") {
    return source
      .split(/[,\n]/)
      .map((item) => s(item).toLowerCase())
      .filter(Boolean);
  }

  return [];
}

function normalizeWidgetConfig(raw = {}) {
  const config = obj(raw);
  const initialPrompts = arr(
    config.initialPrompts || config.initial_prompts || config.quickReplies
  )
    .map((item) => truncate(item, 90))
    .filter(Boolean)
    .slice(0, 4);

  return {
    title: truncate(config.title || config.widgetTitle || config.widget_title, 80),
    subtitle: truncate(
      config.subtitle || config.widgetSubtitle || config.widget_subtitle,
      140
    ),
    accentColor: s(
      config.accentColor || config.accent_color || config.brandColor || config.brand_color
    ),
    initialPrompts,
    allowedOrigins: normalizeAllowedOrigins(config),
    enabled:
      typeof config.enabled === "boolean"
        ? config.enabled
        : typeof config.publicEnabled === "boolean"
          ? config.publicEnabled
          : true,
  };
}

function normalizeUrl(raw = "") {
  const value = s(raw);
  if (!value) return null;

  try {
    const parsed = new URL(value);
    return {
      raw: value,
      href: parsed.href,
      origin: `${parsed.protocol}//${parsed.host}`.toLowerCase(),
      hostname: parsed.hostname.toLowerCase().replace(/^www\./, ""),
      host: parsed.host.toLowerCase(),
      pathname: parsed.pathname || "/",
    };
  } catch {
    return null;
  }
}

function originFromRule(raw = "") {
  const value = s(raw).toLowerCase();
  if (!value) return null;

  if (/^https?:\/\//i.test(value)) {
    return normalizeUrl(value);
  }

  const normalized = value.replace(/^www\./, "");
  return {
    raw: value,
    href: value,
    origin: normalized,
    hostname: normalized.replace(/^https?:\/\//, ""),
    host: normalized.replace(/^https?:\/\//, ""),
    pathname: "/",
  };
}

function hostMatches(expectedHost = "", candidateHost = "") {
  const expected = s(expectedHost).toLowerCase().replace(/^www\./, "");
  const candidate = s(candidateHost).toLowerCase().replace(/^www\./, "");
  if (!expected || !candidate) return false;
  return candidate === expected || candidate.endsWith(`.${expected}`);
}

function resolvePageContext(req) {
  const body = obj(req?.body);
  const page = obj(body.page);
  const pageUrl = s(page.url || body.pageUrl);
  const pageTitle = truncate(page.title || body.pageTitle || body.title, 180);
  const referrer = s(
    page.referrer || body.referrer || req?.headers?.referer || req?.headers?.referrer
  );
  const requestOrigin = s(page.origin || body.origin || req?.headers?.origin).toLowerCase();
  const pageUrlParsed = normalizeUrl(pageUrl);
  const referrerParsed = normalizeUrl(referrer);
  const originParsed = normalizeUrl(requestOrigin || pageUrl || referrer);

  return {
    url: pageUrlParsed?.href || pageUrl,
    title: pageTitle,
    referrer: referrerParsed?.href || referrer,
    origin: originParsed?.origin || requestOrigin,
    host:
      pageUrlParsed?.hostname ||
      referrerParsed?.hostname ||
      originParsed?.hostname ||
      "",
  };
}

function normalizeVisitor(req) {
  const source = obj(obj(req?.body).visitor);

  return {
    name: truncate(source.name, 120),
    email: truncate(source.email, 160),
    phone: truncate(source.phone, 80),
  };
}

function resolveRequestedTenantKey(req) {
  return lower(obj(req?.body).tenantKey || obj(req?.query).tenantKey);
}

function validateWebsiteContext(tenant = {}, page = {}) {
  const config = normalizeWidgetConfig(tenant.widgetConfig);
  const requestedOrigins = uniq([
    lower(page.origin),
    lower(normalizeUrl(page.url)?.origin),
    lower(normalizeUrl(page.referrer)?.origin),
  ]).filter(Boolean);
  const requestedHosts = uniq([
    lower(page.host),
    lower(normalizeUrl(page.url)?.hostname),
    lower(normalizeUrl(page.referrer)?.hostname),
  ]).filter(Boolean);
  const configuredOrigins = config.allowedOrigins
    .map((item) => originFromRule(item))
    .filter(Boolean);
  const websiteUrl = normalizeUrl(tenant.websiteUrl);

  if (config.enabled === false) {
    return {
      ok: false,
      reasonCode: "website_widget_disabled",
      detail: "Website chat is disabled for this tenant.",
    };
  }

  if (configuredOrigins.length) {
    const matched = configuredOrigins.find((rule) =>
      requestedOrigins.some((candidate) => {
        if (rule.origin.startsWith("http")) {
          return candidate === rule.origin;
        }
        const candidateUrl = normalizeUrl(candidate);
        return hostMatches(rule.hostname, candidateUrl?.hostname || "");
      })
    );

    if (matched) {
      return {
        ok: true,
        matchedBy: "allowed_origin",
        matchedValue: matched.raw,
      };
    }

    return {
      ok: false,
      reasonCode: "website_origin_mismatch",
      detail: "This widget request did not come from an allowed website origin.",
    };
  }

  if (websiteUrl?.hostname) {
    const matchedHost = requestedHosts.find((candidate) =>
      hostMatches(websiteUrl.hostname, candidate)
    );

    if (matchedHost) {
      return {
        ok: true,
        matchedBy: "website_url",
        matchedValue: websiteUrl.href,
      };
    }

    return {
      ok: false,
      reasonCode: "website_origin_mismatch",
      detail: "This widget request does not match the tenant website URL.",
    };
  }

  return {
    ok: false,
    reasonCode: "website_widget_unconfigured",
    detail:
      "Website chat is not configured yet. Set an approved website URL or allowed widget origin first.",
  };
}

async function resolveWebsiteWidgetTenant(db, tenantKey = "") {
  if (!isDbReady(db) || !tenantKey) return null;

  const result = await db.query(
    `
    select
      t.id,
      t.tenant_key,
      t.company_name,
      t.timezone,
      coalesce(tp.website_url, '') as website_url,
      coalesce(tc.status, '') as widget_channel_status,
      coalesce(tc.display_name, '') as widget_display_name,
      coalesce(tc.config, '{}'::jsonb) as widget_config
    from tenants t
    left join tenant_profiles tp
      on tp.tenant_id = t.id
    left join lateral (
      select status, display_name, config
      from tenant_channels
      where tenant_id = t.id
        and channel_type = 'webchat'
      order by is_primary desc, updated_at desc
      limit 1
    ) tc on true
    where lower(t.tenant_key) = lower($1::text)
    limit 1
    `,
    [tenantKey]
  );

  const row = result.rows?.[0] || null;
  if (!row) return null;

  return {
    id: s(row.id),
    tenantKey: lower(row.tenant_key),
    companyName: truncate(row.company_name || row.widget_display_name || row.tenant_key, 120),
    timezone: s(row.timezone),
    websiteUrl: s(row.website_url),
    widgetChannelStatus: lower(row.widget_channel_status),
    widgetConfig: obj(row.widget_config),
  };
}

function buildWidgetShell(tenant = {}, automation = {}) {
  const config = normalizeWidgetConfig(tenant.widgetConfig);
  return {
    title: config.title || tenant.companyName || tenant.tenantKey || "Website chat",
    subtitle:
      config.subtitle ||
      (automation.available
        ? "Ask a question and get help right here on the site."
        : "Leave a message here and the team can take over."),
    accentColor: config.accentColor || "#0f172a",
    initialPrompts: config.initialPrompts,
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

  const surfaceSummary = summary || obj(runtimeState?.runtime?.executionPolicy?.inbox);
  const lowRiskOutcome = lower(surfaceSummary.lowRiskOutcome || "");
  const reasonCodes = uniq(surfaceSummary.reasonCodes);

  if (surfaceSummary.blockedUntilRepair || lowRiskOutcome === "blocked_until_repair") {
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

  if (surfaceSummary.handoffRequired || lowRiskOutcome === "handoff_required") {
    return {
      available: false,
      mode: "handoff_required",
      summary: "Messages will be routed to an operator when this chat needs human review.",
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
    summary: "AI replies are available within approved truth and runtime guardrails.",
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

function resolveSession({
  tenant = {},
  providedToken = "",
} = {}) {
  const verified = verifyWebsiteWidgetSessionToken(providedToken);

  if (
    verified.ok &&
    lower(verified.payload?.tenantKey) === lower(tenant.tenantKey) &&
    (!tenant.id || !verified.payload?.tenantId || s(verified.payload.tenantId) === s(tenant.id))
  ) {
    return issueWebsiteWidgetSession({
      ...verified.payload,
      tenantId: tenant.id,
      tenantKey: tenant.tenantKey,
    });
  }

  return issueWebsiteWidgetSession({
    tenantId: tenant.id,
    tenantKey: tenant.tenantKey,
    threadId: "",
  });
}

function buildThreadMeta({ session, page, validation, visitor }) {
  return {
    source: WEBSITE_SOURCE,
    websiteWidget: {
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

function buildConversationMode({ executionResults = [], handoffResults = [], automation = {} } = {}) {
  if (arr(executionResults).some((item) => s(item?.actionType) === "send_message")) {
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
        safeOutcome === "allowed_with_human_review" || safeOutcome === "operator_only"
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
        const tenantKey = resolveRequestedTenantKey(request);
        const page = resolvePageContext(request);
        return [
          tenantKey || "unknown",
          lower(page.origin || page.host),
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
      s(session.threadId) && (await getThreadById(client, session.threadId, tenant.tenantKey));
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
      customerName: visitor.name || existingThread?.customer_name || "Website visitor",
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
          automation.mode === "blocked_until_repair" ? "blocked_until_repair" : "operator_only",
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
          ? buildFallbackActions(strictestOutcome, executionPolicy.summary.reasonCodes)
          : [];

      actions = executionPolicy.actions.length ? executionPolicy.actions : fallbackActions;

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
        automation.mode === "blocked_until_repair" ? "blocked_until_repair" : "operator_only",
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
          reasonCode: automation.reasonCodes[0] || "runtime_authority_unavailable",
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

    const threadState = await upsertInboxThreadState(
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
      threadState,
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
  async function bootstrapWebsiteWidget(req, res) {
    const tenantKey = resolveRequestedTenantKey(req);
    const providedToken = s(obj(req.body).sessionToken);

    try {
      if (!isDbReady(db)) {
        return okJson(res, {
          ok: false,
          error: "db disabled",
          dbDisabled: true,
        });
      }

      if (!tenantKey) {
        return okJson(res, {
          ok: false,
          error: "tenantKey required",
        });
      }

      const tenant = await resolveWebsiteWidgetTenant(db, tenantKey);
      if (!tenant?.id) {
        return okJson(res, {
          ok: false,
          error: "tenant not found",
        });
      }

      const page = resolvePageContext(req);
      const validation = validateWebsiteContext(tenant, page);
      if (!validation.ok) {
        return okJson(res, {
          ok: false,
          error: validation.reasonCode,
          details: {
            message: validation.detail,
          },
        });
      }

      const session = resolveSession({
        tenant,
        providedToken,
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
    const tenantKey = resolveRequestedTenantKey(req);
    const body = obj(req.body);
    const providedToken = s(body.sessionToken);
    const page = resolvePageContext(req);
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

      if (!tenantKey) {
        return okJson(res, {
          ok: false,
          error: "tenantKey required",
        });
      }

      if (!text) {
        return okJson(res, {
          ok: false,
          error: "message required",
        });
      }

      const tenant = await resolveWebsiteWidgetTenant(db, tenantKey);
      if (!tenant?.id) {
        return okJson(res, {
          ok: false,
          error: "tenant not found",
        });
      }

      const validation = validateWebsiteContext(tenant, page);
      if (!validation.ok) {
        return okJson(res, {
          ok: false,
          error: validation.reasonCode,
          details: {
            message: validation.detail,
          },
        });
      }

      const session = resolveSession({
        tenant,
        providedToken,
      });

      const response = await processWebsiteWidgetMessage({
        db,
        wsHub,
        tenant,
        session: session.payload,
        page,
        validation,
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
    const tenantKey = resolveRequestedTenantKey(req);
    const providedToken = s(obj(req.body).sessionToken);

    try {
      if (!isDbReady(db)) {
        return okJson(res, {
          ok: false,
          error: "db disabled",
          dbDisabled: true,
        });
      }

      if (!tenantKey) {
        return okJson(res, {
          ok: false,
          error: "tenantKey required",
        });
      }

      const tenant = await resolveWebsiteWidgetTenant(db, tenantKey);
      if (!tenant?.id) {
        return okJson(res, {
          ok: false,
          error: "tenant not found",
        });
      }

      const page = resolvePageContext(req);
      const validation = validateWebsiteContext(tenant, page);
      if (!validation.ok) {
        return okJson(res, {
          ok: false,
          error: validation.reasonCode,
          details: {
            message: validation.detail,
          },
        });
      }

      const session = resolveSession({
        tenant,
        providedToken,
      });

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
    bootstrapWebsiteWidget,
    postWebsiteWidgetMessage,
    getWebsiteWidgetTranscript,
  };
}

export function websiteWidgetRoutes(options = {}) {
  const handlers = createWebsiteWidgetHandlers(options);
  const router = express.Router();

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
  buildWidgetAutomation,
  buildFallbackActions,
  buildWidgetShell,
  normalizeWidgetConfig,
  toPublicMessage,
  toPublicThread,
  validateWebsiteContext,
};
