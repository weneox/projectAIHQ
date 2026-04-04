import crypto from "crypto";

import { CONTACT_EMAIL, META_APP_SECRET } from "../config.js";
import { createAihqMetaChannelLifecycleClient } from "../services/aihqMetaChannelLifecycleClient.js";
import { getBaseUrl, safeStr } from "../utils/http.js";

function s(v, d = "") {
  return String(v ?? d).trim();
}

function decodeBase64Url(value = "") {
  const normalized = s(value).replace(/-/g, "+").replace(/_/g, "/");
  const pad = normalized.length % 4;
  const padded = pad ? normalized.padEnd(normalized.length + (4 - pad), "=") : normalized;
  return Buffer.from(padded, "base64");
}

function parseMetaSignedRequest(raw = "") {
  const signedRequest = s(raw);
  if (!signedRequest || !signedRequest.includes(".")) {
    throw new Error("invalid_signed_request");
  }

  const [encodedSig, encodedPayload] = signedRequest.split(".", 2);
  const signature = decodeBase64Url(encodedSig);
  const payloadBuffer = decodeBase64Url(encodedPayload);
  const expected = crypto
    .createHmac("sha256", s(META_APP_SECRET))
    .update(encodedPayload)
    .digest();

  if (signature.length !== expected.length) {
    throw new Error("invalid_signed_request");
  }

  if (!crypto.timingSafeEqual(signature, expected)) {
    throw new Error("invalid_signed_request");
  }

  const parsed = JSON.parse(payloadBuffer.toString("utf8"));
  if (s(parsed?.algorithm).toUpperCase() !== "HMAC-SHA256") {
    throw new Error("invalid_signed_request_algorithm");
  }

  return parsed;
}

function readSignedRequest(req) {
  if (typeof req.body === "string") {
    return safeStr(req.body);
  }

  return safeStr(req.body?.signed_request || req.query?.signed_request);
}

function toIsoFromUnixSeconds(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return new Date().toISOString();
  return new Date(n * 1000).toISOString();
}

function normalizeDeauthorizePayload(parsed = {}) {
  return {
    metaUserId: s(parsed.user_id),
    pageId: s(parsed.page_id || parsed.profile_id),
    igUserId: s(parsed.ig_user_id || parsed.instagram_business_account_id),
    reasonCode: "meta_app_deauthorized",
    occurredAt: toIsoFromUnixSeconds(parsed.issued_at),
    signedRequestMeta: {
      issuedAt: Number(parsed.issued_at || 0) || null,
      algorithm: s(parsed.algorithm),
    },
  };
}

