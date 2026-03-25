import { hashUserPassword } from "../../../utils/adminAuth.js";

export function ok(res, data = {}) {
  return res.status(200).json({ ok: true, ...data });
}

export function bad(res, error, extra = {}) {
  return res.status(400).json({ ok: false, error, ...extra });
}

export function forbidden(res, error = "Forbidden", extra = {}) {
  return res.status(403).json({ ok: false, error, ...extra });
}

export function unauth(res, error = "Unauthorized", extra = {}) {
  return res.status(401).json({ ok: false, error, ...extra });
}

export function serverErr(res, error, extra = {}) {
  return res.status(500).json({ ok: false, error, ...extra });
}

export function safeJsonObj(v, fallback = {}) {
  if (v && typeof v === "object" && !Array.isArray(v)) return v;
  return fallback;
}

export function cleanString(v, fallback = "") {
  if (v === null || v === undefined) return String(fallback ?? "").trim();
  const s = String(v).trim();
  if (!s) return String(fallback ?? "").trim();
  if (s.toLowerCase() === "null" || s.toLowerCase() === "undefined") {
    return String(fallback ?? "").trim();
  }
  return s;
}

export function cleanNullableString(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s) return null;
  if (s.toLowerCase() === "null" || s.toLowerCase() === "undefined") return null;
  return s;
}

export function cleanLower(v, fallback = "") {
  return cleanString(v, fallback).toLowerCase();
}

export function hasDb(db) {
  return !!db?.query;
}

export function buildUserInput(body = {}) {
  const input = safeJsonObj(body, {});

  const out = {
    user_email: cleanLower(input.user_email),
    full_name: cleanString(input.full_name),
    role: cleanLower(input.role || "member"),
    status: cleanLower(input.status || "invited"),
    permissions: safeJsonObj(input.permissions, {}),
    meta: safeJsonObj(input.meta, {}),
    auth_provider: cleanLower(input.auth_provider || "local"),
    email_verified:
      typeof input.email_verified === "boolean" ? input.email_verified : true,
    last_seen_at: input.last_seen_at || null,
    last_login_at: input.last_login_at || null,
  };

  if (Object.prototype.hasOwnProperty.call(input, "password")) {
    const password = cleanString(input.password);
    out.password_hash = password ? hashUserPassword(password) : null;
  }

  if (Object.prototype.hasOwnProperty.call(input, "password_hash")) {
    out.password_hash = cleanNullableString(input.password_hash);
  }

  if (Object.prototype.hasOwnProperty.call(input, "session_version")) {
    out.session_version = Number(input.session_version);
  }

  return out;
}