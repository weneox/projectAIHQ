// src/api/client.js
// FINAL v1.2 - resilient API client for same-origin or explicit API base

const RAW = String(import.meta.env?.VITE_API_BASE ?? "").trim();
const API_BASE = RAW ? RAW.replace(/\/+$/, "") : "";

function s(v, d = "") {
  return String(v ?? d).trim();
}

function isAbsoluteUrl(value = "") {
  return /^https?:\/\//i.test(s(value));
}

function isPlainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function normalizeHeaders(input = {}) {
  if (input instanceof Headers) {
    return Object.fromEntries(input.entries());
  }

  return isPlainObject(input) ? { ...input } : {};
}

function looksLikeHtmlDocument(value = "") {
  const trimmed = s(value);
  if (!trimmed) return false;

  return (
    /^<!doctype html/i.test(trimmed) ||
    /^<html/i.test(trimmed) ||
    trimmed.includes("<head") ||
    trimmed.includes("<body")
  );
}

export function getApiBase() {
  return API_BASE;
}

export function apiUrl(path) {
  const cleanPath = s(path);
  if (!cleanPath) return API_BASE || "";

  if (isAbsoluteUrl(cleanPath)) {
    return cleanPath;
  }

  if (!API_BASE) {
    return cleanPath;
  }

  return `${API_BASE}${cleanPath}`;
}

async function readPayload(response) {
  const text = await response.text().catch(() => "");
  const contentType = s(response.headers.get("content-type")).toLowerCase();

  if (!text) {
    return {};
  }

  if (contentType.includes("application/json")) {
    try {
      return JSON.parse(text);
    } catch {
      return {
        ok: false,
        reason: "Invalid JSON response from API",
        raw: text,
      };
    }
  }

  if (looksLikeHtmlDocument(text)) {
    return {
      ok: false,
      reason:
        "API returned HTML instead of JSON. Check VITE_API_BASE or your /api proxy/backend routing.",
      raw: text.trim().slice(0, 600),
    };
  }

  try {
    return JSON.parse(text);
  } catch {
    return {
      ok: false,
      raw: text,
    };
  }
}

function pickErr(payload, fallback) {
  const reason = s(payload?.reason);
  const message = s(
    payload?.message ||
      payload?.details?.message ||
      payload?.details?.error ||
      payload?.details?.reason
  );
  const errorCode = s(payload?.error);
  const raw = s(payload?.raw);

  if (reason && errorCode && reason.toLowerCase() !== errorCode.toLowerCase()) {
    return `${reason} (${errorCode})`;
  }

  if (reason) return reason;
  if (message) return message;
  if (errorCode) return errorCode;
  if (raw) return raw;

  return fallback;
}

export async function apiRequest(path, options = {}) {
  const {
    method = "GET",
    body,
    headers: extraHeaders,
    credentials = "include",
    allowStatuses = [],
    rawBody = false,
  } = options;

  const url = apiUrl(path);
  const headers = {
    Accept: "application/json",
    ...normalizeHeaders(extraHeaders),
  };

  const init = {
    method,
    credentials,
    headers,
  };

  if (body !== undefined) {
    const hasContentType = Object.keys(headers).some(
      (key) => key.toLowerCase() === "content-type"
    );

    if (rawBody) {
      init.body = body;
    } else {
      if (!hasContentType) {
        headers["Content-Type"] = "application/json; charset=utf-8";
      }
      init.body = JSON.stringify(body ?? {});
    }
  }

  let response;
  try {
    response = await fetch(url, init);
  } catch (e) {
    throw new Error(
      `Network error (${method} ${path}): ${String(e?.message || e)}`
    );
  }

  const payload = await readPayload(response);
  const allowed = Array.isArray(allowStatuses)
    ? allowStatuses.includes(response.status)
    : false;

  if ((!response.ok || payload?.ok === false) && !allowed) {
    const error = new Error(
      pickErr(payload, `${method} ${path} failed (${response.status})`)
    );
    error.status = response.status;
    error.payload = payload;
    error.code = s(payload?.code || payload?.error);
    throw error;
  }

  return payload;
}

export async function apiGet(path, options = {}) {
  return apiRequest(path, { ...options, method: "GET" });
}

export async function apiPost(path, body, options = {}) {
  return apiRequest(path, { ...options, method: "POST", body });
}

export async function apiPut(path, body, options = {}) {
  return apiRequest(path, { ...options, method: "PUT", body });
}

export async function apiPatch(path, body, options = {}) {
  return apiRequest(path, { ...options, method: "PATCH", body });
}

export async function apiDelete(path, options = {}) {
  return apiRequest(path, { ...options, method: "DELETE" });
}
