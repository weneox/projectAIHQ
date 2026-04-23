import crypto from "crypto";
import { createStructuredLogger } from "@aihq/shared-contracts/logger";
import { VERIFY_TOKEN, getMetaWebhookSecretConfig } from "../config.js";
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

function normalizeUrlLike(value = "") {
  const next = s(value);
  if (!next) return "";
  if (
    next.startsWith("https://") ||
    next.startsWith("http://") ||
    next.startsWith("/")
  ) {
    return next;
  }
  return "";
}

function pickFirstUrl(...values) {
  for (const value of values) {
    const next = normalizeUrlLike(value);
    if (next) return next;
  }
  return "";
}

function buildAvatarPayloadFromEvent(ev = {}) {
  const raw = normalizeObj(ev?.raw);
  const value = normalizeObj(raw?.value);
  const from = normalizeObj(raw?.from);
  const sender = normalizeObj(raw?.sender);
  const recipient = normalizeObj(raw?.recipient);
  const profile = normalizeObj(raw?.profile);
  const user = normalizeObj(raw?.user);
  const contact = normalizeObj(raw?.contact);
  const senderProfile = normalizeObj(raw?.sender_profile);
  const userProfile = normalizeObj(raw?.user_profile);

  const valueFrom = normalizeObj(value?.from);
  const valueSender = normalizeObj(value?.sender);
  const valueRecipient = normalizeObj(value?.recipient);
  const valueProfile = normalizeObj(value?.profile);
  const valueContact = normalizeObj(value?.contact);
  const valueComment = normalizeObj(value?.comment);
  const commentFrom = normalizeObj(valueComment?.from);

  const avatarUrl = pickFirstUrl(
    ev?.avatar_url,
    ev?.avatarUrl,
    ev?.profile_picture_url,
    ev?.profilePictureUrl,
    ev?.profile_pic,
    ev?.profilePic,
    ev?.picture,

    raw?.avatar_url,
    raw?.avatarUrl,
    raw?.profile_picture_url,
    raw?.profilePictureUrl,
    raw?.profile_pic,
    raw?.profilePic,
    raw?.picture,

    from?.avatar_url,
    from?.avatarUrl,
    from?.profile_picture_url,
    from?.profilePictureUrl,
    from?.profile_pic,
    from?.profilePic,
    from?.picture,

    sender?.avatar_url,
    sender?.avatarUrl,
    sender?.profile_picture_url,
    sender?.profilePictureUrl,
    sender?.profile_pic,
    sender?.profilePic,
    sender?.picture,

    recipient?.avatar_url,
    recipient?.avatarUrl,
    recipient?.profile_picture_url,
    recipient?.profilePictureUrl,
    recipient?.profile_pic,
    recipient?.profilePic,
    recipient?.picture,

    profile?.avatar_url,
    profile?.avatarUrl,
    profile?.profile_picture_url,
    profile?.profilePictureUrl,
    profile?.profile_pic,
    profile?.profilePic,
    profile?.picture,

    user?.avatar_url,
    user?.avatarUrl,
    user?.profile_picture_url,
    user?.profilePictureUrl,
    user?.profile_pic,
    user?.profilePic,
    user?.picture,

    contact?.avatar_url,
    contact?.avatarUrl,
    contact?.profile_picture_url,
    contact?.profilePictureUrl,
    contact?.profile_pic,
    contact?.profilePic,
    contact?.picture,

    senderProfile?.avatar_url,
    senderProfile?.avatarUrl,
    senderProfile?.profile_picture_url,
    senderProfile?.profilePictureUrl,
    senderProfile?.profile_pic,
    senderProfile?.profilePic,
    senderProfile?.picture,

    userProfile?.avatar_url,
    userProfile?.avatarUrl,
    userProfile?.profile_picture_url,
    userProfile?.profilePictureUrl,
    userProfile?.profile_pic,
    userProfile?.profilePic,
    userProfile?.picture,

    value?.avatar_url,
    value?.avatarUrl,
    value?.profile_picture_url,
    value?.profilePictureUrl,
    value?.profile_pic,
    value?.profilePic,
    value?.picture,

    valueFrom?.avatar_url,
    valueFrom?.avatarUrl,
    valueFrom?.profile_picture_url,
    valueFrom?.profilePictureUrl,
    valueFrom?.profile_pic,
    valueFrom?.profilePic,
    valueFrom?.picture,

    valueSender?.avatar_url,
    valueSender?.avatarUrl,
    valueSender?.profile_picture_url,
    valueSender?.profilePictureUrl,
    valueSender?.profile_pic,
    valueSender?.profilePic,
    valueSender?.picture,

    valueRecipient?.avatar_url,
    valueRecipient?.avatarUrl,
    valueRecipient?.profile_picture_url,
    valueRecipient?.profilePictureUrl,
    valueRecipient?.profile_pic,
    valueRecipient?.profilePic,
    valueRecipient?.picture,

    valueProfile?.avatar_url,
    valueProfile?.avatarUrl,
    valueProfile?.profile_picture_url,
    valueProfile?.profilePictureUrl,
    valueProfile?.profile_pic,
    valueProfile?.profilePic,
    valueProfile?.picture,

    valueContact?.avatar_url,
    valueContact?.avatarUrl,
    valueContact?.profile_picture_url,
    valueContact?.profilePictureUrl,
    valueContact?.profile_pic,
    valueContact?.profilePic,
    valueContact?.picture,

    valueComment?.avatar_url,
    valueComment?.avatarUrl,
    valueComment?.profile_picture_url,
    valueComment?.profilePictureUrl,
    valueComment?.profile_pic,
    valueComment?.profilePic,
    valueComment?.picture,

    commentFrom?.avatar_url,
    commentFrom?.avatarUrl,
    commentFrom?.profile_picture_url,
    commentFrom?.profilePictureUrl,
    commentFrom?.profile_pic,
    commentFrom?.profilePic,
    commentFrom?.picture
  );

  return {
    avatarUrl,
    profilePictureUrl: avatarUrl,
  };
}

