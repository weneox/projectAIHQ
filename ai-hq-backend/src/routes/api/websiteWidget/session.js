import crypto from "crypto";

import { cfg } from "../../../config.js";

const WEBSITE_WIDGET_SESSION_VERSION = 1;
const DEFAULT_WIDGET_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function s(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function n(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function safeEquals(left = "", right = "") {
  const a = Buffer.from(s(left));
  const b = Buffer.from(s(right));

  if (!a.length || !b.length || a.length !== b.length) return false;

  try {
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function encodePayload(payload = {}) {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function decodePayload(payloadB64 = "") {
  return Buffer.from(s(payloadB64), "base64url").toString("utf8");
}

function signPayload(payloadB64 = "") {
  return crypto
    .createHmac("sha256", websiteWidgetSessionSecret())
    .update(s(payloadB64))
    .digest("base64url");
}

export function websiteWidgetSessionSecret() {
  return (
    s(cfg?.auth?.userSessionSecret) ||
    s(cfg?.auth?.adminSessionSecret) ||
    s(cfg?.security?.aihqInternalToken) ||
    "aihq-widget-dev-secret"
  );
}

export function normalizeWebsiteWidgetSession(input = {}) {
  const now = Date.now();
  const issuedAt = Math.max(0, n(input.issuedAt || input.iat, now));
  const expiresAt = Math.max(
    issuedAt + 60_000,
    n(input.expiresAt || input.exp, issuedAt + DEFAULT_WIDGET_SESSION_TTL_MS)
  );

  return {
    v: WEBSITE_WIDGET_SESSION_VERSION,
    tenantId: s(input.tenantId || input.tenant_id),
    tenantKey: s(input.tenantKey || input.tenant_key).toLowerCase(),
    sessionId: s(input.sessionId || input.session_id) || crypto.randomUUID(),
    visitorId: s(input.visitorId || input.visitor_id) || crypto.randomUUID(),
    threadId: s(input.threadId || input.thread_id),
    issuedAt,
    expiresAt,
  };
}

export function issueWebsiteWidgetSession(input = {}) {
  const payload = normalizeWebsiteWidgetSession(input);
  const payloadB64 = encodePayload(payload);
  const signature = signPayload(payloadB64);

  return {
    token: `${payloadB64}.${signature}`,
    payload,
  };
}

export function verifyWebsiteWidgetSessionToken(token = "") {
  const raw = s(token);
  if (!raw) {
    return {
      ok: false,
      error: "website_widget_session_missing",
    };
  }

  const [payloadB64, signature] = raw.split(".");
  if (!payloadB64 || !signature) {
    return {
      ok: false,
      error: "website_widget_session_invalid",
    };
  }

  const expected = signPayload(payloadB64);
  if (!safeEquals(signature, expected)) {
    return {
      ok: false,
      error: "website_widget_session_invalid",
    };
  }

  let payload;
  try {
    payload = JSON.parse(decodePayload(payloadB64));
  } catch {
    return {
      ok: false,
      error: "website_widget_session_invalid",
    };
  }

  const normalized = normalizeWebsiteWidgetSession(payload);
  if (normalized.expiresAt <= Date.now()) {
    return {
      ok: false,
      error: "website_widget_session_expired",
      payload: normalized,
    };
  }

  return {
    ok: true,
    payload: normalized,
  };
}

export const __test__ = {
  normalizeWebsiteWidgetSession,
  signPayload,
};
