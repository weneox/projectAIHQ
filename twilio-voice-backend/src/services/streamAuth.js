import crypto from "crypto";
import { cfg } from "../config.js";

function s(v, d = "") {
  return String(v ?? d).trim();
}

function lower(v, d = "") {
  return s(v, d).toLowerCase();
}

function n(v, d = 0) {
  const x = Number(v);
  return Number.isFinite(x) ? x : d;
}

function base64UrlEncode(value = "") {
  return Buffer.from(String(value), "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlDecode(value = "") {
  const input = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
  const padded = input + "=".repeat((4 - (input.length % 4)) % 4);
  return Buffer.from(padded, "base64").toString("utf8");
}

function signingSecret() {
  return s(cfg.TWILIO_AUTH_TOKEN || cfg.AIHQ_INTERNAL_TOKEN);
}

function sign(payloadPart = "") {
  return base64UrlEncode(
    crypto.createHmac("sha256", signingSecret()).update(payloadPart).digest("base64")
  );
}

function safeEq(a, b) {
  const aa = Buffer.from(String(a || ""));
  const bb = Buffer.from(String(b || ""));
  if (aa.length !== bb.length) return false;
  try {
    return crypto.timingSafeEqual(aa, bb);
  } catch {
    return false;
  }
}

export function createTwilioStreamToken({
  tenantKey = "",
  from = "",
  to = "",
  callSid = "",
  ttlSeconds = n(cfg.TWILIO_STREAM_TOKEN_TTL_SECONDS, 300),
} = {}) {
  if (!signingSecret()) {
    throw new Error("twilio_stream_auth_not_configured");
  }

  const payload = {
    v: 1,
    tenantKey: lower(tenantKey),
    from: s(from),
    to: s(to),
    callSid: s(callSid),
    exp: Math.floor(Date.now() / 1000) + Math.max(30, Math.min(900, n(ttlSeconds, 300))),
    nonce: crypto.randomUUID(),
  };

  const payloadPart = base64UrlEncode(JSON.stringify(payload));
  return `${payloadPart}.${sign(payloadPart)}`;
}

export function appendTwilioStreamToken(wsUrl = "", token = "") {
  const url = new URL(wsUrl);
  url.searchParams.set("streamToken", token);
  return url.toString();
}

export function verifyTwilioStreamToken(token = "") {
  if (!signingSecret()) {
    return { ok: false, status: 500, error: "twilio_stream_auth_not_configured" };
  }

  const [payloadPart, signature] = s(token).split(".");
  if (!payloadPart || !signature || !safeEq(signature, sign(payloadPart))) {
    return { ok: false, status: 401, error: "invalid_twilio_stream_token" };
  }

  let payload = null;
  try {
    payload = JSON.parse(base64UrlDecode(payloadPart));
  } catch {
    return { ok: false, status: 401, error: "invalid_twilio_stream_token" };
  }

  const exp = n(payload?.exp, 0);
  if (!exp || exp < Math.floor(Date.now() / 1000)) {
    return { ok: false, status: 401, error: "expired_twilio_stream_token" };
  }

  if (!lower(payload?.tenantKey) || !s(payload?.callSid)) {
    return { ok: false, status: 401, error: "incomplete_twilio_stream_token" };
  }

  return { ok: true, payload };
}

export function verifyTwilioStreamRequest(req = {}) {
  let token = "";
  try {
    const url = new URL(req.url || "", "https://twilio-stream.local");
    token = s(url.searchParams.get("streamToken") || url.searchParams.get("token"));
  } catch {}

  return verifyTwilioStreamToken(token);
}

export function verifyTwilioStartPayload(authPayload = {}, start = {}) {
  const params = start?.customParameters || {};
  const mismatches = [];

  const checks = [
    ["tenantKey", lower(params.TenantKey), lower(authPayload.tenantKey)],
    ["callSid", s(start.callSid), s(authPayload.callSid)],
    ["from", s(params.From), s(authPayload.from)],
    ["to", s(params.To), s(authPayload.to)],
  ];

  for (const [field, actual, expected] of checks) {
    if (expected && actual !== expected) mismatches.push(field);
  }

  if (mismatches.length) {
    return {
      ok: false,
      error: "twilio_stream_start_mismatch",
      mismatches,
    };
  }

  return { ok: true };
}