const logger = createStructuredLogger({
  service: "meta-bot-backend",
  component: "webhook",
});
const META_SIGNATURE_HEADER_CANDIDATES = Object.freeze([
  {
    name: "x-hub-signature-256",
    algorithm: "sha256",
  },
  {
    name: "x-hub-signature",
    algorithm: "sha1",
  },
]);

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

function fingerprintSecret(secret = "") {
  const safeSecret = s(secret);
  return safeSecret
    ? crypto.createHash("sha256").update(safeSecret).digest("hex").slice(0, 12)
    : "";
}

function readHeader(req, name = "") {
  const safeName = s(name).toLowerCase();
  if (!safeName) return "";

  const direct = req?.headers?.[safeName];
  if (Array.isArray(direct)) {
    return s(direct[0]);
  }
  if (direct != null) {
    return s(direct);
  }
  if (typeof req?.get === "function") {
    return s(req.get(safeName));
  }
  return "";
}

function pickMetaSignatureHeader(req) {
  for (const candidate of META_SIGNATURE_HEADER_CANDIDATES) {
    const value = readHeader(req, candidate.name);
    if (value) {
      return {
        headerName: candidate.name,
        headerValue: value,
        expectedAlgorithm: candidate.algorithm,
      };
    }
  }

  return {
    headerName: "",
    headerValue: "",
    expectedAlgorithm: "",
  };
}

function parseMetaSignatureHeader(signature = "", expectedAlgorithm = "") {
  const normalized = s(signature).toLowerCase();
  if (!normalized) {
    return {
      ok: false,
      reason: "missing_meta_signature",
      algorithm: "",
      normalized: "",
    };
  }

  const match = /^([a-z0-9_-]+)=([0-9a-f]+)$/i.exec(normalized);
  if (!match) {
    return {
      ok: false,
      reason: "malformed_meta_signature",
      algorithm: "",
      normalized,
    };
  }

  const algorithm = s(match[1]).toLowerCase();
  const digest = s(match[2]).toLowerCase();
  if (expectedAlgorithm && algorithm !== expectedAlgorithm) {
    return {
      ok: false,
      reason: "malformed_meta_signature",
      algorithm,
      normalized: `${algorithm}=${digest}`,
    };
  }

  const expectedDigestLength =
    algorithm === "sha256" ? 64 : algorithm === "sha1" ? 40 : 0;
  if (!expectedDigestLength) {
    return {
      ok: false,
      reason: "unsupported_meta_signature_algorithm",
      algorithm,
      normalized: `${algorithm}=${digest}`,
    };
  }

  if (digest.length !== expectedDigestLength) {
    return {
      ok: false,
      reason: "malformed_meta_signature",
      algorithm,
      normalized: `${algorithm}=${digest}`,
    };
  }

  return {
    ok: true,
    reason: "",
    algorithm,
    normalized: `${algorithm}=${digest}`,
  };
}

