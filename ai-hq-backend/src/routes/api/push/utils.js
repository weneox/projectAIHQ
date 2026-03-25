import { fixText, deepFix } from "../../../utils/textFix.js";

export function s(v, d = "") {
  return String(v ?? d).trim();
}

export function isObject(v) {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

export function normalizeRecipient(v) {
  return fixText(s(v || "ceo")) || "ceo";
}

export function normalizePushSubscription(body = {}) {
  const sub = body?.subscription || body?.sub || null;

  return {
    subscription: sub,
    endpoint: s(sub?.endpoint),
    p256dh: s(sub?.keys?.p256dh),
    auth: s(sub?.keys?.auth),
  };
}

export function normalizePushTestPayload(body = {}) {
  return {
    title: fixText(s(body?.title || "AI HQ Test")),
    body: fixText(s(body?.body || "Push is working ✅")),
    data: isObject(body?.data) ? deepFix(body.data) : { type: "push.test" },
  };
}