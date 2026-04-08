import crypto from "crypto";

import { cfg } from "../../../config.js";

const WEBSITE_WIDGET_SESSION_VERSION = 2;
const WEBSITE_WIDGET_BOOTSTRAP_VERSION = 1;
const WEBSITE_WIDGET_SESSION_KIND = "website_widget_session";
const WEBSITE_WIDGET_BOOTSTRAP_KIND = "website_widget_bootstrap";
const DEFAULT_WIDGET_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const DEFAULT_WIDGET_BOOTSTRAP_TTL_MS = 5 * 60 * 1000;

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

function issueTypedToken(payload = {}) {
  const payloadB64 = encodePayload(payload);
  const signature = signPayload(payloadB64);

  return {
    token: `${payloadB64}.${signature}`,
    payload,
  };
}

function verifyTypedToken(token = "", { expectedKind = "", errorPrefix = "website_widget_token" } = {}) {
  const raw = s(token);
  if (!raw) {
    return {
      ok: false,
      error: `${errorPrefix}_missing`,
    };
  }

  const [payloadB64, signature] = raw.split(".");
  if (!payloadB64 || !signature) {
    return {
      ok: false,
      error: `${errorPrefix}_invalid`,
    };
  }

  const expected = signPayload(payloadB64);
  if (!safeEquals(signature, expected)) {
    return {
      ok: false,
      error: `${errorPrefix}_invalid`,
    };
  }

  let payload;
  try {
    payload = JSON.parse(decodePayload(payloadB64));
  } catch {
    return {
      ok: false,
      error: `${errorPrefix}_invalid`,
    };
  }

  if (expectedKind && s(payload?.kind) !== expectedKind) {
    return {
      ok: false,
      error: `${errorPrefix}_invalid`,
    };
  }

  return {
    ok: true,
    payload,
  };
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
    kind: WEBSITE_WIDGET_SESSION_KIND,
    tenantId: s(input.tenantId || input.tenant_id),
    tenantKey: s(input.tenantKey || input.tenant_key).toLowerCase(),
    widgetId: s(input.widgetId || input.widget_id).toLowerCase(),
    sessionId: s(input.sessionId || input.session_id) || crypto.randomUUID(),
    visitorId: s(input.visitorId || input.visitor_id) || crypto.randomUUID(),
    threadId: s(input.threadId || input.thread_id),
    installId: s(input.installId || input.install_id),
    installOrigin: s(input.installOrigin || input.install_origin).toLowerCase(),
    installHost: s(input.installHost || input.install_host).toLowerCase(),
    pageUrl: s(input.pageUrl || input.page_url),
    pageTitle: s(input.pageTitle || input.page_title),
    pageReferrer: s(input.pageReferrer || input.page_referrer),
    matchedBy: s(input.matchedBy || input.matched_by),
    matchedValue: s(input.matchedValue || input.matched_value),
    issuedAt,
    expiresAt,
  };
}

export function normalizeWebsiteWidgetBootstrapToken(input = {}) {
  const now = Date.now();
  const issuedAt = Math.max(0, n(input.issuedAt || input.iat, now));
  const expiresAt = Math.max(
    issuedAt + 60_000,
    n(input.expiresAt || input.exp, issuedAt + DEFAULT_WIDGET_BOOTSTRAP_TTL_MS)
  );

  return {
    v: WEBSITE_WIDGET_BOOTSTRAP_VERSION,
    kind: WEBSITE_WIDGET_BOOTSTRAP_KIND,
    tenantId: s(input.tenantId || input.tenant_id),
    tenantKey: s(input.tenantKey || input.tenant_key).toLowerCase(),
    widgetId: s(input.widgetId || input.widget_id).toLowerCase(),
    installId: s(input.installId || input.install_id) || crypto.randomUUID(),
    installOrigin: s(input.installOrigin || input.install_origin).toLowerCase(),
    installHost: s(input.installHost || input.install_host).toLowerCase(),
    pageUrl: s(input.pageUrl || input.page_url),
    pageTitle: s(input.pageTitle || input.page_title),
    pageReferrer: s(input.pageReferrer || input.page_referrer),
    matchedBy: s(input.matchedBy || input.matched_by),
    matchedValue: s(input.matchedValue || input.matched_value),
    issuedAt,
    expiresAt,
  };
}

export function issueWebsiteWidgetSession(input = {}) {
  const payload = normalizeWebsiteWidgetSession(input);
  return issueTypedToken(payload);
}

export function verifyWebsiteWidgetSessionToken(token = "") {
  const verified = verifyTypedToken(token, {
    expectedKind: WEBSITE_WIDGET_SESSION_KIND,
    errorPrefix: "website_widget_session",
  });
  if (!verified.ok) return verified;

  const normalized = normalizeWebsiteWidgetSession(verified.payload);
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

export function issueWebsiteWidgetBootstrapToken(input = {}) {
  const payload = normalizeWebsiteWidgetBootstrapToken(input);
  return issueTypedToken(payload);
}

export function verifyWebsiteWidgetBootstrapToken(token = "") {
  const verified = verifyTypedToken(token, {
    expectedKind: WEBSITE_WIDGET_BOOTSTRAP_KIND,
    errorPrefix: "website_widget_bootstrap",
  });
  if (!verified.ok) return verified;

  const normalized = normalizeWebsiteWidgetBootstrapToken(verified.payload);
  if (normalized.expiresAt <= Date.now()) {
    return {
      ok: false,
      error: "website_widget_bootstrap_expired",
      payload: normalized,
    };
  }

  return {
    ok: true,
    payload: normalized,
  };
}

export const __test__ = {
  normalizeWebsiteWidgetBootstrapToken,
  normalizeWebsiteWidgetSession,
  signPayload,
};