function computeMetaSignature(rawBody, secret, algorithm = "sha256") {
  const safeSecret = s(secret);
  if (!safeSecret || !Buffer.isBuffer(rawBody)) return "";
  if (!["sha256", "sha1"].includes(s(algorithm).toLowerCase())) return "";

  return `${algorithm}=${crypto
    .createHmac(algorithm, safeSecret)
    .update(rawBody)
    .digest("hex")}`.toLowerCase();
}

function readRawBodyBuffer(req) {
  if (Buffer.isBuffer(req?.rawBody)) {
    return {
      rawBody: req.rawBody,
      source: "req.rawBody",
    };
  }
  if (req?.rawBody instanceof Uint8Array) {
    return {
      rawBody: Buffer.from(req.rawBody),
      source: "req.rawBody_uint8array",
    };
  }
  if (Buffer.isBuffer(req?.body)) {
    return {
      rawBody: req.body,
      source: "req.body_buffer",
    };
  }
  if (req?.body instanceof Uint8Array) {
    return {
      rawBody: Buffer.from(req.body),
      source: "req.body_uint8array",
    };
  }

  return {
    rawBody: null,
    source: "",
  };
}

function computeParsedBodyMatch(rawBody, parsedBody) {
  if (!Buffer.isBuffer(rawBody)) return null;
  if (parsedBody === undefined) return null;

  let parsedBodyBuffer = null;
  if (Buffer.isBuffer(parsedBody)) {
    parsedBodyBuffer = parsedBody;
  } else if (parsedBody instanceof Uint8Array) {
    parsedBodyBuffer = Buffer.from(parsedBody);
  } else {
    try {
      parsedBodyBuffer = Buffer.from(JSON.stringify(parsedBody), "utf8");
    } catch {
      parsedBodyBuffer = null;
    }
  }

  return Buffer.isBuffer(parsedBodyBuffer) ? rawBody.equals(parsedBodyBuffer) : null;
}

function buildVerificationDebugFields({
  req,
  signatureHeaderName = "",
  receivedSignature = "",
  computedSignature = "",
  signatureAlgorithm = "",
  secret = "",
  secretSource = "",
  rawBody = null,
  rawBodySource = "",
  reason = "",
} = {}) {
  const safeSecret = s(secret);
  const safeReason = s(reason);
  return {
    requestId: s(req?.requestId),
    correlationId: s(req?.correlationId),
    hasMetaAppSecret: Boolean(safeSecret),
    hasAppSecret: Boolean(safeSecret),
    metaAppSecretFingerprint: fingerprintSecret(safeSecret),
    secretFingerprint: fingerprintSecret(safeSecret),
    secretSource: s(secretSource),
    receivedSignatureHeaderName: s(signatureHeaderName),
    signatureHeaderName: s(signatureHeaderName),
    receivedSignaturePresent: Boolean(s(receivedSignature)),
    receivedSignatureAlgorithm: s(signatureAlgorithm),
    rawBodyPresent: Buffer.isBuffer(rawBody),
    rawBodyByteLength: Buffer.isBuffer(rawBody) ? rawBody.length : 0,
    rawBodyLength: Buffer.isBuffer(rawBody) ? rawBody.length : 0,
    verificationBodySource: s(rawBodySource),
    parsedBodyPresent: req?.body !== undefined,
    parsedBodyMatchesRawBody: computeParsedBodyMatch(rawBody, req?.body),
    contentType: s(req?.headers?.["content-type"]),
    receivedSignaturePrefix: s(receivedSignature).slice(0, 20),
    computedSignaturePrefix: s(computedSignature).slice(0, 20),
    verificationOutcome: safeReason === "accepted" ? "accepted" : "rejected",
    rejectReason: safeReason === "accepted" ? "" : safeReason,
  };
}

