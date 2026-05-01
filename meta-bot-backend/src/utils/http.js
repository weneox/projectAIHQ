// src/utils/http.js
import { PUBLIC_BASE_URL } from "../config.js";

export function safeStr(x) {
  return typeof x === "string" ? x : "";
}

// Proxy arxasında düzgün baseUrl (Railway üçün)
export function getBaseUrl(req = {}) {
  if (PUBLIC_BASE_URL) return PUBLIC_BASE_URL;

  const headers = req?.headers || {};
  const forwardedProto =
    headers["x-forwarded-proto"] ||
    headers["x-forwarded-protocol"] ||
    headers["x-url-scheme"];

  const requestProtocol = req?.socket ? req.protocol : "";
  const proto = (forwardedProto || requestProtocol || "https")
    .toString()
    .split(",")[0]
    .trim();

  const host = (headers["x-forwarded-host"] || headers.host || "")
    .toString()
    .split(",")[0]
    .trim();

  return host ? `${proto}://${host}` : "";
}
