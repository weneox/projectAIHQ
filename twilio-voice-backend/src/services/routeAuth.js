import crypto from "crypto";
import twilio from "twilio";

import { cfg } from "../config.js";
import { getBaseUrlFromReq } from "./twiml.js";
import {
  incrementRuntimeMetric,
  recordRuntimeSignal,
} from "./runtimeObservability.js";

function s(v, d = "") {
  return String(v ?? d).trim();
}

export function getTwilioSignatureValidationResult(req) {
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

export function requireTwilioSignature(req, res, next) {
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

export function requireInternalToken(req, res, next) {
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

  const providedBuffer = Buffer.from(provided, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");
  const authorized =
    providedBuffer.length === expectedBuffer.length &&
    crypto.timingSafeEqual(providedBuffer, expectedBuffer);

  if (!provided || !authorized) {
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
