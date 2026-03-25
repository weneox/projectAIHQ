import crypto from "crypto";
import { createStructuredLogger } from "@aihq/shared-contracts/logger";
import { META_APP_SECRET, VERIFY_TOKEN } from "../config.js";
import { extractMetaEvents } from "../utils/metaParser.js";
import {
  forwardToAiHq,
  forwardCommentToAiHq,
} from "../services/aihqClient.js";
import { executeMetaActions } from "../services/actionExecutor.js";
import { resolveTenantContextFromMetaEvent } from "../services/tenantResolver.js";
import {
  markInboundEventProcessed,
  recordWebhookVerificationFailure,
} from "../services/runtimeReliability.js";

function s(v) {
  return String(v ?? "").trim();
}

function safeJsonPreview(v, limit = 220) {
  try {
    return JSON.stringify(v ?? {}).slice(0, limit);
  } catch {
    return "";
  }
}

function normalizeObj(v) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : {};
}

const logger = createStructuredLogger({
  service: "meta-bot-backend",
  component: "webhook",
});

function summarizeExec(exec) {
  const results = Array.isArray(exec?.results) ? exec.results : [];

  return {
    total: results.length,
    ok: results.filter((x) => x?.ok).length,
    failed: results.filter((x) => !x?.ok).length,
    types: results.map((x) => ({
      type: s(x?.type || "unknown"),
      ok: Boolean(x?.ok),
      status: Number(x?.status || 0),
      error: s(x?.error || ""),
      outboundAckOk:
        x?.meta?.outboundAck && typeof x.meta.outboundAck === "object"
          ? Boolean(x.meta.outboundAck.ok)
          : null,
      outboundAckError:
        x?.meta?.outboundAck && typeof x.meta.outboundAck === "object"
          ? s(x.meta.outboundAck.error || "")
          : "",
    })),
  };
}

function safeEqHex(a, b) {
  const aa = Buffer.from(s(a), "utf8");
  const bb = Buffer.from(s(b), "utf8");
  if (aa.length !== bb.length) return false;

  try {
    return crypto.timingSafeEqual(aa, bb);
  } catch {
    return false;
  }
}

export function verifyMetaWebhookSignature(req) {
  const secret = s(META_APP_SECRET);
  if (!secret) {
    recordWebhookVerificationFailure("misconfigured");
    logger.error("meta.webhook.verify.misconfigured", null, {});
    return {
      ok: false,
      status: 500,
      error: "webhook_auth_misconfigured",
    };
  }

  const signature =
    s(req.headers?.["x-hub-signature-256"]) || s(req.headers?.["x-hub-signature"]);
  if (!signature) {
    recordWebhookVerificationFailure("missing_meta_signature");
    logger.warn("meta.webhook.verify.rejected", {
      reason: "missing_meta_signature",
    });
    return {
      ok: false,
      status: 403,
      error: "missing_meta_signature",
    };
  }

  const rawBody = Buffer.isBuffer(req.rawBody)
    ? req.rawBody
    : Buffer.from(JSON.stringify(req.body || {}), "utf8");
  const expected = `sha256=${crypto.createHmac("sha256", secret).update(rawBody).digest("hex")}`;

  if (!safeEqHex(signature, expected)) {
    recordWebhookVerificationFailure("invalid_meta_signature");
    logger.warn("meta.webhook.verify.rejected", {
      reason: "invalid_meta_signature",
    });
    return {
      ok: false,
      status: 403,
      error: "invalid_meta_signature",
    };
  }

  return { ok: true };
}

function buildCustomerContextFromEvent(ev) {
  return {
    fullName: s(ev?.customerName || ""),
    username: s(ev?.username || ""),
    externalUserId: s(ev?.userId || ""),
    channel: s(ev?.channel || "instagram").toLowerCase() || "instagram",
    pageId: s(ev?.pageId || ""),
    igUserId: s(ev?.igUserId || ""),
  };
}

function buildConversationContextFromEvent(ev) {
  return {
    eventType: s(ev?.eventType || ""),
    sourceType: s(ev?.sourceType || ""),
    externalThreadId: s(ev?.externalThreadId || ev?.userId || ""),
    externalMessageId: s(ev?.messageId || ev?.mid || ""),
    externalCommentId: s(ev?.externalCommentId || ""),
    externalParentCommentId: s(ev?.externalParentCommentId || ""),
    externalPostId: s(ev?.externalPostId || ""),
    hasAttachments: Boolean(ev?.hasAttachments),
    attachments: Array.isArray(ev?.attachments) ? ev.attachments : [],
  };
}