export function registerPublicPages(
  app,
  {
    lifecycleClient = createAihqMetaChannelLifecycleClient(),
  } = {}
) {
  app.get("/privacy", (req, res) => {
    const b = getBaseUrl(req) || "https://meta-bot-backend-production.up.railway.app";
    res
      .status(200)
      .set("Content-Type", "text/html; charset=utf-8")
      .send(`<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Privacy Policy - NEOX Automation</title>
  <style>
    body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;max-width:900px;margin:40px auto;padding:0 16px;line-height:1.6}
    code{background:#f2f2f2;padding:2px 6px;border-radius:6px}
  </style>
</head>
<body>
  <h1>Privacy Policy</h1>
  <p>This service receives Instagram/WhatsApp webhook events so connected businesses can automate customer replies with tenant-specific runtime and settings.</p>

  <h2>Data we process</h2>
  <ul>
    <li>Message text (only when a message is received)</li>
    <li>Sender/user identifier (platform user id / wa_id)</li>
    <li>Timestamp and minimal metadata</li>
  </ul>

  <h2>How we use data</h2>
  <ul>
    <li>Deliver tenant-specific automation and operator workflows for inbound customer conversations.</li>
    <li>We do not sell personal data.</li>
  </ul>

  <h2>Data retention</h2>
  <p>We keep only the minimum records required for reliability, auditability, and customer support. You may request deletion.</p>

  <h2>Data deletion request</h2>
  <p>Deletion URL: <code>${b}/instagram/data-deletion</code></p>

  <h2>Contact</h2>
  <p>Email: <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a></p>
</body>
</html>`);
  });

  app.get("/terms", (_req, res) => {
    res
      .status(200)
      .set("Content-Type", "text/html; charset=utf-8")
      .send(`<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Terms of Service - NEOX Automation</title>
  <style>
    body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;max-width:900px;margin:40px auto;padding:0 16px;line-height:1.6}
  </style>
</head>
<body>
  <h1>Terms of Service</h1>
  <p>This service processes inbound customer conversations for connected businesses.</p>
  <ul>
    <li>You agree that supported messages may be processed to generate replies and trigger workflows.</li>
    <li>We do not sell personal data.</li>
    <li>You can request deletion of your data using the data deletion endpoint.</li>
  </ul>
  <p>Contact: <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a></p>
</body>
</html>`);
  });

  app.get("/instagram/deauthorize", (_req, res) =>
    res.status(200).send("Meta deauthorize callback ready")
  );

  app.post("/instagram/deauthorize", async (req, res) => {
    try {
      const signedRequest = readSignedRequest(req);
      if (!signedRequest) {
        return res.status(400).json({ ok: false, error: "missing_signed_request" });
      }

      if (!s(META_APP_SECRET)) {
        return res.status(500).json({ ok: false, error: "meta_app_secret_missing" });
      }

      const parsed = parseMetaSignedRequest(signedRequest);
      const payload = normalizeDeauthorizePayload(parsed);

      const internalResult = await lifecycleClient.signalDeauthorize(payload, {
        requestId: req.requestId,
        correlationId: req.correlationId,
      });

      return res.status(200).json({
        ok: true,
        processed: internalResult.ok,
        reasonCode: payload.reasonCode,
        occurredAt: payload.occurredAt,
        tenantMatched: Boolean(internalResult?.json?.tenantKey),
        internalStatus: Number(internalResult?.status || 0),
        internalError: internalResult.ok ? "" : s(internalResult?.error),
      });
    } catch (error) {
      return res.status(400).json({
        ok: false,
        error: s(error?.message || "invalid_signed_request"),
      });
    }
  });

  app.get("/instagram/data-deletion", (req, res) => {
    const b = getBaseUrl(req) || "https://meta-bot-backend-production.up.railway.app";
    res
      .status(200)
      .set("Content-Type", "text/html; charset=utf-8")
      .send(`<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Data Deletion</title>
</head>
<body style="font-family:system-ui;padding:24px;line-height:1.6">
  <h2>Data deletion requests</h2>
  <p>Submit a POST request to <code>${b}/instagram/data-deletion</code> to receive a confirmation code.</p>
  <p>Requests are acknowledged immediately and processed through support/compliance handling.</p>
</body>
</html>`);
  });

  app.post("/instagram/data-deletion", (req, res) => {
    const b = getBaseUrl(req) || "https://meta-bot-backend-production.up.railway.app";
    const confirmationCode = `del_${Date.now()}`;

    res.status(200).json({
      url: `${b}/instagram/data-deletion/status?code=${encodeURIComponent(confirmationCode)}`,
      confirmation_code: confirmationCode,
      status: "received",
    });
  });

  app.get("/instagram/data-deletion/status", (req, res) => {
    const code = safeStr(req.query.code);
    res
      .status(200)
      .set("Content-Type", "text/html; charset=utf-8")
      .send(`<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Data Deletion Status</title>
</head>
<body style="font-family:system-ui;padding:24px;line-height:1.6">
  <h2>Data deletion request received</h2>
  <p>Confirmation code: <b>${code || "-"}</b></p>
  <p>Status: queued for review</p>
  <p>If you need help, contact: <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a></p>
</body>
</html>`);
  });
}