function buildWebhookTraceFields(
  ev = {},
  requestContext = {},
  { tenantKey = "", dedupeKey = "" } = {}
) {
  return {
    tenantKey: s(tenantKey),
    channel: s(ev?.channel || "").toLowerCase(),
    pageId: s(ev?.pageId || ""),
    igUserId: s(ev?.igUserId || ""),
    userId: s(ev?.userId || ""),
    externalThreadId: s(ev?.externalThreadId || ev?.userId || ""),
    externalMessageId: s(ev?.messageId || ev?.mid || ""),
    externalCommentId: s(ev?.externalCommentId || ""),
    eventType: s(ev?.eventType || ""),
    dedupeKey: s(dedupeKey),
    requestId: s(requestContext?.requestId),
    correlationId: s(requestContext?.correlationId),
  };
}

export function verifyMetaWebhookSignature(req) {
  const secretConfig = getMetaWebhookSecretConfig();
  const secret = s(secretConfig.resolvedSecret);
  if (secretConfig.mismatch) {
    recordWebhookVerificationFailure("secret_env_mismatch");
    logger.error(
      "meta.webhook.verify.rejected",
      null,
      buildVerificationDebugFields({
        req,
        secret,
        secretSource: secretConfig.resolvedSource,
        reason: "secret_env_mismatch",
      })
    );
    return {
      ok: false,
      status: 500,
      error: "webhook_auth_misconfigured",
    };
  }

  if (!secret) {
    recordWebhookVerificationFailure("missing_webhook_secret");
    logger.error(
      "meta.webhook.verify.rejected",
      null,
      buildVerificationDebugFields({
        req,
        secret,
        secretSource: secretConfig.resolvedSource,
        reason: "missing_webhook_secret",
      })
    );
    return {
      ok: false,
      status: 500,
      error: "webhook_auth_misconfigured",
    };
  }

  const { headerName, headerValue, expectedAlgorithm } =
    pickMetaSignatureHeader(req);
  const { rawBody, source: rawBodySource } = readRawBodyBuffer(req);
  if (!headerValue) {
    recordWebhookVerificationFailure("missing_meta_signature");
    logger.warn("meta.webhook.verify.rejected", {
      ...buildVerificationDebugFields({
        req,
        signatureHeaderName: headerName,
        secret,
        secretSource: secretConfig.resolvedSource,
        rawBody,
        rawBodySource,
        reason: "missing_meta_signature",
      }),
    });
    return {
      ok: false,
      status: 403,
      error: "missing_meta_signature",
    };
  }

  const parsedSignature = parseMetaSignatureHeader(headerValue, expectedAlgorithm);
  if (!parsedSignature.ok) {
    recordWebhookVerificationFailure(parsedSignature.reason);
    logger.warn("meta.webhook.verify.rejected", {
      ...buildVerificationDebugFields({
        req,
        signatureHeaderName: headerName,
        receivedSignature: headerValue,
        signatureAlgorithm: parsedSignature.algorithm || expectedAlgorithm,
        secret,
        secretSource: secretConfig.resolvedSource,
        rawBody,
        rawBodySource,
        reason: parsedSignature.reason,
      }),
    });
    return {
      ok: false,
      status: 403,
      error: parsedSignature.reason,
    };
  }

  if (!rawBody) {
    recordWebhookVerificationFailure("missing_raw_body");
    logger.warn("meta.webhook.verify.rejected", {
      ...buildVerificationDebugFields({
        req,
        signatureHeaderName: headerName,
        receivedSignature: parsedSignature.normalized,
        signatureAlgorithm: parsedSignature.algorithm,
        secret,
        secretSource: secretConfig.resolvedSource,
        rawBodySource,
        reason: "missing_raw_body",
      }),
    });
    return {
      ok: false,
      status: 500,
      error: "missing_raw_body",
    };
  }
  const expected = computeMetaSignature(
    rawBody,
    secret,
    parsedSignature.algorithm
  );

  if (!safeEqHex(parsedSignature.normalized, expected)) {
    recordWebhookVerificationFailure("invalid_meta_signature");
    logger.warn("meta.webhook.verify.rejected", {
      ...buildVerificationDebugFields({
        req,
        signatureHeaderName: headerName,
        receivedSignature: parsedSignature.normalized,
        computedSignature: expected,
        signatureAlgorithm: parsedSignature.algorithm,
        secret,
        secretSource: secretConfig.resolvedSource,
        rawBody,
        rawBodySource,
        reason: "invalid_meta_signature",
      }),
    });
    return {
      ok: false,
      status: 403,
      error: "invalid_meta_signature",
    };
  }

  logger.info(
    "meta.webhook.verify.accepted",
    buildVerificationDebugFields({
      req,
      signatureHeaderName: headerName,
      receivedSignature: parsedSignature.normalized,
      computedSignature: expected,
      signatureAlgorithm: parsedSignature.algorithm,
      secret,
      secretSource: secretConfig.resolvedSource,
      rawBody,
      rawBodySource,
      reason: "accepted",
    })
  );
  return { ok: true };
}