function buildTenantContextFromResolved(tenantCtx) {
  const tenant = normalizeObj(tenantCtx?.tenant);
  const profile = normalizeObj(tenant?.profile);
  const brand = normalizeObj(tenant?.brand);
  const meta = normalizeObj(tenant?.meta);
  const aiPolicy = normalizeObj(tenant?.ai_policy || tenant?.aiPolicy);
  const channelConfig = normalizeObj(tenantCtx?.channelConfig);

  return {
    tenantKey: s(tenantCtx?.tenantKey || ""),
    companyName:
      s(brand?.displayName) ||
      s(brand?.name) ||
      s(profile?.companyName) ||
      s(profile?.displayName) ||
      s(tenant?.company_name) ||
      s(tenant?.name) ||
      s(tenantCtx?.tenantKey || ""),
    industryKey:
      s(profile?.industryKey) ||
      s(profile?.industry_key) ||
      s(tenant?.industry_key) ||
      s(meta?.industry) ||
      "generic_business",
    defaultLanguage:
      s(profile?.defaultLanguage) ||
      s(profile?.default_language) ||
      s(tenant?.default_language) ||
      "az",
    enabledLanguages:
      Array.isArray(tenant?.enabled_languages)
        ? tenant.enabled_languages
        : Array.isArray(profile?.languages)
          ? profile.languages
          : [],
    tone:
      s(profile?.tone_of_voice) ||
      s(meta?.tone) ||
      "professional, concise, premium",
    services:
      Array.isArray(profile?.services)
        ? profile.services
        : Array.isArray(meta?.services)
          ? meta.services
          : [],
    aiPolicy,
    channelConfig,
  };
}

function buildAihqInboxPayload(ev, rawBody, tenantCtx) {
  const channel = s(ev?.channel || "instagram").toLowerCase() || "instagram";
  const externalUserId = s(ev?.userId || "");
  const externalMessageId = s(ev?.messageId || ev?.mid || "");
  const externalThreadId = s(ev?.externalThreadId || externalUserId || "");
  const text = s(ev?.text || "");
  const customerContext = buildCustomerContextFromEvent(ev);
  const conversationContext = buildConversationContextFromEvent(ev);
  const tenantContext = buildTenantContextFromResolved(tenantCtx);

  return {
    tenantKey: s(tenantCtx?.tenantKey || ""),
    source: "meta",
    platform: channel,
    channel,
    userId: externalUserId,
    externalUserId,
    externalThreadId,
    externalMessageId,
    externalUsername: s(ev?.username || ""),
    customerName: s(ev?.customerName || ""),
    text,
    timestamp: Number(ev?.timestamp || Date.now()),
    raw: rawBody,
    customerContext,
    formData: {},
    leadContext: {},
    conversationContext,
    tenantContext,
    metaAccount: {
      recipientId: s(ev?.recipientId || ""),
      pageId: s(ev?.pageId || ""),
      igUserId: s(ev?.igUserId || ""),
    },
  };
}

function buildAihqCommentPayload(ev, rawBody, tenantCtx) {
  const channel = s(ev?.channel || "instagram").toLowerCase() || "instagram";
  const customerContext = buildCustomerContextFromEvent(ev);
  const conversationContext = buildConversationContextFromEvent(ev);
  const tenantContext = buildTenantContextFromResolved(tenantCtx);

  return {
    tenantKey: s(tenantCtx?.tenantKey || ""),
    source: "meta",
    platform: channel,
    channel,
    eventType: "comment",

    externalCommentId: s(ev?.externalCommentId || ev?.messageId || ev?.mid || ""),
    externalParentCommentId: s(ev?.externalParentCommentId || ""),
    externalPostId: s(ev?.externalPostId || ""),

    externalUserId: s(ev?.userId || ""),
    externalUsername: s(ev?.username || ""),
    customerName: s(ev?.customerName || ""),

    text: s(ev?.text || ""),
    timestamp: Number(ev?.timestamp || Date.now()),
    raw: rawBody,

    customerContext,
    formData: {},
    leadContext: {},
    conversationContext,
    tenantContext,

    metaAccount: {
      recipientId: s(ev?.recipientId || ""),
      pageId: s(ev?.pageId || ""),
      igUserId: s(ev?.igUserId || ""),
    },
  };
}

function summarizeInbound(ev) {
  return {
    channel: s(ev?.channel || "unknown"),
    eventType: s(ev?.eventType || "unknown"),
    userId: s(ev?.userId || ""),
    recipientId: s(ev?.recipientId || ""),
    pageId: s(ev?.pageId || ""),
    igUserId: s(ev?.igUserId || ""),
    externalThreadId: s(ev?.externalThreadId || ""),
    externalMessageId: s(ev?.messageId || ev?.mid || ""),
    externalCommentId: s(ev?.externalCommentId || ""),
    externalPostId: s(ev?.externalPostId || ""),
    textPreview: s(ev?.text || "").slice(0, 160),
    hasAttachments: Boolean(ev?.hasAttachments),
    ignored: Boolean(ev?.ignored),
    ignoreReason: s(ev?.ignoreReason || ""),
    supported: Boolean(ev?.supported),
  };
}

