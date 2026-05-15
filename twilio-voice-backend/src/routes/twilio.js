import express from "express";
import crypto from "crypto";
import twilio from "twilio";
import { cfg } from "../config.js";
import { resolveTenantFromRequest } from "../services/tenantResolver.js";
import { getTenantVoiceConfig } from "../services/tenantConfig.js";
import { createAihqVoiceClient } from "../services/aihqVoiceClient.js";
import {
  appendTwilioStreamToken,
  createTwilioStreamToken,
} from "../services/streamAuth.js";
import {
  createSimpleSayXml,
  createTransferResponseXml,
  createVoiceResponseXml,
  getBaseUrlFromReq,
  toWsUrl,
} from "../services/twiml.js";
import {
  getDepartmentEntry,
  getRequestedDepartment,
  resolveDepartmentForTransfer,
} from "../services/transferRouting.js";
import {
  getTwilioSignatureValidationResult,
  requireInternalToken,
  requireTwilioSignature,
} from "../services/routeAuth.js";
import {
  contactUnavailableReply,
  pickLang,
  makeI18n,
} from "../services/voice/i18n.js";
import {
  incrementRuntimeMetric,
  recordRuntimeSignal,
} from "../services/runtimeObservability.js";
import { createStructuredLogger } from "@aihq/shared-contracts/logger";

function s(v, d = "") {
  return String(v ?? d).trim();
}

function isObj(v) {
  return !!v && typeof v === "object" && !Array.isArray(v);
}



function buildConferenceName(tenantKey, callSid) {
  return `${s(tenantKey || "default")}:${s(callSid || "call")}`;
}

function buildRequestContext(req, fallback = "") {
  const requestId = s(req?.requestId || fallback || "voice-route");
  const correlationId = s(req?.correlationId || requestId);
  return {
    requestId,
    correlationId,
  };
}

async function syncWebhookAccepted({
  voiceClient,
  tenantConfig,
  req,
  from,
  to,
  logger,
}) {
  const providerCallSid = s(req?.body?.CallSid || req?.query?.CallSid);
  if (!voiceClient?.canUse?.() || !providerCallSid || !s(tenantConfig?.tenantKey)) return;

  const requestContext = buildRequestContext(req, providerCallSid);

  const result = await voiceClient.upsertSession(
    {
      tenantId: s(tenantConfig?.tenantId) || null,
      tenantKey: s(tenantConfig?.tenantKey),
      provider: "twilio",
      providerCallSid,
      providerStreamSid: null,
      conferenceName: buildConferenceName(tenantConfig?.tenantKey, providerCallSid),
      fromNumber: s(from) || null,
      toNumber: s(to) || null,
      customerNumber: s(from) || null,
      customerName: "",
      language: s(
        tenantConfig?.voiceProfile?.defaultLanguage || tenantConfig?.defaultLanguage,
        "en"
      ).toLowerCase(),
      agentMode: "assistant",
      direction: "inbound",
      callStatus: "queued",
      sessionDirection: "inbound",
      sessionStatus: "bot_silent",
      botActive: false,
      operatorJoinRequested: false,
      operatorJoined: false,
      whisperActive: false,
      takeoverActive: false,
      startedAt: new Date().toISOString(),
      metrics: {},
      sessionMeta: {
        lifecycleStage: "webhook_accepted",
      },
    },
    requestContext
  );

  if (!result?.ok) {
    logger.warn("voice.route.webhook_accept_sync_failed", {
      providerCallSid,
      tenantKey: s(tenantConfig?.tenantKey),
      error: s(result?.text || "voice_sync_request_failed"),
    });
  }
}


function writeStructuredRouteError(res, status, error, details = {}) {
  return res.status(status).json({
    ok: false,
    error: s(error || "voice_route_failed"),
    details: isObj(details) ? details : {},
  });
}

