import crypto from "crypto";
import { cfg } from "../../../config.js";

export function s(v, d = "") {
  return String(v ?? d).trim();
}

export function lower(v, d = "") {
  return s(v, d).toLowerCase();
}

export function cleanNullable(v) {
  const x = s(v);
  return x || null;
}

export function ok(res, data = {}) {
  return res.status(200).json({ ok: true, ...data });
}

export function bad(res, error, extra = {}) {
  return res.status(400).json({ ok: false, error, ...extra });
}

export function unauth(res, error = "Unauthorized", extra = {}) {
  return res.status(401).json({ ok: false, error, ...extra });
}

export function serverErr(res, error, extra = {}) {
  return res.status(500).json({ ok: false, error, ...extra });
}

export function stateSecret() {
  return s(
    cfg.auth.userSessionSecret ||
      cfg.auth.adminSessionSecret ||
      cfg.meta.appSecret,
    ""
  );
}

export function signState(payload) {
  const json = JSON.stringify(payload || {});
  const body = Buffer.from(json, "utf8").toString("base64url");
  const sig = crypto
    .createHmac("sha256", stateSecret())
    .update(body)
    .digest("base64url");
  return `${body}.${sig}`;
}

export function verifyState(raw) {
  try {
    const token = s(raw);
    if (!token || !token.includes(".")) return null;

    const [body, sig] = token.split(".");
    if (!body || !sig) return null;

    const expected = crypto
      .createHmac("sha256", stateSecret())
      .update(body)
      .digest("base64url");

    if (expected !== sig) return null;

    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!parsed || typeof parsed !== "object") return null;

    const now = Date.now();
    const exp = Number(parsed.exp || 0);
    if (!Number.isFinite(exp) || now > exp) return null;

    return parsed;
  } catch {
    return null;
  }
}

export function redirectBase() {
  const x = s(cfg.urls.channelsReturnUrl);
  if (x) return x;

  const firstCors = s(cfg.urls.corsOrigin)
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean)[0];

  return firstCors || "";
}

export function buildRedirectUrl(params = {}) {
  const base = redirectBase();
  if (!base) return "";

  const u = new URL(base);
  for (const [k, v] of Object.entries(params)) {
    if (v == null || v === "") continue;
    u.searchParams.set(k, String(v));
  }
  return u.toString();
}

export function metaGraphBase() {
  return `https://graph.facebook.com/${s(cfg.meta.apiVersion, "v23.0")}`;
}

export async function readJsonSafe(res) {
  const text = await res.text().catch(() => "");
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

export async function fetchJson(url, opts = {}) {
  const res = await fetch(url, opts);
  const json = await readJsonSafe(res);

  if (!res.ok) {
    const msg = json?.error?.message || json?.message || `HTTP ${res.status}`;
    throw new Error(msg);
  }

  return json;
}

export function getReqTenantKey(req) {
  return lower(req?.auth?.tenantKey || "");
}

export function getReqActor(req) {
  return s(req?.auth?.email || req?.auth?.userId || "system");
}