function buildCustomerContextFromEvent(ev) {
  const channel = s(ev?.channel || "instagram").toLowerCase() || "instagram";
  const avatar = buildAvatarPayloadFromEvent(ev);

  const sharedIdentity = {
    fullName: s(ev?.customerName || ""),
    username: s(ev?.username || ""),
    externalUserId: s(ev?.userId || ""),
    channel,
    pageId: s(ev?.pageId || ""),
    igUserId: s(ev?.igUserId || ""),
    avatar_url: s(avatar.avatarUrl || ""),
    avatarUrl: s(avatar.avatarUrl || ""),
    profile_picture_url: s(avatar.profilePictureUrl || ""),
    profilePictureUrl: s(avatar.profilePictureUrl || ""),
  };

  return {
    ...sharedIdentity,
    profile: {
      fullName: s(ev?.customerName || ""),
      username: s(ev?.username || ""),
      avatar_url: s(avatar.avatarUrl || ""),
      avatarUrl: s(avatar.avatarUrl || ""),
      profile_picture_url: s(avatar.profilePictureUrl || ""),
      profilePictureUrl: s(avatar.profilePictureUrl || ""),
    },
    meta: {
      pageId: s(ev?.pageId || ""),
      igUserId: s(ev?.igUserId || ""),
      avatar_url: s(avatar.avatarUrl || ""),
      avatarUrl: s(avatar.avatarUrl || ""),
      profile_picture_url: s(avatar.profilePictureUrl || ""),
      profilePictureUrl: s(avatar.profilePictureUrl || ""),
    },
    instagram:
      channel === "instagram" || channel === "facebook"
        ? {
            username: s(ev?.username || ""),
            fullName: s(ev?.customerName || ""),
            userId: s(ev?.userId || ""),
            pageId: s(ev?.pageId || ""),
            igUserId: s(ev?.igUserId || ""),
            avatar_url: s(avatar.avatarUrl || ""),
            avatarUrl: s(avatar.avatarUrl || ""),
            profile_picture_url: s(avatar.profilePictureUrl || ""),
            profilePictureUrl: s(avatar.profilePictureUrl || ""),
          }
        : {},
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
  const projectedRuntime = normalizeObj(tenantCtx?.projectedRuntime);
  const projectedTenant = normalizeObj(projectedRuntime?.tenant);
  const projectedProfile = normalizeObj(projectedTenant?.profile);
  const projectedVoice = normalizeObj(
    normalizeObj(projectedRuntime?.channels).voice
  );
  const channelConfig = normalizeObj(tenantCtx?.channelConfig);

  return {
    tenantKey: s(projectedTenant?.tenantKey || tenantCtx?.tenantKey || ""),
    companyName: s(
      projectedTenant?.companyName ||
        projectedTenant?.displayName ||
        tenantCtx?.tenantKey ||
        ""
    ),
    industryKey: s(projectedTenant?.industryKey || "generic_business"),
    defaultLanguage: s(projectedTenant?.mainLanguage || "az"),
    enabledLanguages: Array.isArray(projectedTenant?.supportedLanguages)
      ? projectedTenant.supportedLanguages
      : [],
    tone: s(
      projectedVoice?.profile?.tone ||
        projectedProfile?.toneProfile ||
        "professional, concise, premium"
    ),
    services: Array.isArray(projectedTenant?.services)
      ? projectedTenant.services
          .map((item) => s(item?.title || item?.serviceKey || ""))
          .filter(Boolean)
      : [],
    aiPolicy: {},
    channelConfig,
    projectedRuntime,
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
  const avatarUrl = s(
    customerContext?.avatar_url ||
      customerContext?.profile_picture_url ||
      customerContext?.instagram?.avatar_url ||
      customerContext?.instagram?.profile_picture_url ||
      ""
  );

  return {
    tenantKey: s(tenantCtx?.tenantKey || ""),
    source: "meta",
    platform: channel,
    channel,
    userId: externalUserId,
    externalUserId,
    externalThreadId,
    externalMessageId,
    externalUsername: s(ev?.username || customerContext?.username || ""),
    customerName: s(ev?.customerName || customerContext?.fullName || ""),
    text,
    timestamp: Number(ev?.timestamp || Date.now()),
    raw: rawBody,
    customerContext,
    formData: {},
    leadContext: {},
    conversationContext,
    tenantContext,
    meta: {
      source: "meta",
      provider: "meta",
      platform: channel,
      channel,
      recipientId: s(ev?.recipientId || ""),
      pageId: s(ev?.pageId || ""),
      igUserId: s(ev?.igUserId || ""),
      externalAccountId: s(ev?.externalAccountId || ""),
      externalThreadId,
      externalMessageId,
      avatar_url: avatarUrl,
      avatarUrl: avatarUrl,
      profile_picture_url: avatarUrl,
      profilePictureUrl: avatarUrl,
    },
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
  const avatarUrl = s(
    customerContext?.avatar_url ||
      customerContext?.profile_picture_url ||
      customerContext?.instagram?.avatar_url ||
      customerContext?.instagram?.profile_picture_url ||
      ""
  );

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
    externalUsername: s(ev?.username || customerContext?.username || ""),
    customerName: s(ev?.customerName || customerContext?.fullName || ""),

    text: s(ev?.text || ""),
    timestamp: Number(ev?.timestamp || Date.now()),
    raw: rawBody,

    customerContext,
    formData: {},
    leadContext: {},
    conversationContext,
    tenantContext,

    meta: {
      source: "meta",
      provider: "meta",
      platform: channel,
      channel,
      recipientId: s(ev?.recipientId || ""),
      pageId: s(ev?.pageId || ""),
      igUserId: s(ev?.igUserId || ""),
      avatar_url: avatarUrl,
      avatarUrl: avatarUrl,
      profile_picture_url: avatarUrl,
      profilePictureUrl: avatarUrl,
    },

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

async function resolveTenantForEvent(ev, requestContext = {}, requestLogger = null) {
  const out = await resolveTenantContextFromMetaEvent({
    channel: s(ev?.channel || "instagram").toLowerCase() || "instagram",
    recipientId: s(ev?.recipientId || ""),
    pageId: s(ev?.pageId || ""),
    igUserId: s(ev?.igUserId || ""),
    requestContext,
    logger: requestLogger,
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
    projectedRuntime: out.projectedRuntime || null,
  };
}

function pickResolvedTenantKey(aihqResponse, tenantCtx) {
  return s(aihqResponse?.json?.tenant?.tenant_key || tenantCtx?.tenantKey || "");
}

async function handleSupportedTextEvent(ev, rawBody, requestContext = {}) {
  const requestLogger = logger.child({
    requestId: s(requestContext?.requestId),
    correlationId: s(requestContext?.correlationId),
  });
  const tenantCtx = await resolveTenantForEvent(ev, requestContext, requestLogger);

  if (!tenantCtx.ok) {
    requestLogger.warn("meta.webhook.text.tenant_resolution_failed", {
      ...summarizeInbound(ev),
      error: tenantCtx.error,
    });
    return;
  }

  const payload = buildAihqInboxPayload(ev, rawBody, tenantCtx);
  const baseTrace = buildWebhookTraceFields(ev, requestContext, {
    tenantKey: tenantCtx.tenantKey,
    dedupeKey: requestContext?.dedupeKey,
  });

  requestLogger.info("meta.webhook.text.received", {
    ...summarizeInbound(ev),
    tenantKey: tenantCtx.tenantKey,
  });

  requestLogger.info("meta.webhook.forward.started", baseTrace);
  const out = await forwardToAiHq(payload, requestContext);
  const resolvedTenantKey = pickResolvedTenantKey(out, tenantCtx);

  requestLogger.info("meta.webhook.text.forwarded", {
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
    requestLogger.warn("meta.webhook.forward.failed", {
      ...baseTrace,
      tenantKey: resolvedTenantKey,
      status: Number(out?.status || 0),
      error: s(out?.error || ""),
    });
    requestLogger.warn("meta.webhook.text.forward_failed", {
      channel: s(ev?.channel || ""),
      userId: s(ev?.userId || ""),
      externalMessageId: s(ev?.messageId || ev?.mid || ""),
      error: s(out?.error || ""),
      status: Number(out?.status || 0),
      tenantKey: resolvedTenantKey,
    });
    return;
  }

  requestLogger.info("meta.webhook.forward.succeeded", {
    ...baseTrace,
    tenantKey: resolvedTenantKey,
    status: Number(out?.status || 0),
  });

  const actions = Array.isArray(out?.json?.actions) ? out.json.actions : [];

  if (!actions.length) {
    requestLogger.info("meta.webhook.text.no_actions", {
      duplicate: Boolean(out?.json?.duplicate),
      deduped: Boolean(out?.json?.deduped),
      intent: s(out?.json?.intent || ""),
      threadId: s(out?.json?.thread?.id || ""),
      tenantKey: resolvedTenantKey,
    });
    return;
  }

  requestLogger.info("meta.webhook.actions.started", {
    ...baseTrace,
    tenantKey: resolvedTenantKey,
    actionsCount: actions.length,
  });
  let exec = null;
  try {
    exec = await executeMetaActions(actions, {
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
  } catch (error) {
    requestLogger.error("meta.webhook.actions.failed", error, {
      ...baseTrace,
      tenantKey: resolvedTenantKey,
      actionsCount: actions.length,
    });
    throw error;
  }

  const execSummary = summarizeExec(exec);
  if (exec?.ok) {
    requestLogger.info("meta.webhook.actions.succeeded", {
      ...baseTrace,
      tenantKey: resolvedTenantKey,
      actionsCount: actions.length,
      ...execSummary,
    });
  } else {
    requestLogger.warn("meta.webhook.actions.failed", {
      ...baseTrace,
      tenantKey: resolvedTenantKey,
      actionsCount: actions.length,
      ...execSummary,
    });
  }

  requestLogger.info("meta.webhook.text.actions_executed", {
    tenantKey: resolvedTenantKey,
    ...execSummary,
  });
}

async function handleSupportedCommentEvent(ev, rawBody, requestContext = {}) {
  const requestLogger = logger.child({
    requestId: s(requestContext?.requestId),
    correlationId: s(requestContext?.correlationId),
  });
  const tenantCtx = await resolveTenantForEvent(ev, requestContext, requestLogger);

  if (!tenantCtx.ok) {
    requestLogger.warn("meta.webhook.comment.tenant_resolution_failed", {
      ...summarizeInbound(ev),
      error: tenantCtx.error,
    });
    return;
  }

  const payload = buildAihqCommentPayload(ev, rawBody, tenantCtx);
  const baseTrace = buildWebhookTraceFields(ev, requestContext, {
    tenantKey: tenantCtx.tenantKey,
    dedupeKey: requestContext?.dedupeKey,
  });

  requestLogger.info("meta.webhook.comment.received", {
    ...summarizeInbound(ev),
    tenantKey: tenantCtx.tenantKey,
  });

  requestLogger.info("meta.webhook.forward.started", baseTrace);
  const out = await forwardCommentToAiHq(payload, requestContext);
  const resolvedTenantKey = pickResolvedTenantKey(out, tenantCtx);

  requestLogger.info("meta.webhook.comment.forwarded", {
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
    requestLogger.warn("meta.webhook.forward.failed", {
      ...baseTrace,
      tenantKey: resolvedTenantKey,
      status: Number(out?.status || 0),
      error: s(out?.error || ""),
    });
    requestLogger.warn("meta.webhook.comment.forward_failed", {
      channel: s(ev?.channel || ""),
      userId: s(ev?.userId || ""),
      externalCommentId: s(ev?.externalCommentId || ""),
      error: s(out?.error || ""),
      status: Number(out?.status || 0),
      tenantKey: resolvedTenantKey,
    });
    return;
  }

  requestLogger.info("meta.webhook.forward.succeeded", {
    ...baseTrace,
    tenantKey: resolvedTenantKey,
    status: Number(out?.status || 0),
  });

  const actions = Array.isArray(out?.json?.actions) ? out.json.actions : [];

  if (!actions.length) {
    requestLogger.info("meta.webhook.comment.no_actions", {
      classification: s(out?.json?.classification?.category || ""),
      commentId: s(out?.json?.comment?.id || ""),
      tenantKey: resolvedTenantKey,
    });
    return;
  }

  requestLogger.info("meta.webhook.actions.started", {
    ...baseTrace,
    tenantKey: resolvedTenantKey,
    actionsCount: actions.length,
  });
  let exec = null;
  try {
    exec = await executeMetaActions(actions, {
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
  } catch (error) {
    requestLogger.error("meta.webhook.actions.failed", error, {
      ...baseTrace,
      tenantKey: resolvedTenantKey,
      actionsCount: actions.length,
    });
    throw error;
  }

  const execSummary = summarizeExec(exec);
  if (exec?.ok) {
    requestLogger.info("meta.webhook.actions.succeeded", {
      ...baseTrace,
      tenantKey: resolvedTenantKey,
      actionsCount: actions.length,
      ...execSummary,
    });
  } else {
    requestLogger.warn("meta.webhook.actions.failed", {
      ...baseTrace,
      tenantKey: resolvedTenantKey,
      actionsCount: actions.length,
      ...execSummary,
    });
  }

  requestLogger.info("meta.webhook.comment.actions_executed", {
    tenantKey: resolvedTenantKey,
    ...execSummary,
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
    const requestContext = {
      requestId: s(req.requestId),
      correlationId: s(req.correlationId),
    };
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
        logger.info("meta.webhook.event.ignored", {
          ...buildWebhookTraceFields({}, requestContext),
          reason: "empty_event_batch",
        });
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
          logger.info("meta.webhook.event.ignored", {
            ...buildWebhookTraceFields(ev, requestContext, {
              dedupeKey: dedupe.key,
            }),
            reason: "duplicate_suppressed",
          });
          logger.info("meta.webhook.duplicate_suppressed", {
            dedupeKey: dedupe.key,
            ...summarizeInbound(ev),
          });
          continue;
        }

        if (ignored || !supported) {
          logger.info("meta.webhook.event.ignored", {
            ...buildWebhookTraceFields(ev, requestContext, {
              dedupeKey: dedupe.key,
            }),
            reason: s(ev?.ignoreReason || "unsupported"),
          });
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
            logger.warn("meta.webhook.event.ignored", {
              ...buildWebhookTraceFields(ev, requestContext, {
                dedupeKey: dedupe.key,
              }),
              reason: "missing_user_id",
            });
            logger.warn("meta.webhook.text.ignored_missing_user", {
              ...summarizeInbound(ev),
              dedupeKey: dedupe.key,
            });
            continue;
          }

          if (!text) {
            logger.info("meta.webhook.event.ignored", {
              ...buildWebhookTraceFields(ev, requestContext, {
                dedupeKey: dedupe.key,
              }),
              reason: "empty_text",
            });
            logger.info("meta.webhook.text.ignored_empty", {
              ...summarizeInbound(ev),
              dedupeKey: dedupe.key,
            });
            continue;
          }

          logger.info("meta.webhook.event.accepted", {
            ...buildWebhookTraceFields(ev, requestContext, {
              dedupeKey: dedupe.key,
            }),
          });
          await handleSupportedTextEvent(ev, req.body, {
            ...requestContext,
            dedupeKey: dedupe.key,
          });
          continue;
        }

        if (eventType === "comment") {
          if (!s(ev?.externalCommentId || "")) {
            logger.warn("meta.webhook.event.ignored", {
              ...buildWebhookTraceFields(ev, requestContext, {
                dedupeKey: dedupe.key,
              }),
              reason: "missing_comment_id",
            });
            logger.warn("meta.webhook.comment.ignored_missing_comment_id", {
              ...summarizeInbound(ev),
              dedupeKey: dedupe.key,
            });
            continue;
          }

          if (!text) {
            logger.info("meta.webhook.event.ignored", {
              ...buildWebhookTraceFields(ev, requestContext, {
                dedupeKey: dedupe.key,
              }),
              reason: "empty_comment_text",
            });
            logger.info("meta.webhook.comment.ignored_empty", {
              ...summarizeInbound(ev),
              dedupeKey: dedupe.key,
            });
            continue;
          }

          logger.info("meta.webhook.event.accepted", {
            ...buildWebhookTraceFields(ev, requestContext, {
              dedupeKey: dedupe.key,
            }),
          });
          await handleSupportedCommentEvent(ev, req.body, {
            ...requestContext,
            dedupeKey: dedupe.key,
          });
          continue;
        }

        logger.info("meta.webhook.event.ignored", {
          ...buildWebhookTraceFields(ev, requestContext, {
            dedupeKey: dedupe.key,
          }),
          reason: "supported_non_handled",
        });
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
        requestId: requestContext.requestId,
        correlationId: requestContext.correlationId,
      });
    }
  });
}