async function resolveTenantForEvent(ev) {
  const out = await resolveTenantContextFromMetaEvent({
    channel: s(ev?.channel || "instagram").toLowerCase() || "instagram",
    recipientId: s(ev?.recipientId || ""),
    pageId: s(ev?.pageId || ""),
    igUserId: s(ev?.igUserId || ""),
  });

  if (!out?.ok || !s(out?.tenantKey)) {
    return {
      ok: false,
      error: s(out?.error || "tenant_not_resolved"),
      tenantKey: "",
      tenant: null,
      channelConfig: null,
    };
  }

  return {
    ok: true,
    tenantKey: s(out.tenantKey),
    tenant: out.tenant || null,
    channelConfig: out.channelConfig || null,
  };
}

function pickResolvedTenantKey(aihqResponse, tenantCtx) {
  return s(aihqResponse?.json?.tenant?.tenant_key || tenantCtx?.tenantKey || "");
}

async function handleSupportedTextEvent(ev, rawBody) {
  const tenantCtx = await resolveTenantForEvent(ev);

  if (!tenantCtx.ok) {
    logger.warn("meta.webhook.text.tenant_resolution_failed", {
      ...summarizeInbound(ev),
      error: tenantCtx.error,
    });
    return;
  }

  const payload = buildAihqInboxPayload(ev, rawBody, tenantCtx);

  logger.info("meta.webhook.text.received", {
    ...summarizeInbound(ev),
    tenantKey: tenantCtx.tenantKey,
  });

  const out = await forwardToAiHq(payload);
  const resolvedTenantKey = pickResolvedTenantKey(out, tenantCtx);

  logger.info("meta.webhook.text.forwarded", {
    ok: out.ok,
    status: out.status,
    error: out.error,
    duplicate: Boolean(out?.json?.duplicate),
    deduped: Boolean(out?.json?.deduped),
    intent: s(out?.json?.intent || ""),
    leadScore: Number(out?.json?.leadScore || 0),
    actionsCount: Array.isArray(out?.json?.actions) ? out.json.actions.length : 0,
    threadId: s(out?.json?.thread?.id || ""),
    tenantKey: resolvedTenantKey,
    preview: safeJsonPreview(out?.json),
  });

  if (!out.ok) {
    logger.warn("meta.webhook.text.forward_failed", {
      channel: s(ev?.channel || ""),
      userId: s(ev?.userId || ""),
      externalMessageId: s(ev?.messageId || ev?.mid || ""),
      error: s(out?.error || ""),
      status: Number(out?.status || 0),
      tenantKey: resolvedTenantKey,
    });
    return;
  }

  const actions = Array.isArray(out?.json?.actions) ? out.json.actions : [];

  if (!actions.length) {
    logger.info("meta.webhook.text.no_actions", {
      duplicate: Boolean(out?.json?.duplicate),
      deduped: Boolean(out?.json?.deduped),
      intent: s(out?.json?.intent || ""),
      threadId: s(out?.json?.thread?.id || ""),
      tenantKey: resolvedTenantKey,
    });
    return;
  }

  const exec = await executeMetaActions(actions, {
    channel: s(ev?.channel || "instagram").toLowerCase() || "instagram",
    userId: s(ev?.userId || ""),
    recipientId: s(ev?.userId || ""),
    tenantKey: resolvedTenantKey,
    threadId: s(out?.json?.thread?.id || ""),
    pageId: s(ev?.pageId || ""),
    igUserId: s(ev?.igUserId || ""),
    meta: {
      pageId: s(ev?.pageId || ""),
      igUserId: s(ev?.igUserId || ""),
    },
  });

  logger.info("meta.webhook.text.actions_executed", {
    tenantKey: resolvedTenantKey,
    ...summarizeExec(exec),
  });
}