function detectPreferredLang(req, tenantConfig) {
  const explicit =
    s(req.body?.lang) ||
    s(req.query?.lang) ||
    s(req.body?.Language) ||
    s(req.query?.Language);

  if (explicit) {
    const dict = makeI18n(tenantConfig);
    return pickLang(explicit, dict);
  }

  return s(
    tenantConfig?.voiceProfile?.defaultLanguage || tenantConfig?.defaultLanguage,
    "en"
  ).toLowerCase();
}


function buildDepartmentTransferAck(lang, tenantConfig, departmentKey = "") {
  const dept = getDepartmentEntry(tenantConfig, departmentKey);
  const label = s(dept?.label || departmentKey || "operator");
  const L = s(lang, "en").toLowerCase();

  if (L === "ru") return `Хорошо, соединяю вас с отделом ${label}.`;
  if (L === "tr") return `Tamam, sizi ${label} bölümüne bağlıyorum.`;
  if (L === "en") return `Okay, I will connect you to the ${label} team.`;
  if (L === "es") return `De acuerdo, te conecto con el equipo de ${label}.`;
  if (L === "de") return `Okay, ich verbinde Sie mit dem ${label}-Team.`;
  if (L === "fr") return `D’accord, je vous mets en relation avec l’équipe ${label}.`;
  return `Yaxşı, sizi ${label} komandası ilə əlaqələndirirəm.`;
}

function buildFallbackUnavailableReply(lang) {
  const L = s(lang, "en").toLowerCase();

  if (L === "ru") return "Извините, сервис сейчас временно недоступен.";
  if (L === "tr") return "Üzgünüm, hizmet şu anda geçici olarak kullanılamıyor.";
  if (L === "en") return "Sorry, the service is temporarily unavailable right now.";
  if (L === "es") return "Lo siento, el servicio no está disponible temporalmente en este momento.";
  if (L === "de") return "Entschuldigung, der Dienst ist im Moment vorübergehend nicht verfügbar.";
  if (L === "fr") return "Désolé, le service est temporairement indisponible pour le moment.";
  return "Bağışlayın, xidmət hazırda müvəqqəti olaraq əlçatan deyil.";
}

const routeLogger = createStructuredLogger({
  service: "voice-gateway-backend",
  component: "twilio-routes",
});
const fallbackRateLimitBuckets = new Map();
const FALLBACK_RATE_LIMIT_WINDOW_MS = 60 * 1000;
const FALLBACK_RATE_LIMIT_MAX = 20;
const FALLBACK_RATE_LIMIT_MAX_BUCKETS = 2000;

function getFallbackRateLimitKey(req) {
  const forwardedFor = s(req?.headers?.["x-forwarded-for"])
    .split(",")[0]
    .trim();

  const ip = s(
    forwardedFor ||
      req?.ip ||
      req?.socket?.remoteAddress ||
      req?.connection?.remoteAddress ||
      "unknown"
  );

  const toNumber = s(req?.body?.To || req?.query?.To || req?.body?.Called || req?.query?.Called);
  return `${ip}:${toNumber || "unknown_to"}`;
}

function pruneFallbackRateLimitBuckets(now = Date.now()) {
  if (fallbackRateLimitBuckets.size <= FALLBACK_RATE_LIMIT_MAX_BUCKETS) return;

  for (const [key, bucket] of fallbackRateLimitBuckets.entries()) {
    if (!bucket || Number(bucket.resetAt || 0) <= now) {
      fallbackRateLimitBuckets.delete(key);
    }
  }

  if (fallbackRateLimitBuckets.size <= FALLBACK_RATE_LIMIT_MAX_BUCKETS) return;

  const overflow = fallbackRateLimitBuckets.size - FALLBACK_RATE_LIMIT_MAX_BUCKETS;
  let removed = 0;
  for (const key of fallbackRateLimitBuckets.keys()) {
    fallbackRateLimitBuckets.delete(key);
    removed += 1;
    if (removed >= overflow) break;
  }
}

