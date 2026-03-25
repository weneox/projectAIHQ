import crypto from "crypto";
import { cfg } from "../config.js";

function s(v, d = "") {
  return String(v ?? d).trim();
}

function lower(v, d = "") {
  return s(v, d).toLowerCase();
}

function base64url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function unbase64url(input) {
  const x = String(input || "")
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const pad = x.length % 4 === 0 ? "" : "=".repeat(4 - (x.length % 4));
  return Buffer.from(x + pad, "base64");
}

function getRealtimeSecret() {
  return s(cfg.auth.userSessionSecret || cfg.auth.adminSessionSecret);
}

function safeEqBuffer(a, b) {
  const aa = Buffer.isBuffer(a) ? a : Buffer.from(a || "");
  const bb = Buffer.isBuffer(b) ? b : Buffer.from(b || "");
  if (aa.length !== bb.length) return false;

  try {
    return crypto.timingSafeEqual(aa, bb);
  } catch {
    return false;
  }
}

function normalizeRole(role = "member") {
  return lower(role || "member");
}

export function isOperatorRealtimeRole(role = "member") {
  return ["owner", "admin", "operator"].includes(normalizeRole(role));
}

export function issueRealtimeTicket({
  userId = "",
  tenantId = "",
  tenantKey = "",
  role = "member",
  ttlSec = 90,
} = {}) {
  const secret = getRealtimeSecret();
  if (!secret) {
    throw new Error("realtime auth secret missing");
  }

  const safeUserId = s(userId);
  const safeTenantId = s(tenantId);
  const safeTenantKey = lower(tenantKey);
  const safeRole = normalizeRole(role);

  if (!safeUserId || !safeTenantId || !safeTenantKey) {
    throw new Error("realtime ticket scope missing");
  }

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    typ: "realtime_ticket",
    userId: safeUserId,
    tenantId: safeTenantId,
    tenantKey: safeTenantKey,
    role: safeRole,
    audience: isOperatorRealtimeRole(safeRole) ? "operator" : "tenant",
    iat: now,
    exp: now + Math.max(15, Number(ttlSec || 90)),
  };

  const encodedPayload = base64url(JSON.stringify(payload));
  const sig = crypto.createHmac("sha256", secret).update(encodedPayload).digest();
  return `${encodedPayload}.${base64url(sig)}`;
}

export function verifyRealtimeTicket(ticket = "") {
  try {
    const secret = getRealtimeSecret();
    if (!secret) {
      return { ok: false, error: "realtime_auth_not_configured" };
    }

    const raw = s(ticket);
    if (!raw || !raw.includes(".")) {
      return { ok: false, error: "invalid_ticket_format" };
    }

    const [payloadB64, sigB64] = raw.split(".");
    if (!payloadB64 || !sigB64) {
      return { ok: false, error: "invalid_ticket_parts" };
    }

    const expectedSig = crypto
      .createHmac("sha256", secret)
      .update(payloadB64)
      .digest();
    const gotSig = unbase64url(sigB64);

    if (!safeEqBuffer(expectedSig, gotSig)) {
      return { ok: false, error: "invalid_ticket_signature" };
    }

    const payload = JSON.parse(unbase64url(payloadB64).toString("utf8") || "{}");
    const now = Math.floor(Date.now() / 1000);

    if (payload?.typ !== "realtime_ticket") {
      return { ok: false, error: "invalid_ticket_type" };
    }

    if (!Number.isFinite(payload?.exp) || now >= Number(payload.exp)) {
      return { ok: false, error: "ticket_expired" };
    }

    const scope = {
      userId: s(payload.userId),
      tenantId: s(payload.tenantId),
      tenantKey: lower(payload.tenantKey),
      role: normalizeRole(payload.role),
      audience: lower(payload.audience || "tenant"),
    };

    if (!scope.userId || !scope.tenantId || !scope.tenantKey) {
      return { ok: false, error: "invalid_ticket_scope" };
    }

    return { ok: true, scope };
  } catch (err) {
    return {
      ok: false,
      error: s(err?.message || err || "ticket_verify_failed"),
    };
  }
}
