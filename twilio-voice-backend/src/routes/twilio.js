import express from "express";
import twilio from "../vendor/twilioImport.js";
import { cfg } from "../config.js";
import { resolveTenantFromRequest } from "../services/tenantResolver.js";
import { getTenantVoiceConfig } from "../services/tenantConfig.js";
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

function getBaseUrlFromReq(req) {
  const envBase = s(cfg.PUBLIC_BASE_URL);
  if (envBase) return envBase.replace(/\/+$/, "");

  const proto = (req.headers["x-forwarded-proto"] || req.protocol || "https")
    .toString()
    .split(",")[0]
    .trim();

  const host = (req.headers["x-forwarded-host"] || req.get("host") || "")
    .toString()
    .split(",")[0]
    .trim();

  return `${proto}://${host}`.replace(/\/+$/, "");
}

function toWsUrl(httpUrl) {
  return httpUrl.replace(/^https:\/\//i, "wss://").replace(/^http:\/\//i, "ws://");
}

function getTwilioSignatureValidationResult(req) {
  if (!cfg.TWILIO_AUTH_TOKEN) {
    recordRuntimeSignal({
      level: "error",
      category: "voice_route",
      code: "twilio_auth_not_configured",
      reasonCode: "twilio_auth_not_configured",
    });
    return {
      ok: false,
      status: 500,
      error: "twilio_auth_not_configured",
    };
  }

  try {
    const signature = req.header("X-Twilio-Signature") || "";
    const base = (cfg.PUBLIC_BASE_URL || getBaseUrlFromReq(req)).replace(/\/+$/, "");
    const url = base + req.originalUrl;
    const params = req.body && typeof req.body === "object" ? req.body : {};
    const ok = !!twilio.validateRequest(cfg.TWILIO_AUTH_TOKEN, signature, url, params);
    return {
      ok,
      status: ok ? 200 : 403,
      error: ok ? "" : "invalid_twilio_signature",
    };
  } catch {
    return {
      ok: false,
      status: 403,
      error: "invalid_twilio_signature",
    };
  }
}

function requireTwilioSignature(req, res, next) {
  const result = getTwilioSignatureValidationResult(req);
  if (result.ok) return next();
  incrementRuntimeMetric(`twilio_signature_failures_total:${s(result.error || "unknown")}`);
  recordRuntimeSignal({
    level: "warn",
    category: "voice_route",
    code: "twilio_signature_failed",
    reasonCode: s(result.error || "unknown"),
    status: Number(result.status || 403),
  });
  return res.status(result.status || 403).type("text/plain").send(result.error || "Forbidden");
}

function requireInternalToken(req, res, next) {
  const expected = s(cfg.AIHQ_INTERNAL_TOKEN);
  const provided = s(req.headers["x-internal-token"] || req.headers.authorization).replace(
    /^Bearer\s+/i,
    ""
  );

  if (!expected) {
    incrementRuntimeMetric("twilio_internal_auth_failures_total:misconfigured");
    recordRuntimeSignal({
      level: "error",
      category: "internal_auth",
      code: "twilio_internal_auth_misconfigured",
      reasonCode: "misconfigured",
      status: 500,
    });
    return res.status(500).json({
      ok: false,
      error: "internal_auth_misconfigured",
    });
  }

  if (!provided || provided !== expected) {
    incrementRuntimeMetric("twilio_internal_auth_failures_total:unauthorized");
    recordRuntimeSignal({
      level: "warn",
      category: "internal_auth",
      code: "twilio_internal_auth_unauthorized",
      reasonCode: "unauthorized",
      status: 401,
    });
    return res.status(401).json({
      ok: false,
      error: "unauthorized",
    });
  }

  return next();
}

function createVoiceResponseXml({ wsUrl, from, to, tenantKey }) {
  const vr = new twilio.twiml.VoiceResponse();
  const connect = vr.connect();
  const stream = connect.stream({ url: wsUrl });

  stream.parameter({
    name: "From",
    value: s(from),
  });

  stream.parameter({
    name: "To",
    value: s(to),
  });

  stream.parameter({
    name: "TenantKey",
    value: s(tenantKey),
  });

  return vr.toString();
}

function createTransferResponseXml({
  operatorPhone,
  callerId,
  transferText,
  unavailableText,
}) {
  const vr = new twilio.twiml.VoiceResponse();

  if (!s(operatorPhone)) {
    vr.say({ voice: "alice" }, unavailableText || "Operator is not available right now.");
    return vr.toString();
  }

  vr.say({ voice: "alice" }, transferText || "Okay, I will connect you now.");

  const dial = vr.dial({
    callerId: s(callerId) || undefined,
    timeout: 25,
  });

  dial.number(operatorPhone);

  vr.say({ voice: "alice" }, unavailableText || "Operator is not available right now.");

  return vr.toString();
}

function createSimpleSayXml(text) {
  const vr = new twilio.twiml.VoiceResponse();
  vr.say({ voice: "alice" }, s(text, "The service is temporarily unavailable."));
  return vr.toString();
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

function getOperatorRouting(tenantConfig = null) {
  const routing = isObj(tenantConfig?.operatorRouting) ? tenantConfig.operatorRouting : {};
  const departments = isObj(routing.departments) ? routing.departments : {};

  return {
    mode: s(
      routing.mode ||
        tenantConfig?.voiceProfile?.transferMode ||
        tenantConfig?.operator?.mode,
      "manual"
    ).toLowerCase(),
    defaultDepartment: s(routing.defaultDepartment).toLowerCase(),
    departments,
  };
}

function getDepartmentEntry(tenantConfig, departmentKey) {
  const routing = getOperatorRouting(tenantConfig);
  const key = s(departmentKey).toLowerCase();
  if (!key) return null;

  const item = routing.departments?.[key];
  return isObj(item) ? item : null;
}

function resolveDepartmentForTransfer(tenantConfig, requestedDepartment = "") {
  const routing = getOperatorRouting(tenantConfig);
  const requested = s(requestedDepartment).toLowerCase();

  if (requested) {
    const item = getDepartmentEntry(tenantConfig, requested);
    if (item && String(item.enabled ?? "true").trim() !== "false" && s(item.phone)) {
      return requested;
    }

    const fb = s(item?.fallbackDepartment).toLowerCase();
    if (fb) {
      const fbItem = getDepartmentEntry(tenantConfig, fb);
      if (fbItem && String(fbItem.enabled ?? "true").trim() !== "false" && s(fbItem.phone)) {
        return fb;
      }
    }
  }

  const def = s(routing.defaultDepartment).toLowerCase();
  if (def) {
    const defItem = getDepartmentEntry(tenantConfig, def);
    if (defItem && String(defItem.enabled ?? "true").trim() !== "false" && s(defItem.phone)) {
      return def;
    }
  }

  for (const [key, value] of Object.entries(routing.departments || {})) {
    if (!isObj(value)) continue;
    if (String(value.enabled ?? "true").trim() === "false") continue;
    if (s(value.phone)) return s(key).toLowerCase();
  }

  return "";
}

function getRequestedDepartment(req) {
  return s(
    req.body?.department ||
      req.body?.Department ||
      req.query?.department ||
      req.query?.Department ||
      req.body?.targetDepartment ||
      req.query?.targetDepartment
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
  service: "twilio-voice-backend",
  component: "twilio-routes",
});

export function twilioRouter() {
  const r = express.Router();

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

      const xml = createVoiceResponseXml({
        wsUrl,
        from,
        to,
        tenantKey,
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

  r.post("/twilio/voice/fallback", async (req, res) => {
    const logger = (req.log || routeLogger).child({ route: "twilio-voice-fallback" });
    try {
      const tenant = await resolveTenantFromRequest(req).catch(() => null);
      const tenantConfigResult = await getTenantVoiceConfig({
        tenant,
        requestContext: {
          requestId: s(req.requestId),
          correlationId: s(req.correlationId),
        },
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