function twilioVoiceFallbackRateLimit(req, res, next) {
  const now = Date.now();
  pruneFallbackRateLimitBuckets(now);

  const key = getFallbackRateLimitKey(req);
  const current = fallbackRateLimitBuckets.get(key);

  const bucket =
    current && Number(current.resetAt || 0) > now
      ? current
      : {
          count: 0,
          resetAt: now + FALLBACK_RATE_LIMIT_WINDOW_MS,
        };

  bucket.count += 1;
  fallbackRateLimitBuckets.set(key, bucket);

  if (bucket.count <= FALLBACK_RATE_LIMIT_MAX) return next();

  incrementRuntimeMetric("twilio_voice_fallback_rate_limited_total");
  recordRuntimeSignal({
    level: "warn",
    category: "voice_fallback",
    code: "voice_fallback_rate_limited",
    reasonCode: "rate_limited",
    status: 429,
  });

  return res
    .status(429)
    .type("text/xml")
    .send(createSimpleSayXml("The service is temporarily unavailable."));
}

export function twilioRouter({ voiceClient = null } = {}) {
  const r = express.Router();
  const aihqVoiceClient =
    voiceClient ||
    createAihqVoiceClient({
      fetchFn: globalThis.fetch,
      baseUrl: cfg.AIHQ_BASE_URL,
      internalToken: cfg.AIHQ_INTERNAL_TOKEN,
      timeoutMs: 1500,
    });

  r.options("/twilio/token", (_req, res) => res.sendStatus(204));

  r.get("/twilio/token", (_req, res) => {
    return res.status(405).json({
      ok: false,
      error: "method_not_allowed",
      message: "Use POST /twilio/token",
    });
  });

  r.post("/twilio/token", requireInternalToken, (req, res) => {
    if (
      !cfg.TWILIO_ACCOUNT_SID ||
      !cfg.TWILIO_API_KEY ||
      !cfg.TWILIO_API_SECRET ||
      !cfg.TWILIO_TWIML_APP_SID
    ) {
      return res.status(400).json({
        ok: false,
        error: "missing_twilio_env",
      });
    }

    const tenantKey = s(req.body?.tenantKey || req.query?.tenantKey).toLowerCase();
    if (!tenantKey) {
      return res.status(400).json({
        ok: false,
        error: "tenant_key_required",
      });
    }

    const AccessToken = twilio.jwt.AccessToken;
    const VoiceGrant = AccessToken.VoiceGrant;

    const identity =
      s(req.body?.identity || req.query?.identity) ||
      `browser-${Math.random().toString(16).slice(2)}-${Date.now().toString(36)}`;

    const token = new AccessToken(
      cfg.TWILIO_ACCOUNT_SID,
      cfg.TWILIO_API_KEY,
      cfg.TWILIO_API_SECRET,
      { identity, ttl: 3600 }
    );

    token.addGrant(
      new VoiceGrant({
        outgoingApplicationSid: cfg.TWILIO_TWIML_APP_SID,
        incomingAllow: true,
      })
    );

    return res.json({
      ok: true,
      token: token.toJwt(),
      identity,
      tenantKey,
    });
  });

  r.post("/twilio/voice", requireTwilioSignature, async (req, res) => {
    const logger = (req.log || routeLogger).child({ route: "twilio-voice" });
    try {
      const tenant = await resolveTenantFromRequest(req);
      if (!tenant?.ok) {
        logger.warn("voice.route.tenant_resolution_blocked", {
          error: s(tenant?.error || "tenant_resolution_required"),
          matchedBy: s(tenant?.matchedBy || ""),
          toNumber: s(tenant?.toNumber || ""),
        });
        recordRuntimeSignal({
          level: "warn",
          category: "voice_route",
          code: "voice_tenant_resolution_blocked",
          reasonCode: s(tenant?.error || "tenant_resolution_required"),
          status: 400,
          tenantKey: s(tenant?.tenantKey || ""),
        });
        return writeStructuredRouteError(
          res,
          400,
          tenant?.error || "tenant_resolution_required",
          {
            matchedBy: s(tenant?.matchedBy || ""),
          }
        );
      }
      const tenantConfigResult = await getTenantVoiceConfig({
        tenant,
        requestContext: {
          requestId: s(req.requestId),
          correlationId: s(req.correlationId),
        },
        logger,
      });
      if (
        !tenantConfigResult?.ok ||
        !s(tenantConfigResult?.config?.tenantKey) ||
        tenantConfigResult?.config?.authority?.available !== true
      ) {
        logger.warn("voice.route.tenant_config_unavailable", {
          tenantKey: s(tenant?.tenantKey || ""),
          toNumber: s(tenant?.toNumber || ""),
          error: s(tenantConfigResult?.error || "tenant_config_not_found"),
          authority: tenantConfigResult?.authority || null,
        });
        recordRuntimeSignal({
          level: "warn",
          category: "voice_route",
          code: "voice_tenant_config_unavailable",
          reasonCode: s(tenantConfigResult?.error || "tenant_config_not_found"),
          status: Number(tenantConfigResult?.status || 404),
          tenantKey: s(tenant?.tenantKey || ""),
        });
        return writeStructuredRouteError(
          res,
          Number(tenantConfigResult?.status || 404),
          tenantConfigResult?.error || "tenant_config_not_found",
          {
            tenantKey: s(tenant?.tenantKey || ""),
            toNumber: s(tenant?.toNumber || ""),
            authority: tenantConfigResult?.authority || null,
          }
        );
      }
      const tenantConfig = tenantConfigResult.config;

      const baseUrl = getBaseUrlFromReq(req);
      const wsUrl = `${toWsUrl(baseUrl)}/twilio/stream`;

      const from = s(req.body?.From || req.query?.From);
      const to = s(req.body?.To || req.query?.To || req.body?.Called || req.query?.Called);
      const tenantKey = s(tenantConfig?.tenantKey);
      const callSid = s(req.body?.CallSid || req.query?.CallSid);
      const streamToken = createTwilioStreamToken({
        tenantKey,
        from,
        to,
        callSid,
      });

      const xml = createVoiceResponseXml({
        wsUrl: appendTwilioStreamToken(wsUrl, streamToken),
        from,
        to,
        tenantKey,
        callSid,
      });

      void syncWebhookAccepted({
        voiceClient: aihqVoiceClient,
        tenantConfig,
        req,
        from,
        to,
        logger,
      });

      return res.type("text/xml").send(xml);
    } catch (err) {
      logger.error("voice.route.failed", err);
      recordRuntimeSignal({
        level: "error",
        category: "voice_route",
        code: "voice_route_failed",
        reasonCode: "voice_route_failed",
        status: 500,
        error: s(err?.message || err),
      });
      return res.status(500).json({
        ok: false,
        error: "voice_route_failed",
      });
    }
  });

  r.post("/twilio/transfer", requireTwilioSignature, async (req, res) => {
    const logger = (req.log || routeLogger).child({ route: "twilio-transfer" });
    try {
      const tenant = await resolveTenantFromRequest(req);
      if (!tenant?.ok) {
        logger.warn("voice.transfer.tenant_resolution_blocked", {
          error: s(tenant?.error || "tenant_resolution_required"),
          matchedBy: s(tenant?.matchedBy || ""),
          toNumber: s(tenant?.toNumber || ""),
        });
        recordRuntimeSignal({
          level: "warn",
          category: "voice_transfer",
          code: "transfer_tenant_resolution_blocked",
          reasonCode: s(tenant?.error || "tenant_resolution_required"),
          status: 400,
          tenantKey: s(tenant?.tenantKey || ""),
        });
        return writeStructuredRouteError(
          res,
          400,
          tenant?.error || "tenant_resolution_required",
          {
            matchedBy: s(tenant?.matchedBy || ""),
          }
        );
      }
      const tenantConfigResult = await getTenantVoiceConfig({
        tenant,
        requestContext: {
          requestId: s(req.requestId),
          correlationId: s(req.correlationId),
        },
        logger,
      });
      if (
        !tenantConfigResult?.ok ||
        !s(tenantConfigResult?.config?.tenantKey) ||
        tenantConfigResult?.config?.authority?.available !== true
      ) {
        logger.warn("voice.transfer.tenant_config_unavailable", {
          tenantKey: s(tenant?.tenantKey || ""),
          toNumber: s(tenant?.toNumber || ""),
          error: s(tenantConfigResult?.error || "tenant_config_not_found"),
          authority: tenantConfigResult?.authority || null,
        });
        recordRuntimeSignal({
          level: "warn",
          category: "voice_transfer",
          code: "transfer_tenant_config_unavailable",
          reasonCode: s(tenantConfigResult?.error || "tenant_config_not_found"),
          status: Number(tenantConfigResult?.status || 404),
          tenantKey: s(tenant?.tenantKey || ""),
        });
        return writeStructuredRouteError(
          res,
          Number(tenantConfigResult?.status || 404),
          tenantConfigResult?.error || "tenant_config_not_found",
          {
            tenantKey: s(tenant?.tenantKey || ""),
            toNumber: s(tenant?.toNumber || ""),
            authority: tenantConfigResult?.authority || null,
          }
        );
      }
      const tenantConfig = tenantConfigResult.config;
      const lang = detectPreferredLang(req, tenantConfig);

      const requestedDepartment = getRequestedDepartment(req);
      const resolvedDepartment = resolveDepartmentForTransfer(
        tenantConfig,
        requestedDepartment
      );

      const dept = getDepartmentEntry(tenantConfig, resolvedDepartment);

      const operatorPhone =
        s(dept?.phone) ||
        s(tenantConfig?.operator?.phone) ||
        s(cfg.OPERATOR_PHONE);

      const callerId =
        s(dept?.callerId) ||
        s(tenantConfig?.operator?.callerId) ||
        s(cfg.TWILIO_CALLER_ID);

      const transferText = buildDepartmentTransferAck(
        lang,
        tenantConfig,
        resolvedDepartment
      );

      const unavailableText = contactUnavailableReply(lang, tenantConfig);

      const xml = createTransferResponseXml({
        operatorPhone,
        callerId,
        transferText,
        unavailableText,
      });

      return res.type("text/xml").send(xml);
    } catch (err) {
      logger.error("voice.transfer.failed", err);
      recordRuntimeSignal({
        level: "error",
        category: "voice_transfer",
        code: "transfer_route_failed",
        reasonCode: "transfer_route_failed",
        status: 500,
        error: s(err?.message || err),
      });
      return res.status(500).json({
        ok: false,
        error: "transfer_route_failed",
      });
    }
  });

  r.post("/twilio/voice/fallback", requireTwilioSignature, twilioVoiceFallbackRateLimit, async (req, res) => {
    const logger = (req.log || routeLogger).child({ route: "twilio-voice-fallback" });
    try {
      const tenant = await resolveTenantFromRequest(req).catch(() => null);
      const tenantConfigResult = await getTenantVoiceConfig({
        tenant,
        requestContext: {
          requestId: s(req.requestId),
          correlationId: s(req.correlationId),
        },
        logger,
      }).catch(() => null);
      const tenantConfig = tenantConfigResult?.ok ? tenantConfigResult.config : null;
      const lang = detectPreferredLang(req, tenantConfig);
      const text = buildFallbackUnavailableReply(lang);

      return res.type("text/xml").send(createSimpleSayXml(text));
    } catch (err) {
      logger.error("voice.fallback.failed", err);
      recordRuntimeSignal({
        level: "error",
        category: "voice_fallback",
        code: "voice_fallback_failed",
        reasonCode: "voice_fallback_failed",
        status: 500,
        error: s(err?.message || err),
      });
      return res
        .type("text/xml")
        .send(createSimpleSayXml("The service is temporarily unavailable."));
    }
  });

  return r;
}

export const __test__ = {
  getTwilioSignatureValidationResult,
};