async function handleSupportedCommentEvent(ev, rawBody) {
  const tenantCtx = await resolveTenantForEvent(ev);

  if (!tenantCtx.ok) {
    logger.warn("meta.webhook.comment.tenant_resolution_failed", {
      ...summarizeInbound(ev),
      error: tenantCtx.error,
    });
    return;
  }

  const payload = buildAihqCommentPayload(ev, rawBody, tenantCtx);

  logger.info("meta.webhook.comment.received", {
    ...summarizeInbound(ev),
    tenantKey: tenantCtx.tenantKey,
  });

  const out = await forwardCommentToAiHq(payload);
  const resolvedTenantKey = pickResolvedTenantKey(out, tenantCtx);

  logger.info("meta.webhook.comment.forwarded", {
    ok: out.ok,
    status: out.status,
    error: out.error,
    classification: s(out?.json?.classification?.category || ""),
    priority: s(out?.json?.classification?.priority || ""),
    requiresHuman: Boolean(out?.json?.classification?.requiresHuman),
    shouldCreateLead: Boolean(out?.json?.classification?.shouldCreateLead),
    commentId: s(out?.json?.comment?.id || ""),
    tenantKey: resolvedTenantKey,
    preview: safeJsonPreview(out?.json),
  });

  if (!out.ok) {
    logger.warn("meta.webhook.comment.forward_failed", {
      channel: s(ev?.channel || ""),
      userId: s(ev?.userId || ""),
      externalCommentId: s(ev?.externalCommentId || ""),
      error: s(out?.error || ""),
      status: Number(out?.status || 0),
      tenantKey: resolvedTenantKey,
    });
    return;
  }

  const actions = Array.isArray(out?.json?.actions) ? out.json.actions : [];

  if (!actions.length) {
    logger.info("meta.webhook.comment.no_actions", {
      classification: s(out?.json?.classification?.category || ""),
      commentId: s(out?.json?.comment?.id || ""),
      tenantKey: resolvedTenantKey,
    });
    return;
  }

  const exec = await executeMetaActions(actions, {
    channel: s(ev?.channel || "instagram").toLowerCase() || "instagram",
    userId: s(ev?.userId || ""),
    recipientId: s(ev?.userId || ""),
    tenantKey: resolvedTenantKey,
    threadId: s(out?.json?.thread?.id || ""),
    externalCommentId: s(ev?.externalCommentId || ""),
    externalPostId: s(ev?.externalPostId || ""),
    pageId: s(ev?.pageId || ""),
    igUserId: s(ev?.igUserId || ""),
    meta: {
      pageId: s(ev?.pageId || ""),
      igUserId: s(ev?.igUserId || ""),
      externalCommentId: s(ev?.externalCommentId || ""),
      externalPostId: s(ev?.externalPostId || ""),
    },
  });

  logger.info("meta.webhook.comment.actions_executed", {
    tenantKey: resolvedTenantKey,
    ...summarizeExec(exec),
  });
}

export function registerWebhookRoutes(app) {
  app.get("/webhook", (req, res) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      logger.info("meta.webhook.challenge.verified");
      return res.status(200).send(String(challenge || ""));
    }

    return res.sendStatus(403);
  });

  app.post("/webhook", async (req, res) => {
    const verified = verifyMetaWebhookSignature(req);
    if (!verified.ok) {
      return res.status(verified.status || 403).json({
        ok: false,
        error: verified.error,
      });
    }

    res.sendStatus(200);

    try {
      const events = extractMetaEvents(req.body);

      if (!events.length) {
        logger.info("meta.webhook.ignored.empty");
        return;
      }

      for (const ev of events) {
        const supported = Boolean(ev?.supported);
        const ignored = Boolean(ev?.ignored);
        const userId = s(ev?.userId || "");
        const text = s(ev?.text || "");
        const eventType = s(ev?.eventType || "unknown");

        const dedupe = markInboundEventProcessed(ev);
        if (dedupe.duplicate) {
          logger.info("meta.webhook.duplicate_suppressed", {
            dedupeKey: dedupe.key,
            ...summarizeInbound(ev),
          });
          continue;
        }

        if (ignored || !supported) {
          logger.info("meta.webhook.ignored.event", {
            eventType,
            channel: s(ev?.channel || "unknown"),
            userId,
            reason: s(ev?.ignoreReason || "unsupported"),
            dedupeKey: dedupe.key,
          });
          continue;
        }

        if (eventType === "text") {
          if (!userId) {
            logger.warn("meta.webhook.text.ignored_missing_user", {
              ...summarizeInbound(ev),
              dedupeKey: dedupe.key,
            });
            continue;
          }

          if (!text) {
            logger.info("meta.webhook.text.ignored_empty", {
              ...summarizeInbound(ev),
              dedupeKey: dedupe.key,
            });
            continue;
          }

          await handleSupportedTextEvent(ev, req.body);
          continue;
        }

        if (eventType === "comment") {
          if (!s(ev?.externalCommentId || "")) {
            logger.warn("meta.webhook.comment.ignored_missing_comment_id", {
              ...summarizeInbound(ev),
              dedupeKey: dedupe.key,
            });
            continue;
          }

          if (!text) {
            logger.info("meta.webhook.comment.ignored_empty", {
              ...summarizeInbound(ev),
              dedupeKey: dedupe.key,
            });
            continue;
          }

          await handleSupportedCommentEvent(ev, req.body);
          continue;
        }

        logger.info("meta.webhook.ignored.supported_non_handled", {
          eventType,
          channel: s(ev?.channel || "unknown"),
          userId,
          dedupeKey: dedupe.key,
        });
      }
    } catch (err) {
      logger.error("meta.webhook.processing_failed", err, {
        message: s(err?.message || err),
      });
    }
  });
}
